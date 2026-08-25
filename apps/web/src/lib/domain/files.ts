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
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

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

const PDF: Signature = {
  type: 'application/pdf',
  test: (b) =>
    b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46,
};

/**
 * The real type of an attachment: the image types, plus PDF.
 *
 * PDF earns its place because a letter, a report or a form is the ordinary
 * thing someone needs to hand to a counsellor. It is also the riskiest of the
 * four — a PDF can carry script that the browser's built-in viewer, not the
 * page, would run. So attachments of this type are served as a download rather
 * than rendered in place; see `dispositionFor`.
 */
export function sniffAttachmentType(bytes: Uint8Array): string | null {
  if (PDF.test(bytes)) return PDF.type;
  return sniffImageType(bytes);
}

/**
 * How a stored file should be handed to the browser.
 *
 * Images render in place, which is the point of sending a photograph. Anything
 * else downloads, so the browser never opens member-supplied content in a
 * viewer of its own.
 */
export function dispositionFor(contentType: string, fileName: string | null): string {
  const kind = contentType.startsWith('image/') ? 'inline' : 'attachment';
  const safe = sanitiseFileName(fileName);
  return safe ? `${kind}; filename="${safe}"` : kind;
}

/**
 * A filename safe to place inside a Content-Disposition header.
 *
 * The name came from the sender's machine, so it is not trusted: quotes,
 * backslashes, control characters and newlines are all removed rather than
 * escaped, because a header is the wrong place to be clever. Path separators
 * go too — only the final component of a path is ever a filename.
 */
export function sanitiseFileName(name: string | null | undefined): string | null {
  if (!name) return null;
  const base = name.split(/[\\/]/).pop() ?? '';
  const cleaned = base
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f"\\]/g, '')
    .trim()
    .slice(0, 100);
  return cleaned.length > 0 ? cleaned : null;
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

/**
 * Store a file shared into a conversation.
 *
 * The caller must already have established that this sender may write to this
 * conversation — this function records the link, it does not authorise it.
 */
export async function storeAttachment(
  userId: string,
  conversationId: string,
  bytes: Buffer,
  fileName: string | null,
): Promise<{ id: string; url: string; contentType: string; byteSize: number; fileName: string | null }> {
  if (bytes.byteLength === 0) {
    throw new ApiError(422, 'empty_file', 'That file is empty.');
  }
  if (bytes.byteLength > MAX_ATTACHMENT_BYTES) {
    throw new ApiError(413, 'file_too_large', 'Please choose a file smaller than 5 MB.');
  }

  const contentType = sniffAttachmentType(bytes);
  if (!contentType) {
    throw new ApiError(
      415,
      'unsupported_file_type',
      'Please choose a PNG, JPEG, WebP or PDF file.',
    );
  }

  const stored = await prisma.storedFile.create({
    data: {
      ownerId: userId,
      conversationId,
      purpose: 'MESSAGE_ATTACHMENT',
      contentType,
      byteSize: bytes.byteLength,
      fileName: sanitiseFileName(fileName),
      data: new Uint8Array(bytes),
    },
    select: { id: true, contentType: true, byteSize: true, fileName: true },
  });

  return { ...stored, url: fileUrl(stored.id) };
}

export type StoredFileRead = {
  id: string;
  purpose: StoredFilePurpose;
  conversationId: string | null;
  contentType: string;
  byteSize: number;
  fileName: string | null;
  data: Buffer;
};

export async function readFile(id: string): Promise<StoredFileRead | null> {
  const file = await prisma.storedFile.findUnique({
    where: { id },
    select: {
      id: true,
      purpose: true,
      conversationId: true,
      contentType: true,
      byteSize: true,
      fileName: true,
      data: true,
    },
  });
  if (!file) return null;
  return { ...file, data: Buffer.from(file.data) };
}

/** The id in one of our own `/api/files/<uuid>` paths, or null. */
export function fileIdFromUrl(url: string): string | null {
  const match = /^\/api\/files\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/.exec(
    url,
  );
  return match ? match[1]! : null;
}

/**
 * The display names for a set of attachment URLs, keyed by URL.
 *
 * Message rows carry only the URL, so the sender's filename is fetched
 * alongside rather than duplicated onto the message. Batched, because the
 * alternative is a query per message in a conversation.
 */
export async function attachmentNamesFor(
  urls: (string | null)[],
): Promise<Map<string, { fileName: string | null; contentType: string }>> {
  const byId = new Map<string, string>();
  for (const url of urls) {
    if (!url) continue;
    const id = fileIdFromUrl(url);
    if (id) byId.set(id, url);
  }
  if (byId.size === 0) return new Map();

  const files = await prisma.storedFile.findMany({
    where: { id: { in: [...byId.keys()] }, purpose: 'MESSAGE_ATTACHMENT' },
    select: { id: true, fileName: true, contentType: true },
  });

  return new Map(
    files.map((file) => [
      byId.get(file.id)!,
      { fileName: file.fileName, contentType: file.contentType },
    ]),
  );
}
