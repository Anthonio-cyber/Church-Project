import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/auth/guard';
import { AppPageHeader } from '@/components/app/AppShell';
import { Card, EmptyState, StatTile } from '@/components/ui';
import { DataGovernanceQueue } from '@/components/app/DataGovernanceQueue';

export const metadata: Metadata = { title: 'Data Governance' };
export const dynamic = 'force-dynamic';

export default async function AdminDataGovernancePage() {
  await requirePagePermission(['data_governance.manage'], '/admin/data-governance');

  const [requests, counts, deletionRequested] = await Promise.all([
    prisma.dataRequest.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 60,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            status: true,
            profile: { select: { displayName: true } },
          },
        },
      },
    }),
    prisma.dataRequest.groupBy({ by: ['status'], _count: true }),
    prisma.user.count({ where: { status: 'DELETION_REQUESTED' } }),
  ]);

  const countFor = (status: string) => counts.find((row) => row.status === status)?._count ?? 0;

  return (
    <>
      <AppPageHeader
        eyebrow="Admin Portal"
        title="Data governance"
        description="Data-rights requests from members: export, correction, deletion and consent withdrawal."
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-4">
        <StatTile
          label="Received"
          value={countFor('RECEIVED')}
          tone={countFor('RECEIVED') > 0 ? 'caution' : 'neutral'}
        />
        <StatTile label="In progress" value={countFor('IN_PROGRESS')} />
        <StatTile label="Completed" value={countFor('COMPLETED')} tone="positive" />
        <StatTile
          label="Accounts pending deletion"
          value={deletionRequested}
          tone={deletionRequested > 0 ? 'caution' : 'neutral'}
        />
      </div>

      <Card className="mb-8 border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
        <h2 className="font-serif text-base font-semibold text-amber-900 dark:text-amber-100">
          Answering a deletion request honestly
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-amber-900 dark:text-amber-100">
          Some records cannot be erased: safeguarding case history where retention is a legal
          obligation, and audit entries, which exist precisely so that administrative action cannot
          be made to disappear. Tell the member specifically what has been erased and what has been
          retained, and why — do not let a request close with a vague reassurance.
        </p>
      </Card>

      {requests.length === 0 ? (
        <EmptyState
          icon="🗂"
          title="No data-rights requests"
          description="Requests submitted from the member Privacy Centre appear here for review."
        />
      ) : (
        <DataGovernanceQueue
          requests={requests.map((request) => ({
            id: request.id,
            kind: request.kind,
            status: request.status,
            details: request.details,
            createdAt: request.createdAt.toISOString(),
            handledAt: request.handledAt?.toISOString() ?? null,
            member: {
              displayName: request.user.profile?.displayName ?? 'Member',
              email: request.user.email,
              accountStatus: request.user.status,
            },
          }))}
        />
      )}
    </>
  );
}
