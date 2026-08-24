import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, assertSameOrigin, ok, parseBody, route } from '@/lib/api';
import {
  requireAuthorityOver,
  requireCanGrantPermission,
  requirePermission,
  requireUser,
} from '@/lib/auth/context';
import { reasonSchema } from '@/lib/validation';
import { ALL_PERMISSIONS, PERMISSIONS, SENSITIVE_PERMISSIONS } from '@/lib/permissions';
import { revokeAllSessions } from '@/lib/auth/session';
import { AUDIT, writeAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/** The permission catalogue and which roles hold what. */
export const GET = route(async () => {
  await requirePermission('permissions.manage', {
    reason: 'Reviewing the permission catalogue.',
  });

  const roles = await prisma.role.findMany({
    orderBy: { rank: 'desc' },
    include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
  });

  return ok({
    catalogue: ALL_PERMISSIONS.map((key) => ({
      key,
      description: PERMISSIONS[key],
      sensitive: SENSITIVE_PERMISSIONS.includes(key),
    })),
    roles: roles.map((role) => ({
      key: role.key,
      name: role.name,
      description: role.description,
      rank: role.rank,
      holders: role._count.users,
      permissions: role.permissions.map((rp) => rp.permission.key),
    })),
  });
});

const schema = z.object({
  userId: z.string().uuid(),
  permission: z.enum(ALL_PERMISSIONS as [string, ...string[]]),
  /** true grants, false denies, null clears the override. */
  granted: z.boolean().nullable(),
  reason: reasonSchema,
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

/**
 * Per-user permission overrides.
 *
 * A grant adds a permission the person's roles do not carry; a denial removes
 * one they would otherwise inherit, and a denial always wins. Both are the
 * mechanism for least privilege in practice: a senior office can be given
 * without also handing over, say, counselling note access.
 *
 * An actor can never grant a permission they do not themselves hold.
 */
export const POST = route(async (request: Request) => {
  assertSameOrigin(request);
  const base = await requireUser();
  const input = await parseBody(request, schema);

  const context = await requirePermission('permissions.manage', {
    context: base,
    reason: input.reason,
    targetType: 'user',
    targetId: input.userId,
  });

  await requireAuthorityOver(context, input.userId);

  if (input.granted === true) {
    requireCanGrantPermission(context, input.permission as never);
  }

  const permission = await prisma.permission.findUnique({
    where: { key: input.permission },
  });
  if (!permission) throw new ApiError(400, 'unknown_permission', 'That permission does not exist.');

  if (input.granted === null) {
    await prisma.userPermissionOverride.deleteMany({
      where: { userId: input.userId, permissionId: permission.id },
    });
    await writeAudit({
      actorId: context.user.id,
      actorEmail: context.user.email,
      actorRole: context.roles.join(','),
      action: AUDIT.PERMISSION_REVOKED,
      targetType: 'user',
      targetId: input.userId,
      reason: input.reason,
      metadata: { permission: input.permission, cleared: true },
      ipAddress: context.ipAddress,
    });
    await revokeAllSessions(input.userId, 'permissions_changed');
    return ok({ message: 'Override cleared. Role permissions apply again.' });
  }

  await prisma.userPermissionOverride.upsert({
    where: {
      userId_permissionId: { userId: input.userId, permissionId: permission.id },
    },
    create: {
      userId: input.userId,
      permissionId: permission.id,
      granted: input.granted,
      reason: input.reason,
      grantedById: context.user.id,
      expiresAt: input.expiresInDays
        ? new Date(Date.now() + input.expiresInDays * 24 * 3600 * 1000)
        : null,
    },
    update: {
      granted: input.granted,
      reason: input.reason,
      grantedById: context.user.id,
      expiresAt: input.expiresInDays
        ? new Date(Date.now() + input.expiresInDays * 24 * 3600 * 1000)
        : null,
    },
  });

  await revokeAllSessions(input.userId, 'permissions_changed');

  await writeAudit({
    actorId: context.user.id,
    actorEmail: context.user.email,
    actorRole: context.roles.join(','),
    action: input.granted ? AUDIT.PERMISSION_GRANTED : AUDIT.PERMISSION_REVOKED,
    targetType: 'user',
    targetId: input.userId,
    reason: input.reason,
    metadata: { permission: input.permission, granted: input.granted },
    ipAddress: context.ipAddress,
  });

  return ok({
    message: input.granted
      ? `Granted ${input.permission}. The change is recorded and reversible by an authorised superior.`
      : `Denied ${input.permission}. A denial overrides any role grant.`,
  });
});
