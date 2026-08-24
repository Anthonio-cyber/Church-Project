import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requirePageUser } from '@/lib/auth/guard';
import { AppPageHeader } from '@/components/app/AppShell';
import { Badge, ButtonLink, Card, EmptyState, PermissionDenied } from '@/components/ui';
import { CATEGORY_LABEL, waitingRoomState } from '@/lib/domain/counselling';
import { formatDateTime } from '@/lib/format';

export const metadata: Metadata = { title: 'Sessions' };
export const dynamic = 'force-dynamic';

export default async function CounsellorSessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const context = await requirePageUser('/counsellor/sessions');
  const params = await searchParams;
  const scope = params.scope === 'past' ? 'past' : 'upcoming';

  const counsellor = await prisma.counsellor.findUnique({ where: { userId: context.user.id } });
  if (!counsellor || counsellor.status !== 'APPROVED') {
    return <PermissionDenied what="counselling sessions" />;
  }

  const sessions = await prisma.counsellingSession.findMany({
    where: {
      counsellorId: counsellor.id,
      status:
        scope === 'past'
          ? { in: ['COMPLETED', 'CANCELLED', 'NO_SHOW'] }
          : { in: ['CONFIRMED', 'WAITING', 'COUNSELLOR_JOINED', 'ACTIVE'] },
    },
    orderBy: { scheduledFor: scope === 'past' ? 'desc' : 'asc' },
    take: 60,
    include: {
      request: {
        select: {
          category: true,
          summary: true,
          urgency: true,
          requester: { select: { profile: { select: { displayName: true } } } },
        },
      },
      _count: { select: { notes: true } },
    },
  });

  return (
    <>
      <AppPageHeader
        eyebrow="Counsellor Portal"
        title="Your sessions"
        description="Everyone assigned to you. Nobody else's caseload is reachable from here."
      />

      <nav aria-label="Session views" className="mb-6 flex gap-2">
        {[
          { value: 'upcoming', label: 'Upcoming and active' },
          { value: 'past', label: 'Completed' },
        ].map((tab) => (
          <a
            key={tab.value}
            href={`/counsellor/sessions?scope=${tab.value}`}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              scope === tab.value
                ? 'bg-gold-sheen text-ink-950'
                : 'border border-ink-300 dark:border-ink-700'
            }`}
          >
            {tab.label}
          </a>
        ))}
      </nav>

      {sessions.length === 0 ? (
        <EmptyState
          icon="◷"
          title={scope === 'past' ? 'No completed sessions yet' : 'No sessions scheduled'}
          description={
            scope === 'past'
              ? 'Completed sessions appear here with their notes.'
              : 'Accept a request from your queue to schedule a session.'
          }
          action={<ButtonLink href="/counsellor/requests">Open your queue</ButtonLink>}
        />
      ) : (
        <ul className="space-y-4">
          {sessions.map((session) => {
            const state = waitingRoomState(session);
            return (
              <Card key={session.id} as="li">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge tone="gold">{CATEGORY_LABEL[session.request.category]}</Badge>
                      <Badge
                        tone={
                          session.status === 'COMPLETED'
                            ? 'positive'
                            : session.status === 'CANCELLED'
                              ? 'neutral'
                              : session.status === 'WAITING'
                                ? 'caution'
                                : 'info'
                        }
                      >
                        {session.status.toLowerCase().replace('_', ' ')}
                      </Badge>
                      {session.followUpRequired ? <Badge tone="caution">Follow-up</Badge> : null}
                    </div>

                    <p className="font-medium">
                      {session.request.requester.profile?.displayName ?? 'Member'}
                    </p>
                    <p className="mt-1 text-sm text-ink-600 dark:text-parchment-300">
                      {formatDateTime(session.scheduledFor)} · {session.durationMinutes} minutes
                    </p>
                    <p className="mt-2 text-sm text-ink-600 dark:text-parchment-300">
                      {session.request.summary}
                    </p>
                    <p className="mt-2 text-xs text-ink-500 dark:text-parchment-400">
                      {session._count.notes} note{session._count.notes === 1 ? '' : 's'}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <ButtonLink
                      href={`/counsellor/sessions/${session.id}`}
                      variant={state.canEnterWaitingRoom ? 'primary' : 'secondary'}
                    >
                      {state.canEnterSession
                        ? 'Enter session'
                        : state.canEnterWaitingRoom
                          ? 'Join waiting room'
                          : 'View'}
                    </ButtonLink>
                    <ButtonLink
                      href={`/counsellor/sessions/${session.id}/notes`}
                      variant="secondary"
                    >
                      Notes
                    </ButtonLink>
                  </div>
                </div>
              </Card>
            );
          })}
        </ul>
      )}
    </>
  );
}
