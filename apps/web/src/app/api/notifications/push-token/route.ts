import { z } from 'zod';
import { prisma } from '@/lib/db';
import { assertSameOrigin, ok, parseBody, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/context';

export const dynamic = 'force-dynamic';

const schema = z
  .object({
    // A browser subscription endpoint is a URL and can be long, so this is
    // roomier than a mobile push token needs.
    token: z.string().min(10).max(1000),
    platform: z.enum(['ios', 'android', 'web']),
    deviceName: z.string().trim().max(80).optional(),
    // Web Push only: the keys the payload is encrypted to.
    p256dh: z.string().trim().max(200).optional(),
    auth: z.string().trim().max(200).optional(),
  })
  // A browser subscription without its keys cannot be sent to, so it is
  // refused at the door rather than stored and silently skipped forever.
  .refine((value) => value.platform !== 'web' || (value.p256dh && value.auth), {
    message: 'A browser subscription must include its encryption keys.',
    path: ['p256dh'],
  });

/**
 * Register a device for push.
 *
 * Used by the browser (Web Push) and by the Android and iOS applications.
 */
export const POST = route(async (request: Request) => {
  assertSameOrigin(request);
  const context = await requireUser();
  const input = await parseBody(request, schema);

  await prisma.pushToken.upsert({
    where: { token: input.token },
    create: {
      token: input.token,
      userId: context.user.id,
      platform: input.platform,
      deviceName: input.deviceName ?? null,
      p256dh: input.p256dh ?? null,
      auth: input.auth ?? null,
    },
    // Re-registering an existing token reassigns it, which matters on a shared
    // or handed-down device: the previous owner stops receiving notifications.
    update: {
      userId: context.user.id,
      platform: input.platform,
      deviceName: input.deviceName ?? null,
      p256dh: input.p256dh ?? null,
      auth: input.auth ?? null,
      lastUsedAt: new Date(),
    },
  });

  return ok({ message: 'This device will receive notifications.' });
});

export const DELETE = route(async (request: Request) => {
  assertSameOrigin(request);
  const context = await requireUser();
  const input = await parseBody(request, z.object({ token: z.string().min(10).max(1000) }));

  await prisma.pushToken
    .deleteMany({ where: { token: input.token, userId: context.user.id } })
    .catch(() => undefined);

  return ok({ message: 'This device will no longer receive notifications.' });
});
