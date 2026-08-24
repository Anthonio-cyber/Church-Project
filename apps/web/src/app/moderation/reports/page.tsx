import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/auth/guard';
import { AppPageHeader } from '@/components/app/AppShell';
import { ReportQueue } from '@/components/app/ReportQueue';

export const metadata: Metadata = { title: 'Reports' };
export const dynamic = 'force-dynamic';

const FILTERS = [
  { value: 'open', label: 'Open', statuses: ['OPEN'] },
  { value: 'review', label: 'Under review', statuses: ['UNDER_REVIEW', 'ACTION_REQUIRED'] },
  { value: 'escalated', label: 'Escalated', statuses: ['ESCALATED'] },
  { value: 'closed', label: 'Closed', statuses: ['RESOLVED', 'DISMISSED'] },
] as const;

export default async function ModerationReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const context = await requirePagePermission(['reports.view'], '/moderation/reports');
  const params = await searchParams;
  const filter = FILTERS.find((entry) => entry.value === params.filter) ?? FILTERS[0];

  const reports = await prisma.report.findMany({
    where: { status: { in: [...filter.statuses] } },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      reporter: { select: { profile: { select: { displayName: true } } } },
      reportedUser: {
        select: {
          id: true,
          status: true,
          profile: { select: { displayName: true } },
          _count: { select: { reportsAbout: true } },
        },
      },
      message: {
        select: {
          id: true,
          body: true,
          createdAt: true,
          conversation: { select: { kind: true } },
        },
      },
    },
  });

  return (
    <>
      <AppPageHeader
        eyebrow="Moderator Portal"
        title="Reports"
        description="Review, act, and record why. Serious matters are escalated out of this queue to safeguarding."
      />

      <nav aria-label="Report filters" className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((entry) => (
          <a
            key={entry.value}
            href={`/moderation/reports?filter=${entry.value}`}
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

      <ReportQueue
        canResolve={context.permissions.has('reports.resolve')}
        reports={reports.map((report) => ({
          id: report.id,
          reference: report.reference,
          category: report.category,
          description: report.description,
          status: report.status,
          createdAt: report.createdAt.toISOString(),
          resolution: report.resolution,
          reporterName: report.reporter.profile?.displayName ?? 'Member',
          reportedUser: report.reportedUser
            ? {
                id: report.reportedUser.id,
                displayName: report.reportedUser.profile?.displayName ?? 'Member',
                accountStatus: report.reportedUser.status,
                priorReportCount: report.reportedUser._count.reportsAbout,
              }
            : null,
          // A message from a counselling conversation is never shown to a
          // moderator, whatever the report says about it.
          message: report.message
            ? report.message.conversation.kind === 'COUNSELLING'
              ? {
                  id: report.message.id,
                  body: null,
                  withheld:
                    'This message is part of a private counselling session. It is not available to moderators and must be handled through safeguarding.',
                  createdAt: report.message.createdAt.toISOString(),
                }
              : {
                  id: report.message.id,
                  body: report.message.body,
                  withheld: null,
                  createdAt: report.message.createdAt.toISOString(),
                }
            : null,
          escalated: report.status === 'ESCALATED',
        }))}
      />
    </>
  );
}
