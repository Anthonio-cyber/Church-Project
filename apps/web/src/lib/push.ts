import webpush from 'web-push';
import { env } from './env';
import { prisma } from './db';

export type PushMessage = {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
};

/**
 * Push notifications, to browsers and to mobile devices.
 *
 * Two transports, because they are genuinely different things:
 *
 *   Web Push reaches anyone who installed the platform as a web app and
 *   allowed notifications. It needs no app store and no account with anyone —
 *   a VAPID key pair, generated once, is the whole setup.
 *
 *   Expo push fronts APNs and FCM for the mobile applications.
 *
 * Payloads must stay generic on both: a counselling notification says a
 * session is starting, never what it is about. That rule is why the body
 * every caller passes is already written that way.
 */

let vapidConfigured: boolean | null = null;

/**
 * Configure VAPID once, and remember whether it worked.
 *
 * Recomputed lazily rather than at import so that a key added to the
 * environment takes effect without anything else changing.
 */
function ensureVapid(): boolean {
  if (vapidConfigured !== null) return vapidConfigured;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    vapidConfigured = false;
    return false;
  }

  try {
    // The subject tells a push service who to contact about a misbehaving
    // sender. It must be a mailto: or https: URL.
    webpush.setVapidDetails(env.appUrl, publicKey, privateKey);
    vapidConfigured = true;
  } catch (error) {
    console.error('[push] VAPID keys are present but invalid', error);
    vapidConfigured = false;
  }
  return vapidConfigured;
}

export function isWebPushConfigured(): boolean {
  return ensureVapid();
}

export async function sendPush(message: PushMessage): Promise<{
  delivered: number;
  reason?: string;
}> {
  const tokens = await prisma.pushToken.findMany({
    where: { userId: message.userId },
    select: { id: true, token: true, platform: true, p256dh: true, auth: true },
  });
  if (tokens.length === 0) return { delivered: 0, reason: 'no_devices' };

  const web = tokens.filter((row) => row.platform === 'web' && row.p256dh && row.auth);
  const mobile = tokens.filter((row) => row.platform !== 'web');

  const payload = JSON.stringify({
    title: message.title,
    body: message.body,
    link: message.data?.link ?? '/app/notifications',
    tag: message.data?.tag ?? 'ipastor',
  });

  let delivered = 0;
  const reasons: string[] = [];

  // ── Browsers ──────────────────────────────────────────────────────────────
  if (web.length > 0) {
    if (!ensureVapid()) {
      reasons.push('web_not_configured');
      console.info(`[push:web-not-configured] user=${message.userId}`);
    } else {
      const staleIds: string[] = [];
      await Promise.all(
        web.map(async (row) => {
          try {
            await webpush.sendNotification(
              { endpoint: row.token, keys: { p256dh: row.p256dh!, auth: row.auth! } },
              payload,
            );
            delivered += 1;
          } catch (error) {
            const status = (error as { statusCode?: number }).statusCode;
            // 404/410 mean the browser threw the subscription away — the user
            // cleared site data, or revoked permission. Keeping it would mean
            // failing on every future send forever.
            if (status === 404 || status === 410) {
              staleIds.push(row.id);
            } else {
              console.error('[push:web] send failed', status ?? error);
              reasons.push(`web_error_${status ?? 'unknown'}`);
            }
          }
        }),
      );
      if (staleIds.length > 0) {
        await prisma.pushToken.deleteMany({ where: { id: { in: staleIds } } });
      }
    }
  }

  // ── Mobile ────────────────────────────────────────────────────────────────
  if (mobile.length > 0) {
    if (!env.pushKey) {
      reasons.push('mobile_not_configured');
      console.info(`[push:mobile-not-configured] user=${message.userId}`);
    } else {
      try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.pushKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(
            mobile.map((row) => ({
              to: row.token,
              title: message.title,
              body: message.body,
              data: message.data ?? {},
              sound: 'default',
            })),
          ),
        });
        if (response.ok) {
          delivered += mobile.length;
        } else {
          reasons.push(`mobile_error_${response.status}`);
        }
      } catch (error) {
        console.error('[push:mobile] send failed', error);
        reasons.push('mobile_transport_error');
      }
    }
  }

  if (delivered > 0) {
    await prisma.pushToken.updateMany({
      where: { userId: message.userId },
      data: { lastUsedAt: new Date() },
    });
  }

  return delivered > 0
    ? { delivered }
    : { delivered: 0, reason: reasons[0] ?? 'not_configured' };
}
