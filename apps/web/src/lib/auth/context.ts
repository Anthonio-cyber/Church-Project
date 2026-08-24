import { headers } from 'next/headers';
import type { RoleKey, Session, User } from '@prisma/client';
import { prisma } from '../db';
import { writeAudit, writeSecurityEvent, AUDIT } from '../audit';
import {
  ADMIN_ROLES,
  isSensitive,
  ROLE_RANK,
  type PermissionKey,
} from '../permissions';
import { isReauthFresh, readSessionToken, resolveSession } from './session';

export type AuthContext = {
  user: User;
  session: Session;
  roles: RoleKey[];
  permissions: Set<PermissionKey>;
  rank: number;
  ministryCenterId: string | null;
  displayName: string;
  isStaff: boolean;
  isAdmin: boolean;
  ipAddress: string | null;
  userAgent: string | null;
};

export class AuthError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly detail?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export async function requestMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  const headerList = await headers();
  const forwarded = headerList.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0]!.trim() : headerList.get('x-real-ip');
  return { ip: ip ?? null, userAgent: headerList.get('user-agent') };
}

/**
 * Effective permissions for a user.
 *
 * Resolution order, and it matters:
 *   1. union of permissions granted by the user's active roles
 *   2. plus explicit per-user grants
 *   3. minus explicit per-user denials — a denial always wins
 *
 * Expired role assignments and expired overrides are ignored.
 */
