import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/auth/guard';
import { AppPageHeader } from '@/components/app/AppShell';
import { BarChart, DistributionBar } from '@/components/app/Charts';
import { Card, StatTile } from '@/components/ui';

export const metadata: Metadata = { title: 'Admin Overview' };
export const dynamic = 'force-dynamic';

/**
 * The administrative overview.
 *
 * Everything here is a count or an aggregate. No counselling content, no
 * message bodies, no safeguarding narratives, no personal detail: the church is
 * administered on operational statistics, not by reading people's pastoral
 * conversations.
 */
export default async function AdminOverviewPage() {
  const context = await requirePagePermission(['analytics.view', 'users.view'], '/admin');

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

  const [
    totalUsers,
    activeUsers,
    newUsers,
    verifiedCounsellors,
    pendingCounsellors,
    upcomingSessions,
    activeSessions,
    openReports,
    prayerRequests,
    courseEnrollments,
    upcomingEvents,
    ministryCenters,
    pendingHierarchy,
    securityAlerts,
    openSafeguarding,
    sessionStatuses,
    connectionCounts,
  ] = await Promise.all([
    prisma.user.count({ where: { status: { not: 'DELETED' } } }),
    prisma.user.count({ where: { status: 'ACTIVE', lastLoginAt: { gte: thirtyDaysAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.counsellor.count({ where: { status: 'APPROVED' } }),
    prisma.counsellor.count({ where: { status: { in: ['PENDING', 'UNDER_REVIEW'] } } }),
    prisma.counsellingSession.count({
      where: { scheduledFor: { gte: now }, status: { in: ['CONFIRMED', 'WAITING'] } },
    }),
    prisma.counsellingSession.count({
      where: { status: { in: ['ACTIVE', 'COUNSELLOR_JOINED'] } },
    }),
    prisma.report.count({
      where: { status: { in: ['OPEN', 'UNDER_REVIEW', 'ACTION_REQUIRED'] } },
    }),
    prisma.prayerRequest.count({ where: { deletedAt: null } }),
    prisma.courseProgress.count(),
    prisma.event.count({
      where: { status: 'PUBLISHED', startsAt: { gte: now }, cancelledAt: null },
    }),
    prisma.ministryCenter.count({ where: { isActive: true } }),
    prisma.churchHierarchyNode.count({ where: { status: 'PENDING_APPROVAL' } }),
    prisma.securityEvent.count({
      where: { createdAt: { gte: sevenDaysAgo }, severity: { in: ['warning', 'critical'] } },
    }),
    // Safeguarding is surfaced only as a count, and only to those permitted.
    context.permissions.has('safeguarding.view')
      ? prisma.safeguardingCase.count({
          where: { status: { in: ['OPEN', 'UNDER_ASSESSMENT', 'ESCALATED'] } },
        })
      : Promise.resolve(null),
    prisma.counsellingSession.groupBy({ by: ['status'], _count: true }),
    prisma.connectionRequest.groupBy({ by: ['status'], _count: true }),
  ]);

  // Weekly trends, aggregated in SQL rather than pulled into memory.
  const [userGrowth, counsellingDemand, reportTrends, resourceEngagement] = await Promise.all([
    prisma.$queryRaw<{ week: Date; count: bigint }[]>`
      SELECT date_trunc('week', "createdAt") AS week, COUNT(*)::bigint AS count
      FROM users WHERE "createdAt" >= NOW() - INTERVAL '12 weeks'
      GROUP BY week ORDER BY week ASC`,
    prisma.$queryRaw<{ week: Date; count: bigint }[]>`
      SELECT date_trunc('week', "createdAt") AS week, COUNT(*)::bigint AS count
      FROM counselling_requests WHERE "createdAt" >= NOW() - INTERVAL '12 weeks'
      GROUP BY week ORDER BY week ASC`,
    prisma.$queryRaw<{ week: Date; count: bigint }[]>`
      SELECT date_trunc('week', "createdAt") AS week, COUNT(*)::bigint AS count
      FROM reports WHERE "createdAt" >= NOW() - INTERVAL '12 weeks'
      GROUP BY week ORDER BY week ASC`,
    prisma.resource.findMany({
      where: { status: 'PUBLISHED' },
      select: { title: true, viewCount: true },
      orderBy: { viewCount: 'desc' },
      take: 8,
    }),
  ]);

  const toSeries = (rows: { week: Date; count: bigint }[]) =>
    rows.map((row) => ({
      label: row.week.toISOString().slice(5, 10),
      value: Number(row.count),
    }));

  return (
    <>
      <AppPageHeader
        eyebrow="Admin Portal"
        title="Overview"
        description="Operational statistics for the ministry. Aggregated and anonymised — no counselling content appears anywhere on this page."
      />

      <section className="mb-10">
        <h2 className="mb-4 font-serif text-lg font-semibold">People</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Total members" value={totalUsers} />
          <StatTile label="Active (30 days)" value={activeUsers} />
          <StatTile label="New (30 days)" value={newUsers} tone="positive" hint="Growth" />
          <StatTile label="Ministry centres" value={ministryCenters} />
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 font-serif text-lg font-semibold">Pastoral care</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatTile label="Verified counsellors" value={verifiedCounsellors} />
          <StatTile
            label="Pending applications"
            value={pendingCounsellors}
            tone="caution"
            hint={pendingCounsellors > 0 ? 'Awaiting verification' : undefined}
          />
          <StatTile label="Upcoming sessions" value={upcomingSessions} />
          <StatTile
            label="Sessions in progress"
            value={activeSessions}
            tone="positive"
            hint={activeSessions > 0 ? 'Live now' : undefined}
          />
          <StatTile label="Prayer requests" value={prayerRequests} />
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 font-serif text-lg font-semibold">Attention</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Open reports"
            value={openReports}
            tone={openReports > 0 ? 'caution' : 'neutral'}
            hint={openReports > 0 ? 'In the moderation queue' : undefined}
          />
          <StatTile
            label="Security alerts (7 days)"
            value={securityAlerts}
            tone={securityAlerts > 0 ? 'critical' : 'neutral'}
          />
          <StatTile
            label="Pending approvals"
            value={pendingHierarchy}
            hint={pendingHierarchy > 0 ? 'Hierarchy changes' : undefined}
          />
          {openSafeguarding !== null ? (
            <StatTile
              label="Open safeguarding cases"
              value={openSafeguarding}
              tone={openSafeguarding > 0 ? 'critical' : 'neutral'}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-ink-300 p-4 text-sm text-ink-500 dark:border-ink-700 dark:text-parchment-400">
              Safeguarding figures are limited to safeguarding leads.
            </div>
          )}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 font-serif text-lg font-semibold">Learning and gathering</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile label="Course enrolments" value={courseEnrollments} />
          <StatTile label="Upcoming events" value={upcomingEvents} />
          <StatTile label="Published resources" value={resourceEngagement.length} />
        </div>
      </section>

      <section className="mb-10 grid gap-6 lg:grid-cols-2">
        <BarChart
          title="Member growth"
          description="New accounts per week, last twelve weeks"
          data={toSeries(userGrowth)}
        />
        <BarChart
          title="Counselling demand"
          description="Requests per week, last twelve weeks"
          data={toSeries(counsellingDemand)}
        />
        <BarChart
          title="Report trends"
          description="Reports submitted per week, last twelve weeks"
          data={toSeries(reportTrends)}
        />
        <DistributionBar
          title="Session outcomes"
          description="All counselling sessions by current status"
          data={sessionStatuses.map((row) => ({ label: row.status, value: row._count }))}
        />
        <DistributionBar
          title="Connection requests"
          description="How members respond to requests to connect"
          data={connectionCounts.map((row) => ({ label: row.status, value: row._count }))}
        />
        <Card>
          <h3 className="mb-4 font-serif text-base font-semibold">Resource engagement</h3>
          {resourceEngagement.length === 0 ? (
            <p className="text-sm text-ink-500 dark:text-parchment-400">
              No published resources yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {resourceEngagement.map((resource) => (
                <li key={resource.title} className="flex items-center justify-between text-sm">
                  <span className="truncate pr-4 text-ink-700 dark:text-parchment-200">
                    {resource.title}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">{resource.viewCount}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <Card className="border-gold-300 bg-gold-50/40 dark:border-gold-800 dark:bg-gold-950/20">
        <h2 className="font-serif text-lg font-semibold">What this page deliberately omits</h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-700 dark:text-parchment-200">
          Counselling conversations, counsellor notes, safeguarding narratives, message content and
          private prayer requests are not aggregated here and are not reachable from any
          administrative analytics route. Reading a specific record means opening it deliberately,
          with a stated reason, on a route that records the access.
        </p>
      </Card>
    </>
  );
}
