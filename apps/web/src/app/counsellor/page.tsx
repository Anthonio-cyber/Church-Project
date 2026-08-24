import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requirePageUser } from '@/lib/auth/guard';
import { AppPageHeader } from '@/components/app/AppShell';
import { Badge, ButtonLink, Card, EmptyState, StatTile } from '@/components/ui';
import { CATEGORY_LABEL, waitingRoomState } from '@/lib/domain/counselling';
import { formatTime, greeting } from '@/lib/format';

export const metadata: Metadata = { title: 'Counsellor Dashboard' };
export const dynamic = 'force-dynamic';

export default async function CounsellorDashboard() {
  const context = await requirePageUser('/counsellor');

  const counsellor = await prisma.counsellor.findUnique({
    where: { userId: context.user.id },
    include: { user: { select: { profile: { select: { firstName: true, timezone: true } } } } },
  });
  if (!counsellor) return null;

  // An unapproved counsellor sees their application state and nothing else —
  // no queue, no caseload, no member information.
  if (counsellor.status !== 'APPROVED') {
    return (
      <div className="mx-auto max-w-2xl">
        <AppPageHeader
          eyebrow="Counsellor"
          title="Your application"
          description="Counselling requests reach you only after an authorised administrator has verified your application."
        />
        <Card>
          <div className="flex items-center gap-3">
            <Badge
              tone={
                counsellor.status === 'SUSPENDED'
                  ? 'critical'
                  : counsellor.status === 'REJECTED'
                    ? 'critical'
                    : 'caution'
              }
            >
              {counsellor.status.toLowerCase().replace('_', ' ')}
            </Badge>
            <span className="text-sm text-ink-500 dark:text-parchment-400">
              submitted {counsellor.createdAt.toLocaleDateString()}
            </span>
          </div>

          <p className="mt-5 text-sm leading-relaxed text-ink-700 dark:text-parchment-200">
            {counsellor.status === 'PENDING'
              ? 'Your application is waiting for review. You will be notified once it has been considered.'
              : counsellor.status === 'UNDER_REVIEW'
                ? 'Your application is being reviewed by the counselling team.'
                : counsellor.status === 'SUSPENDED'
                  ? 'Your counsellor account is suspended. Please speak with your supervising leader.'
                  : 'Your application was not approved at this time. Please speak with your ministry leader.'}
          </p>

          {counsellor.statusReason ? (
            <p className="mt-4 rounded-lg border border-ink-200 bg-parchment-100 p-4 text-sm dark:border-ink-800 dark:bg-ink-950">
              {counsellor.statusReason}
            </p>
          ) : null}

          {!context.user.mfaEnabled ? (
            <p className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              Counsellors must use multi-factor authentication.{' '}
              <Link href="/app/privacy" className="font-medium underline underline-offset-4">
                Set it up now
              </Link>{' '}
              so you are ready if your application is approved.
            </p>
          ) : null}
        </Card>
      </div>
    );
  }

  const timezone = counsellor.user.profile?.timezone ?? 'UTC';
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay.getTime() + 24 * 3600 * 1000);

  const [today, upcoming, pending, completedCount, followUps] = await Promise.all([
    prisma.counsellingSession.findMany({
      where: {
        counsellorId: counsellor.id,
        scheduledFor: { gte: startOfDay, lt: endOfDay },
        status: { not: 'CANCELLED' },
      },
      orderBy: { scheduledFor: 'asc' },
      include: {
        request: {
          select: {
            category: true,
            summary: true,
            urgency: true,
            requester: { select: { profile: { select: { displayName: true } } } },
          },
        },
      },
    }),
    prisma.counsellingSession.count({
      where: {
        counsellorId: counsellor.id,
        scheduledFor: { gte: endOfDay },
        status: { in: ['CONFIRMED', 'WAITING'] },
      },
    }),
    prisma.counsellingRequest.count({
      where: {
        status: { in: ['MATCHING', 'ASSIGNED'] },
        OR: [
          { assignedCounsellorId: counsellor.id },
          { assignedCounsellorId: null, category: { in: counsellor.categories } },
        ],
      },
    }),
    prisma.counsellingSession.count({
      where: { counsellorId: counsellor.id, status: 'COMPLETED' },
    }),
    prisma.counsellingSession.count({
      where: { counsellorId: counsellor.id, followUpRequired: true, status: 'COMPLETED' },
    }),
  ]);

  return (
    <>
      <AppPageHeader
        eyebrow="Counsellor Portal"
        title={`${greeting()}, ${counsellor.user.profile?.firstName ?? 'friend'}`}
        description="Today's sessions, your queue, and the people you are walking with."
        action={
          <div className="flex items-center gap-2">
            <Badge
              tone={
                counsellor.availabilityState === 'AVAILABLE'
                  ? 'positive'
                  : counsellor.availabilityState === 'BUSY'
                    ? 'caution'
                    : 'neutral'
              }
            >
              {counsellor.availabilityState.toLowerCase()}
            </Badge>
            <ButtonLink href="/counsellor/availability" variant="secondary">
              Update availability
            </ButtonLink>
          </div>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Today" value={today.length} />
        <StatTile label="Upcoming" value={upcoming} />
        <StatTile
          label="Pending requests"
          value={pending}
          hint={pending > 0 ? 'Awaiting a response' : undefined}
          tone="gold"
        />
        <StatTile label="Completed" value={completedCount} />
        <StatTile label="Follow-ups" value={followUps} />
      </div>

      <section className="mb-10">
        <h2 className="mb-5 font-serif text-xl font-semibold">Today’s sessions</h2>
        {today.length === 0 ? (
          <EmptyState
            icon="◷"
            title="Nothing scheduled today"
            description="When a session is scheduled it appears here, with a direct route into the waiting room."
            action={<ButtonLink href="/counsellor/requests">See pending requests</ButtonLink>}
          />
        ) : (
          <ul className="space-y-4">
            {today.map((session) => {
              const state = waitingRoomState(session);
              return (
                <Card key={session.id} as="li">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="font-mono text-lg font-semibold">
                          {formatTime(session.scheduledFor, timezone)}
                        </span>
                        <Badge tone="gold">{CATEGORY_LABEL[session.request.category]}</Badge>
                        {session.request.urgency === 'URGENT' ? (
                          <Badge tone="critical">Urgent</Badge>
                        ) : null}
                        {session.status === 'WAITING' ? (
                          <Badge tone="positive">Member is waiting</Badge>
                        ) : null}
                      </div>
                      <p className="text-sm font-medium">
                        {session.request.requester.profile?.displayName ?? 'Member'}
                      </p>
                      <p className="mt-1.5 text-sm text-ink-600 dark:text-parchment-300">
                        {session.request.summary}
                      </p>
                    </div>

                    <ButtonLink
                      href={`/counsellor/sessions/${session.id}`}
                      variant={state.canEnterWaitingRoom ? 'primary' : 'secondary'}
                    >
                      {state.canEnterSession
                        ? 'Enter session'
                        : state.canEnterWaitingRoom
                          ? 'Join waiting room'
                          : 'View session'}
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
