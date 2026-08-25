import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requirePageUser } from '@/lib/auth/guard';
import { AppPageHeader } from '@/components/app/AppShell';
import { Badge, Card } from '@/components/ui';
import { CounsellorApplicationForm } from '@/components/forms/CounsellorApplicationForm';
import { formatDateTime } from '@/lib/format';

export const metadata: Metadata = { title: 'Serve as a Counsellor' };
export const dynamic = 'force-dynamic';

const STATUS_LABEL = {
  PENDING: 'Awaiting review',
  APPROVED: 'Approved',
  REJECTED: 'Not approved',
  SUSPENDED: 'Suspended',
  UNDER_REVIEW: 'Under review',
} as const;

const STATUS_TONE = {
  PENDING: 'neutral',
  APPROVED: 'positive',
  REJECTED: 'critical',
  SUSPENDED: 'caution',
  UNDER_REVIEW: 'info',
} as const;

export default async function CounsellorApplicationPage() {
  const context = await requirePageUser('/app/counsellor-application');
  const profile = await prisma.profile.findUnique({ where: { userId: context.user.id } });

  const existing = await prisma.counsellor.findUnique({
    where: { userId: context.user.id },
    select: { status: true, statusReason: true, createdAt: true, verifiedAt: true },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <AppPageHeader
        eyebrow="Serving"
        title="Serve as a counsellor"
        description="Apply to serve members seeking pastoral counselling. An administrator reviews every application before it is approved."
      />

      {existing && existing.status !== 'REJECTED' ? (
        <Card>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[existing.status]}>{STATUS_LABEL[existing.status]}</Badge>
          </div>
          <p className="font-serif text-lg font-semibold">
            {existing.status === 'APPROVED'
              ? 'You are an approved counsellor'
              : 'Your application has been submitted'}
          </p>
          <p className="mt-2 text-sm text-ink-600 dark:text-parchment-300">
            {existing.status === 'APPROVED'
              ? `Approved ${existing.verifiedAt ? formatDateTime(existing.verifiedAt, profile?.timezone ?? 'UTC') : ''}. Manage your availability and requests from the Counsellor Portal.`
              : existing.status === 'UNDER_REVIEW'
                ? 'An administrator is reviewing your application again. You will be notified once a decision is made.'
                : 'You will be notified once an administrator has reviewed it. There is no need to apply again.'}
          </p>
          {existing.statusReason ? (
            <p className="mt-3 text-sm text-ink-500 dark:text-parchment-400">
              Note from the review: {existing.statusReason}
            </p>
          ) : null}
        </Card>
      ) : (
        <>
          {existing?.status === 'REJECTED' ? (
            <Card className="mb-6 border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
              <p className="text-sm text-amber-900 dark:text-amber-100">
                Your previous application was not approved
                {existing.statusReason ? `: ${existing.statusReason}` : '.'} You are welcome to
                apply again below.
              </p>
            </Card>
          ) : null}
          <CounsellorApplicationForm />
        </>
      )}
    </div>
  );
}
