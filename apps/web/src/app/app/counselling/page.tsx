import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requirePageUser } from '@/lib/auth/guard';
import { AppPageHeader } from '@/components/app/AppShell';
import { Badge, ButtonLink, Card, EmptyState, SafeguardingNotice } from '@/components/ui';
import { CATEGORY_LABEL, waitingRoomState } from '@/lib/domain/counselling';
import { formatDateTime } from '@/lib/format';

export const metadata: Metadata = { title: 'Counselling' };
export const dynamic = 'force-dynamic';

const STATUS_TONE = {
  SUBMITTED: 'neutral',
  TRIAGED: 'neutral',
  MATCHING: 'info',
  ASSIGNED: 'info',
  ACCEPTED: 'positive',
  SCHEDULED: 'positive',
  DECLINED: 'caution',
  CANCELLED: 'neutral',
  CLOSED: 'neutral',
} as const;

const STATUS_LABEL = {
  SUBMITTED: 'Received',
  TRIAGED: 'Being reviewed',
  MATCHING: 'Finding a counsellor',
  ASSIGNED: 'Counsellor assigned',
  ACCEPTED: 'Accepted',
  SCHEDULED: 'Session scheduled',
  DECLINED: 'Back in the queue',
  CANCELLED: 'Cancelled',
  CLOSED: 'Completed',
} as const;

export default async function CounsellingPage() {
  const context = await requirePageUser('/app/counselling');

  const [requests, profile, followUps] = await Promise.all([
    prisma.counsellingRequest.findMany({
      where: { requesterId: context.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        assignedCounsellor: {
          select: {
            ministryRole: true,
            user: { select: { profile: { select: { displayName: true } } } },
          },
        },
        session: true,
      },
    }),
    prisma.profile.findUnique({ where: { userId: context.user.id } }),
    // Only SHARED_FOLLOW_UP notes are ever exposed to the member. Internal
    // counsellor notes are not queried here at all.
    prisma.sessionNote.findMany({
      where: {
        kind: 'SHARED_FOLLOW_UP',
        session: { request: { requesterId: context.user.id } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, createdAt: true, sessionId: true },
    }),
  ]);

  const timezone = profile?.timezone ?? 'UTC';
  const active = requests.filter(
    (request) => !['CLOSED', 'CANCELLED'].includes(request.status),
  );
  const past = requests.filter((request) => ['CLOSED', 'CANCELLED'].includes(request.status));

  return (
    <>
      <AppPageHeader
        eyebrow="Pastoral counselling"
        title="Your counselling"
        description="Your requests, scheduled sessions and follow-up notes written for you."
        action={<ButtonLink href="/app/counselling/request">Request counselling</ButtonLink>}
      />

      {requests.length === 0 ? (
        <EmptyState
          icon="✚"
          title="You have not requested counselling yet"
          description="When you are ready, tell us a little about what you would like to talk about. The counselling team will match you with an approved counsellor, and your session stays private between the two of you."
          action={<ButtonLink href="/app/counselling/request">Request pastoral counselling</ButtonLink>}
        />
      ) : (
        <>
          {active.length > 0 ? (
            <section className="mb-10">
              <h2 className="mb-5 font-serif text-xl font-semibold">Active</h2>
              <ul className="space-y-4">
                {active.map((request) => {
                  const state = request.session ? waitingRoomState(request.session) : null;
                  return (
                    <Card key={request.id} as="li">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <Badge tone={STATUS_TONE[request.status]}>
                              {STATUS_LABEL[request.status]}
                            </Badge>
                            <Badge tone="gold">{CATEGORY_LABEL[request.category]}</Badge>
                            {request.urgency === 'URGENT' ? (
                              <Badge tone="critical">Urgent</Badge>
                            ) : null}
                          </div>
                          <p className="font-serif text-lg font-semibold">{request.summary}</p>

                          {request.assignedCounsellor ? (
                            <p className="mt-2 text-sm text-ink-600 dark:text-parchment-300">
                              With{' '}
                              <span className="font-medium">
                                {request.assignedCounsellor.user.profile?.displayName ?? 'your counsellor'}
                              </span>{' '}
                              · {request.assignedCounsellor.ministryRole}
                            </p>
                          ) : (
                            <p className="mt-2 text-sm text-ink-600 dark:text-parchment-300">
                              The counselling team is matching you with a counsellor.
                            </p>
                          )}

                          {request.session ? (
                            <p className="mt-3 text-sm">
                              <span className="font-medium">
                                {formatDateTime(request.session.scheduledFor, timezone)}
                              </span>
                              <span className="ml-2 text-ink-500 dark:text-parchment-400">
                                · {request.session.durationMinutes} minutes ·{' '}
                                {request.session.method === 'TEXT'
                                  ? 'Written conversation'
                                  : request.session.method === 'VIDEO'
                                    ? 'Video call'
                                    : request.session.method === 'VOICE'
                                      ? 'Voice call'
                                      : 'In person'}
                              </span>
                            </p>
                          ) : null}

                          {state ? (
                            <p className="mt-2 text-sm text-ink-600 dark:text-parchment-300">
                              {state.detail}
                            </p>
                          ) : null}
                        </div>

                        {request.session ? (
                          <ButtonLink
                            href={`/app/counselling/${request.session.id}`}
                            variant={state?.canEnterWaitingRoom ? 'primary' : 'secondary'}
                          >
                            {state?.canEnterSession
                              ? 'Enter Secure Session'
                              : state?.canEnterWaitingRoom
                                ? 'Enter Waiting Room'
                                : 'View session'}
                          </ButtonLink>
                        ) : null}
                      </div>
                    </Card>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {followUps.length > 0 ? (
            <section className="mb-10">
              <h2 className="mb-5 font-serif text-xl font-semibold">Follow-up notes for you</h2>
              <ul className="space-y-3">
                {followUps.map((note) => (
                  <li
                    key={note.id}
                    className="rounded-xl border border-ink-200/70 bg-white p-4 dark:border-ink-800 dark:bg-ink-900"
                  >
                    <p className="text-sm text-ink-600 dark:text-parchment-300">
                      Your counsellor left a follow-up note on{' '}
                      {formatDateTime(note.createdAt, timezone)}.
                    </p>
                    <Link
                      href={`/app/counselling/${note.sessionId}`}
                      className="mt-2 inline-block text-sm font-semibold text-gold-700 underline-offset-4 hover:underline dark:text-gold-400"
                    >
                      Read it →
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {past.length > 0 ? (
            <section className="mb-10">
              <h2 className="mb-5 font-serif text-xl font-semibold">Past</h2>
              <ul className="space-y-3">
                {past.map((request) => (
                  <li
                    key={request.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-200/70 bg-white px-5 py-4 dark:border-ink-800 dark:bg-ink-900"
                  >
                    <div>
                      <p className="font-medium">{CATEGORY_LABEL[request.category]}</p>
                      <p className="text-sm text-ink-500 dark:text-parchment-400">
                        {request.session
                          ? formatDateTime(request.session.scheduledFor, timezone)
                          : formatDateTime(request.createdAt, timezone)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge tone={STATUS_TONE[request.status]}>
                        {STATUS_LABEL[request.status]}
                      </Badge>
                      {request.session ? (
                        <Link
                          href={`/app/counselling/${request.session.id}`}
                          className="text-sm font-semibold text-gold-700 underline-offset-4 hover:underline dark:text-gold-400"
                        >
                          View
                        </Link>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      <div className="mt-10">
        <SafeguardingNotice />
      </div>
    </>
  );
}
