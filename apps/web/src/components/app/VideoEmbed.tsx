import { youTubeEmbedUrl } from '@/lib/domain/media';

/**
 * A linked teaching video.
 *
 * A recognised YouTube video plays in place. Anything else stays a plain link
 * out — this platform will not frame an arbitrary URL an administrator typed.
 */
export function VideoEmbed({ url, title }: { url: string; title: string }) {
  const embed = youTubeEmbedUrl(url);

  if (!embed) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex min-h-[2.5rem] items-center gap-2 rounded-lg border border-ink-300 px-4 text-sm dark:border-ink-700"
      >
        <span aria-hidden>▶</span> Watch the video
      </a>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-ink-200 bg-ink-950 dark:border-ink-800">
      <iframe
        src={embed}
        title={title}
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        className="aspect-video w-full border-0"
      />
    </div>
  );
}
