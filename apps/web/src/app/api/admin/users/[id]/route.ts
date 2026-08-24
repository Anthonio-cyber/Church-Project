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
import { revokeAllSessions } from '@/lib/auth/session';
import { AUDIT, writeAudit, writeSecurityEvent } from '@/lib/audit';
import { notify } from '@/lib/notifications';
import { ROLE_RANK } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export const GET = route(async (_request: Request, { params }: Params) => {
  const { id } = await params;
  const context = await requirePermission('users.view');

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      status: true,
      statusReason: true,
      createdAt: true,
      lastLoginAt: true,
      mfaEnabled: true,
      mfaRequired: true,
      emailVerifiedAt: true,
      isDemoAccount: true,
      profile: true,
      roles: { select: { role: { select: { key: true, name: true } }, assignedAt: true } },
      ministryCenter: { select: { id: true, name: true } },
      sessions: {
        where: { revokedAt: null, expiresAt: { gt: new Date() } },
        select: { id: true, ipAddress: true, userAgent: true, lastSeenAt: true, deviceLabel: true },
      },
      _count: {
        select: {
          counsellingRequests: true,
          prayerRequests: true,
          reportsFiled: true,
          reportsAbout: true,
        },
      },
    },
  });

  if (!user) throw new ApiError(404, 'not_found', 'That account could not be found.');

  const roles = user.roles.map((r) => r.role.key);
  const rank = roles.reduce((max, key) => Math.max(max, ROLE_RANK[key] ?? 0), 0);

  return ok({
    user: {
      ...user,
      roles,
      rank,
      actionable: rank < context.rank,
      // Counts only. An administrator can see that someone has used counselling;
      // they cannot see what was said, and there is no route here that would
      // let them.
      counts: user._count,
    },
  });
});

const patchSchema = z.object({
  action: z.enum([
    'suspend',
    'reinstate',
    'disable',
    'require_mfa',
    'require_password_reset',
    'revoke_sessions',
    'assign_role',
    'remove_role',
    'set_ministry_center',
  ]),
  reason: reasonSchema,
  role: z
    .enum([
      'USER', 'COUNSELLOR', 'PASTOR', 'MINISTRY_LEADER', 'MODERATOR',
      'COUNSELLING_ADMIN', 'CONTENT_ADMIN', 'EVENT_ADMIN', 'SAFEGUARDING_ADMIN',
      'ANALYTICS_ADMIN', 'ADMIN', 'SENIOR_LEADERSHIP_ADMIN', 'SUPER_ADMIN',
    ])
    .optional(),
  ministryCenterId: z.string().uuid().nullable().optional(),
});

/**
 * Administrative actions on a member account.
 *
 * Every branch below passes through two gates before it does anything:
 *   requirePermission — do you hold this specific permission, with MFA and a
 *                       fresh re-authentication where the permission is sensitive;
 *   requireAuthorityOver — is this person actually below you in the hierarchy,
 *                       and is this not your own account.
 *
 * That pairing is what makes an administrator unable to promote themselves,
 * unable to act on a peer, and unable to touch anyone senior to them.
 */
