import { prisma } from '@/lib/db';
import { ok, paginationFrom, route } from '@/lib/api';
import { requirePermission } from '@/lib/auth/context';

export const dynamic = 'force-dynamic';

/**
 * Safeguarding case list.
 *
 * Reaching this route at all requires safeguarding.view, which is a sensitive
 * permission: MFA, fresh re-authentication and an audit entry. The list returns
 * metadata only — the narrative stays encrypted until a lead opens a specific
 * case and states why, on the detail route.
 */
export const GET = route(async (request: Request) => {
  // The list is metadata only — references, categories, risk and status, never
  // a narrative. Demanding a written reason to see that would be friction
  // without benefit; the reason belongs on opening a specific case, where it is
  // required and recorded permanently against that case.
  await requirePermission('safeguarding.view', {
    reason: 'Reviewing the safeguarding case list.',
  });
  const { take, skip } = paginationFrom(request, 25, 100);
  const url = new URL(request.url);
  const status = url.searchParams.get('status');

  const where = status ? { status: status as never } : {};

  const [rows, total, counts] = await Promise.all([
    prisma.safeguardingCase.findMany({
      where,
      orderBy: [{ riskLevel: 'desc' }, { createdAt: 'desc' }],
      take,
      skip,
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
        assignedToId: true,
        reportId: true,
        subjectUserId: true,
        _count: { select: { accesses: true } },
      },
    }),
    prisma.safeguardingCase.count({ where }),
    prisma.safeguardingCase.groupBy({ by: ['status'], _count: true }),
  ]);

  return ok({
    total,
    statusCounts: counts.map((row) => ({ status: row.status, count: row._count })),
    cases: rows.map((row) => ({
      ...row,
      accessCount: row._count.accesses,
      narrativeAvailable: true,
      note: 'Open the case to read the narrative. Every access is recorded against the case.',
    })),
  });
});
