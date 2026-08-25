import { z } from 'zod';
import { ApiError, assertSameOrigin, created, enforceRateLimit, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/context';
import { writeSecurityEvent } from '@/lib/audit';
import { assertFeatureEnabled } from '@/lib/domain/settings';
import { assertCanWriteToConversation } from '@/lib/domain/messaging';
import { MAX_ATTACHMENT_BYTES, storeAttachment } from '@/lib/domain/files';

export const dynamic = 'force-dynamic';

const conversationIdSchema = z.string().uuid();

/**
 * Attach a file to a conversation.
 *
 * Uploading is authorised exactly as sending is — same function, so the two
 * cannot drift apart. Without that, a member who had been blocked, or whose
 * pastoral session had ended, could still push a file into the conversation
 * and have the platform hold it.
 *
 * The upload only stores the file. It becomes visible to the other person when
 * a message referencing it is sent, which is checked again there.
 */
export const POST = route(async (request: Request) => {
  assertSameOrigin(request);
  await assertFeatureEnabled('messaging.enabled');
  const context = await requireUser();
  await enforceRateLimit('message', `user:${context.user.id}`);

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  const conversationId = form?.get('conversationId');

  if (!form || !(file instanceof File)) {
    throw new ApiError(422, 'no_file', 'Please choose a file to attach.');
  }

  const parsedConversation = conversationIdSchema.safeParse(conversationId);
  if (!parsedConversation.success) {
    throw new ApiError(422, 'invalid_conversation', 'That conversation could not be found.');
  }

  // Throws unless this person may write to this conversation right now.
  await assertCanWriteToConversation(context.user.id, parsedConversation.data);

  // Checked before the body is read into memory.
  if (file.size > MAX_ATTACHMENT_BYTES) {
    await writeSecurityEvent({
      userId: context.user.id,
      kind: 'UPLOAD_REJECTED',
      detail: `Attachment refused: ${file.size} bytes exceeds the limit.`,
      ipAddress: context.ipAddress,
    });
    throw new ApiError(413, 'file_too_large', 'Please choose a file smaller than 5 MB.');
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  try {
    const stored = await storeAttachment(
      context.user.id,
      parsedConversation.data,
      bytes,
      file.name || null,
    );
    return created({
      attachment: {
        url: stored.url,
        fileName: stored.fileName,
        contentType: stored.contentType,
        byteSize: stored.byteSize,
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      await writeSecurityEvent({
        userId: context.user.id,
        kind: 'UPLOAD_REJECTED',
        detail: `Attachment refused: ${error.code}.`,
        ipAddress: context.ipAddress,
      });
    }
    throw error;
  }
});