export async function loadAuthorization(userId: string): Promise<{
  roles: RoleKey[];
  permissions: Set<PermissionKey>;
  rank: number;
}> {
  const now = new Date();

  const [userRoles, overrides] = await Promise.all([
    prisma.userRole.findMany({
      where: {
        userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    }),
    prisma.userPermissionOverride.findMany({
      where: {
        userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: { permission: true },
    }),
  ]);

  const roles = userRoles.map((assignment) => assignment.role.key);
  const permissions = new Set<PermissionKey>();

  for (const assignment of userRoles) {
    for (const rolePermission of assignment.role.permissions) {
      permissions.add(rolePermission.permission.key as PermissionKey);
    }
  }

  for (const override of overrides) {
    const key = override.permission.key as PermissionKey;
    if (override.granted) permissions.add(key);
    else permissions.delete(key);
  }

  const rank = roles.reduce((max, role) => Math.max(max, ROLE_RANK[role] ?? 0), 0);
  return { roles, permissions, rank };
}

/** Resolve the caller. Returns null when unauthenticated — never throws. */
export async function getAuthContext(): Promise<AuthContext | null> {
  const token = await readSessionToken();
  const resolved = await resolveSession(token);
  if (!resolved) return null;

  const { user, session } = resolved;
  const { roles, permissions, rank } = await loadAuthorization(user.id);
  const profile = await prisma.profile.findUnique({
    where: { userId: user.id },
    select: { displayName: true, firstName: true },
  });
  const meta = await requestMeta();

  return {
    user,
    session,
    roles,
    permissions,
    rank,
    ministryCenterId: user.ministryCenterId,
    displayName: profile?.displayName ?? profile?.firstName ?? 'Member',
    isStaff: roles.some((role) => role !== 'USER'),
    isAdmin: roles.some((role) => ADMIN_ROLES.includes(role)),
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  };
}

export async function requireUser(): Promise<AuthContext> {
  const context = await getAuthContext();
  if (!context) {
    throw new AuthError(401, 'unauthenticated', 'Please sign in to continue.');
  }
  return context;
}

export function hasPermission(context: AuthContext, permission: PermissionKey): boolean {
  return context.permissions.has(permission);
}

export function hasAnyPermission(
  context: AuthContext,
  permissions: PermissionKey[],
): boolean {
  return permissions.some((permission) => context.permissions.has(permission));
}

export function hasRole(context: AuthContext, role: RoleKey): boolean {
  return context.roles.includes(role);
}

/**
 * The single gate for every privileged operation.
 *
 * Beyond checking the permission it enforces the accountability rules attached
 * to sensitive permissions: MFA must be enabled and satisfied on this session,
 * re-authentication must be recent, and a reason must be supplied. Denials are
 * recorded as security events, because a pattern of denials is itself a signal.
 */
export async function requirePermission(
  permission: PermissionKey,
  options: {
    context?: AuthContext;
    reason?: string;
    targetType?: string;
    targetId?: string;
  } = {},
): Promise<AuthContext> {
  const context = options.context ?? (await requireUser());

  if (!context.permissions.has(permission)) {
    await writeSecurityEvent({
      userId: context.user.id,
      kind: 'PERMISSION_DENIED',
      severity: 'warning',
      detail: `Denied ${permission}`,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    await writeAudit({
      actorId: context.user.id,
      actorEmail: context.user.email,
      actorRole: context.roles.join(','),
      action: AUDIT.PERMISSION_DENIED,
      targetType: options.targetType ?? null,
      targetId: options.targetId ?? null,
      outcome: 'DENIED',
      metadata: { permission },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    throw new AuthError(403, 'forbidden', 'You do not have permission to do this.');
  }

  if (isSensitive(permission)) {
    if (!context.user.mfaEnabled) {
      throw new AuthError(
        403,
        'mfa_required',
        'This action requires multi-factor authentication to be enabled on your account.',
      );
    }
    if (!context.session.mfaSatisfiedAt) {
      throw new AuthError(
        403,
        'mfa_challenge_required',
        'Complete a multi-factor challenge before performing this action.',
      );
    }
    if (!isReauthFresh(context.session)) {
      throw new AuthError(
        403,
        'reauth_required',
        'Please confirm your password again before performing this action.',
      );
    }
    if (!options.reason || options.reason.trim().length < 8) {
      throw new AuthError(
        400,
        'reason_required',
        'A written reason of at least 8 characters is required and will be recorded.',
      );
    }
  }

  return context;
}

/**
 * Hierarchy guard.
 *
 * An actor may only act on a principal of strictly lower rank. This is what
 * prevents an Administrator from editing a Senior Leadership Administrator, a
 * Senior Leadership Administrator from stripping the Setman's authority, and
 * anyone at all from escalating themselves — self-targeting is refused outright
 * for governance actions.
 */
export async function requireAuthorityOver(
  context: AuthContext,
  targetUserId: string,
  options: { allowSelf?: boolean } = {},
): Promise<{ targetRank: number; targetRoles: RoleKey[] }> {
  if (targetUserId === context.user.id && !options.allowSelf) {
    throw new AuthError(
      403,
      'self_target_forbidden',
      'You cannot perform this governance action on your own account.',
    );
  }

  const target = await loadAuthorization(targetUserId);

  if (targetUserId !== context.user.id && target.rank >= context.rank) {
    await writeAudit({
      actorId: context.user.id,
      actorEmail: context.user.email,
      actorRole: context.roles.join(','),
      action: AUDIT.PERMISSION_DENIED,
      targetType: 'user',
      targetId: targetUserId,
      outcome: 'DENIED',
      reason: 'Hierarchy guard: target rank is not below actor rank.',
      metadata: { actorRank: context.rank, targetRank: target.rank },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    throw new AuthError(
      403,
      'insufficient_authority',
      'This person holds equal or greater authority than you in the church hierarchy.',
    );
  }

  return { targetRank: target.rank, targetRoles: target.roles };
}

/**
 * An actor may never grant authority they do not themselves hold, nor assign a
 * role at or above their own rank.
 */
export function requireCanGrantRole(context: AuthContext, role: RoleKey): void {
  const targetRank = ROLE_RANK[role] ?? 0;
  if (targetRank >= context.rank) {
    throw new AuthError(
      403,
      'insufficient_authority',
      `You cannot assign the ${role} role, which is at or above your own level of authority.`,
    );
  }
}

export function requireCanGrantPermission(
  context: AuthContext,
  permission: PermissionKey,
): void {
  if (!context.permissions.has(permission)) {
    throw new AuthError(
      403,
      'insufficient_authority',
      'You cannot grant a permission that you do not hold yourself.',
    );
  }
}

/** Confirms the session has completed a fresh re-authentication. */
export function requireFreshAuth(context: AuthContext): void {
  if (!isReauthFresh(context.session)) {
    throw new AuthError(
      403,
      'reauth_required',
      'Please confirm your password again before continuing.',
    );
  }
}
