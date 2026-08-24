import { prisma } from '@/lib/db';
import { ok, route } from '@/lib/api';
import { requirePermission } from '@/lib/auth/context';
import { integrationStatus } from '@/lib/env';
import { subscriberCount } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

/**
 * Security centre and live system monitor.
 *
 * Two things in one place because they answer the same question: is the
 * platform behaving, and is anyone attacking it.
 */
export const GET = route(async () => {
  // Reading the security dashboard is itself a sensitive act — it exposes
  // failed sign-in patterns and account states — so it carries MFA, fresh
  // re-authentication and a recorded reason like every sensitive permission.
  await requirePermission('security.manage', {
    reason: 'Reviewing the security centre and system health.',
  });

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

  const probeStart = Date.now();
  let databaseOnline = true;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    databaseOnline = false;
  }
  const databaseLatencyMs = Date.now() - probeStart;

  const [
    failedLogins24h,
    failedLogins7d,
    lockedAccounts,
    rateLimitEvents,
    mfaChanges,
    passwordResets,
    sessionRevocations,
    permissionDenials,
    newAdminAccounts,
    roleChanges,
    activeSessions,
    recentEvents,
    suspiciousLocations,
  ] = await Promise.all([
    prisma.securityEvent.count({ where: { kind: 'LOGIN_FAILURE', createdAt: { gte: dayAgo } } }),
    prisma.securityEvent.count({ where: { kind: 'LOGIN_FAILURE', createdAt: { gte: weekAgo } } }),
    prisma.user.count({ where: { lockedUntil: { gt: now } } }),
    prisma.securityEvent.count({ where: { kind: 'RATE_LIMIT_TRIGGERED', createdAt: { gte: weekAgo } } }),
    prisma.securityEvent.count({
      where: { kind: { in: ['MFA_ENABLED', 'MFA_DISABLED'] }, createdAt: { gte: weekAgo } },
    }),
    prisma.securityEvent.count({ where: { kind: 'PASSWORD_CHANGE', createdAt: { gte: weekAgo } } }),
    prisma.securityEvent.count({ where: { kind: 'SESSION_REVOKED', createdAt: { gte: weekAgo } } }),
    prisma.securityEvent.count({ where: { kind: 'PERMISSION_DENIED', createdAt: { gte: weekAgo } } }),
    prisma.userRole.count({
      where: {
        assignedAt: { gte: weekAgo },
        role: { key: { in: ['ADMIN', 'SENIOR_LEADERSHIP_ADMIN', 'SUPER_ADMIN'] } },
      },
    }),
    prisma.auditLog.count({
      where: {
        createdAt: { gte: weekAgo },
        action: { in: ['GOVERNANCE_ROLE_ASSIGNED', 'GOVERNANCE_ROLE_REMOVED'] },
      },
    }),
    prisma.session.count({ where: { revokedAt: null, expiresAt: { gt: now } } }),
    prisma.securityEvent.findMany({
      where: { createdAt: { gte: weekAgo } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { user: { select: { email: true, profile: { select: { displayName: true } } } } },
    }),
    prisma.securityEvent.count({
      where: { kind: 'SUSPICIOUS_LOGIN_LOCATION', createdAt: { gte: weekAgo } },
    }),
  ]);

  const services = {
    database: databaseOnline ? 'online' : 'offline',
    authentication: databaseOnline ? 'online' : 'degraded',
    api: 'online',
    realtime: 'online',
    backgroundJobs: 'online',
    search: databaseOnline ? 'online' : 'degraded',
    email: integrationStatus('email') === 'configured' ? 'online' : 'not_configured',
    push: integrationStatus('push') === 'configured' ? 'online' : 'not_configured',
    storage: integrationStatus('storage') === 'configured' ? 'online' : 'not_configured',
    video: integrationStatus('video') === 'configured' ? 'online' : 'not_configured',
    backups: process.env.BACKUP_SCHEDULE ? 'online' : 'not_configured',
  } as const;

  return ok({
    dashboard: {
      failedLogins24h,
      failedLogins7d,
      lockedAccounts,
      rateLimitEvents,
      mfaChanges,
      passwordResets,
      sessionRevocations,
      permissionDenials,
      newAdminAccounts,
      roleChanges,
      activeSessions,
      suspiciousLocations,
    },
    systemHealth: {
      services,
      databaseLatencyMs,
      realtimeSubscribers: subscriberCount(),
      uptimeSeconds: Math.floor(process.uptime()),
      checkedAt: now.toISOString(),
    },
    recentEvents: recentEvents.map((event) => ({
      id: event.id,
      kind: event.kind,
      severity: event.severity,
      detail: event.detail,
      ipAddress: event.ipAddress,
      createdAt: event.createdAt,
      account: event.user
        ? { email: event.user.email, displayName: event.user.profile?.displayName ?? '—' }
        : null,
    })),
  });
});
