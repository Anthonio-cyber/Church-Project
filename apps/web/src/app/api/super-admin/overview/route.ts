import { prisma } from '@/lib/db';
import { ok, route } from '@/lib/api';
import { requirePermission } from '@/lib/auth/context';
import { integrationStatus } from '@/lib/env';
import { subscriberCount } from '@/lib/realtime';
import { getAllFlags } from '@/lib/domain/settings';
import { ADMIN_ROLES } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

/**
 * The Setman's overview: the whole platform in one view.
 *
 * Even here, the numbers are aggregates. Holding the highest office does not
 * come with a window into people's counselling conversations — reading a
 * specific record still means opening it deliberately, with a reason, on a
 * route that records the access.
 */
export const GET = route(async () => {
  const context = await requirePermission('audit_logs.view');

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000);

  let databaseOnline = true;
  const probeStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    databaseOnline = false;
  }

  const [
    totalUsers,
    activeCenters,
    counsellorCounts,
    adminCount,
    moderatorCount,
    pendingApprovals,
    securityAlerts,
    openSafeguarding,
    auditActivity24h,
    recentHierarchyChanges,
    flags,
    storageRows,
  ] = await Promise.all([
    prisma.user.count({ where: { status: { not: 'DELETED' } } }),
    prisma.ministryCenter.count({ where: { isActive: true } }),
    prisma.counsellor.groupBy({ by: ['status'], _count: true }),
    prisma.user.count({ where: { roles: { some: { role: { key: { in: ADMIN_ROLES } } } } } }),
    prisma.user.count({ where: { roles: { some: { role: { key: 'MODERATOR' } } } } }),
    prisma.churchHierarchyNode.count({ where: { status: 'PENDING_APPROVAL' } }),
    prisma.securityEvent.count({
      where: { createdAt: { gte: dayAgo }, severity: { in: ['warning', 'critical'] } },
    }),
    context.permissions.has('safeguarding.view')
      ? prisma.safeguardingCase.count({ where: { status: { in: ['OPEN', 'UNDER_ASSESSMENT', 'ESCALATED'] } } })
      : Promise.resolve(null),
    prisma.auditLog.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.hierarchyChange.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { node: { select: { personName: true, title: true, administrativeRole: true } } },
    }),
    getAllFlags(),
    prisma.$queryRaw<{ total: string }[]>`SELECT pg_size_pretty(pg_database_size(current_database())) AS total`,
  ]);

  return ok({
    platform: {
      totalUsers,
      activeCenters,
      administrators: adminCount,
      moderators: moderatorCount,
      counsellors: counsellorCounts.map((row) => ({ status: row.status, count: row._count })),
      pendingApprovals,
      securityAlerts,
      openSafeguarding,
      auditActivity24h,
    },
    health: {
      services: {
        database: databaseOnline ? 'online' : 'offline',
        authentication: databaseOnline ? 'online' : 'degraded',
        realtime: 'online',
        api: 'online',
        email: integrationStatus('email'),
        push: integrationStatus('push'),
        storage: integrationStatus('storage'),
        video: integrationStatus('video'),
        backups: process.env.BACKUP_SCHEDULE ? 'configured' : 'not_configured',
      },
      databaseLatencyMs: Date.now() - probeStart,
      databaseSize: storageRows[0]?.total ?? 'unknown',
      realtimeSubscribers: subscriberCount(),
      uptimeSeconds: Math.floor(process.uptime()),
    },
    featureFlags: flags,
    recentHierarchyChanges: recentHierarchyChanges.map((change) => ({
      at: change.createdAt,
      changeType: change.changeType,
      reason: change.reason,
      person: change.node.personName,
      title: change.node.title,
      administrativeRole: change.node.administrativeRole,
    })),
  });
});
