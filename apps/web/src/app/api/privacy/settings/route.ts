import { prisma } from '@/lib/db';
import { assertSameOrigin, ok, parseBody, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/context';
import { privacySettingsSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const context = await requireUser();
  const settings = await prisma.privacySettings.findUnique({
    where: { userId: context.user.id },
  });
  return ok({ settings });
});

export const PATCH = route(async (request: Request) => {
  assertSameOrigin(request);
  const context = await requireUser();
  const input = await parseBody(request, privacySettingsSchema);

  const settings = await prisma.privacySettings.upsert({
    where: { userId: context.user.id },
    create: { userId: context.user.id, ...input },
    update: input,
  });

  return ok({ settings, message: 'Your privacy settings have been saved.' });
});
