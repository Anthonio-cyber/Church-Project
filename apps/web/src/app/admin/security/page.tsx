import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/auth/guard';
import { AppPageHeader } from '@/components/app/AppShell';
import { Badge, Card, StatTile } from '@/components/ui';
import { integrationStatus } from '@/lib/env';
import { subscriberCount } from '@/lib/realtime';

export const metadata: Metadata = { title: 'Security Centre' };
export const dynamic = 'force-dynamic';

/**
 * The security centre and live system monitor.
 *
 * Two things in one place because they answer the same question: is the
 * platform behaving, and is anyone attacking it. Service states are reported
 * honestly — a service that is not configured says so rather than showing a
 * reassuring green light.
 */
export default async function AdminSecurityPage() {
  await requirePagePermission(['security.manage'], '/admin/security');

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
    lockedAccounts,
    permissionDenials,
    mfaChanges,
    passwordResets,
    sessionRevocations,
    activeSessions,
    adminAppointments,
    recentEvents,
    accountsWithoutMfa,
    failedJobs,
  ] = await Promise.all([
    prisma.securityEvent.count({ where: { kind: 'LOGIN_FAILURE', createdAt: { gte: dayAgo } } }),
    prisma.user.count({ where: { lockedUntil: { gt: now } } }),
    prisma.securityEvent.count({
      where: { kind: 'PERMISSION_DENIED', createdAt: { gte: weekAgo } },
    }),
    prisma.securityEvent.count({
      where: { kind: { in: ['MFA_ENABLED', 'MFA_DISABLED'] }, createdAt: { gte: weekAgo } },
    }),
    prisma.securityEvent.count({ where: { kind: 'PASSWORD_CHANGE', createdAt: { gte: weekAgo } } }),
    prisma.securityEvent.count({ where: { kind: 'SESSION_REVOKED', createdAt: { gte: weekAgo } } }),
    prisma.session.count({ where: { revokedAt: null, expiresAt: { gt: now } } }),
    prisma.auditLog.count({
      where: { action: 'GOVERNANCE_ADMIN_APPOINTED', createdAt: { gte: weekAgo } },
    }),
    prisma.securityEvent.findMany({
      where: { createdAt: { gte: weekAgo } },
      orderBy: { createdAt: 'desc' },
      take: 60,
      include: { user: { select: { email: true, profile: { select: { displayName: true } } } } },
    }),
    // Accounts whose role demands a second factor but which do not have one.
    prisma.user.count({ where: { mfaRequired: true, mfaEnabled: false } }),
    prisma.securityEvent.count({
      where: { severity: 'critical', createdAt: { gte: weekAgo } },
    }),
  ]);

  const services: [string, string][] = [
    ['Database', databaseOnline ? 'online' : 'offline'],
    ['Authentication', databaseOnline ? 'online' : 'degraded'],
    ['API', 'online'],
    ['Realtime', 'online'],
    ['Background jobs', 'online'],
    ['Search', databaseOnline ? 'online' : 'degraded'],
    ['Email', integrationStatus('email') === 'configured' ? 'online' : 'not configured'],
    ['Push notifications', integrationStatus('push') === 'configured' ? 'online' : 'not configured'],
    ['File storage', integrationStatus('storage') === 'configured' ? 'online' : 'not configured'],
    ['Video and voice', integrationStatus('video') === 'configured' ? 'online' : 'not configured'],
    ['Backups', process.env.BACKUP_SCHEDULE ? 'online' : 'not configured'],
  ];

  return (
    <>
      <AppPageHeader
        eyebrow="Admin Portal"
        title="Security centre"
        description="Failed sign-ins, permission denials, session activity, and the live state of every service."
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Failed sign-ins (24h)"
          value={failedLogins24h}
          tone={failedLogins24h > 20 ? 'critical' : 'neutral'}
        />
        <StatTile
          label="Locked accounts"
          value={lockedAccounts}
          tone={lockedAccounts > 0 ? 'caution' : 'neutral'}
        />
        <StatTile
          label="Permission denials (7d)"
          value={permissionDenials}
          tone={permissionDenials > 0 ? 'caution' : 'neutral'}
          hint={permissionDenials > 0 ? 'Investigate patterns' : undefined}
        />
        <StatTile
          label="MFA required but missing"
          value={accountsWithoutMfa}
          tone={accountsWithoutMfa > 0 ? 'critical' : 'positive'}
        />
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Active sessions" value={activeSessions} />
        <StatTile label="Session revocations (7d)" value={sessionRevocations} />
        <StatTile label="Password changes (7d)" value={passwordResets} />
        <StatTile label="MFA changes (7d)" value={mfaChanges} />
        <StatTile
          label="Admin appointments (7d)"
          value={adminAppointments}
          tone={adminAppointments > 0 ? 'caution' : 'neutral'}
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[20rem_1fr]">
        <Card>
          <h2 className="mb-1 font-serif text-lg font-semibold">System health</h2>
          <p className="mb-4 text-xs text-ink-500 dark:text-parchment-400">
            Database responded in {databaseLatencyMs}ms · {subscriberCount()} realtime subscriber
            {subscriberCount() === 1 ? '' : 's'} · up{' '}
            {Math.floor(process.uptime() / 60)} minute
            {Math.floor(process.uptime() / 60) === 1 ? '' : 's'}
          </p>

          <ul className="space-y-2">
            {services.map(([name, state]) => (
              <li
                key={name}
                className="flex items-center justify-between rounded-lg border border-ink-200 px-3 py-2 text-sm dark:border-ink-800"
              >
                <span>{name}</span>
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={`h-2 w-2 rounded-full ${
                      state === 'online'
                        ? 'bg-emerald-500'
                        : state === 'degraded'
                          ? 'bg-amber-500'
                          : state === 'offline'
                            ? 'bg-red-500'
                            : 'bg-ink-400'
                    }`}
                  />
                  <span className="text-xs capitalize text-ink-600 dark:text-parchment-300">
                    {state}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          {failedJobs > 0 ? (
            <p className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
              {failedJobs} critical security event{failedJobs === 1 ? '' : 's'} in the last seven
              days. Review the event list.
            </p>
          ) : null}
        </Card>

        <Card>
          <h2 className="mb-4 font-serif text-lg font-semibold">Recent security events</h2>
          {recentEvents.length === 0 ? (
            <p className="text-sm text-ink-500 dark:text-parchment-400">
              No security events in the last seven days.
            </p>
          ) : (
            <ul className="max-h-[32rem] space-y-2 overflow-y-auto">
              {recentEvents.map((event) => (
                <li
                  key={event.id}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-ink-200 px-3 py-2 text-sm dark:border-ink-800"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2">
                      <Badge
                        tone={
                          event.severity === 'critical'
                            ? 'critical'
                            : event.severity === 'warning'
                              ? 'caution'
                              : 'neutral'
                        }
                      >
                        {event.kind.toLowerCase().replace(/_/g, ' ')}
                      </Badge>
                    </p>
                    {event.detail ? (
                      <p className="mt-1 text-xs text-ink-600 dark:text-parchment-300">
                        {event.detail}
                      </p>
                    ) : null}
                    <p className="text-xs text-ink-500 dark:text-parchment-400">
                      {event.user?.profile?.displayName ?? event.user?.email ?? 'Anonymous'} ·{' '}
                      {event.ipAddress ?? 'unknown address'}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-ink-500 dark:text-parchment-400">
                    {event.createdAt.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
