import { prisma } from '@/lib/db';
import { ok, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/context';

export const dynamic = 'force-dynamic';

/**
 * The caller's conversations.
 *
 * Counselling conversations are returned in a separate list and are never mixed
 * into ordinary messages — a pastoral session should not sit in the same thread
 * list as a chat with a friend.
 */
export const GET = route(async () => {
  const context = await requireUser();

  const memberships = await prisma.conversationParticipant.findMany({
    where: { userId: context.user.id, leftAt: null },
    include: {
      conversation: {
        include: {
          participants: {
            include: {
              user: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
            },
          },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          session: { select: { id: true, status: true, scheduledFor: true } },
        },
      },
    },
    orderBy: { conversation: { lastMessageAt: 'desc' } },
  });

  // Blocked relationships disappear from the list entirely: blocking hides the
  // existing conversation rather than merely muting it.
  const blocks = await prisma.block.findMany({
    where: { OR: [{ blockerId: context.user.id }, { blockedId: context.user.id }] },
    select: { blockerId: true, blockedId: true },
  });
  const blockedIds = new Set(
    blocks.flatMap((b) => [b.blockerId, b.blockedId]).filter((id) => id !== context.user.id),
  );

  const shape = (membership: (typeof memberships)[number]) => {
    const conversation = membership.conversation;
    const others = conversation.participants.filter((p) => p.userId !== context.user.id);
    const last = conversation.messages[0];
    return {
      id: conversation.id,
      kind: conversation.kind,
      isActive: conversation.isActive,
      sessionId: conversation.session?.id ?? null,
      sessionStatus: conversation.session?.status ?? null,
      participants: others.map((p) => ({
        id: p.user.id,
        displayName: p.user.profile?.displayName ?? 'Member',
        avatarUrl: p.user.profile?.avatarUrl ?? null,
      })),
      lastMessage: last
        ? {
            body: last.deletedAt ? 'Message removed' : last.body.slice(0, 160),
            senderId: last.senderId,
            createdAt: last.createdAt,
          }
        : null,
      unread:
        last && (!membership.lastReadAt || last.createdAt > membership.lastReadAt)
          ? last.senderId !== context.user.id
          : false,
      lastMessageAt: conversation.lastMessageAt,
    };
  };

  const visible = memberships.filter((membership) =>
    membership.conversation.participants.every(
      (p) => p.userId === context.user.id || !blockedIds.has(p.userId),
    ),
  );

  return ok({
    conversations: visible.filter((m) => m.conversation.kind === 'PEER').map(shape),
    counsellingConversations: visible
      .filter((m) => m.conversation.kind === 'COUNSELLING')
      .map(shape),
  });
});
