import { z } from 'zod';
import { ApiError, assertSameOrigin, ok, parseBody, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/context';
import { verifyPassword, verifyTotp } from '@/lib/crypto';
import { markReauthenticated } from '@/lib/auth/session';
import { AUDIT, writeAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const schema = z.object({
  password: z.string().min(1),
  mfaCode: z.string().trim().regex(/^\d{6}$/).optional().or(z.literal('')),
});

/**
 * Fresh re-authentication for sensitive actions.
 *
 * Holding a permission is not enough to use it: the platform requires proof
 * that the person at the keyboard is still the account holder, within a short
 * window, before anything governance-critical proceeds.
 */
export const POST = route(async (request: Request) => {
  assertSameOrigin(request);
  const context = await requireUser();
  const input = await parseBody(request, schema);

  if (!(await verifyPassword(input.password, context.user.passwordHash))) {
    throw new ApiError(401, 'invalid_credentials', 'That password is not correct.');
  }

  let mfaSatisfied = false;
  if (context.user.mfaEnabled && context.user.mfaSecret) {
    if (!input.mfaCode) {
      throw new ApiError(
        401,
        'mfa_challenge_required',
        'Enter the six-digit code from your authenticator app.',
      );
    }
    if (!verifyTotp(context.user.mfaSecret, input.mfaCode)) {
      throw new ApiError(401, 'invalid_mfa_code', 'That code is not correct or has expired.');
    }
    mfaSatisfied = true;
  }

  await markReauthenticated(context.session.id, mfaSatisfied);
  await writeAudit({
    actorId: context.user.id,
    actorEmail: context.user.email,
    actorRole: context.roles.join(','),
    action: AUDIT.REAUTH,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  return ok({
    message: 'Confirmed. Sensitive actions are unlocked for the next ten minutes.',
    mfaSatisfied,
  });
});
