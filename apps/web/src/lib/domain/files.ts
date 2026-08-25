import type { StoredFilePurpose } from '@prisma/client';
import { prisma } from '../db';
import { ApiError } from '../api';

/**
 * Uploaded files.
 *
 * Files live in the database and are served only through an authenticated
 * route, so there is no public bucket URL that can leak or be guessed. That
 * choice costs nothing to run and is private by construction; the price is
 * size, so what may be uploaded is deliberately narrow.
 *
 * Swapping to object storage later means replacing `store` and `read` here.
 * Nothing outside this module knows where the bytes actually live.
 */

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/**
 * Image types accepted for avatars, keyed by the signature that proves it.
 *
 * The browser's declared Content-Type is attacker-controlled and is never
 * trusted: the type recorded and later served is the one derived from the
 * bytes. SVG is absent on purpose — it is a document format that can carry
 * script, and serving one back from our own origin would be a stored-XSS
 * hole no matter what the uploader claimed it was.
 */
type Signature = { type: string; test: (bytes: Uint8Array) => boolean };

const SIGNATURES: Signature[] = [
  {
    type: 'image/png',
    test: (b) =>
      b.length > 8 &&
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  },
  {
    type: 'image/jpeg',
    test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    type: 'image/webp',
    test: (b) =>
      b.length > 12 &&
      // "RIFF" .... "WEBP"
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
];

/** The real type of these bytes, or null if it is not one we accept. */
export function sniffImageType(bytes: Uint8Array): string | null {
  return SIGNATURES.find((signature) => signature.test(bytes))?.type ?? null;
}

/** The path an uploaded file is served from. Relative: same origin, always. */
export function fileUrl(id: string): string {
  return `/api/files/${id}`;
}

/**
 * Store an avatar for a user, replacing any previous one.
 *
 * Replacing rather than accumulating matters: without it every re-upload
 * would leave the old bytes in the database forever, and "delete my account"
 * would leave a trail of orphaned images.
 */
export async function storeAvatar(
  userId: string,
  bytes: Buffer,
): Promise<{ id: string; url: string; contentType: string }> {
  if (bytes.byteLength === 0) {
    throw new ApiError(422, 'empty_file', 'That file is empty.');
  }
  if (bytes.byteLength > MAX_AVATAR_BYTES) {
    throw new ApiError(
      413,
      'file_too_large',
      'Please choose an image smaller than 2 MB.',
    );
  }

  const contentType = sniffImageType(bytes);
  if (!contentType) {
    throw new ApiError(
      415,
      'unsupported_file_type',
      'Please choose a PNG, JPEG or WebP image.',
    );
  }

  const stored = await prisma.$transaction(async (tx) => {
    await tx.storedFile.deleteMany({ where: { ownerId: userId, purpose: 'AVATAR' } });
    return tx.storedFile.create({
      data: {
        ownerId: userId,
        purpose: 'AVATAR',
        contentType,
        byteSize: bytes.byteLength,
        data: new Uint8Array(bytes),
      },
      select: { id: true, contentType: true },
    });
  });

  return { id: stored.id, url: fileUrl(stored.id), contentType: stored.contentType };
}

export type StoredFileRead = {
  id: string;
  purpose: StoredFilePurpose;
  contentType: string;
  byteSize: number;
  data: Buffer;
};

export async function readFile(id: string): Promise<StoredFileRead | null> {
  const file = await prisma.storedFile.findUnique({
    where: { id },
    select: { id: true, purpose: true, contentType: true, byteSize: true, data: true },
  });
  if (!file) return null;
  return { ...file, data: Buffer.from(file.data) };
}
