import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requirePageUser } from '@/lib/auth/guard';
import { AppPageHeader } from '@/components/app/AppShell';
import { Badge, ButtonLink, Card, EmptyState, GoldRule, SafeguardingNotice, StatTile } from '@/components/ui';
import { CATEGORY_LABEL, waitingRoomState } from '@/lib/domain/counselling';
import { formatDateTime, greeting, relativeTime } from '@/lib/format';

export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

const QUICK_ACTIONS = [
  {
    href: '/app/counselling/request',
    title: 'Request Counselling',
    body: 'Speak privately with an approved counsellor.',
    icon: '✚',
  },
  {
    href: '/app/prayer',
    title: 'Request Prayer',
    body: 'Publicly, privately, or with the ministry team.',
    icon: '✧',
  },
  {
    href: '/app/discipleship',
    title: 'Continue Discipleship',
    body: 'Pick up where you left off.',
    icon: '📖',
  },
  {
    href: '/app/connections',
    title: 'My Connections',
    body: 'Requests to connect, and who you are connected with.',
    icon: '⁂',
  },
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const context = await requirePageUser();
  const params = await searchParams;

  const counsellor = await prisma.counsellor.findUnique({
    where: { userId: context.user.id },
    select: { id: true },
  });

  const [profile, nextSession, courseProgress, prayerCount, recentResources, upcomingEvents, announcements, pendingConnections] =
    await Promise.all([
      prisma.profile.findUnique({ where: { userId: context.user.id } }),
      prisma.counsellingSession.findFirst({
        where: {
          status: { in: ['CONFIRMED', 'WAITING', 'COUNSELLOR_JOINED', 'ACTIVE'] },
          scheduledFor: { gte: new Date(Date.now() - 2 * 3600 * 1000) },
          OR: [
            { request: { requesterId: context.user.id } },
            ...(counsellor ? [{ counsellorId: counsellor.id }] : []),
          ],
        },
        orderBy: { scheduledFor: 'asc' },
        include: {
          request: { select: { category: true, requesterId: true } },
          counsellor: {
            select: {
              userId: true,
              ministryRole: true,
              user: { select: { profile: { select: { displayName: true } } } },
            },
          },
        },
      }),
      prisma.courseProgress.findMany({
        where: { userId: context.user.id, completedAt: null },
        orderBy: { lastActivityAt: 'desc' },
        take: 3,
        include: { course: { select: { title: true, slug: true, track: true } } },
      }),
      prisma.prayerRequest.count({ where: { authorId: context.user.id, deletedAt: null } }),
      prisma.resource.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: { publishedAt: 'desc' },
        take: 4,
        select: { id: true, slug: true, title: true, type: true, topic: true },
      }),
      prisma.event.findMany({
        where: { status: 'PUBLISHED', startsAt: { gte: new Date() }, cancelledAt: null },
        orderBy: { startsAt: 'asc' },
        take: 3,
        select: { id: true, title: true, startsAt: true, mode: true, location: true },
      }),
      prisma.notification.findMany({
        where: { userId: context.user.id, category: 'ANNOUNCEMENT' },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
      prisma.connectionRequest.count({
        where: { recipientId: context.user.id, status: 'PENDING' },
      }),
    ]);

  const viewerIsCounsellorOnSession =
    nextSession && nextSession.counsellor.userId === context.user.id;

  return (
    <>
      {params.denied ? (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
        >
          <strong className="font-semibold">You do not have access to that area.</strong> Access
          follows the church’s leadership structure and the principle of least privilege. Speak with
          your supervising leader if you believe this is wrong.
        </div>
      ) : null}

      <AppPageHeader
        eyebrow={formatDateTime(new Date(), profile?.timezone ?? 'UTC')}
        title={`${greeting()}, ${profile?.firstName ?? 'friend'}`}
        description="How can we serve you today?"
      />

      {/* Next session — the single most important thing on this page. */}
      {nextSession ? (
        <section className="mb-8 rounded-2xl border-2 border-gold-400 bg-gradient-to-br from-gold-50 to-parchment-100 p-6 dark:border-gold-700 dark:from-ink-900 dark:to-ink-950">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="eyebrow mb-2">
                {viewerIsCounsellorOnSession ? 'Private counselling session' : 'Private pastoral session'}
              </p>
              <h2 className="font-serif text-2xl font-semibold">
                {formatDateTime(nextSession.scheduledFor, profile?.timezone ?? 'UTC')}
              </h2>
              <p className="mt-2 text-sm text-ink-600 dark:text-parchment-300">
                {CATEGORY_LABEL[nextSession.request.category]} ·{' '}
                {viewerIsCounsellorOnSession
                  ? 'With a member'
                  : `With ${nextSession.counsellor.user.profile?.displayName ?? 'your counsellor'} · ${nextSession.counsellor.ministryRole}`}
              </p>
              <p className="mt-3 text-sm">
                <Badge tone={waitingRoomState(nextSession).canEnterSession ? 'positive' : 'gold'}>
                  {waitingRoomState(nextSession).label}
                </Badge>{' '}
                <span className="text-ink-600 dark:text-parchment-300">
                  {waitingRoomState(nextSession).detail}
                </span>
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {waitingRoomState(nextSession).canEnterWaitingRoom ? (
                <ButtonLink
                  href={
                    viewerIsCounsellorOnSession
                      ? `/counsellor/sessions/${nextSession.id}`
                      : `/app/counselling/${nextSession.id}`
                  }
                >
                  {waitingRoomState(nextSession).canEnterSession
                    ? 'Enter Secure Session'
                    : 'Enter Waiting Room'}
                </ButtonLink>
              ) : (
                <ButtonLink
                  href={
                    viewerIsCounsellorOnSession
                      ? `/counsellor/sessions/${nextSession.id}`
                      : `/app/counselling/${nextSession.id}`
                  }
                  variant="secondary"
                >
                  View session details
                </ButtonLink>
              )}
              <p className="max-w-[14rem] text-xs text-ink-500 dark:text-parchment-400">
                The waiting room opens fifteen minutes beforehand and holds only you.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {/* Quick actions */}
      <section className="mb-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="group rounded-xl border border-ink-200/70 bg-white p-5 shadow-card transition hover:border-gold-400 dark:border-ink-800 dark:bg-ink-900"
            >
              <span aria-hidden className="text-2xl text-gold-500">
                {action.icon}
              </span>
              <h2 className="mt-3 font-serif text-lg font-semibold group-hover:text-gold-700 dark:group-hover:text-gold-300">
                {action.title}
              </h2>
              <p className="mt-1.5 text-sm text-ink-600 dark:text-parchment-300">{action.body}</p>
              {action.href === '/app/connections' && pendingConnections > 0 ? (
                <p className="mt-3">
                  <Badge tone="gold">
                    {pendingConnections} request{pendingConnections === 1 ? '' : 's'} waiting
                  </Badge>
                </p>
              ) : null}
            </Link>
          ))}
        </div>
      </section>

      {/* Your activity */}
      <section className="mb-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Prayer requests" value={prayerCount} />
          <StatTile label="Courses in progress" value={courseProgress.length} />
          <StatTile
            label="Connection requests"
            value={pendingConnections}
            hint={pendingConnections > 0 ? 'Awaiting your decision' : undefined}
            tone="gold"
          />
          <StatTile label="Upcoming events" value={upcomingEvents.length} />
        </div>
      </section>

      <GoldRule className="mb-10" />

      <div className="grid gap-10 lg:grid-cols-2">
        {/* Continue learning */}
        <section>
          <h2 className="mb-5 font-serif text-xl font-semibold">Continue learning</h2>
          {courseProgress.length === 0 ? (
            <EmptyState
              icon="📖"
              title="You haven’t started a course yet"
              description="Discipleship courses take you from foundations of faith through to ministry training, and your progress is saved as you go."
              action={<ButtonLink href="/app/discipleship">Browse courses</ButtonLink>}
            />
          ) : (
            <ul className="space-y-4">
              {courseProgress.map((progress) => (
                <Card key={progress.id} as="li">
                  <p className="eyebrow">{progress.course.track}</p>
                  <h3 className="mt-1.5 font-serif text-lg font-semibold">
                    {progress.course.title}
                  </h3>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-ink-600 dark:text-parchment-300">Progress</span>
                      <span className="font-semibold tabular-nums">
                        {progress.percentComplete}%
                      </span>
                    </div>
                    <div
                      className="mt-2 h-2 overflow-hidden rounded-full bg-ink-200 dark:bg-ink-800"
                      role="progressbar"
                      aria-valuenow={progress.percentComplete}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${progress.course.title} progress`}
                    >
                      <div
                        className="h-full rounded-full bg-gold-sheen"
                        style={{ width: `${progress.percentComplete}%` }}
                      />
                    </div>
                  </div>
                  <Link
                    href={`/app/discipleship/${progress.course.slug}`}
                    className="mt-4 inline-block text-sm font-semibold text-gold-700 underline-offset-4 hover:underline dark:text-gold-400"
                  >
                    Continue →
                  </Link>
                </Card>
              ))}
            </ul>
          )}
        </section>

        {/* Announcements and events */}
        <section>
          <h2 className="mb-5 font-serif text-xl font-semibold">Ministry updates</h2>

          {announcements.length > 0 ? (
            <ul className="mb-6 space-y-3">
              {announcements.map((announcement) => (
                <li
                  key={announcement.id}
                  className="rounded-xl border border-ink-200/70 bg-white p-4 dark:border-ink-800 dark:bg-ink-900"
                >
                  <p className="text-xs text-ink-500 dark:text-parchment-400">
                    {relativeTime(announcement.createdAt)}
                  </p>
                  <h3 className="mt-1 font-serif text-base font-semibold">{announcement.title}</h3>
                  <p className="mt-1 text-sm text-ink-600 dark:text-parchment-300">
                    {announcement.body}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}

          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500 dark:text-parchment-400">
            Upcoming events
          </h3>
          {upcomingEvents.length === 0 ? (
            <p className="rounded-xl border border-dashed border-ink-300 p-5 text-sm text-ink-500 dark:border-ink-700 dark:text-parchment-400">
              No events are scheduled at the moment.
            </p>
          ) : (
            <ul className="space-y-3">
              {upcomingEvents.map((event) => (
                <li
                  key={event.id}
                  className="rounded-xl border border-ink-200/70 bg-white p-4 dark:border-ink-800 dark:bg-ink-900"
                >
                  <p className="eyebrow">
                    {formatDateTime(event.startsAt, profile?.timezone ?? 'UTC')}
                  </p>
                  <h4 className="mt-1 font-serif text-base font-semibold">{event.title}</h4>
                  <p className="mt-1 text-sm text-ink-600 dark:text-parchment-300">
                    {event.mode === 'ONLINE' ? 'Online' : (event.location ?? 'In person')}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <h3 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-ink-500 dark:text-parchment-400">
            Recent resources
          </h3>
          <ul className="space-y-2">
            {recentResources.map((resource) => (
              <li key={resource.id}>
                <Link
                  href="/app/resources"
                  className="block rounded-lg px-3 py-2 text-sm text-ink-700 transition hover:bg-parchment-100 dark:text-parchment-200 dark:hover:bg-ink-900"
                >
                  <span className="text-gold-600">•</span> {resource.title}
                  <span className="ml-2 text-xs text-ink-500 dark:text-parchment-400">
                    {resource.topic}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-12">
        <SafeguardingNotice />
      </div>
    </>
  );
}
