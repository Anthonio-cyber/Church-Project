import { z } from 'zod';
import { ApiError, assertSameOrigin, enforceRateLimit, ok, parseBody, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/context';
import { verifyTotp } from '@/lib/crypto';
import { markReauthenticated } from '@/lib/auth/session';
import { writeSecurityEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const schema = z.object({ code: z.string().trim().regex(/^\d{6}$/) });

/** Satisfies the MFA requirement on the current session for sensitive actions. */
export const POST = route(async (request: Request) => {
  assertSameOrigin(request);
  const context = await requireUser();
  await enforceRateLimit('mfaChallenge', `user:${context.user.id}`);
  const { code } = await parseBody(request, schema);

  if (!context.user.mfaEnabled || !context.user.mfaSecret) {
    throw new ApiError(400, 'mfa_not_enabled', 'Multi-factor authentication is not enabled.');
  }
  if (!verifyTotp(context.user.mfaSecret, code)) {
    await writeSecurityEvent({
      userId: context.user.id,
      kind: 'MFA_CHALLENGE_FAILURE',
      severity: 'warning',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    throw new ApiError(401, 'invalid_mfa_code', 'That code is not correct or has expired.');
  }

  await markReauthenticated(context.session.id, true);
  return ok({ message: 'Multi-factor challenge satisfied for this session.' });
});
