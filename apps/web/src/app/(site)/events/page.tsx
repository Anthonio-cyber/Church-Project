import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { PageHero } from '@/components/site/SiteChrome';
import { Badge, ButtonLink, Card, EmptyState } from '@/components/ui';
import { formatDateTime } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Events',
  description: 'Upcoming gatherings, conferences, teaching sessions and online meetings.',
};

export const dynamic = 'force-dynamic';

export default async function EventsPage() {
  const events = await prisma.event
    .findMany({
      where: {
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        startsAt: { gte: new Date() },
        cancelledAt: null,
      },
      orderBy: { startsAt: 'asc' },
      take: 40,
      include: {
        ministryCenter: { select: { name: true, city: true, country: true } },
        _count: { select: { registrations: { where: { status: 'REGISTERED' } } } },
      },
    })
    .catch(() => []);

  return (
    <>
      <PageHero
        eyebrow="Events"
        title="Gather with us"
        description="Conferences, teaching sessions, prayer meetings and online gatherings. Sign in to register and receive reminders."
      >
        <ButtonLink href="/register">Create an account to register</ButtonLink>
      </PageHero>

      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        {events.length === 0 ? (
          <EmptyState
            icon="🕯"
            title="No public events are scheduled"
            description="Events appear here once they are published. Members may also see events limited to their ministry centre after signing in."
          />
        ) : (
          <ul className="space-y-5">
            {events.map((event) => {
              const remaining =
                event.capacity === null
                  ? null
                  : Math.max(0, event.capacity - event._count.registrations);
              return (
                <Card key={event.id} as="li">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge tone="gold">{event.category}</Badge>
                        <Badge tone={event.mode === 'ONLINE' ? 'info' : 'neutral'}>
                          {event.mode === 'ONLINE'
                            ? 'Online'
                            : event.mode === 'HYBRID'
                              ? 'In person and online'
                              : 'In person'}
                        </Badge>
                        {remaining !== null ? (
                          <Badge tone={remaining === 0 ? 'critical' : 'positive'}>
                            {remaining === 0 ? 'Full — waiting list' : `${remaining} places left`}
                          </Badge>
                        ) : null}
                      </div>
                      <h2 className="font-serif text-xl font-semibold">{event.title}</h2>
                      <p className="mt-2 text-sm leading-relaxed text-ink-600 dark:text-parchment-300">
                        {event.description}
                      </p>
                      <dl className="mt-4 grid gap-x-8 gap-y-1.5 text-sm text-ink-600 sm:grid-cols-2 dark:text-parchment-300">
                        <div className="flex gap-2">
                          <dt className="font-medium text-ink-800 dark:text-parchment-100">When</dt>
                          <dd>{formatDateTime(event.startsAt)} UTC</dd>
                        </div>
                        {event.location ? (
                          <div className="flex gap-2">
                            <dt className="font-medium text-ink-800 dark:text-parchment-100">Where</dt>
                            <dd>{event.location}</dd>
                          </div>
                        ) : null}
                        {event.speaker ? (
                          <div className="flex gap-2">
                            <dt className="font-medium text-ink-800 dark:text-parchment-100">Speaker</dt>
                            <dd>{event.speaker}</dd>
                          </div>
                        ) : null}
                        {event.ministryCenter ? (
                          <div className="flex gap-2">
                            <dt className="font-medium text-ink-800 dark:text-parchment-100">Centre</dt>
                            <dd>{event.ministryCenter.name}</dd>
                          </div>
                        ) : null}
                      </dl>
                    </div>
                    <ButtonLink href="/login" variant="secondary">
                      Sign in to register
                    </ButtonLink>
                  </div>
                </Card>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
