import type { Metadata } from 'next';
import type { CounsellorStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/auth/guard';
import { AppPageHeader } from '@/components/app/AppShell';
import { CounsellorVerification } from '@/components/app/CounsellorVerification';
import { StatTile } from '@/components/ui';

export const metadata: Metadata = { title: 'Counsellors' };
export const dynamic = 'force-dynamic';

const FILTERS = [
  { value: 'pending', label: 'Awaiting verification', statuses: ['PENDING', 'UNDER_REVIEW'] },
  { value: 'approved', label: 'Approved', statuses: ['APPROVED'] },
  { value: 'suspended', label: 'Suspended or rejected', statuses: ['SUSPENDED', 'REJECTED'] },
] as const;

export default async function AdminCounsellorsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const context = await requirePagePermission(
    ['counsellors.manage', 'counsellors.verify'],
    '/admin/counsellors',
  );
  const params = await searchParams;
  const filter = FILTERS.find((entry) => entry.value === params.filter) ?? FILTERS[0];

  const [rows, counts] = await Promise.all([
    prisma.counsellor.findMany({
      where: { status: { in: [...filter.statuses] as CounsellorStatus[] } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        user: {
          select: {
            email: true,
            mfaEnabled: true,
            profile: { select: { displayName: true, firstName: true, lastName: true } },
          },
        },
        ministryCenter: { select: { name: true } },
        _count: {
          select: { sessions: { where: { status: { in: ['CONFIRMED', 'WAITING', 'ACTIVE'] } } } },
        },
      },
    }),
    prisma.counsellor.groupBy({ by: ['status'], _count: true }),
  ]);

  const countFor = (status: string) =>
    counts.find((row) => row.status === status)?._count ?? 0;

  return (
    <>
      <AppPageHeader
        eyebrow="Admin Portal"
        title="Counsellors"
        description="Verification, availability and suspension. Verifying someone means entrusting them with people's pastoral confidences — every decision is recorded with your reason."
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Awaiting verification"
          value={countFor('PENDING') + countFor('UNDER_REVIEW')}
          tone="caution"
          hint={countFor('PENDING') > 0 ? 'Needs a decision' : undefined}
        />
        <StatTile label="Approved" value={countFor('APPROVED')} tone="positive" />
        <StatTile label="Suspended" value={countFor('SUSPENDED')} />
        <StatTile label="Rejected" value={countFor('REJECTED')} />
      </div>

      <nav aria-label="Counsellor filters" className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((entry) => (
          <a
            key={entry.value}
            href={`/admin/counsellors?filter=${entry.value}`}
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

      <CounsellorVerification
        canVerify={context.permissions.has('counsellors.verify')}
        canSuspend={context.permissions.has('counsellors.suspend')}
        counsellors={rows.map((row) => ({
          id: row.id,
          displayName: row.user.profile?.displayName ?? '—',
          fullName: row.user.profile
            ? `${row.user.profile.firstName} ${row.user.profile.lastName}`
            : '—',
          email: row.user.email,
          ministryRole: row.ministryRole,
          biography: row.biography,
          categories: row.categories,
          languages: row.languages,
          experienceYears: row.experienceYears,
          qualifications: row.qualifications,
          referenceInfo: row.referenceInfo,
          acceptsMinors: row.acceptsMinors,
          status: row.status,
          statusReason: row.statusReason,
          verifiedAt: row.verifiedAt?.toISOString() ?? null,
          availabilityState: row.availabilityState,
          activeCaseload: row._count.sessions,
          maxConcurrentCases: row.maxConcurrentCases,
          ministryCenter: row.ministryCenter?.name ?? null,
          mfaEnabled: row.user.mfaEnabled,
          policiesAcceptedAt: row.policiesAcceptedAt?.toISOString() ?? null,
          safeguardingAcknowledgedAt: row.safeguardingAcknowledgedAt?.toISOString() ?? null,
          createdAt: row.createdAt.toISOString(),
        }))}
      />
    </>
  );
}
