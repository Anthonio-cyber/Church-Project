import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, assertSameOrigin, ok, parseBody, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/context';
import { verifyTotp } from '@/lib/crypto';
import { markReauthenticated } from '@/lib/auth/session';
import { AUDIT, writeAudit, writeSecurityEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const schema = z.object({ code: z.string().trim().regex(/^\d{6}$/) });

export const POST = route(async (request: Request) => {
  assertSameOrigin(request);
  const context = await requireUser();
  const { code } = await parseBody(request, schema);

  if (!context.user.mfaSecret) {
    throw new ApiError(400, 'mfa_not_started', 'Start multi-factor setup first.');
  }
  if (!verifyTotp(context.user.mfaSecret, code)) {
    throw new ApiError(401, 'invalid_mfa_code', 'That code is not correct or has expired.');
  }

  await prisma.user.update({
    where: { id: context.user.id },
    data: { mfaEnabled: true },
  });
  await markReauthenticated(context.session.id, true);

  await writeSecurityEvent({
    userId: context.user.id,
    kind: 'MFA_ENABLED',
    severity: 'info',
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });
  await writeAudit({
    actorId: context.user.id,
    actorEmail: context.user.email,
    actorRole: context.roles.join(','),
    action: AUDIT.MFA_ENABLED,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  return ok({ message: 'Multi-factor authentication is now enabled.' });
});
