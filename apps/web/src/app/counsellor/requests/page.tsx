import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requirePageUser } from '@/lib/auth/guard';
import { AppPageHeader } from '@/components/app/AppShell';
import { CounsellorRequestQueue } from '@/components/app/CounsellorRequestQueue';
import { CATEGORY_LABEL } from '@/lib/domain/counselling';
import { PermissionDenied } from '@/components/ui';

export const metadata: Metadata = { title: 'Client Requests' };
export const dynamic = 'force-dynamic';

export default async function CounsellorRequestsPage() {
  const context = await requirePageUser('/counsellor/requests');

  const counsellor = await prisma.counsellor.findUnique({
    where: { userId: context.user.id },
  });

  if (!counsellor || counsellor.status !== 'APPROVED') {
    return (
      <PermissionDenied
        what="the counselling queue"
        detail="Counselling requests reach a counsellor only once their application has been verified and approved by an authorised administrator."
      />
    );
  }

  // Two sources: requests assigned directly to this counsellor, and unassigned
  // requests matching their approved areas of service and language.
  const requests = await prisma.counsellingRequest.findMany({
    where: {
      status: { in: ['MATCHING', 'ASSIGNED', 'SUBMITTED'] },
      OR: [
        { assignedCounsellorId: counsellor.id },
        {
          assignedCounsellorId: null,
          category: { in: counsellor.categories },
          ...(counsellor.languages.length > 0
            ? { language: { in: counsellor.languages } }
            : {}),
        },
      ],
      // A counsellor not approved to work with minors never sees their requests.
      ...(counsellor.acceptsMinors
        ? {}
        : { requester: { profile: { ageBand: { not: 'MINOR' } } } }),
    },
    orderBy: [{ urgency: 'desc' }, { createdAt: 'asc' }],
    take: 40,
    include: {
      requester: { select: { profile: { select: { ageBand: true } } } },
    },
  });

  return (
    <>
      <AppPageHeader
        eyebrow="Counsellor Portal"
        title="Client requests"
        description="Requests matching your approved areas of service, and any assigned to you directly. Accepting means choosing a time, so the member knows immediately when they will be seen."
      />

      <CounsellorRequestQueue
        items={requests.map((request) => ({
          id: request.id,
          categoryLabel: CATEGORY_LABEL[request.category],
          summary: request.summary,
          urgency: request.urgency,
          preferredMethod: request.preferredMethod,
          preferredDate: request.preferredDate?.toISOString() ?? null,
          preferredTimeLabel: request.preferredTimeLabel,
          language: request.language,
          createdAt: request.createdAt.toISOString(),
          directlyAssigned: request.assignedCounsellorId === counsellor.id,
          memberIsMinor: request.requester.profile?.ageBand === 'MINOR',
        }))}
      />
    </>
  );
}
