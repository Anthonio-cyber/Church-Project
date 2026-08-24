import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrandLink } from '@/components/brand/Logo';
import { GoldRule } from '@/components/ui';
import { SignOutButton } from './SignOutButton';

export type StaffNavItem = { href: string; label: string };

/**
 * Shell for the counsellor, moderator, admin and super-admin portals.
 *
 * Visually distinct from the member application on purpose: a leader should
 * always know whether they are looking at their own account or acting in
 * office. The portal banner names the role they are acting under.
 */
export function StaffShell({
  portal,
  roleLabel,
  nav,
  displayName,
  children,
  accent = 'gold',
}: {
  portal: string;
  roleLabel: string;
  nav: StaffNavItem[];
  displayName: string;
  children: ReactNode;
  accent?: 'gold' | 'crimson';
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-parchment-50 dark:bg-ink-950">
      <header className="border-b border-ink-800 bg-ink-950">
        <div className="mx-auto flex max-w-[100rem] flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-5">
            <BrandLink href="/app/dashboard" tone="gold" size={34} />
            <div className="border-l border-ink-800 pl-5">
              <p
                className={`text-xs font-semibold uppercase tracking-[0.16em] ${
                  accent === 'crimson' ? 'text-red-400' : 'text-gold-500'
                }`}
              >
                {portal}
              </p>
              <p className="text-sm text-parchment-200">Acting as {roleLabel}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/app/dashboard" className="text-sm text-parchment-300 hover:text-gold-300">
              My account
            </Link>
            <span className="hidden text-sm text-parchment-500 sm:inline">{displayName}</span>
            <SignOutButton compact />
          </div>
        </div>

        <nav aria-label={portal} className="border-t border-ink-800/70">
          <ul className="mx-auto flex max-w-[100rem] gap-1 overflow-x-auto px-4 py-2 sm:px-6">
            {nav.map((item) => (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  className="block rounded-md px-3 py-1.5 text-sm text-parchment-200 transition hover:bg-ink-900 hover:text-gold-300"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <GoldRule />

      <main id="main" className="mx-auto w-full max-w-[100rem] flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>

      <footer className="border-t border-ink-200 px-4 py-5 text-center dark:border-ink-800">
        <p className="text-xs text-ink-500 dark:text-parchment-500">
          Actions taken in this portal are recorded in the audit log with your name, the time and
          your stated reason.
        </p>
      </footer>
    </div>
  );
}