export const PATCH = route(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { id } = await params;
  const base = await requireUser();
  const input = await parseBody(request, patchSchema);

  const target = await prisma.user.findUnique({
    where: { id },
    include: { profile: true },
  });
  if (!target) throw new ApiError(404, 'not_found', 'That account could not be found.');

  const permissionFor = {
    suspend: 'users.suspend',
    reinstate: 'users.suspend',
    disable: 'users.suspend',
    require_mfa: 'users.require_mfa',
    require_password_reset: 'users.edit',
    revoke_sessions: 'users.force_logout',
    assign_role: 'users.assign_role',
    remove_role: 'users.assign_role',
    set_ministry_center: 'users.edit',
  } as const;

  const context = await requirePermission(permissionFor[input.action], {
    context: base,
    reason: input.reason,
    targetType: 'user',
    targetId: id,
  });

  await requireAuthorityOver(context, id);

  const auditBase = {
    actorId: context.user.id,
    actorEmail: context.user.email,
    actorRole: context.roles.join(','),
    targetType: 'user',
    targetId: id,
    reason: input.reason,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  };

  switch (input.action) {
    case 'suspend': {
      await prisma.user.update({
        where: { id },
        data: { status: 'SUSPENDED', statusReason: input.reason },
      });
      await revokeAllSessions(id, 'account_suspended');
      await writeAudit({ ...auditBase, action: AUDIT.USER_SUSPENDED });
      await notify({
        userId: id,
        category: 'SECURITY',
        title: 'Your account has been suspended',
        body: 'Please contact the ministry office if you believe this is a mistake.',
        isCritical: true,
        email: {
          subject: 'Your account status has changed',
          text: 'Your account has been suspended. Please contact the ministry office.',
        },
      });
      return ok({ message: 'Account suspended and all sessions revoked.' });
    }

    case 'reinstate': {
      await prisma.user.update({
        where: { id },
        data: { status: 'ACTIVE', statusReason: null },
      });
      await writeAudit({ ...auditBase, action: AUDIT.USER_REINSTATED });
      await notify({
        userId: id,
        category: 'SECURITY',
        title: 'Your account has been reinstated',
        body: 'You can sign in again.',
        isCritical: true,
      });
      return ok({ message: 'Account reinstated.' });
    }

    case 'disable': {
      await prisma.user.update({
        where: { id },
        data: { status: 'DISABLED', statusReason: input.reason },
      });
      await revokeAllSessions(id, 'account_disabled');
      await writeAudit({ ...auditBase, action: AUDIT.USER_SUSPENDED, metadata: { disabled: true } });
      return ok({ message: 'Account disabled and all sessions revoked.' });
    }

    case 'require_mfa': {
      await prisma.user.update({ where: { id }, data: { mfaRequired: true } });
      await writeAudit({ ...auditBase, action: 'ADMIN_MFA_REQUIRED' });
      await notify({
        userId: id,
        category: 'SECURITY',
        title: 'Multi-factor authentication is now required',
        body: 'Set up an authenticator app from Privacy & Security to keep using your account.',
        isCritical: true,
      });
      return ok({ message: 'Multi-factor authentication is now required for this account.' });
    }

    case 'require_password_reset': {
      await prisma.user.update({ where: { id }, data: { mustChangePassword: true } });
      await revokeAllSessions(id, 'password_reset_required');
      await writeAudit({ ...auditBase, action: 'ADMIN_PASSWORD_RESET_REQUIRED' });
      return ok({ message: 'The member must set a new password at next sign-in.' });
    }

    case 'revoke_sessions': {
      const count = await revokeAllSessions(id, 'admin_revoked');
      await writeSecurityEvent({
        userId: id,
        kind: 'SESSION_REVOKED',
        severity: 'warning',
        detail: `Revoked by administrator: ${input.reason}`,
      });
      await writeAudit({ ...auditBase, action: AUDIT.USER_SESSIONS_REVOKED, metadata: { count } });
      return ok({ message: `Signed out of ${count} device(s).`, count });
    }

    case 'assign_role':
    case 'remove_role': {
      if (!input.role) throw new ApiError(400, 'role_required', 'Choose a role.');

      // You cannot hand out authority you do not hold. This is the check that
      // stops an Administrator making anyone — themselves included — a Super
      // Admin, regardless of what the client sends.
      requireCanGrantRole(context, input.role);

      const role = await prisma.role.findUnique({ where: { key: input.role } });
      if (!role) throw new ApiError(400, 'unknown_role', 'That role does not exist.');

      if (input.action === 'assign_role') {
        await prisma.userRole.upsert({
          where: { userId_roleId: { userId: id, roleId: role.id } },
          create: { userId: id, roleId: role.id, assignedById: context.user.id, reason: input.reason },
          update: { assignedById: context.user.id, reason: input.reason },
        });
        await writeAudit({
          ...auditBase,
          action: AUDIT.ROLE_ASSIGNED,
          metadata: { role: input.role },
        });
        await notify({
          userId: id,
          category: 'ADMINISTRATIVE',
          title: 'Your role has been updated',
          body: `You have been given the ${role.name} role.`,
        });
        return ok({ message: `${role.name} role assigned.` });
      }

      await prisma.userRole.deleteMany({ where: { userId: id, roleId: role.id } });
      await revokeAllSessions(id, 'role_changed');
      await writeAudit({
        ...auditBase,
        action: AUDIT.ROLE_REMOVED,
        metadata: { role: input.role },
      });
      return ok({ message: `${role.name} role removed and sessions refreshed.` });
    }

    case 'set_ministry_center': {
      await prisma.user.update({
        where: { id },
        data: { ministryCenterId: input.ministryCenterId ?? null },
      });
      await writeAudit({
        ...auditBase,
        action: 'ADMIN_MINISTRY_CENTER_SET',
        metadata: { ministryCenterId: input.ministryCenterId ?? null },
      });
      return ok({ message: 'Ministry centre updated.' });
    }
  }
});
