import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/site/SiteChrome';
import { Card, SafeguardingNotice } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'How to reach the ministry office, and where to go for urgent help.',
};

const ROUTES = [
  {
    title: 'Pastoral counselling',
    body: 'Create an account and submit a counselling request. Requests are reviewed by the counselling team and matched with a verified counsellor.',
    action: { href: '/register', label: 'Create an account' },
  },
  {
    title: 'Prayer',
    body: 'Members can submit prayer requests publicly, privately, or to the ministry team alone.',
    action: { href: '/prayer', label: 'About prayer requests' },
  },
  {
    title: 'A safeguarding concern',
    body: 'If you are worried about someone’s safety, report it from inside the platform. Serious categories go straight to a safeguarding lead rather than the general queue.',
    action: { href: '/safeguarding', label: 'Safeguarding policy' },
  },
  {
    title: 'Privacy and your data',
    body: 'Download your data or submit a data-rights request from the Privacy Centre in your account.',
    action: { href: '/data-rights', label: 'Your data rights' },
  },
  {
    title: 'Serving as a counsellor',
    body: 'Members can apply from within the platform. Applications are reviewed and verified by an authorised administrator before any request is received.',
    action: { href: '/register', label: 'Create an account to apply' },
  },
  {
    title: 'Ministry centres',
    body: 'Each centre publishes its own contact details, leadership and events.',
    action: { href: '/centers', label: 'Find a centre' },
  },
];

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="How to reach us"
        description="Most things are handled inside the platform, where they can be routed to the right people and kept private."
      />

      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <div className="mb-12">
          <SafeguardingNotice />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {ROUTES.map((route) => (
            <Card key={route.title} as="article" className="flex flex-col">
              <h2 className="font-serif text-lg font-semibold text-gold-800 dark:text-gold-300">
                {route.title}
              </h2>
              <p className="mt-2.5 flex-1 text-sm leading-relaxed text-ink-600 dark:text-parchment-300">
                {route.body}
              </p>
              <Link
                href={route.action.href}
                className="mt-4 text-sm font-semibold text-gold-700 underline-offset-4 hover:underline dark:text-gold-400"
              >
                {route.action.label} →
              </Link>
            </Card>
          ))}
        </div>

        <div className="mt-12 rounded-xl border border-ink-200 bg-parchment-100 p-6 dark:border-ink-800 dark:bg-ink-900">
          <h2 className="font-serif text-lg font-semibold">Ministry office</h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-600 dark:text-parchment-300">
            The deploying organisation sets its office address, telephone number and general
            enquiries email through the administration portal. Those details appear here once
            configured, along with each ministry centre’s own contact information.
          </p>
        </div>
      </section>
    </>
  );
}
