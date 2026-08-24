import { prisma } from '@/lib/db';
import {
  ApiError,
  assertSameOrigin,
  created,
  enforceRateLimit,
  parseBody,
  route,
} from '@/lib/api';
import { requireUser } from '@/lib/auth/context';
import { messageSchema } from '@/lib/validation';
import { isBlockedBetween } from '@/lib/domain/connections';
import { assertFeatureEnabled } from '@/lib/domain/settings';
import { channels, publish } from '@/lib/realtime';
import { notify } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

/**
 * Send a message.
 *
 * Authorisation is re-derived on every send rather than trusted from the client:
 * membership of the conversation, an active conversation, no block in either
 * direction, and for counselling conversations, a session that is actually
 * running.
 */
export const POST = route(async (request: Request) => {
  assertSameOrigin(request);
  await assertFeatureEnabled('messaging.enabled');
  const context = await requireUser();
  await enforceRateLimit('message', `user:${context.user.id}`);

  const input = await parseBody(request, messageSchema);

  const membership = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: { conversationId: input.conversationId, userId: context.user.id },
    },
    include: {
      conversation: {
        include: {
          participants: true,
          session: { select: { id: true, status: true } },
        },
      },
    },
  });

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
    (p) => p.userId !== context.user.id,
  );
  for (const other of others) {
    if (await isBlockedBetween(context.user.id, other.userId)) {
      throw new ApiError(403, 'blocked', 'This message cannot be delivered.');
    }
  }

  const message = await prisma.message.create({
    data: {
      conversationId: input.conversationId,
      senderId: context.user.id,
      kind: input.kind,
      body: input.body,
      scriptureRef: input.scriptureRef && input.scriptureRef.length > 0 ? input.scriptureRef : null,
    },
  });

  await prisma.conversation.update({
    where: { id: input.conversationId },
    data: { lastMessageAt: message.createdAt },
  });

  publish(channels.conversation(input.conversationId), 'message.created', {
    id: message.id,
    conversationId: input.conversationId,
    senderId: message.senderId,
    kind: message.kind,
    body: message.body,
    scriptureRef: message.scriptureRef,
    createdAt: message.createdAt.toISOString(),
  });

  for (const other of others) {
    if (other.mutedUntil && other.mutedUntil > new Date()) continue;
    await notify({
      userId: other.userId,
      category: membership.conversation.kind === 'COUNSELLING' ? 'COUNSELLING' : 'CONNECTION',
      // The notification never carries the message body — a preview on a lock
      // screen would defeat the privacy of the conversation.
      title:
        membership.conversation.kind === 'COUNSELLING'
          ? 'New message in your pastoral session'
          : 'You have a new message',
      body: 'Open the platform to read it.',
      link:
        membership.conversation.kind === 'COUNSELLING'
          ? `/app/counselling/${membership.conversation.session?.id}`
          : `/app/messages/${input.conversationId}`,
      push: true,
    });
  }

  return created({
    message: {
      id: message.id,
      body: message.body,
      kind: message.kind,
      createdAt: message.createdAt,
      isMine: true,
    },
  });
});
