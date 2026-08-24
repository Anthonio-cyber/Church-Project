import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/auth/guard';
import { AppPageHeader } from '@/components/app/AppShell';
import { SafeguardingCaseView } from '@/components/app/SafeguardingCaseView';
import { Card } from '@/components/ui';

export const metadata: Metadata = { title: 'Safeguarding case' };
export const dynamic = 'force-dynamic';

/**
 * A single safeguarding case.
 *
 * The narrative is NOT decrypted here. The page renders the case metadata and
 * an explicit "open the narrative" step that carries a written reason — the
 * reason is sent to the API, which decrypts, records the access against the
 * case and writes an audit entry. Rendering the narrative on page load would
 * mean a stray click, a bookmark or a back-button press silently accessed
 * someone's safeguarding record.
 */
export default async function SafeguardingCasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requirePagePermission(['safeguarding.view'], `/admin/safeguarding/${id}`);

  const safeguardingCase = await prisma.safeguardingCase.findUnique({
    where: { id },
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
      closureSummary: true,
      assignedToId: true,
      subjectUserId: true,
      report: { select: { reference: true, category: true, createdAt: true } },
      accesses: {
        orderBy: { createdAt: 'desc' },
        take: 25,
        select: { id: true, actorId: true, action: true, reason: true, createdAt: true },
      },
    },
  });

  if (!safeguardingCase) notFound();

  const [subject, leads, actors] = await Promise.all([
    safeguardingCase.subjectUserId
      ? prisma.user.findUnique({
          where: { id: safeguardingCase.subjectUserId },
          select: {
            id: true,
            status: true,
            profile: { select: { displayName: true, ageBand: true } },
          },
        })
      : Promise.resolve(null),
    prisma.user.findMany({
      where: {
        roles: {
          some: {
            role: { key: { in: ['SAFEGUARDING_ADMIN', 'SENIOR_LEADERSHIP_ADMIN', 'SUPER_ADMIN'] } },
          },
        },
      },
      select: { id: true, profile: { select: { displayName: true } } },
    }),
    prisma.user.findMany({
      where: { id: { in: safeguardingCase.accesses.map((entry) => entry.actorId) } },
      select: { id: true, email: true, profile: { select: { displayName: true } } },
    }),
  ]);

  const actorNames = new Map(
    actors.map((actor) => [actor.id, actor.profile?.displayName ?? actor.email]),
  );

  return (
    <div className="mx-auto max-w-4xl">
      <AppPageHeader
        eyebrow="Safeguarding"
        title={`Case ${safeguardingCase.reference}`}
        description="Opening the narrative below records your access against this case, permanently."
      />

      <SafeguardingCaseView
        caseId={safeguardingCase.id}
        reference={safeguardingCase.reference}
        category={safeguardingCase.category}
        riskLevel={safeguardingCase.riskLevel}
        status={safeguardingCase.status}
        involvesMinor={safeguardingCase.involvesMinor}
        createdAt={safeguardingCase.createdAt.toISOString()}
        escalatedAt={safeguardingCase.escalatedAt?.toISOString() ?? null}
        closedAt={safeguardingCase.closedAt?.toISOString() ?? null}
        closureSummary={safeguardingCase.closureSummary}
        assignedToId={safeguardingCase.assignedToId}
        subject={
          subject
            ? {
                displayName: subject.profile?.displayName ?? 'Member',
                accountStatus: subject.status,
                isMinor: subject.profile?.ageBand === 'MINOR',
              }
            : null
        }
        sourceReport={
          safeguardingCase.report
            ? {
                reference: safeguardingCase.report.reference,
                category: safeguardingCase.report.category,
                createdAt: safeguardingCase.report.createdAt.toISOString(),
              }
            : null
        }
        leads={leads.map((lead) => ({
          id: lead.id,
          displayName: lead.profile?.displayName ?? 'Lead',
        }))}
        accessTrail={safeguardingCase.accesses.map((entry) => ({
          id: entry.id,
          actor: actorNames.get(entry.actorId) ?? entry.actorId,
          action: entry.action,
          reason: entry.reason,
          createdAt: entry.createdAt.toISOString(),
        }))}
      />

      <Card className="mt-8 border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
        <h2 className="font-serif text-base font-semibold text-amber-900 dark:text-amber-100">
          The limits of this platform
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-amber-900 dark:text-amber-100">
          This platform cannot intervene physically and is not an emergency service. Where someone
          is in immediate danger, the response is local emergency services and the organisation's
          approved safeguarding procedure — not a status change in this interface.
        </p>
      </Card>
    </div>
  );
}
