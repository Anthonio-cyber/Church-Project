'use client';

/**
 * An attachment inside a message bubble.
 *
 * Images are shown; everything else is offered as a download rather than
 * opened, matching the Content-Disposition the file route sets. The link is a
 * same-origin path that only a participant in this conversation can load, so
 * there is nothing here that works if it is copied elsewhere.
 */
export function MessageAttachment({
  url,
  fileName,
  contentType,
  mine,
}: {
  url: string;
  fileName: string | null;
  contentType: string | null;
  mine: boolean;
}) {
  const isImage = (contentType ?? '').startsWith('image/');
  const label = fileName ?? (isImage ? 'Image' : 'Attachment');

  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="mt-1 block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={label}
          className="max-h-64 w-auto rounded-lg border border-black/10 object-contain"
        />
      </a>
    );
  }

  return (
    <a
      href={url}
      download={fileName ?? undefined}
      className={`mt-1 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm underline-offset-2 hover:underline ${
        mine ? 'bg-black/10' : 'bg-black/5 dark:bg-white/10'
      }`}
    >
      <span aria-hidden className="text-base">
        ⎙
      </span>
      <span className="min-w-0 truncate">{label}</span>
    </a>
  );
}
