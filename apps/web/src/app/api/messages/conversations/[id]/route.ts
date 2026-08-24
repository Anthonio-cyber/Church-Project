import { prisma } from '@/lib/db';
import { ApiError, ok, paginationFrom, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/context';
import { isBlockedBetween } from '@/lib/domain/connections';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/** Read a conversation. Membership is verified against the database, always. */
export const GET = route(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const context = await requireUser();
  const { take, skip } = paginationFrom(request, 50, 100);

  const membership = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId: id, userId: context.user.id } },
    include: {
      conversation: {
        include: {
          participants: {
            include: { user: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } } },
          },
          session: { select: { id: true, status: true, scheduledFor: true, method: true } },
        },
      },
    },
  });

  if (!membership || membership.leftAt) {
    throw new ApiError(404, 'not_found', 'That conversation could not be found.');
  }

  const others = membership.conversation.participants.filter((p) => p.userId !== context.user.id);
  for (const other of others) {
    if (await isBlockedBetween(context.user.id, other.userId)) {
      throw new ApiError(403, 'blocked', 'This conversation is unavailable.');
    }
  }

  const messages = await prisma.message.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: 'desc' },
    take,
    skip,
  });

  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId: id, userId: context.user.id } },
    data: { lastReadAt: new Date() },
  });

  return ok({
    conversation: {
      id: membership.conversation.id,
      kind: membership.conversation.kind,
      isActive: membership.conversation.isActive,
      session: membership.conversation.session,
      participants: others.map((p) => ({
        id: p.user.id,
        displayName: p.user.profile?.displayName ?? 'Member',
        avatarUrl: p.user.profile?.avatarUrl ?? null,
      })),
    },
    messages: messages
      .map((message) => ({
        id: message.id,
        senderId: message.senderId,
        kind: message.kind,
        body: message.deletedAt ? 'This message was removed.' : message.body,
        scriptureRef: message.scriptureRef,
        createdAt: message.createdAt,
        isMine: message.senderId === context.user.id,
        deleted: Boolean(message.deletedAt),
      }))
      .reverse(),
  });
});
