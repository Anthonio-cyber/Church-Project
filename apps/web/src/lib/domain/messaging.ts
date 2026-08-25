import { prisma } from '../db';
import { ApiError } from '../api';
import { isBlockedBetween } from './connections';

/**
 * May this person put something into this conversation?
 *
 * Sending a message and attaching a file are the same act as far as
 * authorisation goes, so they ask the same question here rather than each
 * keeping a copy of the rule. A copy is how an attachment route ends up
 * accepting an upload into a conversation the uploader may no longer write to.
 *
 * Every condition is re-derived from the database on each call. Nothing is
 * taken from the request beyond the conversation id.
 */
export async function assertCanWriteToConversation(userId: string, conversationId: string) {
  const membership = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    include: {
      conversation: {
        include: {
          participants: true,
          session: { select: { id: true, status: true } },
        },
      },
    },
  });

  // A conversation someone is not in is reported as missing rather than
  // forbidden: whether it exists is itself none of their business.
  if (!membership || membership.leftAt) {
    throw new ApiError(404, 'not_found', 'That conversation could not be found.');
  }
  if (!membership.conversation.isActive) {
    throw new ApiError(409, 'conversation_closed', 'This conversation is closed.');
  }

  if (membership.conversation.kind === 'COUNSELLING') {
    const status = membership.conversation.session?.status;
    if (!status || !['WAITING', 'COUNSELLOR_JOINED', 'ACTIVE'].includes(status)) {
      throw new ApiError(
        409,
        'session_not_active',
        'This pastoral session is not currently in progress.',
      );
    }
  }

  const others = membership.conversation.participants.filter(
    (participant) => participant.userId !== userId,
  );
  for (const other of others) {
    if (await isBlockedBetween(userId, other.userId)) {
      throw new ApiError(403, 'blocked', 'This message cannot be delivered.');
    }
  }

  return { membership, conversation: membership.conversation, others };
}

/**
 * May this person read what is in this conversation?
 *
 * Weaker than the write rule on purpose: a closed conversation, or a
 * counselling session that has ended, can still be read back by the people who
 * were in it. Someone who has left it cannot.
 */
export async function canReadConversation(
  userId: string,
  conversationId: string,
): Promise<boolean> {
  const membership = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { leftAt: true },
  });
  return Boolean(membership && !membership.leftAt);
}
