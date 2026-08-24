import { prisma } from '@/lib/db';
import { ok, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/context';
import { ROLE_LABEL } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

/**
 * The caller's own identity, roles and effective permissions.
 *
 * Clients use this to decide what to render. They must never use it to decide
 * what is *allowed* — every protected route re-checks server-side, so a client
 * that lies about its permissions gains nothing.
 */
export const GET = route(async () => {
  const context = await requireUser();

  const [profile, privacy, prefs, unreadCount] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: context.user.id } }),
    prisma.privacySettings.findUnique({ where: { userId: context.user.id } }),
    prisma.notificationPreference.findUnique({ where: { userId: context.user.id } }),
    prisma.notification.count({ where: { userId: context.user.id, readAt: null } }),
  ]);

  return ok({
    user: {
      id: context.user.id,
      email: context.user.email,
      status: context.user.status,
      emailVerified: Boolean(context.user.emailVerifiedAt),
      mfaEnabled: context.user.mfaEnabled,
      mfaRequired: context.user.mfaRequired,
      mustChangePassword: context.user.mustChangePassword,
      isDemoAccount: context.user.isDemoAccount,
      ministryCenterId: context.user.ministryCenterId,
      lastLoginAt: context.user.lastLoginAt,
    },
    profile,
    privacy,
    notificationPreferences: prefs,
    roles: context.roles,
    roleLabels: context.roles.map((role) => ROLE_LABEL[role]),
    permissions: Array.from(context.permissions),
    rank: context.rank,
    unreadNotifications: unreadCount,
  });
});
