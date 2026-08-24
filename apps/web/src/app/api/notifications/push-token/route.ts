import { z } from 'zod';
import { prisma } from '@/lib/db';
import { assertSameOrigin, ok, parseBody, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/context';

export const dynamic = 'force-dynamic';

const schema = z.object({
  token: z.string().min(10).max(300),
  platform: z.enum(['ios', 'android', 'web']),
  deviceName: z.string().trim().max(80).optional(),
});

/** Register a device for push. Used by the Android and iOS applications. */
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
    },
    // Re-registering an existing token reassigns it, which matters on a shared
    // or handed-down device: the previous owner stops receiving notifications.
    update: {
      userId: context.user.id,
      platform: input.platform,
      deviceName: input.deviceName ?? null,
      lastUsedAt: new Date(),
    },
  });

  return ok({ message: 'This device will receive notifications.' });
});

export const DELETE = route(async (request: Request) => {
  assertSameOrigin(request);
  const context = await requireUser();
  const input = await parseBody(request, z.object({ token: z.string().min(10).max(300) }));

  await prisma.pushToken
    .deleteMany({ where: { token: input.token, userId: context.user.id } })
    .catch(() => undefined);

  return ok({ message: 'This device will no longer receive notifications.' });
});
