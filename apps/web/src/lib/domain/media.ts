/**
 * Linked video.
 *
 * Teaching video is the one kind of media this platform does not host itself:
 * a sermon is large, public by intention, and already lives on the ministry's
 * own channel. So an administrator pastes a link and it plays in place.
 *
 * Only YouTube is recognised, and only as a specific video. A channel or
 * playlist URL is left as a plain link rather than embedded, because an embed
 * that silently plays "whatever is newest on this channel" is not something a
 * content administrator can meaningfully review before publishing.
 */

/** The YouTube video id in a URL, or null if it is not one. */
export function youTubeVideoId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;

  const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
  const isYouTube =
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'youtube-nocookie.com' ||
    host === 'youtu.be';
  if (!isYouTube) return null;

  const candidate = (() => {
    if (host === 'youtu.be') return parsed.pathname.slice(1);

    const path = parsed.pathname;
    if (path === '/watch') return parsed.searchParams.get('v') ?? '';
    // /embed/ID, /live/ID, /shorts/ID, /v/ID
    const match = /^\/(?:embed|live|shorts|v)\/([^/]+)/.exec(path);
    return match ? match[1]! : '';
  })();

  // A YouTube id is 11 characters of an unreserved alphabet. Checking the
  // shape keeps anything else out of a URL we are about to frame.
  return /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null;
}

/**
 * The origin embeds are loaded from.
 *
 * youtube-nocookie.com is YouTube's privacy-enhanced host: it does not set
 * tracking cookies until someone actually presses play. For a platform whose
 * members are here for pastoral care, "watching a teaching video does not
 * quietly enrol you in ad tracking" is worth the one-word difference.
 */
export const YOUTUBE_EMBED_ORIGIN = 'https://www.youtube-nocookie.com';

/** The embed URL for a linked video, or null when it is not embeddable. */
export function youTubeEmbedUrl(url: string): string | null {
  const id = youTubeVideoId(url);
  if (!id) return null;
  // modestbranding and rel=0 keep the end-of-video suggestions from becoming a
  // doorway out of the platform into unrelated content.
  return `${YOUTUBE_EMBED_ORIGIN}/embed/${id}?rel=0&modestbranding=1`;
}
