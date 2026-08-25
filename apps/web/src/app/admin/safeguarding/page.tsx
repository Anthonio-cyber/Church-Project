import type { Metadata } from 'next';
import type { SafeguardingStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/auth/guard';
import { AppPageHeader } from '@/components/app/AppShell';
import { Badge, Card, EmptyState, StatTile } from '@/components/ui';

export const metadata: Metadata = { title: 'Safeguarding' };
export const dynamic = 'force-dynamic';

const FILTERS = [
  { value: 'open', label: 'Open', statuses: ['OPEN', 'UNDER_ASSESSMENT'] },
  { value: 'escalated', label: 'Escalated', statuses: ['ESCALATED'] },
  { value: 'closed', label: 'Closed', statuses: ['ACTION_TAKEN', 'CLOSED'] },
] as const;

/**
 * The safeguarding case list.
 *
 * Reaching this page requires safeguarding.view. Even here the narrative is not
 * shown: the list is metadata only, and reading a specific case means opening
 * it deliberately with a written reason, which is recorded permanently against
 * the case itself.
 */
export default async function AdminSafeguardingPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  await requirePagePermission(['safeguarding.view'], '/admin/safeguarding');
  const params = await searchParams;
  const filter = FILTERS.find((entry) => entry.value === params.filter) ?? FILTERS[0];

  const [cases, counts, minorCases, criticalCases] = await Promise.all([
    prisma.safeguardingCase.findMany({
      where: { status: { in: [...filter.statuses] as SafeguardingStatus[] } },
      orderBy: [{ riskLevel: 'desc' }, { createdAt: 'desc' }],
      take: 50,
      select: {
        id: true,
        reference: true,
        category: true,
        riskLevel: true,
        status: true,
        involvesMinor: true,
        createdAt: true,
        escalatedAt: true,
        closedAt: true,
        assignedToId: true,
        _count: { select: { accesses: true } },
      },
    }),
    prisma.safeguardingCase.groupBy({ by: ['status'], _count: true }),
    prisma.safeguardingCase.count({
      where: { involvesMinor: true, status: { notIn: ['CLOSED'] } },
    }),
    prisma.safeguardingCase.count({
      where: { riskLevel: 'CRITICAL', status: { notIn: ['CLOSED'] } },
    }),
  ]);

  const countFor = (status: string) => counts.find((row) => row.status === status)?._count ?? 0;

  return (
    <>
      <AppPageHeader
        eyebrow="Admin Portal"
        title="Safeguarding"
        description="Cases raised from reports, from counselling triage, and by escalation. Every case you open is recorded against that case, permanently."
      />

      <Card className="mb-8 border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30">
        <p className="text-sm leading-relaxed text-red-900 dark:text-red-100">
          <strong className="font-semibold">This is the most sensitive area of the platform.</strong>{' '}
          Case narratives are encrypted at rest. Opening one requires a written reason and creates a
          permanent access record that cannot be edited or deleted — by you, by an administrator, or
          by the Super Admin. Open a case because your role requires it, not because you can.
        </p>
      </Card>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Open"
          value={countFor('OPEN') + countFor('UNDER_ASSESSMENT')}
          tone="caution"
        />
        <StatTile label="Escalated" value={countFor('ESCALATED')} tone="critical" />
        <StatTile
          label="Involving a minor"
          value={minorCases}
          tone={minorCases > 0 ? 'critical' : 'neutral'}
        />
        <StatTile
          label="Critical risk"
          value={criticalCases}
          tone={criticalCases > 0 ? 'critical' : 'neutral'}
        />
      </div>

      <nav aria-label="Safeguarding filters" className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((entry) => (
          <a
            key={entry.value}
            href={`/admin/safeguarding?filter=${entry.value}`}
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

      {cases.length === 0 ? (
        <EmptyState
          icon="🛡"
          title="No cases in this view"
          description="Cases appear here when a report is escalated, when counselling triage detects a concern, or when a safeguarding lead raises one directly."
        />
      ) : (
        <ul className="space-y-3">
          {cases.map((entry) => (
            <li
              key={entry.id}
              className={`rounded-xl border bg-white p-5 dark:bg-ink-900 ${
                entry.riskLevel === 'CRITICAL'
                  ? 'border-red-400 dark:border-red-700'
                  : 'border-ink-200 dark:border-ink-800'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-gold-700 dark:text-gold-400">
                      {entry.reference}
                    </span>
                    <Badge
                      tone={
                        entry.riskLevel === 'CRITICAL'
                          ? 'critical'
                          : entry.riskLevel === 'HIGH'
                            ? 'caution'
                            : 'neutral'
                      }
                    >
                      {entry.riskLevel.toLowerCase()} risk
                    </Badge>
                    <Badge>{entry.category.toLowerCase().replace(/_/g, ' ')}</Badge>
                    <Badge tone={entry.status === 'ESCALATED' ? 'critical' : 'gold'}>
                      {entry.status.toLowerCase().replace(/_/g, ' ')}
                    </Badge>
                    {entry.involvesMinor ? <Badge tone="critical">Involves a minor</Badge> : null}
                  </div>

                  <p className="text-sm text-ink-600 dark:text-parchment-300">
                    Raised {entry.createdAt.toLocaleString()}
                    {entry.escalatedAt
                      ? ` · escalated ${entry.escalatedAt.toLocaleDateString()}`
                      : ''}
                    {entry.closedAt ? ` · closed ${entry.closedAt.toLocaleDateString()}` : ''}
                  </p>
                  <p className="mt-1 text-xs text-ink-500 dark:text-parchment-400">
                    {entry._count.accesses} recorded access
                    {entry._count.accesses === 1 ? '' : 'es'} ·{' '}
                    {entry.assignedToId ? 'assigned' : 'unassigned'}
                  </p>
                </div>

                <a
                  href={`/admin/safeguarding/${entry.id}`}
                  className="min-h-[2.75rem] shrink-0 rounded-lg border border-ink-300 px-5 py-2.5 text-sm dark:border-ink-700"
                >
                  Open case
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
