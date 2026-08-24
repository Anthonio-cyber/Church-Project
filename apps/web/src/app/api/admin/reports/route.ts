import { prisma } from '@/lib/db';
import { ok, paginationFrom, route } from '@/lib/api';
import { requirePermission } from '@/lib/auth/context';

export const dynamic = 'force-dynamic';

/**
 * The moderation queue.
 *
 * A moderator sees reports, the reported account, and the reported message if
 * one was attached. They do not see counselling conversations, counselling
 * notes or safeguarding narratives — reports that touch those are escalated out
 * of this queue entirely and become safeguarding cases.
 */
export const GET = route(async (request: Request) => {
  const context = await requirePermission('reports.view');
  const { take, skip } = paginationFrom(request, 25, 100);
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const category = url.searchParams.get('category');

  const where = {
    ...(status ? { status: status as never } : {}),
    ...(category ? { category: category as never } : {}),
  };

  const [rows, total, counts] = await Promise.all([
    prisma.report.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      include: {
        reporter: { select: { id: true, profile: { select: { displayName: true } } } },
        reportedUser: {
          select: {
            id: true,
            status: true,
            profile: { select: { displayName: true } },
            _count: { select: { reportsAbout: true } },
          },
        },
        message: {
          select: { id: true, body: true, createdAt: true, conversationId: true, conversation: { select: { kind: true } } },
        },
        safeguardingCase: { select: { id: true, reference: true } },
      },
    }),
    prisma.report.count({ where }),
    prisma.report.groupBy({ by: ['status'], _count: true }),
  ]);

  return ok({
    total,
    statusCounts: counts.map((row) => ({ status: row.status, count: row._count })),
    reports: rows.map((row) => ({
      id: row.id,
      reference: row.reference,
      category: row.category,
      description: row.description,
      status: row.status,
      createdAt: row.createdAt,
      resolvedAt: row.resolvedAt,
      resolution: row.resolution,
      escalatedAt: row.escalatedAt,
      assignedModeratorId: row.assignedModeratorId,
      reporter: {
        id: row.reporter.id,
        displayName: row.reporter.profile?.displayName ?? 'Member',
      },
      reportedUser: row.reportedUser
        ? {
            id: row.reportedUser.id,
            displayName: row.reportedUser.profile?.displayName ?? 'Member',
            accountStatus: row.reportedUser.status,
            priorReportCount: row.reportedUser._count.reportsAbout,
          }
        : null,
      // A reported message from a counselling conversation is never shown to a
      // moderator, even though the report itself is visible to them.
      message: row.message
        ? row.message.conversation.kind === 'COUNSELLING'
          ? {
              id: row.message.id,
              body: null,
              withheld:
                'This message is part of a private counselling session. It is not available to moderators and must be handled through safeguarding.',
              createdAt: row.message.createdAt,
            }
          : {
              id: row.message.id,
              body: row.message.body,
              withheld: null,
              createdAt: row.message.createdAt,
            }
        : null,
      safeguardingCase: context.permissions.has('safeguarding.view')
        ? row.safeguardingCase
        : row.safeguardingCase
          ? { id: null, reference: 'Escalated to safeguarding' }
          : null,
    })),
  });
});
