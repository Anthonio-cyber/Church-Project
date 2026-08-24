import { redirect } from 'next/navigation';
import { prisma } from '../db';
import { getAuthContext, type AuthContext } from './context';
import type { PermissionKey } from '../permissions';
import type { Viewer } from '@/components/app/AppShell';
import { MFA_REQUIRED_ROLES } from '../permissions';

/**
 * Page-level guards.
 *
 * These sit alongside — never instead of — the API guards. A page that renders
 * data still gets that data through code paths that check authorisation
 * themselves; these functions exist so that an unauthorised visitor gets a
 * sensible redirect rather than a broken page.
 */

export async function requirePageUser(returnTo?: string): Promise<AuthContext> {
  const context = await getAuthContext();
  if (!context) {
    redirect(returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : '/login');
  }
  return context;
}

export async function requirePagePermission(
  permissions: PermissionKey[],
  returnTo?: string,
): Promise<AuthContext> {
  const context = await requirePageUser(returnTo);
  if (!permissions.some((permission) => context.permissions.has(permission))) {
    redirect('/app/dashboard?denied=1');
  }
  return context;
}

/** Builds the shell viewer object from an authenticated context. */
export async function viewerFrom(context: AuthContext): Promise<Viewer> {
  const [profile, unread] = await Promise.all([
    prisma.profile.findUnique({
      where: { userId: context.user.id },
      select: { displayName: true, firstName: true },
    }),
    prisma.notification.count({ where: { userId: context.user.id, readAt: null } }),
  ]);

  const mfaMandatory =
    context.user.mfaRequired || context.roles.some((role) => MFA_REQUIRED_ROLES.includes(role));

  return {
    displayName: profile?.displayName ?? 'Member',
    firstName: profile?.firstName ?? 'friend',
    email: context.user.email,
    roles: context.roles,
    permissions: Array.from(context.permissions),
    unreadNotifications: unread,
    isDemoAccount: context.user.isDemoAccount,
    mfaSetupRequired: mfaMandatory && !context.user.mfaEnabled,
  };
}
