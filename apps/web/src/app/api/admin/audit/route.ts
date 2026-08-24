import { prisma } from '@/lib/db';
import { ok, paginationFrom, route } from '@/lib/api';
import { requirePermission } from '@/lib/auth/context';

export const dynamic = 'force-dynamic';

/**
 * The audit log.
 *
 * Read-only by construction: the table has no update or delete route anywhere
 * in this codebase, and a database trigger rejects UPDATE and DELETE regardless
 * of who issues them. An administrator cannot erase their own actions, and
 * neither can the Setman.
 */
export const GET = route(async (request: Request) => {
  await requirePermission('audit_logs.view');
  const { take, skip } = paginationFrom(request, 50, 200);
  const url = new URL(request.url);

  const action = url.searchParams.get('action');
  const actorId = url.searchParams.get('actorId');
  const targetId = url.searchParams.get('targetId');
  const outcome = url.searchParams.get('outcome');
  const since = url.searchParams.get('since');

  const where = {
    ...(action ? { action: { contains: action, mode: 'insensitive' as const } } : {}),
    ...(actorId ? { actorId } : {}),
    ...(targetId ? { targetId } : {}),
    ...(outcome ? { outcome: outcome as never } : {}),
    ...(since ? { createdAt: { gte: new Date(since) } } : {}),
  };

  const [entries, total, actionCounts] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      include: {
        actor: { select: { id: true, email: true, profile: { select: { displayName: true } } } },
      },
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({
      by: ['action'],
      _count: true,
      orderBy: { _count: { action: 'desc' } },
      take: 15,
    }),
  ]);

  return ok({
    total,
    topActions: actionCounts.map((row) => ({ action: row.action, count: row._count })),
    entries: entries.map((entry) => ({
      id: entry.id,
      at: entry.createdAt,
      actor: entry.actor
        ? {
            id: entry.actor.id,
            email: entry.actor.email,
            displayName: entry.actor.profile?.displayName ?? entry.actorEmail,
          }
        : { id: null, email: entry.actorEmail, displayName: entry.actorEmail ?? 'System' },
      role: entry.actorRole,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      reason: entry.reason,
      outcome: entry.outcome,
      metadata: entry.metadata,
      ipAddress: entry.ipAddress,
    })),
    integrity:
      'This log is append-only. UPDATE and DELETE are rejected by a database trigger, so entries cannot be altered or removed through the application.',
  });
});
