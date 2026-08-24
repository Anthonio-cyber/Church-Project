import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, assertSameOrigin, ok, parseBody, route } from '@/lib/api';
import { passwordSchema } from '@/lib/validation';
import { assessPasswordStrength, hashPassword, hashToken } from '@/lib/crypto';
import { revokeAllSessions } from '@/lib/auth/session';
import { AUDIT, writeAudit, writeSecurityEvent } from '@/lib/audit';
import { requestMeta } from '@/lib/auth/context';

export const dynamic = 'force-dynamic';

const schema = z.object({
  token: z.string().min(10).max(200),
  password: passwordSchema,
});

export const POST = route(async (request: Request) => {
  assertSameOrigin(request);
  const input = await parseBody(request, schema);
  const meta = await requestMeta();

  const strength = assessPasswordStrength(input.password);
  if (!strength.ok) {
    throw new ApiError(422, 'weak_password', 'Please choose a stronger password.', {
      problems: strength.problems,
    });
  }

  const record = await prisma.verificationToken.findUnique({
    where: { tokenHash: hashToken(input.token) },
  });

  if (!record || record.usedAt || record.expiresAt <= new Date() || record.purpose !== 'password_reset') {
    throw new ApiError(400, 'invalid_token', 'This reset link is invalid or has expired.');
  }

  const passwordHash = await hashPassword(input.password);

  await prisma.$transaction([
    prisma.verificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.user.update({
      where: { id: record.userId },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
        mustChangePassword: false,
        failedLoginCount: 0,
        lockedUntil: null,
      },
    }),
  ]);

  // A password reset invalidates every existing session: if the reset was
  // triggered because the account was compromised, the attacker's session dies
  // with it.
  await revokeAllSessions(record.userId, 'password_reset');

  await writeSecurityEvent({
    userId: record.userId,
    kind: 'PASSWORD_CHANGE',
    severity: 'warning',
    detail: 'Password reset completed; all sessions revoked.',
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  await writeAudit({
    actorId: record.userId,
    action: AUDIT.PASSWORD_CHANGED,
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });

  return ok({ message: 'Your password has been changed. Please sign in again.' });
});
