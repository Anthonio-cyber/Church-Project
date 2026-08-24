import { prisma } from '@/lib/db';
import { ok, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/context';

export const dynamic = 'force-dynamic';

/** Connections and pending requests belonging to the caller. */
export const GET = route(async () => {
  const context = await requireUser();

  const rows = await prisma.connectionRequest.findMany({
    where: {
      OR: [{ requesterId: context.user.id }, { recipientId: context.user.id }],
      status: { in: ['PENDING', 'ACCEPTED'] },
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      requester: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true, country: true } } } },
      recipient: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true, country: true } } } },
    },
  });

  const shape = (row: (typeof rows)[number]) => {
    const outgoing = row.requesterId === context.user.id;
    const other = outgoing ? row.recipient : row.requester;
    return {
      id: row.id,
      direction: outgoing ? ('outgoing' as const) : ('incoming' as const),
      status: row.status,
      // The intro message is shown only to the recipient deciding on it.
      introMessage: outgoing ? row.introMessage : row.introMessage,
      createdAt: row.createdAt,
      respondedAt: row.respondedAt,
      conversationId: row.conversationId,
      person: {
        id: other.id,
        displayName: other.profile?.displayName ?? 'Member',
        avatarUrl: other.profile?.avatarUrl ?? null,
        country: other.profile?.country ?? null,
      },
    };
  };

  return ok({
    pendingIncoming: rows.filter((r) => r.status === 'PENDING' && r.recipientId === context.user.id).map(shape),
    pendingOutgoing: rows.filter((r) => r.status === 'PENDING' && r.requesterId === context.user.id).map(shape),
    connections: rows.filter((r) => r.status === 'ACCEPTED').map(shape),
  });
});
