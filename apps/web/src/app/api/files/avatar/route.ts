import { prisma } from '@/lib/db';
import { ApiError, assertSameOrigin, clientIdentity, enforceRateLimit, ok, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/context';
import { writeSecurityEvent } from '@/lib/audit';
import { MAX_AVATAR_BYTES, storeAvatar } from '@/lib/domain/files';

export const dynamic = 'force-dynamic';

/**
 * Upload a profile picture.
 *
 * A member may only ever replace their own avatar: the owner is taken from the
 * session, never from the request, so there is no field to tamper with that
 * would write a file onto someone else's profile.
 */
export const POST = route(async (request: Request) => {
  assertSameOrigin(request);
  const context = await requireUser();
  await enforceRateLimit('generalWrite', clientIdentity(request, context.user.id));

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');

  if (!form || !(file instanceof File)) {
    throw new ApiError(422, 'no_file', 'Please choose an image to upload.');
  }

  // Checked before reading the body into memory, so an oversized upload is
  // refused rather than buffered.
  if (file.size > MAX_AVATAR_BYTES) {
    await writeSecurityEvent({
      userId: context.user.id,
      kind: 'UPLOAD_REJECTED',
      detail: `Avatar upload refused: ${file.size} bytes exceeds the limit.`,
      ipAddress: context.ipAddress,
    });
    throw new ApiError(413, 'file_too_large', 'Please choose an image smaller than 2 MB.');
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  let stored;
  try {
    stored = await storeAvatar(context.user.id, bytes);
  } catch (error) {
    // A refusal here means the bytes were not an image we accept. Worth
    // recording: repeated rejections are what an attempt to smuggle an
    // executable payload past the check looks like.
    if (error instanceof ApiError) {
      await writeSecurityEvent({
        userId: context.user.id,
        kind: 'UPLOAD_REJECTED',
        detail: `Avatar upload refused: ${error.code}.`,
        ipAddress: context.ipAddress,
      });
    }
    throw error;
  }

  await prisma.profile.update({
    where: { userId: context.user.id },
    data: { avatarUrl: stored.url },
  });

  return ok({ avatarUrl: stored.url, message: 'Your profile picture has been updated.' });
});

/** Remove the current profile picture. */
export const DELETE = route(async (request: Request) => {
  assertSameOrigin(request);
  const context = await requireUser();

  await prisma.$transaction(async (tx) => {
    await tx.storedFile.deleteMany({ where: { ownerId: context.user.id, purpose: 'AVATAR' } });
    await tx.profile.update({
      where: { userId: context.user.id },
      data: { avatarUrl: null },
    });
  });

  return ok({ avatarUrl: null, message: 'Your profile picture has been removed.' });
});
