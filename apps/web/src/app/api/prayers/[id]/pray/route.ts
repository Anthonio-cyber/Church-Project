import { prisma } from '@/lib/db';
import { ApiError, assertSameOrigin, ok, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/context';
import { notify } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/**
 * "Pray for this."
 *
 * The author sees that people are praying, and how many. They do not see who,
 * unless that person has separately allowed prayer interaction to be visible —
 * the count is encouragement, not a social graph.
 */
export const POST = route(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { id } = await params;
  const context = await requireUser();

  const prayer = await prisma.prayerRequest.findUnique({ where: { id } });
  if (!prayer || prayer.deletedAt) {
    throw new ApiError(404, 'not_found', 'That prayer request could not be found.');
  }
  if (prayer.visibility === 'PRIVATE' && prayer.authorId !== context.user.id) {
    throw new ApiError(404, 'not_found', 'That prayer request could not be found.');
  }

  const existing = await prisma.prayerInteraction.findUnique({
    where: { requestId_userId: { requestId: id, userId: context.user.id } },
  });
  if (existing) {
    return ok({ prayerCount: prayer.prayerCount, alreadyPrayed: true });
  }

  const [, updated] = await prisma.$transaction([
    prisma.prayerInteraction.create({ data: { requestId: id, userId: context.user.id } }),
    prisma.prayerRequest.update({
      where: { id },
      data: { prayerCount: { increment: 1 } },
    }),
  ]);

  if (prayer.authorId !== context.user.id) {
    const authorPrivacy = await prisma.privacySettings.findUnique({
      where: { userId: prayer.authorId },
    });
    if (authorPrivacy?.allowPrayerInteraction !== false) {
      await notify({
        userId: prayer.authorId,
        category: 'PRAYER',
        title: 'Someone is praying for you',
        body: `${updated.prayerCount} ${updated.prayerCount === 1 ? 'person has' : 'people have'} prayed for your request.`,
        link: '/app/prayer',
      });
    }
  }

  return ok({ prayerCount: updated.prayerCount, alreadyPrayed: false });
});
