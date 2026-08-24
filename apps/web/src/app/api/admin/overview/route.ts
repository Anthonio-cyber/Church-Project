import { prisma } from '@/lib/db';
import { ok, route } from '@/lib/api';
import { requirePermission } from '@/lib/auth/context';

export const dynamic = 'force-dynamic';

/**
 * Administrative overview.
 *
 * Every figure here is a count or an aggregate. No counselling content, no
 * message bodies, no safeguarding narratives and no personal detail reach this
 * route — administration is run on operational statistics, not on reading
 * people's pastoral conversations.
 */
export const GET = route(async () => {
  const context = await requirePermission('analytics.view');

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
  ] = await Promise.all([
    prisma.user.count({ where: { status: { not: 'DELETED' } } }),
    prisma.user.count({ where: { status: 'ACTIVE', lastLoginAt: { gte: thirtyDaysAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.counsellor.count({ where: { status: 'APPROVED' } }),
    prisma.counsellor.count({ where: { status: { in: ['PENDING', 'UNDER_REVIEW'] } } }),
    prisma.counsellingSession.count({
      where: { scheduledFor: { gte: now }, status: { in: ['CONFIRMED', 'WAITING'] } },
    }),
    prisma.counsellingSession.count({ where: { status: { in: ['ACTIVE', 'COUNSELLOR_JOINED'] } } }),
    prisma.report.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW', 'ACTION_REQUIRED'] } } }),
    prisma.prayerRequest.count({ where: { deletedAt: null } }),
    prisma.courseProgress.count(),
    prisma.event.count({ where: { status: 'PUBLISHED', startsAt: { gte: now }, cancelledAt: null } }),
    prisma.ministryCenter.count({ where: { isActive: true } }),
    prisma.churchHierarchyNode.count({ where: { status: 'PENDING_APPROVAL' } }),
    prisma.securityEvent.count({
      where: { createdAt: { gte: sevenDaysAgo }, severity: { in: ['warning', 'critical'] } },
    }),
    // Safeguarding is reported only as a count, and only to those who may see it.
    context.permissions.has('safeguarding.view')
      ? prisma.safeguardingCase.count({ where: { status: { in: ['OPEN', 'UNDER_ASSESSMENT', 'ESCALATED'] } } })
      : Promise.resolve(null),
  ]);

  // Twelve weeks of trend data, aggregated in SQL rather than pulled into memory.
  const userGrowth = await prisma.$queryRaw<{ week: Date; count: bigint }[]>`
    SELECT date_trunc('week', "createdAt") AS week, COUNT(*)::bigint AS count
    FROM users
    WHERE "createdAt" >= NOW() - INTERVAL '12 weeks'
    GROUP BY week ORDER BY week ASC`;

  const counsellingDemand = await prisma.$queryRaw<{ week: Date; count: bigint }[]>`
    SELECT date_trunc('week', "createdAt") AS week, COUNT(*)::bigint AS count
    FROM counselling_requests
    WHERE "createdAt" >= NOW() - INTERVAL '12 weeks'
    GROUP BY week ORDER BY week ASC`;

  const sessionCompletion = await prisma.$queryRaw<{ status: string; count: bigint }[]>`
    SELECT status::text AS status, COUNT(*)::bigint AS count
    FROM counselling_sessions
    WHERE "createdAt" >= NOW() - INTERVAL '12 weeks'
    GROUP BY status`;

  const reportTrends = await prisma.$queryRaw<{ week: Date; count: bigint }[]>`
    SELECT date_trunc('week', "createdAt") AS week, COUNT(*)::bigint AS count
    FROM reports
    WHERE "createdAt" >= NOW() - INTERVAL '12 weeks'
    GROUP BY week ORDER BY week ASC`;

  const centerActivity = await prisma.ministryCenter.findMany({
    where: { isActive: true },
    select: {
      name: true,
      _count: { select: { members: true, events: true, counsellors: true } },
    },
    orderBy: { name: 'asc' },
  });

  const toSeries = (rows: { week: Date; count: bigint }[]) =>
    rows.map((row) => ({ week: row.week.toISOString().slice(0, 10), count: Number(row.count) }));

  return ok({
    cards: {
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
    },
    charts: {
      userGrowth: toSeries(userGrowth),
      counsellingDemand: toSeries(counsellingDemand),
      reportTrends: toSeries(reportTrends),
      sessionCompletion: sessionCompletion.map((row) => ({
        status: row.status,
        count: Number(row.count),
      })),
      ministryCenterActivity: centerActivity.map((center) => ({
        name: center.name,
        members: center._count.members,
        events: center._count.events,
        counsellors: center._count.counsellors,
      })),
    },
    note: 'All figures are aggregated. This view contains no counselling content, message content or personal detail.',
  });
});
