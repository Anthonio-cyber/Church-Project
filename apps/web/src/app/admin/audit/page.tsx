import type { Metadata } from 'next';
import type { AuditOutcome } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/auth/guard';
import { AppPageHeader } from '@/components/app/AppShell';
import { Badge, Card } from '@/components/ui';

export const metadata: Metadata = { title: 'Audit Log' };
export const dynamic = 'force-dynamic';

/**
 * The audit log.
 *
 * Read-only by construction. There is no update or delete route anywhere in
 * this codebase, and a database trigger rejects UPDATE and DELETE on the table
 * regardless of who issues them — so an administrator cannot erase their own
 * actions, and neither can the Setman.
 */
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; actorId?: string; outcome?: string; targetId?: string }>;
}) {
  await requirePagePermission(['audit_logs.view'], '/admin/audit');
  const params = await searchParams;

  const where = {
    ...(params.action ? { action: { contains: params.action, mode: 'insensitive' as const } } : {}),
    ...(params.actorId ? { actorId: params.actorId } : {}),
    ...(params.targetId ? { targetId: params.targetId } : {}),
    ...(params.outcome ? { outcome: params.outcome as AuditOutcome } : {}),
  };

  const [entries, total, topActions, deniedCount] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        actor: { select: { id: true, email: true, profile: { select: { displayName: true } } } },
      },
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({
      by: ['action'],
      _count: true,
      orderBy: { _count: { action: 'desc' } },
      take: 10,
    }),
    prisma.auditLog.count({ where: { outcome: 'DENIED' } }),
  ]);

  return (
    <>
      <AppPageHeader
        eyebrow="Admin Portal"
        title="Audit log"
        description="Who did what, to whom, when, and why."
      />

      <Card className="mb-8 border-gold-300 bg-gold-50/40 dark:border-gold-800 dark:bg-gold-950/20">
        <p className="text-sm leading-relaxed text-ink-700 dark:text-parchment-200">
          <strong>This log is append-only.</strong> Updates and deletions are rejected by a database
          trigger, not merely omitted from the application. A deliberate, recorded purge — a
          court-ordered erasure, an approved retention run — requires a database superuser to set an
          explicit maintenance flag for the transaction, which makes the act visible in the database
          logs rather than invisible in the product. No administrator, at any rank, can quietly
          remove an entry.
        </p>
      </Card>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
          <p className="text-xs uppercase tracking-wide text-ink-500 dark:text-parchment-400">
            Entries matching
          </p>
          <p className="mt-2 font-serif text-3xl font-semibold tabular-nums">{total}</p>
        </div>
        <div className="rounded-xl border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
          <p className="text-xs uppercase tracking-wide text-ink-500 dark:text-parchment-400">
            Access denials recorded
          </p>
          <p className="mt-2 font-serif text-3xl font-semibold tabular-nums">{deniedCount}</p>
          <p className="mt-1 text-xs text-ink-500 dark:text-parchment-400">
            A pattern of denials is itself a signal.
          </p>
        </div>
        <div className="rounded-xl border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
          <p className="mb-2 text-xs uppercase tracking-wide text-ink-500 dark:text-parchment-400">
            Most frequent actions
          </p>
          <ul className="space-y-0.5 text-xs">
            {topActions.slice(0, 5).map((row) => (
              <li key={row.action} className="flex justify-between gap-2">
                <span className="truncate text-ink-600 dark:text-parchment-300">{row.action}</span>
                <span className="shrink-0 font-semibold tabular-nums">{row._count}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <form method="get" className="mb-6 flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="action" className="label">
            Action contains
          </label>
          <input
            id="action"
            name="action"
            defaultValue={params.action ?? ''}
            placeholder="e.g. SUSPENDED, ROLE, SAFEGUARDING"
            className="input"
          />
        </div>
        <div>
          <label htmlFor="outcome" className="label">
            Outcome
          </label>
          <select id="outcome" name="outcome" defaultValue={params.outcome ?? ''} className="input">
            <option value="">All outcomes</option>
            <option value="SUCCESS">Success</option>
            <option value="FAILURE">Failure</option>
            <option value="DENIED">Denied</option>
          </select>
        </div>
        <div className="min-w-[14rem]">
          <label htmlFor="targetId" className="label">
            Target ID
          </label>
          <input
            id="targetId"
            name="targetId"
            defaultValue={params.targetId ?? ''}
            className="input font-mono text-xs"
          />
        </div>
        <button
          type="submit"
          className="min-h-[2.75rem] rounded-lg bg-gold-sheen px-5 text-sm font-semibold text-ink-950"
        >
          Filter
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-ink-200 dark:border-ink-800">
        <table className="w-full min-w-[60rem] text-left text-sm">
          <thead className="bg-parchment-100 text-xs uppercase tracking-wide text-ink-500 dark:bg-ink-900 dark:text-parchment-400">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                When
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Administrator
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Action
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Target
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Reason
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Outcome
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-200 dark:divide-ink-800">
            {entries.map((entry) => (
              <tr key={entry.id} className="bg-white align-top dark:bg-ink-900">
                <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-500 dark:text-parchment-400">
                  {entry.createdAt.toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium">
                    {entry.actor?.profile?.displayName ?? entry.actorEmail ?? 'System'}
                  </p>
                  <p className="text-xs text-ink-500 dark:text-parchment-400">
                    {entry.actorEmail ?? '—'}
                  </p>
                  {entry.actorRole ? (
                    <p className="text-xs capitalize text-ink-400 dark:text-parchment-500">
                      {entry.actorRole.toLowerCase().replace(/_/g, ' ')}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono text-xs">{entry.action}</span>
                </td>
                <td className="px-4 py-3 text-xs">
                  {entry.targetType ? (
                    <>
                      <p className="capitalize">{entry.targetType.replace(/_/g, ' ')}</p>
                      <p className="truncate font-mono text-ink-500 dark:text-parchment-400">
                        {entry.targetId?.slice(0, 8) ?? '—'}
                      </p>
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="max-w-[18rem] px-4 py-3 text-xs text-ink-600 dark:text-parchment-300">
                  {entry.reason ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    tone={
                      entry.outcome === 'SUCCESS'
                        ? 'positive'
                        : entry.outcome === 'DENIED'
                          ? 'critical'
                          : 'caution'
                    }
                  >
                    {entry.outcome.toLowerCase()}
                  </Badge>
                </td>
              </tr>
            ))}

            {entries.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="bg-white px-4 py-12 text-center text-sm text-ink-500 dark:bg-ink-900 dark:text-parchment-400"
                >
                  No audit entries matched those filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
