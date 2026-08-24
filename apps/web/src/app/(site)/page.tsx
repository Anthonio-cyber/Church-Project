import Link from 'next/link';
import { prisma } from '@/lib/db';
import { ButtonLink, Card, GoldRule, SafeguardingNotice } from '@/components/ui';
import { LogoMark } from '@/components/brand/Logo';
import { formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

const PILLARS = [
  {
    title: 'Prayer',
    body: 'Bring your requests before God and before a fellowship that will stand with you. Share publicly, privately, or with the ministry team alone — you decide.',
    href: '/prayer',
  },
  {
    title: 'The Word',
    body: 'Structured discipleship: foundations of faith, the Holy Spirit, Christian character, evangelism and ministry training, with progress you can return to.',
    href: '/discipleship',
  },
  {
    title: 'Pastoral care',
    body: 'Request counselling with an approved, verified counsellor. Private waiting room, private session, and notes that stay where they belong.',
    href: '/counselling',
  },
  {
    title: 'Fellowship',
    body: 'Connect with other believers — but only ever by mutual consent. Nobody can open a private conversation with you unless you accept.',
    href: '/ministries',
  },
];

const PROMISES = [
  {
    title: 'Consent before contact',
    body: 'No member can message you without asking first. Requests can be accepted, declined or blocked, and a decline carries a cooling-off period.',
  },
  {
    title: 'Counselling stays private',
    body: 'Sessions are visible to you and your counsellor. Internal notes are encrypted, and every access to them is recorded — administrators included.',
  },
  {
    title: 'Accountable leadership',
    body: 'Administration follows the church hierarchy, with least-privilege access and an audit log that no administrator can erase.',
  },
  {
    title: 'Honest about limits',
    body: 'We will always tell you when something needs professional or emergency help. Pastoral care sits alongside it, never in place of it.',
  },
];

export default async function HomePage() {
  // The public home page shows only published, public material.
  const [resources, events] = await Promise.all([
    prisma.resource
      .findMany({
        where: { status: 'PUBLISHED', visibility: 'PUBLIC' },
        orderBy: { publishedAt: 'desc' },
        take: 3,
        select: { id: true, slug: true, title: true, description: true, type: true, speaker: true, topic: true },
      })
      .catch(() => []),
    prisma.event
      .findMany({
        where: { status: 'PUBLISHED', visibility: 'PUBLIC', startsAt: { gte: new Date() }, cancelledAt: null },
        orderBy: { startsAt: 'asc' },
        take: 3,
        select: { id: true, slug: true, title: true, startsAt: true, mode: true, location: true },
      })
      .catch(() => []),
  ]);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-ink-950 py-20 text-parchment-100 sm:py-28">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, #e8c469 0, transparent 45%), radial-gradient(circle at 80% 30%, #c9922a 0, transparent 40%)',
          }}
        />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid items-center gap-14 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-gold-700/60 bg-gold-950/40 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-gold-300">
                Prayer · The Word · Discipleship · Fellowship
              </p>
              <h1 className="font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
                A safe place to seek God,
                <span className="block text-gold-300">and to be cared for.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-parchment-300">
                Private pastoral counselling, prayer, discipleship and fellowship — built so that
                your confidences are protected, your consent is asked before anyone contacts you,
                and those who lead are accountable for what they do.
              </p>

              <div className="mt-9 flex flex-wrap gap-3">
                <ButtonLink href="/register">Create your account</ButtonLink>
                <ButtonLink href="/counselling" variant="secondary">
                  Request pastoral counselling
                </ButtonLink>
              </div>

              <p className="mt-6 text-sm text-parchment-400">
                Already a member?{' '}
                <Link href="/login" className="font-medium text-gold-300 underline underline-offset-4">
                  Sign in
                </Link>
              </p>
            </div>

            <div className="flex justify-center lg:justify-end">
              <div className="relative">
                <div
                  aria-hidden
                  className="absolute -inset-10 rounded-full bg-gold-500/10 blur-3xl"
                />
                <LogoMark size={280} tone="gold" className="relative drop-shadow-2xl" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <GoldRule />

      {/* Four pillars */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="mb-12 max-w-2xl">
          <p className="eyebrow mb-3">What this platform is for</p>
          <h2 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
            Four things, done carefully
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ink-600 dark:text-parchment-300">
            This is a ministry platform, not a social network. There is no feed to scroll, no
            follower count, and nothing here rewards you for spending longer than you meant to.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((pillar) => (
            <Card key={pillar.title} as="article" className="flex flex-col">
              <h3 className="font-serif text-xl font-semibold text-gold-800 dark:text-gold-300">
                {pillar.title}
              </h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-600 dark:text-parchment-300">
                {pillar.body}
              </p>
              <Link
                href={pillar.href}
                className="mt-5 text-sm font-semibold text-gold-700 underline-offset-4 hover:underline dark:text-gold-400"
              >
                Learn more →
              </Link>
            </Card>
          ))}
        </div>
      </section>

      {/* Promises */}
      <section className="bg-ink-950 py-20 text-parchment-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-12 max-w-2xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-gold-500">
              How we handle your trust
            </p>
            <h2 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
              What we will and will not do
            </h2>
          </div>

          <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {PROMISES.map((promise) => (
              <div key={promise.title} className="border-l-2 border-gold-600 pl-5">
                <h3 className="font-serif text-lg font-semibold text-gold-200">{promise.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-parchment-300">{promise.body}</p>
              </div>
            ))}
          </div>

          <p className="mt-12 max-w-3xl border-t border-ink-800 pt-8 text-sm leading-relaxed text-parchment-400">
            We will not tell you that your information is “100% private” or that nobody can ever
            access it. What we can tell you honestly: information is protected by encryption, strict
            access rules and recorded access, and authorised personnel may reach it only where
            necessary for platform operation, safeguarding, legal obligations or security. Read the{' '}
            <Link href="/privacy" className="font-medium text-gold-300 underline underline-offset-4">
              Privacy Policy
            </Link>{' '}
            for the detail.
          </p>
        </div>
      </section>

      {/* Latest teaching and events */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <h2 className="mb-6 font-serif text-2xl font-semibold">Recent teaching</h2>
            {resources.length === 0 ? (
              <p className="rounded-xl border border-dashed border-ink-300 p-6 text-sm text-ink-500 dark:border-ink-700 dark:text-parchment-400">
                No public resources have been published yet. Teaching material appears here once the
                content team publishes it.
              </p>
            ) : (
              <ul className="space-y-4">
                {resources.map((resource) => (
                  <li key={resource.id}>
                    <Link
                      href={`/resources?q=${encodeURIComponent(resource.title)}`}
                      className="block rounded-xl border border-ink-200/70 bg-white p-5 transition hover:border-gold-400 dark:border-ink-800 dark:bg-ink-900"
                    >
                      <p className="eyebrow">{resource.topic}</p>
                      <h3 className="mt-2 font-serif text-lg font-semibold">{resource.title}</h3>
                      <p className="mt-1.5 line-clamp-2 text-sm text-ink-600 dark:text-parchment-300">
                        {resource.description}
                      </p>
                      {resource.speaker ? (
                        <p className="mt-2 text-xs text-ink-500 dark:text-parchment-400">
                          {resource.speaker}
                        </p>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <ButtonLink href="/resources" variant="secondary" className="mt-6">
              Browse all resources
            </ButtonLink>
          </div>

          <div>
            <h2 className="mb-6 font-serif text-2xl font-semibold">Upcoming gatherings</h2>
            {events.length === 0 ? (
              <p className="rounded-xl border border-dashed border-ink-300 p-6 text-sm text-ink-500 dark:border-ink-700 dark:text-parchment-400">
                No public events are scheduled at the moment. Check back soon.
              </p>
            ) : (
              <ul className="space-y-4">
                {events.map((event) => (
                  <li
                    key={event.id}
                    className="rounded-xl border border-ink-200/70 bg-white p-5 dark:border-ink-800 dark:bg-ink-900"
                  >
                    <p className="eyebrow">{formatDate(event.startsAt)}</p>
                    <h3 className="mt-2 font-serif text-lg font-semibold">{event.title}</h3>
                    <p className="mt-1.5 text-sm text-ink-600 dark:text-parchment-300">
                      {event.mode === 'ONLINE' ? 'Online' : (event.location ?? 'In person')}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <ButtonLink href="/events" variant="secondary" className="mt-6">
              See all events
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* Closing call */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="rounded-2xl border border-gold-300 bg-gradient-to-br from-parchment-100 to-parchment-200 p-10 text-center dark:border-gold-800 dark:from-ink-900 dark:to-ink-950">
          <h2 className="font-serif text-3xl font-semibold tracking-tight">
            You do not have to carry it alone
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-ink-600 dark:text-parchment-300">
            Create an account to request counselling with an approved counsellor, ask for prayer, and
            begin a discipleship course at your own pace.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/register">Create your account</ButtonLink>
            <ButtonLink href="/counselling" variant="secondary">
              How counselling works
            </ButtonLink>
          </div>
          <div className="mx-auto mt-10 max-w-2xl">
            <SafeguardingNotice />
          </div>
        </div>
      </section>
    </>
  );
}
