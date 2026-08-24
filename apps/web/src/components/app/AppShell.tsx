import Link from 'next/link';
import type { ReactNode } from 'react';
import type { RoleKey } from '@prisma/client';
import { BrandLink } from '@/components/brand/Logo';
import { GoldRule } from '@/components/ui';
import { SignOutButton } from './SignOutButton';
import { ADMIN_ROLES, type PermissionKey } from '@/lib/permissions';

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  /** Shown only when the caller holds at least one of these permissions. */
  anyPermission?: PermissionKey[];
  anyRole?: RoleKey[];
};

const MEMBER_NAV: NavItem[] = [
  { href: '/app/dashboard', label: 'Dashboard', icon: '⌂' },
  { href: '/app/counselling', label: 'Counselling', icon: '✚' },
  { href: '/app/messages', label: 'Messages', icon: '✉' },
  { href: '/app/connections', label: 'Connections', icon: '⁂' },
  { href: '/app/prayer', label: 'Prayer', icon: '✧' },
  { href: '/app/discipleship', label: 'Discipleship', icon: '📖' },
  { href: '/app/resources', label: 'Resources', icon: '❖' },
  { href: '/app/events', label: 'Events', icon: '◷' },
  { href: '/app/notifications', label: 'Notifications', icon: '◔' },
];

const ACCOUNT_NAV: NavItem[] = [
  { href: '/app/profile', label: 'My Profile', icon: '☺' },
  { href: '/app/privacy', label: 'Privacy & Security', icon: '🔒' },
  { href: '/app/help', label: 'Help & Support', icon: '?' },
];

const STAFF_NAV: NavItem[] = [
  { href: '/counsellor', label: 'Counsellor Portal', icon: '✚', anyRole: ['COUNSELLOR', 'PASTOR'] },
  {
    href: '/moderation',
    label: 'Moderator Portal',
    icon: '⚖',
    anyPermission: ['reports.view'],
  },
  {
    href: '/admin',
    label: 'Admin Portal',
    icon: '⚙',
    anyPermission: ['users.view', 'analytics.view', 'content.edit', 'events.edit', 'counselling.view'],
  },
  {
    href: '/super-admin',
    label: 'Super Admin',
    icon: '✦',
    anyPermission: ['hierarchy.manage', 'admins.manage', 'emergency_controls.manage'],
  },
];

export type Viewer = {
  displayName: string;
  firstName: string;
  email: string;
  roles: RoleKey[];
  permissions: PermissionKey[];
  unreadNotifications: number;
  isDemoAccount: boolean;
  mfaSetupRequired: boolean;
};

function visible(items: NavItem[], viewer: Viewer): NavItem[] {
  return items.filter((item) => {
    if (item.anyPermission && item.anyPermission.some((p) => viewer.permissions.includes(p))) {
      return true;
    }
    if (item.anyRole && item.anyRole.some((r) => viewer.roles.includes(r))) return true;
    return !item.anyPermission && !item.anyRole;
  });
}

