import { prisma } from '@/lib/db';
import { assertSameOrigin, ok, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/context';
import { generateTotpSecret, totpUri } from '@/lib/crypto';
import { ApiError } from '@/lib/api';

export const dynamic = 'force-dynamic';

/**
 * Begin MFA enrolment. The secret is stored provisionally and only becomes
 * active once the member proves they can generate a valid code.
 */
export const POST = route(async (request: Request) => {
  assertSameOrigin(request);
  const context = await requireUser();

  if (context.user.mfaEnabled) {
    throw new ApiError(
      409,
      'mfa_already_enabled',
      'Multi-factor authentication is already enabled on this account.',
    );
  }

  const secret = generateTotpSecret();
  await prisma.user.update({
    where: { id: context.user.id },
    data: { mfaSecret: secret },
  });

  return ok({
    secret,
    otpauthUri: totpUri(secret, context.user.email),
    instructions:
      'Add this secret to an authenticator app, then confirm with a six-digit code to finish enabling.',
  });
});
