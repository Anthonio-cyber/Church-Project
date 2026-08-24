import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, assertSameOrigin, ok, parseBody, route } from '@/lib/api';
import {
  requireAuthorityOver,
  requireCanGrantRole,
  requirePermission,
  requireUser,
} from '@/lib/auth/context';
import { reasonSchema } from '@/lib/validation';
import { ADMIN_ROLES, ROLE_LABEL, ROLE_RANK } from '@/lib/permissions';
import { revokeAllSessions } from '@/lib/auth/session';
import { AUDIT, writeAudit } from '@/lib/audit';
import { notify } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

/** Every administrator, with their rank, permissions and MFA state. */
export const GET = route(async () => {
  const context = await requirePermission('admins.manage', {
    reason: 'Reviewing administrator appointments.',
  });

  const admins = await prisma.user.findMany({
    where: { roles: { some: { role: { key: { in: ADMIN_ROLES } } } } },
    select: {
      id: true,
      email: true,
      status: true,
      mfaEnabled: true,
      lastLoginAt: true,
      createdAt: true,
      isSeedPlaceholder: true,
      profile: { select: { displayName: true, firstName: true, lastName: true } },
      roles: { select: { role: { select: { key: true, name: true } }, assignedAt: true, assignedById: true, reason: true } },
      permissionOverrides: {
        select: { granted: true, reason: true, expiresAt: true, permission: { select: { key: true } } },
      },
      hierarchyNode: { select: { id: true, title: true, status: true, supervisorId: true, isSeedPlaceholder: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return ok({
    admins: admins.map((admin) => {
      const roles = admin.roles.map((r) => r.role.key);
      const rank = roles.reduce((max, key) => Math.max(max, ROLE_RANK[key] ?? 0), 0);
      return {
        id: admin.id,
        email: admin.email,
        displayName: admin.profile?.displayName ?? '—',
        fullName: admin.profile ? `${admin.profile.firstName} ${admin.profile.lastName}` : '—',
        status: admin.status,
        mfaEnabled: admin.mfaEnabled,
        lastLoginAt: admin.lastLoginAt,
        roles,
        roleLabels: roles.map((role) => ROLE_LABEL[role]),
        rank,
        actionable: rank < context.rank && admin.id !== context.user.id,
        assignments: admin.roles,
        overrides: admin.permissionOverrides.map((override) => ({
          permission: override.permission.key,
          granted: override.granted,
          reason: override.reason,
          expiresAt: override.expiresAt,
        })),
        hierarchyNode: admin.hierarchyNode,
        isSeedPlaceholder: admin.isSeedPlaceholder,
      };
    }),
    viewer: { rank: context.rank, id: context.user.id },
  });
});

const schema = z.object({
  action: z.enum(['appoint', 'remove', 'suspend_access']),
  userId: z.string().uuid(),
  role: z.enum([
    'MODERATOR', 'COUNSELLING_ADMIN', 'CONTENT_ADMIN', 'EVENT_ADMIN',
    'SAFEGUARDING_ADMIN', 'ANALYTICS_ADMIN', 'ADMIN', 'SENIOR_LEADERSHIP_ADMIN', 'SUPER_ADMIN',
  ]),
  reason: reasonSchema,
});

/**
 * Appoint or remove an administrator.
 *
 * Three independent guards run before anything changes, and each answers one of
 * the questions the specification asks explicitly:
 *
 *   requirePermission('admins.manage') — with MFA and fresh re-authentication.
 *   requireAuthorityOver(...)          — refuses self-targeting outright, and
 *                                        refuses anyone of equal or greater rank.
 *   requireCanGrantRole(...)           — refuses to grant a role at or above the
 *                                        actor's own rank.
 *
 * Together: an Administrator cannot make themselves Super Admin, a Senior
 * Leadership Administrator cannot strip the Setman, and no one can quietly
 * promote a peer to outrank them.
 */
export const POST = route(async (request: Request) => {
  assertSameOrigin(request);
  const base = await requireUser();
  const input = await parseBody(request, schema);

  const context = await requirePermission('admins.manage', {
    context: base,
    reason: input.reason,
    targetType: 'user',
    targetId: input.userId,
  });

  await requireAuthorityOver(context, input.userId);
  requireCanGrantRole(context, input.role);

  const target = await prisma.user.findUnique({
    where: { id: input.userId },
    include: { profile: true },
  });
  if (!target) throw new ApiError(404, 'not_found', 'That account could not be found.');

  const role = await prisma.role.findUnique({ where: { key: input.role } });
  if (!role) throw new ApiError(400, 'unknown_role', 'That role does not exist.');

  const auditBase = {
    actorId: context.user.id,
    actorEmail: context.user.email,
    actorRole: context.roles.join(','),
    targetType: 'user',
    targetId: input.userId,
    reason: input.reason,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  };

  if (input.action === 'appoint') {
    await prisma.$transaction(async (tx) => {
      await tx.userRole.upsert({
        where: { userId_roleId: { userId: input.userId, roleId: role.id } },
        create: {
          userId: input.userId,
          roleId: role.id,
          assignedById: context.user.id,
          reason: input.reason,
        },
        update: { assignedById: context.user.id, reason: input.reason },
      });
      // Administrative office carries a standing MFA requirement.
      await tx.user.update({ where: { id: input.userId }, data: { mfaRequired: true } });
    });

    // The appointment takes effect on their next sign-in, so a stale session
    // cannot carry old authorisation into a new office.
    await revokeAllSessions(input.userId, 'role_changed');

    await writeAudit({
      ...auditBase,
      action: AUDIT.ADMIN_APPOINTED,
      metadata: { role: input.role, rank: ROLE_RANK[input.role] },
    });
    await notify({
      userId: input.userId,
      category: 'ADMINISTRATIVE',
      title: 'You have been appointed as an administrator',
      body: `You have been given the ${ROLE_LABEL[input.role]} role. Multi-factor authentication is now required. Please sign in again.`,
      isCritical: true,
      email: {
        subject: 'Your administrative access has changed',
        text: `You have been appointed as ${ROLE_LABEL[input.role]}. Multi-factor authentication is now required on your account.`,
      },
    });

    return ok({ message: `${ROLE_LABEL[input.role]} role granted. Their sessions were refreshed.` });
  }

  if (input.action === 'remove') {
    await prisma.userRole.deleteMany({ where: { userId: input.userId, roleId: role.id } });
    await revokeAllSessions(input.userId, 'role_removed');
    await writeAudit({ ...auditBase, action: AUDIT.ADMIN_REMOVED, metadata: { role: input.role } });
    await notify({
      userId: input.userId,
      category: 'ADMINISTRATIVE',
      title: 'Your administrative access has been removed',
      body: `The ${ROLE_LABEL[input.role]} role has been removed from your account.`,
      isCritical: true,
    });
    return ok({ message: `${ROLE_LABEL[input.role]} role removed and sessions revoked.` });
  }

  await prisma.user.update({
    where: { id: input.userId },
    data: { status: 'SUSPENDED', statusReason: input.reason },
  });
  await revokeAllSessions(input.userId, 'admin_access_suspended');
  await writeAudit({ ...auditBase, action: 'GOVERNANCE_ADMIN_SUSPENDED' });
  return ok({ message: 'Administrative access suspended and all sessions revoked.' });
});
