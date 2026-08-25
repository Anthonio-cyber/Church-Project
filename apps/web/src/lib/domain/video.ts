import { createHmac } from 'node:crypto';
import { env } from '../env';

/**
 * Read at call time rather than through the frozen `env` object, so that
 * enabling or disabling video does not depend on when this module happened to
 * be imported. `env` snapshots at import, which is right for secrets that must
 * exist at boot and wrong for a switch like this one.
 */
function configuredVideoUrl(): string | undefined {
  const raw = process.env.VIDEO_SERVICE_URL;
  return raw && raw.length > 0 ? raw : undefined;
}

/**
 * Voice and video for counselling sessions, over Jitsi.
 *
 * WHY A DERIVED ROOM NAME.
 * A public Jitsi instance (meet.jit.si) has no account system: whoever opens a
 * room URL is in it. So the room name is the secret. It is derived here as
 * an HMAC of the session id under AUTH_SECRET, which means:
 *
 *   - both participants independently derive the same room without any
 *     shared state or a round trip;
 *   - the name cannot be guessed from the session id, which appears in URLs;
 *   - the name cannot be computed by anyone who does not hold AUTH_SECRET,
 *     so a database leak alone does not expose joinable rooms.
 *
 * HONEST LIMIT — READ THIS BEFORE RELYING ON IT.
 * This is unguessable-URL security, not authenticated access. Anyone who
 * obtains the derived room name (a shoulder-surfed screen, a shared link, a
 * compromised browser) can join the call, and on a public instance the
 * platform cannot evict them. The written channel, by contrast, is guarded by
 * assertSessionAccess on every request.
 *
 * For stronger guarantees, point VIDEO_SERVICE_URL at a self-hosted Jitsi with
 * JWT authentication enabled, or at a provider that issues per-participant
 * tokens. The room derivation below stays correct either way.
 */

/** The Jitsi origin, e.g. "https://meet.jit.si". Unset means video is off. */
export function videoOrigin(): string | null {
  const raw = configuredVideoUrl();
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    // A malformed value must not silently become a broken embed.
    console.error(`[video] VIDEO_SERVICE_URL is not a valid URL: ${raw}`);
    return null;
  }
}

export function isVideoConfigured(): boolean {
  return videoOrigin() !== null;
}

/**
 * The room name for a session. Deterministic, unguessable, and stable for the
 * lifetime of the session so a participant who drops can rejoin.
 */
export function videoRoomName(sessionId: string): string {
  const digest = createHmac('sha256', env.authSecret)
    .update(`counselling-video-room:${sessionId}`)
    .digest('base64url');
  // 32 base64url characters is 192 bits of the digest — far beyond guessable,
  // while keeping the room URL a manageable length.
  return `ipastor-${digest.slice(0, 32)}`;
}

export type VideoRoom = {
  origin: string;
  roomName: string;
  /** The full URL the iframe loads. */
  url: string;
};

/**
 * Build the room for a session, or null when video is not configured or the
 * session is not a voice/video session.
 *
 * Callers must have already established that the viewer may access the
 * session — this function performs no authorisation of its own.
 */
export function videoRoomForSession(
  sessionId: string,
  method: string,
): VideoRoom | null {
  if (method !== 'VIDEO' && method !== 'VOICE') return null;

  const origin = videoOrigin();
  if (!origin) return null;

  const roomName = videoRoomName(sessionId);

  // Jitsi reads UI preferences from the URL fragment. Voice sessions start
  // with the camera off, which is what someone who chose "voice call" asked
  // for; they can still enable it during the call if both agree.
  const params = new URLSearchParams({
    'config.prejoinPageEnabled': 'true',
    'config.disableDeepLinking': 'true',
    'config.startWithVideoMuted': method === 'VOICE' ? 'true' : 'false',
    'config.startWithAudioMuted': 'false',
  });

  return {
    origin,
    roomName,
    url: `${origin}/${roomName}#${params.toString()}`,
  };
}