function NavList({ items, viewer, title }: { items: NavItem[]; viewer: Viewer; title?: string }) {
  const shown = visible(items, viewer);
  if (shown.length === 0) return null;

  return (
    <div className="mb-6">
      {title ? (
        <h2 className="mb-2 px-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-ink-400">
          {title}
        </h2>
      ) : null}
      <ul className="space-y-0.5">
        {shown.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-parchment-200 transition hover:bg-ink-800 hover:text-gold-300"
            >
              <span aria-hidden className="w-5 text-center text-gold-500">
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>
              {item.href === '/app/notifications' && viewer.unreadNotifications > 0 ? (
                <span className="rounded-full bg-gold-sheen px-2 py-0.5 text-[0.65rem] font-bold text-ink-950">
                  {viewer.unreadNotifications > 99 ? '99+' : viewer.unreadNotifications}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The authenticated shell.
 *
 * Navigation is filtered by the viewer's actual permissions — but that is a
 * convenience, not a control. Every destination re-checks server-side, so
 * typing a URL into the address bar gains nothing.
 */
export function AppShell({ viewer, children }: { viewer: Viewer; children: ReactNode }) {
  const isStaff = viewer.roles.some((role) => role !== 'USER');
  const isAdmin = viewer.roles.some((role) => ADMIN_ROLES.includes(role));

  return (
    <div className="flex min-h-dvh bg-parchment-50 dark:bg-ink-950">
      {/* Desktop sidebar */}
      <aside className="hidden w-72 shrink-0 flex-col border-r border-ink-800 bg-ink-950 lg:flex">
        <div className="border-b border-ink-800 px-5 py-4">
          <BrandLink href="/app/dashboard" tone="gold" size={38} />
        </div>

        <nav aria-label="Application" className="flex-1 overflow-y-auto px-3 py-5">
          <NavList items={MEMBER_NAV} viewer={viewer} />
          <GoldRule className="mb-5 opacity-40" />
          <NavList items={ACCOUNT_NAV} viewer={viewer} title="Account" />
          {isStaff ? (
            <>
              <GoldRule className="mb-5 opacity-40" />
              <NavList items={STAFF_NAV} viewer={viewer} title="Ministry & administration" />
            </>
          ) : null}
        </nav>

        <div className="border-t border-ink-800 px-4 py-4">
          <p className="truncate text-sm font-medium text-parchment-100">{viewer.displayName}</p>
          <p className="truncate text-xs text-parchment-500">{viewer.email}</p>
          {viewer.isDemoAccount ? (
            <p className="mt-2 rounded bg-amber-950/60 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-amber-300">
              Demo account
            </p>
          ) : null}
          <SignOutButton className="mt-3" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 border-b border-ink-800 bg-ink-950 px-4 py-3 lg:hidden">
          <div className="flex items-center justify-between">
            <BrandLink href="/app/dashboard" tone="gold" size={34} />
            <div className="flex items-center gap-3">
              <Link
                href="/app/notifications"
                className="relative rounded-lg p-2 text-parchment-200"
                aria-label={`Notifications${viewer.unreadNotifications > 0 ? `, ${viewer.unreadNotifications} unread` : ''}`}
              >
                <span aria-hidden className="text-lg">
                  ◔
                </span>
                {viewer.unreadNotifications > 0 ? (
                  <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-gold-400" />
                ) : null}
              </Link>
              <SignOutButton compact />
            </div>
          </div>
        </header>

        {viewer.mfaSetupRequired ? (
          <div className="border-b border-amber-700 bg-amber-950/60 px-4 py-3 text-sm text-amber-100">
            <strong className="font-semibold">Multi-factor authentication is required for your role.</strong>{' '}
            Sensitive actions stay blocked until you set it up.{' '}
            <Link href="/app/privacy" className="underline underline-offset-4">
              Set it up now
            </Link>
            .
          </div>
        ) : null}

        <main id="main" className="flex-1 px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-10">
          {children}
        </main>

        {/* Mobile bottom navigation: the five things people actually come for. */}
        <nav
          aria-label="Primary, mobile"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-800 bg-ink-950 lg:hidden"
        >
          <ul className="grid grid-cols-5">
            {[
              { href: '/app/dashboard', label: 'Home', icon: '⌂' },
              { href: '/app/counselling', label: 'Counselling', icon: '✚' },
              { href: '/app/messages', label: 'Messages', icon: '✉' },
              { href: '/app/discipleship', label: 'Learn', icon: '📖' },
              { href: isAdmin ? '/admin' : '/app/profile', label: isAdmin ? 'Admin' : 'Profile', icon: isAdmin ? '⚙' : '☺' },
            ].map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 px-1 py-2 text-parchment-300 transition hover:text-gold-300"
                >
                  <span aria-hidden className="text-base text-gold-500">
                    {item.icon}
                  </span>
                  <span className="text-[0.65rem] font-medium">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}

/** Page heading used inside the application shell. */
export function AppPageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow ? <p className="eyebrow mb-1.5">{eyebrow}</p> : null}
        <h1 className="font-serif text-3xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-2 text-sm leading-relaxed text-ink-600 dark:text-parchment-300">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
