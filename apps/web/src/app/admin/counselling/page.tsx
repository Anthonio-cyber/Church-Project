import type { Metadata } from 'next';
import type { CounsellingRequestStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/auth/guard';
import { AppPageHeader } from '@/components/app/AppShell';
import { CounsellingOperations } from '@/components/app/CounsellingOperations';
import { StatTile, Card } from '@/components/ui';
import { CATEGORY_LABEL } from '@/lib/domain/counselling';

export const metadata: Metadata = { title: 'Counselling Operations' };
export const dynamic = 'force-dynamic';

const FILTERS = [
  { value: 'open', label: 'Needs attention', statuses: ['SUBMITTED', 'TRIAGED', 'MATCHING'] },
  { value: 'assigned', label: 'Assigned', statuses: ['ASSIGNED', 'ACCEPTED'] },
  { value: 'scheduled', label: 'Scheduled', statuses: ['SCHEDULED'] },
  { value: 'closed', label: 'Closed', statuses: ['CLOSED', 'CANCELLED', 'DECLINED'] },
] as const;

export default async function AdminCounsellingPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const context = await requirePagePermission(['counselling.view'], '/admin/counselling');
  const params = await searchParams;
  const filter = FILTERS.find((entry) => entry.value === params.filter) ?? FILTERS[0];

  const [requests, counsellors, sessionCounts, waitingNow] = await Promise.all([
    prisma.counsellingRequest.findMany({
      where: { status: { in: [...filter.statuses] as CounsellingRequestStatus[] } },
      orderBy: [{ urgency: 'desc' }, { createdAt: 'asc' }],
      take: 50,
      select: {
        id: true,
        category: true,
        urgency: true,
        status: true,
        preferredMethod: true,
        preferredGender: true,
        language: true,
        createdAt: true,
        safeguardingFlagged: true,
        // The member's summary is deliberately not selected: operations do not
        // require reading what someone wishes to discuss.
        requester: {
          select: { profile: { select: { displayName: true, ageBand: true } } },
        },
        assignedCounsellor: {
          select: { id: true, user: { select: { profile: { select: { displayName: true } } } } },
        },
        session: { select: { scheduledFor: true } },
      },
    }),
    prisma.counsellor.findMany({
      where: { status: 'APPROVED' },
      select: {
        id: true,
        availabilityState: true,
        categories: true,
        languages: true,
        acceptsMinors: true,
        maxConcurrentCases: true,
        user: { select: { profile: { select: { displayName: true, gender: true } } } },
        _count: {
          select: { sessions: { where: { status: { in: ['CONFIRMED', 'WAITING', 'ACTIVE'] } } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.counsellingSession.groupBy({ by: ['status'], _count: true }),
    prisma.counsellingSession.count({ where: { status: 'WAITING' } }),
  ]);

  const unassigned = await prisma.counsellingRequest.count({
    where: { status: { in: ['SUBMITTED', 'TRIAGED', 'MATCHING'] }, assignedCounsellorId: null },
  });
  const flagged = await prisma.counsellingRequest.count({
    where: { safeguardingFlagged: true, status: { notIn: ['CLOSED', 'CANCELLED'] } },
  });

  const countFor = (status: string) =>
    sessionCounts.find((row) => row.status === status)?._count ?? 0;

  return (
    <>
      <AppPageHeader
        eyebrow="Admin Portal"
        title="Counselling operations"
        description="Assignment, scheduling and capacity. This portal does not contain counselling conversations or notes, and there is no route from here to them."
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile
          label="Unassigned"
          value={unassigned}
          tone={unassigned > 0 ? 'caution' : 'neutral'}
          hint={unassigned > 0 ? 'Waiting for a counsellor' : undefined}
        />
        <StatTile label="Scheduled" value={countFor('CONFIRMED')} />
        <StatTile
          label="In the waiting room"
          value={waitingNow}
          tone={waitingNow > 0 ? 'positive' : 'neutral'}
          hint={waitingNow > 0 ? 'Someone is waiting now' : undefined}
        />
        <StatTile label="Completed" value={countFor('COMPLETED')} />
        <StatTile
          label="Safeguarding flagged"
          value={flagged}
          tone={flagged > 0 ? 'critical' : 'neutral'}
        />
      </div>

      <nav aria-label="Counselling filters" className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((entry) => (
          <a
            key={entry.value}
            href={`/admin/counselling?filter=${entry.value}`}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              filter.value === entry.value
                ? 'bg-gold-sheen text-ink-950'
                : 'border border-ink-300 dark:border-ink-700'
            }`}
          >
            {entry.label}
          </a>
        ))}
      </nav>

      <CounsellingOperations
        canAssign={context.permissions.has('counselling.assign')}
        requests={requests.map((request) => ({
          id: request.id,
          categoryLabel: CATEGORY_LABEL[request.category],
          urgency: request.urgency,
          status: request.status,
          preferredMethod: request.preferredMethod,
          preferredGender: request.preferredGender,
          language: request.language,
          createdAt: request.createdAt.toISOString(),
          safeguardingFlagged: request.safeguardingFlagged,
          memberName: request.requester.profile?.displayName ?? 'Member',
          memberIsMinor: request.requester.profile?.ageBand === 'MINOR',
          assignedCounsellor: request.assignedCounsellor
            ? {
                id: request.assignedCounsellor.id,
                displayName:
                  request.assignedCounsellor.user.profile?.displayName ?? 'Counsellor',
              }
            : null,
          sessionScheduledFor: request.session?.scheduledFor.toISOString() ?? null,
        }))}
        counsellors={counsellors.map((counsellor) => ({
          id: counsellor.id,
          displayName: counsellor.user.profile?.displayName ?? 'Counsellor',
          gender: counsellor.user.profile?.gender ?? 'UNSPECIFIED',
          availabilityState: counsellor.availabilityState,
          categories: counsellor.categories,
          languages: counsellor.languages,
          acceptsMinors: counsellor.acceptsMinors,
          caseload: counsellor._count.sessions,
          capacity: counsellor.maxConcurrentCases,
        }))}
      />

      <Card className="mt-8 border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
        <h2 className="font-serif text-lg font-semibold text-amber-900 dark:text-amber-100">
          Counsellor capacity
        </h2>
        <ul className="mt-4 space-y-2">
          {counsellors.map((counsellor) => {
            const load = counsellor._count.sessions;
            const percent = Math.min(100, (load / counsellor.maxConcurrentCases) * 100);
            return (
              <li key={counsellor.id} className="text-sm">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-amber-900 dark:text-amber-100">
                    {counsellor.user.profile?.displayName ?? 'Counsellor'}
                  </span>
                  <span className="tabular-nums text-amber-800 dark:text-amber-200">
                    {load}/{counsellor.maxConcurrentCases}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-amber-200 dark:bg-amber-900">
                  <div
                    className={`h-full rounded-full ${percent >= 100 ? 'bg-red-500' : 'bg-gold-500'}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </li>
            );
          })}
          {counsellors.length === 0 ? (
            <li className="text-sm text-amber-900 dark:text-amber-100">
              No approved counsellors yet. Verify an application to begin assigning requests.
            </li>
          ) : null}
        </ul>
      </Card>
    </>
  );
}
