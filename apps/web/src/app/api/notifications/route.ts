import { z } from 'zod';
import { prisma } from '@/lib/db';
import { assertSameOrigin, ok, paginationFrom, parseBody, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/context';
import { notificationPreferenceSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export const GET = route(async (request: Request) => {
  const context = await requireUser();
  const { take, skip } = paginationFrom(request, 30, 100);

  const [notifications, unread, preferences] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: context.user.id },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),
    prisma.notification.count({ where: { userId: context.user.id, readAt: null } }),
    prisma.notificationPreference.findUnique({ where: { userId: context.user.id } }),
  ]);

  return ok({ notifications, unread, preferences });
});

const markSchema = z.object({
  notificationId: z.string().uuid().optional(),
  all: z.boolean().optional(),
});

export const PATCH = route(async (request: Request) => {
  assertSameOrigin(request);
  const context = await requireUser();
  const input = await parseBody(request, markSchema);
  const now = new Date();

  if (input.all) {
    const result = await prisma.notification.updateMany({
      where: { userId: context.user.id, readAt: null },
      data: { readAt: now },
    });
    return ok({ marked: result.count });
  }

  if (!input.notificationId) return ok({ marked: 0 });

  // Scoped by userId so one member can never mark another's notifications.
  const result = await prisma.notification.updateMany({
    where: { id: input.notificationId, userId: context.user.id },
    data: { readAt: now },
  });
  return ok({ marked: result.count });
});

export const PUT = route(async (request: Request) => {
  assertSameOrigin(request);
  const context = await requireUser();
  const input = await parseBody(request, notificationPreferenceSchema);

  const preferences = await prisma.notificationPreference.upsert({
    where: { userId: context.user.id },
    create: { userId: context.user.id, ...input },
    update: input,
  });

  return ok({
    preferences,
    message:
      'Preferences saved. Security and safeguarding notices are always delivered, whatever your settings.',
  });
});
