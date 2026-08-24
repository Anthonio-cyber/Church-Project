import { prisma } from '@/lib/db';
import { ApiError, assertSameOrigin, ok, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/context';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/** A member can always withdraw their own prayer request. */
export const DELETE = route(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { id } = await params;
  const context = await requireUser();

  const prayer = await prisma.prayerRequest.findUnique({ where: { id } });
  if (!prayer || prayer.deletedAt) {
    throw new ApiError(404, 'not_found', 'That prayer request could not be found.');
  }
  if (prayer.authorId !== context.user.id) {
    throw new ApiError(403, 'forbidden', 'You can only remove your own prayer requests.');
  }

  await prisma.prayerRequest.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return ok({ message: 'Your prayer request has been removed.' });
});
