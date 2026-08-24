import { env } from './env';
import { prisma } from './db';

export type PushMessage = {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
};

/**
 * Push notifications for the Android and iOS applications.
 *
 * The default transport is the Expo push service, which fronts both APNs and
 * FCM. Like email, push payloads must stay generic: a counselling notification
 * says a session is starting, never what it is about.
 */
export async function sendPush(message: PushMessage): Promise<{
  delivered: number;
  reason?: string;
}> {
  const tokens = await prisma.pushToken.findMany({
    where: { userId: message.userId },
    select: { token: true },
  });
  if (tokens.length === 0) return { delivered: 0, reason: 'no_devices' };
  if (!env.pushKey) {
    console.info(`[push:not-configured] user=${message.userId} title="${message.title}"`);
    return { delivered: 0, reason: 'not_configured' };
  }

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.pushKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        tokens.map((row) => ({
          to: row.token,
          title: message.title,
          body: message.body,
          data: message.data ?? {},
          sound: 'default',
        })),
      ),
    });
    if (!response.ok) return { delivered: 0, reason: `provider_error_${response.status}` };
    await prisma.pushToken.updateMany({
      where: { userId: message.userId },
      data: { lastUsedAt: new Date() },
    });
    return { delivered: tokens.length };
  } catch (error) {
    console.error('[push] send failed', error);
    return { delivered: 0, reason: 'transport_error' };
  }
}
