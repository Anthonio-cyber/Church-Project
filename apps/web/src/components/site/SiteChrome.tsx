import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrandLink } from '@/components/brand/Logo';
import { GoldRule } from '@/components/ui';

const PRIMARY_NAV = [
  { href: '/about', label: 'About' },
  { href: '/beliefs', label: 'Our Beliefs' },
  { href: '/ministries', label: 'Ministries' },
  { href: '/counselling', label: 'Counselling' },
  { href: '/prayer', label: 'Prayer' },
  { href: '/discipleship', label: 'Discipleship' },
  { href: '/resources', label: 'Resources' },
  { href: '/events', label: 'Events' },
];

const FOOTER_SECTIONS = [
  {
    title: 'Ministry',
    links: [
      { href: '/about', label: 'About' },
      { href: '/beliefs', label: 'Our Beliefs' },
      { href: '/leadership', label: 'Church Leadership' },
      { href: '/ministries', label: 'Ministries' },
      { href: '/missions', label: 'Missions' },
      { href: '/centers', label: 'Ministry Centers' },
    ],
  },
  {
    title: 'Care and growth',
    links: [
      { href: '/counselling', label: 'Pastoral Counselling' },
      { href: '/prayer', label: 'Prayer' },
      { href: '/discipleship', label: 'Discipleship' },
      { href: '/resources', label: 'Resources' },
      { href: '/events', label: 'Events' },
      { href: '/faq', label: 'Frequently Asked Questions' },
    ],
  },
  {
    title: 'Policies',
    links: [
      { href: '/privacy', label: 'Privacy Policy' },
      { href: '/terms', label: 'Terms of Use' },
      { href: '/safeguarding', label: 'Safeguarding Policy' },
      { href: '/counselling-disclaimer', label: 'Counselling Disclaimer' },
      { href: '/community-guidelines', label: 'Community Guidelines' },
      { href: '/data-rights', label: 'Your Data Rights' },
    ],
  },
  {
    title: 'Get in touch',
    links: [
      { href: '/contact', label: 'Contact' },
      { href: '/download', label: 'Get the app' },
      { href: '/register', label: 'Create an account' },
      { href: '/login', label: 'Sign in' },
      { href: '/app/help', label: 'Help and support' },
    ],
  },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink-800/60 bg-ink-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <BrandLink tone="gold" size={40} />

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {PRIMARY_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-parchment-200 transition hover:bg-ink-900 hover:text-gold-300"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-lg px-3 py-2 text-sm font-medium text-parchment-200 transition hover:text-gold-300"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-gold-sheen px-4 py-2 text-sm font-semibold text-ink-950 transition hover:brightness-105"
          >
            Create account
          </Link>
        </div>
      </div>

      {/* Small-screen navigation: a scrollable rail rather than a hidden menu,
          so every destination stays one tap away. */}
      <nav aria-label="Primary, compact" className="lg:hidden">
        <ul className="flex gap-1 overflow-x-auto border-t border-ink-800/60 px-4 py-2">
          {PRIMARY_NAV.map((item) => (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                className="block rounded-md px-3 py-1.5 text-sm text-parchment-200 hover:text-gold-300"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <GoldRule />
    </header>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-24 border-t border-ink-800/60 bg-ink-950 text-parchment-300">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <BrandLink tone="gold" size={44} />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-parchment-400">
              A safe digital ministry environment for pastoral counselling, prayer, discipleship and
              fellowship — governed responsibly, with every administrative action recorded.
            </p>
          </div>

          {FOOTER_SECTIONS.map((section) => (
            <div key={section.title}>
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-gold-500">
                {section.title}
              </h2>
              <ul className="space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-parchment-300 transition hover:text-gold-300"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 space-y-4 border-t border-ink-800/60 pt-8">
          {/* Stated plainly and permanently, on every page of the public site. */}
          <p className="text-xs leading-relaxed text-parchment-500">
            <strong className="text-parchment-300">Branding notice.</strong> This platform uses an
            original Christian visual identity created for it. It is not an official product of
            Remnant Christian Network, and no claim of official status or endorsement is made unless
            and until the organisation authorises it in writing.
          </p>
          <p className="text-xs leading-relaxed text-parchment-500">
            <strong className="text-parchment-300">Counselling notice.</strong> Pastoral counselling
            provides spiritual guidance, prayer, biblical encouragement and pastoral support. It is
            not a substitute for emergency services, licensed medical care, psychological treatment,
            psychiatric treatment, legal advice or other professional services.
          </p>
          <p className="text-xs text-parchment-500">© {year} 𝒾Pastor · Remnant Christian Network. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export function SitePage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-parchment-50 dark:bg-ink-950">
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

/** Standard hero for interior public pages. */
export function PageHero({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <section className="border-b border-ink-800/40 bg-ink-950 py-16 text-parchment-100 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {eyebrow ? (
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold-500">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="max-w-4xl font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-parchment-300">{description}</p>
        ) : null}
        {children ? <div className="mt-8">{children}</div> : null}
      </div>
    </section>
  );
}
