import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/auth/guard';
import { AppPageHeader } from '@/components/app/AppShell';
import { Card, EmptyState, StatTile } from '@/components/ui';

export const metadata: Metadata = { title: 'Ministry Centers' };
export const dynamic = 'force-dynamic';

export default async function AdminCentersPage() {
  await requirePagePermission(['centers.manage'], '/admin/centers');

  const centers = await prisma.ministryCenter.findMany({
    orderBy: [{ isActive: 'desc' }, { country: 'asc' }, { name: 'asc' }],
    include: {
      _count: { select: { members: true, counsellors: true, events: true, hierarchy: true } },
      hierarchy: {
        where: { status: 'ACTIVE' },
        select: { personName: true, title: true, isSeedPlaceholder: true },
        take: 3,
      },
    },
  });

  const active = centers.filter((center) => center.isActive);

  return (
    <>
      <AppPageHeader
        eyebrow="Admin Portal"
        title="Ministry centres"
        description="Each centre holds its own leadership, counsellors, events and resources, while remaining part of one accountable structure."
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-4">
        <StatTile label="Active centres" value={active.length} />
        <StatTile
          label="Members assigned"
          value={centers.reduce((sum, center) => sum + center._count.members, 0)}
        />
        <StatTile
          label="Counsellors"
          value={centers.reduce((sum, center) => sum + center._count.counsellors, 0)}
        />
        <StatTile
          label="Disabled centres"
          value={centers.length - active.length}
          tone={centers.length - active.length > 0 ? 'caution' : 'neutral'}
        />
      </div>

      {centers.length === 0 ? (
        <EmptyState
          icon="⛪"
          title="No ministry centres yet"
          description="Centres are created through the API or the Super Admin portal, and appear publicly once activated."
        />
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2">
          {centers.map((center) => (
            <Card key={center.id} as="li" className={center.isActive ? '' : 'opacity-70'}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    center.isActive
                      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
                      : 'bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-200'
                  }`}
                >
                  {center.isActive ? 'Active' : 'Disabled'}
                </span>
                <span className="text-xs text-ink-500 dark:text-parchment-400">
                  {center.country}
                  {center.city ? ` · ${center.city}` : ''}
                </span>
              </div>

              <h2 className="font-serif text-lg font-semibold">{center.name}</h2>
              {center.description ? (
                <p className="mt-2 text-sm text-ink-600 dark:text-parchment-300">
                  {center.description}
                </p>
              ) : null}

              {center.disabledReason ? (
                <p className="mt-2 rounded-lg border border-red-300 bg-red-50 p-2 text-xs text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
                  Disabled: {center.disabledReason}
                </p>
              ) : null}

              {center.hierarchy.length > 0 ? (
                <p className="mt-3 text-sm text-ink-600 dark:text-parchment-300">
                  <span className="font-medium">Leadership:</span>{' '}
                  {center.hierarchy
                    .map(
                      (node) =>
                        `${node.personName} (${node.title})${node.isSeedPlaceholder ? ' — provisional' : ''}`,
                    )
                    .join(', ')}
                </p>
              ) : null}

              <dl className="mt-4 grid grid-cols-4 gap-2 border-t border-ink-200 pt-3 text-center text-xs dark:border-ink-800">
                {[
                  ['Members', center._count.members],
                  ['Counsellors', center._count.counsellors],
                  ['Events', center._count.events],
                  ['Leaders', center._count.hierarchy],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <dt className="text-ink-500 dark:text-parchment-400">{label}</dt>
                    <dd className="mt-0.5 font-semibold tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>

              {center.contactEmail || center.contactPhone ? (
                <p className="mt-3 text-xs text-ink-500 dark:text-parchment-400">
                  {[center.contactEmail, center.contactPhone].filter(Boolean).join(' · ')}
                </p>
              ) : null}
            </Card>
          ))}
        </ul>
      )}
    </>
  );
}
