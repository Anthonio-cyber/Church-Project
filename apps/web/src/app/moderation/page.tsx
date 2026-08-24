import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/auth/guard';
import { AppPageHeader } from '@/components/app/AppShell';
import { ButtonLink, Card, StatTile } from '@/components/ui';

export const metadata: Metadata = { title: 'Moderator Dashboard' };
export const dynamic = 'force-dynamic';

export default async function ModerationDashboard() {
  const context = await requirePagePermission(['reports.view'], '/moderation');

  const [open, underReview, actionRequired, resolved, escalated, byCategory, blocks, suspended] =
    await Promise.all([
      prisma.report.count({ where: { status: 'OPEN' } }),
      prisma.report.count({ where: { status: 'UNDER_REVIEW' } }),
      prisma.report.count({ where: { status: 'ACTION_REQUIRED' } }),
      prisma.report.count({ where: { status: 'RESOLVED' } }),
      prisma.report.count({ where: { status: 'ESCALATED' } }),
      prisma.report.groupBy({
        by: ['category'],
        _count: true,
        where: { status: { in: ['OPEN', 'UNDER_REVIEW', 'ACTION_REQUIRED'] } },
      }),
      prisma.block.count(),
      prisma.user.count({ where: { status: 'SUSPENDED' } }),
    ]);

  return (
    <>
      <AppPageHeader
        eyebrow="Moderator Portal"
        title="Community moderation"
        description="Reports, spam, abuse and community violations."
        action={<ButtonLink href="/moderation/reports">Open the queue</ButtonLink>}
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Open"
          value={open}
          hint={open > 0 ? 'Needs a first look' : undefined}
          tone="gold"
        />
        <StatTile label="Under review" value={underReview} />
        <StatTile
          label="Action required"
          value={actionRequired}
          tone="caution"
          hint={actionRequired > 0 ? 'Decide an outcome' : undefined}
        />
        <StatTile
          label="Escalated"
          value={escalated}
          tone="critical"
          hint="Now with safeguarding"
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-serif text-lg font-semibold">Open queue by category</h2>
          {byCategory.length === 0 ? (
            <p className="text-sm text-ink-500 dark:text-parchment-400">
              Nothing is waiting. The queue is clear.
            </p>
          ) : (
            <ul className="space-y-2">
              {byCategory
                .slice()
                .sort((a, b) => b._count - a._count)
                .map((row) => (
                  <li
                    key={row.category}
                    className="flex items-center justify-between rounded-lg border border-ink-200 px-4 py-2.5 text-sm dark:border-ink-800"
                  >
                    <span className="capitalize">
                      {row.category.toLowerCase().replace(/_/g, ' ')}
                    </span>
                    <span className="font-semibold tabular-nums">{row._count}</span>
                  </li>
                ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 font-serif text-lg font-semibold">Community state</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-600 dark:text-parchment-300">Reports resolved</dt>
              <dd className="font-semibold tabular-nums">{resolved}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-600 dark:text-parchment-300">Blocks in place</dt>
              <dd className="font-semibold tabular-nums">{blocks}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-600 dark:text-parchment-300">Suspended accounts</dt>
              <dd className="font-semibold tabular-nums">{suspended}</dd>
            </div>
          </dl>
        </Card>
      </div>

      {/* Stating the boundary in the portal itself, not only in the code. */}
      <Card className="mt-8 border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
        <h2 className="font-serif text-lg font-semibold text-amber-900 dark:text-amber-100">
          The boundary of this role
        </h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-amber-900 dark:text-amber-100">
          <li>
            • You cannot see private counselling conversations or counsellor notes. A message
            reported from a counselling session is withheld from you and handled through
            safeguarding instead.
          </li>
          <li>
            • You cannot read safeguarding case narratives, even for a case you escalated yourself.
          </li>
          <li>
            {context.permissions.has('users.suspend')
              ? '• You can suspend an account, and every such action is recorded with your stated reason.'
              : '• You cannot suspend accounts. Escalate to an administrator where that is needed.'}
          </li>
          <li>
            • Every action you take here is written to the audit log with your name, the time and
            your reason.
          </li>
        </ul>
      </Card>
    </>
  );
}
