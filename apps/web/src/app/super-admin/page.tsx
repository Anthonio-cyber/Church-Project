import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/auth/guard';
import { AppPageHeader } from '@/components/app/AppShell';
import { Badge, Card, StatTile } from '@/components/ui';
import { integrationStatus } from '@/lib/env';
import { subscriberCount } from '@/lib/realtime';
import { getAllFlags, FEATURE_FLAGS, type FeatureFlagKey } from '@/lib/domain/settings';
import { ADMIN_ROLES } from '@/lib/permissions';

export const metadata: Metadata = { title: 'System Overview' };
export const dynamic = 'force-dynamic';

/**
 * The Setman's overview.
 *
 * Even at the highest office the numbers are aggregates. Holding this role does
 * not come with a window into people's counselling conversations — reading a
 * specific record still means opening it deliberately, with a reason, on a
 * route that records the access.
 */
export default async function SuperAdminOverviewPage() {
  const context = await requirePagePermission(
    ['hierarchy.manage', 'admins.manage', 'emergency_controls.manage'],
    '/super-admin',
  );

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000);

  const probeStart = Date.now();
  let databaseOnline = true;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    databaseOnline = false;
  }
  const databaseLatencyMs = Date.now() - probeStart;

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
    databaseSize,
    placeholderNodes,
    adminsWithoutMfa,
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
      ? prisma.safeguardingCase.count({
          where: { status: { in: ['OPEN', 'UNDER_ASSESSMENT', 'ESCALATED'] } },
        })
      : Promise.resolve(null),
    prisma.auditLog.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.hierarchyChange.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        node: { select: { personName: true, title: true, administrativeRole: true } },
      },
    }),
    getAllFlags(),
    prisma.$queryRaw<{ total: string }[]>`
      SELECT pg_size_pretty(pg_database_size(current_database())) AS total`,
    prisma.churchHierarchyNode.count({ where: { isSeedPlaceholder: true } }),
    prisma.user.count({
      where: {
        mfaEnabled: false,
        roles: { some: { role: { key: { in: ADMIN_ROLES } } } },
      },
    }),
  ]);

  const disabledFlags = (Object.keys(FEATURE_FLAGS) as FeatureFlagKey[]).filter(
    (key) => flags[key] !== FEATURE_FLAGS[key].default,
  );

  return (
    <>
      <AppPageHeader
        eyebrow="Super Admin Portal"
        title="System overview"
        description="The whole platform in one view: people, leadership, services and governance activity."
      />

      {placeholderNodes > 0 ? (
        <Card className="mb-6 border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <h2 className="font-serif text-base font-semibold text-amber-900 dark:text-amber-100">
            {placeholderNodes} leadership record{placeholderNodes === 1 ? '' : 's'} awaiting
            organisational confirmation
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-amber-900 dark:text-amber-100">
            Seeded leadership records are provisional. They are not published on the public site and
            confer no access until confirmed. Confirm each one with the organisation before treating
            it as an authorised statement that a named person holds that office.
          </p>
          <Link
            href="/super-admin/hierarchy"
            className="mt-3 inline-block text-sm font-semibold text-amber-900 underline underline-offset-4 dark:text-amber-100"
          >
            Review the hierarchy →
          </Link>
        </Card>
      ) : null}

      {adminsWithoutMfa > 0 ? (
        <Card className="mb-6 border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30">
          <h2 className="font-serif text-base font-semibold text-red-900 dark:text-red-200">
            {adminsWithoutMfa} administrator{adminsWithoutMfa === 1 ? '' : 's'} without multi-factor
            authentication
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-red-900 dark:text-red-100">
            Their sensitive permissions are blocked until they enrol — that is enforced, not
            advisory — but an administrative account without a second factor is still a standing
            risk worth closing.
          </p>
        </Card>
      ) : null}

      <section className="mb-8">
        <h2 className="mb-4 font-serif text-lg font-semibold">Platform</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Total members" value={totalUsers} />
          <StatTile label="Active ministry centres" value={activeCenters} />
          <StatTile label="Administrators" value={adminCount} />
          <StatTile label="Moderators" value={moderatorCount} />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 font-serif text-lg font-semibold">Governance and safety</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Pending approvals"
            value={pendingApprovals}
            tone={pendingApprovals > 0 ? 'caution' : 'neutral'}
          />
          <StatTile
            label="Security alerts (24h)"
            value={securityAlerts}
            tone={securityAlerts > 0 ? 'critical' : 'neutral'}
          />
          <StatTile label="Audit entries (24h)" value={auditActivity24h} />
          {openSafeguarding !== null ? (
            <StatTile
              label="Open safeguarding"
              value={openSafeguarding}
              tone={openSafeguarding > 0 ? 'critical' : 'neutral'}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-ink-300 p-4 text-xs text-ink-500 dark:border-ink-700 dark:text-parchment-400">
              Safeguarding figures require the safeguarding permission, which is granted separately
              from this office.
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card>
          <h2 className="mb-1 font-serif text-lg font-semibold">System health</h2>
          <p className="mb-4 text-xs text-ink-500 dark:text-parchment-400">
            Database {databaseLatencyMs}ms · {databaseSize[0]?.total ?? 'unknown'} ·{' '}
            {subscriberCount()} realtime subscriber{subscriberCount() === 1 ? '' : 's'}
          </p>
          <ul className="space-y-2">
            {[
              ['Database', databaseOnline ? 'online' : 'offline'],
              ['Authentication', databaseOnline ? 'online' : 'degraded'],
              ['Realtime', 'online'],
              ['API', 'online'],
              ['Email', integrationStatus('email')],
              ['Push notifications', integrationStatus('push')],
              ['File storage', integrationStatus('storage')],
              ['Video and voice', integrationStatus('video')],
              ['Backups', process.env.BACKUP_SCHEDULE ? 'configured' : 'not_configured'],
            ].map(([name, state]) => (
              <li
                key={String(name)}
                className="flex items-center justify-between rounded-lg border border-ink-200 px-3 py-2 text-sm dark:border-ink-800"
              >
                <span>{name}</span>
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={`h-2 w-2 rounded-full ${
                      state === 'online' || state === 'configured'
                        ? 'bg-emerald-500'
                        : state === 'degraded'
                          ? 'bg-amber-500'
                          : state === 'offline'
                            ? 'bg-red-500'
                            : 'bg-ink-400'
                    }`}
                  />
                  <span className="text-xs capitalize text-ink-600 dark:text-parchment-300">
                    {String(state).replace(/_/g, ' ')}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <h3 className="mb-2 mt-5 text-sm font-semibold">Counsellor status</h3>
          <ul className="space-y-1 text-sm">
            {counsellorCounts.map((row) => (
              <li key={row.status} className="flex justify-between">
                <span className="capitalize text-ink-600 dark:text-parchment-300">
                  {row.status.toLowerCase().replace(/_/g, ' ')}
                </span>
                <span className="font-semibold tabular-nums">{row._count}</span>
              </li>
            ))}
            {counsellorCounts.length === 0 ? (
              <li className="text-ink-500 dark:text-parchment-400">No counsellors yet.</li>
            ) : null}
          </ul>
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 font-serif text-lg font-semibold">Platform controls</h2>
            {disabledFlags.length === 0 ? (
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                ✓ Every capability is in its normal state.
              </p>
            ) : (
              <ul className="space-y-2">
                {disabledFlags.map((key) => (
                  <li
                    key={key}
                    className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:border-amber-800 dark:bg-amber-950/30"
                  >
                    <span className="text-amber-900 dark:text-amber-100">
                      {FEATURE_FLAGS[key].label}
                    </span>
                    <Badge tone="caution">{flags[key] ? 'enabled' : 'disabled'}</Badge>
                  </li>
                ))}
              </ul>
            )}
            {context.permissions.has('emergency_controls.manage') ? (
              <Link
                href="/super-admin/emergency"
                className="mt-4 inline-block text-sm font-semibold text-gold-700 underline-offset-4 hover:underline dark:text-gold-400"
              >
                Open emergency controls →
              </Link>
            ) : null}
          </Card>

          <Card>
            <h2 className="mb-4 font-serif text-lg font-semibold">Recent hierarchy changes</h2>
            {recentHierarchyChanges.length === 0 ? (
              <p className="text-sm text-ink-500 dark:text-parchment-400">
                No changes recorded yet.
              </p>
            ) : (
              <ol className="space-y-3">
                {recentHierarchyChanges.map((change) => (
                  <li key={change.id} className="border-l-2 border-gold-400 pl-4 text-sm">
                    <p className="font-medium">
                      {change.node.personName}{' '}
                      <span className="font-normal text-ink-500 dark:text-parchment-400">
                        — {change.changeType.toLowerCase().replace(/_/g, ' ')}
                      </span>
                    </p>
                    <p className="text-xs text-ink-500 dark:text-parchment-400">
                      {change.node.title} · {change.createdAt.toLocaleString()}
                    </p>
                    <p className="mt-1 text-ink-600 dark:text-parchment-300">“{change.reason}”</p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
