import { prisma } from '@/lib/db';
import { ok, paginationFrom, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/context';
import { CATEGORY_LABEL } from '@/lib/domain/counselling';

export const dynamic = 'force-dynamic';

/**
 * The caller's own counselling requests. Scoped by requesterId at the database
 * level — there is no query parameter that would widen it to anyone else.
 */
export const GET = route(async (request: Request) => {
  const context = await requireUser();
  const { take, skip } = paginationFrom(request);

  const [rows, total] = await Promise.all([
    prisma.counsellingRequest.findMany({
      where: { requesterId: context.user.id },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      include: {
        assignedCounsellor: {
          select: {
            id: true,
            ministryRole: true,
            user: { select: { profile: { select: { displayName: true, avatarUrl: true } } } },
          },
        },
        session: {
          select: { id: true, scheduledFor: true, status: true, method: true, durationMinutes: true },
        },
      },
    }),
    prisma.counsellingRequest.count({ where: { requesterId: context.user.id } }),
  ]);

  return ok({
    total,
    requests: rows.map((row) => ({
      id: row.id,
      category: row.category,
      categoryLabel: CATEGORY_LABEL[row.category],
      summary: row.summary,
      urgency: row.urgency,
      status: row.status,
      preferredMethod: row.preferredMethod,
      createdAt: row.createdAt,
      counsellor: row.assignedCounsellor
        ? {
            id: row.assignedCounsellor.id,
            displayName: row.assignedCounsellor.user.profile?.displayName ?? 'Counsellor',
            ministryRole: row.assignedCounsellor.ministryRole,
            avatarUrl: row.assignedCounsellor.user.profile?.avatarUrl ?? null,
          }
        : null,
      session: row.session,
    })),
  });
});
