import { prisma } from '@/lib/db';
import { assertSameOrigin, ok, parseBody, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/context';
import { profileUpdateSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const context = await requireUser();
  const profile = await prisma.profile.findUnique({ where: { userId: context.user.id } });
  return ok({ profile });
});

export const PATCH = route(async (request: Request) => {
  assertSameOrigin(request);
  const context = await requireUser();
  const input = await parseBody(request, profileUpdateSchema);

  // Note what cannot be changed here: email address, age band, roles and
  // account status. Those move only through their own audited routes, so a
  // crafted profile payload can never escalate anything.
  const profile = await prisma.profile.update({
    where: { userId: context.user.id },
    data: {
      ...(input.displayName ? { displayName: input.displayName } : {}),
      ...(input.bio !== undefined ? { bio: input.bio || null } : {}),
      ...(input.country !== undefined ? { country: input.country || null } : {}),
      ...(input.timezone ? { timezone: input.timezone } : {}),
      ...(input.preferredLanguage ? { preferredLanguage: input.preferredLanguage } : {}),
      ...(input.interests ? { interests: input.interests } : {}),
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl || null } : {}),
    },
  });

  return ok({ profile, message: 'Your profile has been updated.' });
});
