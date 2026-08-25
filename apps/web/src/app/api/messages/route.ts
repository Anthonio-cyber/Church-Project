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
import { assertCanWriteToConversation } from '@/lib/domain/messaging';
import { fileIdFromUrl } from '@/lib/domain/files';
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

  // The same rule the attachment upload applies, from one place.
  const { membership, others } = await assertCanWriteToConversation(
    context.user.id,
    input.conversationId,
  );

  // An attachment is only accepted if it was uploaded by this sender, into
  // this conversation, and has not already been sent. Without all three, a
  // sender could quote any file id they had ever seen and have the platform
  // serve it to a conversation it does not belong to.
  let attachment: { url: string; fileName: string | null } | null = null;
  if (input.attachmentUrl) {
    const id = fileIdFromUrl(input.attachmentUrl);
    const stored = id
      ? await prisma.storedFile.findUnique({
          where: { id },
          select: { id: true, ownerId: true, conversationId: true, purpose: true, fileName: true },
        })
      : null;

    if (
      !stored ||
      stored.purpose !== 'MESSAGE_ATTACHMENT' ||
      stored.ownerId !== context.user.id ||
      stored.conversationId !== input.conversationId
    ) {
      throw new ApiError(422, 'unknown_attachment', 'That attachment could not be found.');
    }

    const alreadySent = await prisma.message.findFirst({
      where: { attachmentUrl: input.attachmentUrl },
      select: { id: true },
    });
    if (alreadySent) {
      throw new ApiError(409, 'attachment_already_sent', 'That attachment has already been sent.');
    }

    attachment = { url: input.attachmentUrl, fileName: stored.fileName };
  }

  const message = await prisma.message.create({
    data: {
      conversationId: input.conversationId,
      senderId: context.user.id,
      kind: attachment ? 'FILE' : input.kind,
      body: input.body,
      attachmentUrl: attachment?.url ?? null,
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
    attachmentUrl: message.attachmentUrl,
    attachmentName: attachment?.fileName ?? null,
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
      attachmentUrl: message.attachmentUrl,
      attachmentName: attachment?.fileName ?? null,
      createdAt: message.createdAt,
      isMine: true,
    },
  });
});
