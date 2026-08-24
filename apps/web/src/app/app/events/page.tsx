import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requirePageUser } from '@/lib/auth/guard';
import { AppPageHeader } from '@/components/app/AppShell';
import { Badge, Card, EmptyState } from '@/components/ui';
import { EventRegisterButton } from '@/components/app/EventRegisterButton';
import { formatDateTime } from '@/lib/format';

export const metadata: Metadata = { title: 'Events' };
export const dynamic = 'force-dynamic';

export default async function EventsPage() {
  const context = await requirePageUser('/app/events');

  const profile = await prisma.profile.findUnique({
    where: { userId: context.user.id },
    select: { timezone: true },
  });
  const timezone = profile?.timezone ?? 'UTC';

  const events = await prisma.event.findMany({
    where: {
      status: 'PUBLISHED',
      startsAt: { gte: new Date() },
      cancelledAt: null,
      OR: [
        { visibility: { in: ['PUBLIC', 'MEMBERS_ONLY'] } },
        { visibility: 'MINISTRY_CENTER', ministryCenterId: context.ministryCenterId },
      ],
    },
    orderBy: { startsAt: 'asc' },
    include: {
      ministryCenter: { select: { name: true } },
      registrations: { where: { userId: context.user.id }, take: 1 },
      _count: { select: { registrations: { where: { status: 'REGISTERED' } } } },
    },
  });

  return (
    <>
      <AppPageHeader
        eyebrow="Gatherings"
        title="Events"
        description="Register, add to your calendar, and receive a reminder before it begins."
      />

      {events.length === 0 ? (
        <EmptyState
          icon="◷"
          title="No upcoming events"
          description="When events are published — for everyone, or for your ministry centre — they appear here."
        />
      ) : (
        <ul className="space-y-5">
          {events.map((event) => {
            const registration = event.registrations[0];
            const isRegistered =
              registration?.status === 'REGISTERED' || registration?.status === 'WAITLISTED';
            const isFull =
              event.capacity !== null && event._count.registrations >= event.capacity;

            return (
              <Card key={event.id} as="li">
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge tone="gold">{event.category}</Badge>
                      <Badge tone={event.mode === 'ONLINE' ? 'info' : 'neutral'}>
                        {event.mode === 'ONLINE'
                          ? 'Online'
                          : event.mode === 'HYBRID'
                            ? 'In person and online'
                            : 'In person'}
                      </Badge>
                      {registration?.status === 'WAITLISTED' ? (
                        <Badge tone="caution">On the waiting list</Badge>
                      ) : registration?.status === 'REGISTERED' ? (
                        <Badge tone="positive">You are registered</Badge>
                      ) : isFull ? (
                        <Badge tone="critical">Full</Badge>
                      ) : null}
                    </div>

                    <h2 className="font-serif text-xl font-semibold">{event.title}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-ink-600 dark:text-parchment-300">
                      {event.description}
                    </p>

                    <dl className="mt-4 grid gap-x-8 gap-y-1.5 text-sm text-ink-600 sm:grid-cols-2 dark:text-parchment-300">
                      <div className="flex gap-2">
                        <dt className="font-medium text-ink-800 dark:text-parchment-100">When</dt>
                        <dd>{formatDateTime(event.startsAt, timezone)}</dd>
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

                    {/* The joining link is released only to registered members. */}
                    {registration?.status === 'REGISTERED' && event.onlineUrl ? (
                      <a
                        href={event.onlineUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="mt-4 inline-block text-sm font-semibold text-gold-700 underline-offset-4 hover:underline dark:text-gold-400"
                      >
                        Join online →
                      </a>
                    ) : null}
                  </div>

                  <EventRegisterButton
                    eventId={event.id}
                    isRegistered={isRegistered}
                    isFull={isFull}
                  />
                </div>
              </Card>
            );
          })}
        </ul>
      )}
    </>
  );
}
