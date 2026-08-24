import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/auth/guard';
import { AppPageHeader } from '@/components/app/AppShell';
import { HierarchyManager } from '@/components/app/HierarchyManager';
import { Card } from '@/components/ui';
import { ROLE_RANK } from '@/lib/permissions';

export const metadata: Metadata = { title: 'Church Hierarchy' };
export const dynamic = 'force-dynamic';

export default async function HierarchyPage() {
  const context = await requirePagePermission(['hierarchy.manage'], '/super-admin/hierarchy');

  const [nodes, centers, candidates] = await Promise.all([
    prisma.churchHierarchyNode.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      include: {
        user: { select: { id: true, email: true, status: true, mfaEnabled: true } },
        ministryCenter: { select: { id: true, name: true } },
        supervisor: { select: { id: true, personName: true, title: true } },
        approvals: { orderBy: { createdAt: 'desc' }, take: 3 },
      },
    }),
    prisma.ministryCenter.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      where: { status: 'ACTIVE', hierarchyNode: null },
      select: { id: true, email: true, profile: { select: { displayName: true } } },
      take: 100,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return (
    <>
      <AppPageHeader
        eyebrow="Super Admin Portal"
        title="Church hierarchy"
        description="Who holds which office, under whose supervision, since when, and on whose authority."
      />

      <Card className="mb-8 border-gold-300 bg-gold-50/40 dark:border-gold-800 dark:bg-gold-950/20">
        <h2 className="font-serif text-base font-semibold">How authority flows here</h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-700 dark:text-parchment-200">
          <li>
            • You cannot create or edit a position at or above your own level of authority. Your
            rank is {context.rank}.
          </li>
          <li>
            • A position confers no access on its own. Access comes from roles and permissions,
            assigned separately and audited separately.
          </li>
          <li>
            • Every change is written to an append-only hierarchy record with your stated reason,
            alongside the audit log. Neither can be edited or deleted afterwards.
          </li>
          <li>
            • Records flagged provisional are never published on the public site until the
            organisation confirms that the named person genuinely holds that office.
          </li>
        </ul>
      </Card>

      <HierarchyManager
        viewerRank={context.rank}
        centers={centers}
        candidates={candidates.map((candidate) => ({
          id: candidate.id,
          label: `${candidate.profile?.displayName ?? 'Member'} — ${candidate.email}`,
        }))}
        nodes={nodes.map((node) => ({
          id: node.id,
          personName: node.personName,
          title: node.title,
          ministryRole: node.ministryRole,
          administrativeRole: node.administrativeRole,
          rank: ROLE_RANK[node.administrativeRole] ?? 0,
          status: node.status,
          isSeedPlaceholder: node.isSeedPlaceholder,
          organisationConfirmedAt: node.organisationConfirmedAt?.toISOString() ?? null,
          startDate: node.startDate.toISOString(),
          endDate: node.endDate?.toISOString() ?? null,
          notes: node.notes,
          supervisor: node.supervisor
            ? { id: node.supervisor.id, personName: node.supervisor.personName, title: node.supervisor.title }
            : null,
          ministryCenter: node.ministryCenter,
          account: node.user
            ? {
                id: node.user.id,
                email: node.user.email,
                status: node.user.status,
                mfaEnabled: node.user.mfaEnabled,
              }
            : null,
          recentChanges: node.approvals.map((change) => ({
            id: change.id,
            changeType: change.changeType,
            reason: change.reason,
            createdAt: change.createdAt.toISOString(),
          })),
        }))}
      />
    </>
  );
}
