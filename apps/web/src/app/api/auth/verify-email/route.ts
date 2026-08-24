import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, assertSameOrigin, ok, parseBody, route } from '@/lib/api';
import { hashToken } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

const schema = z.object({ token: z.string().min(10).max(200) });

export const POST = route(async (request: Request) => {
  assertSameOrigin(request);
  const { token } = await parseBody(request, schema);

  const record = await prisma.verificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!record || record.usedAt || record.expiresAt <= new Date() || record.purpose !== 'email_verification') {
    throw new ApiError(
      400,
      'invalid_token',
      'This confirmation link is invalid or has expired. Request a new one from the sign-in page.',
    );
  }

  await prisma.$transaction([
    prisma.verificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: {
        emailVerifiedAt: new Date(),
        status: record.user.status === 'PENDING_VERIFICATION' ? 'ACTIVE' : record.user.status,
      },
    }),
  ]);

  return ok({ message: 'Your email address is confirmed. You can now sign in.' });
});
