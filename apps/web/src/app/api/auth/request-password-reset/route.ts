import { z } from 'zod';
import { prisma } from '@/lib/db';
import { assertSameOrigin, clientIdentity, enforceRateLimit, ok, parseBody, route } from '@/lib/api';
import { emailSchema } from '@/lib/validation';
import { generateToken, hashToken } from '@/lib/crypto';
import { sendMail, templates } from '@/lib/mail';
import { env } from '@/lib/env';
import { AUDIT, writeAudit, writeSecurityEvent } from '@/lib/audit';
import { requestMeta } from '@/lib/auth/context';

export const dynamic = 'force-dynamic';

const schema = z.object({ email: emailSchema });

export const POST = route(async (request: Request) => {
  assertSameOrigin(request);
  await enforceRateLimit('passwordReset', clientIdentity(request));
  const { email } = await parseBody(request, schema);
  const meta = await requestMeta();

  const user = await prisma.user.findUnique({
    where: { email },
    include: { profile: true },
  });

  // The response never varies. Telling an anonymous caller whether an address
  // is registered would leak membership of the fellowship.
  const genericResponse = ok({
    message: 'If an account exists for that address, a reset link has been sent.',
  });

  if (!user || user.status === 'DELETED') return genericResponse;

  const token = generateToken(32);
  await prisma.verificationToken.create({
    data: {
      userId: user.id,
      purpose: 'password_reset',
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 3600 * 1000),
    },
  });

  const link = `${env.appUrl}/reset-password?token=${token}`;
  const template = templates.resetPassword(user.profile?.firstName ?? 'there', link);
  await sendMail({ to: user.email, ...template });

  await writeSecurityEvent({
    userId: user.id,
    kind: 'PASSWORD_RESET_REQUEST',
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  await writeAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: AUDIT.PASSWORD_RESET_REQUESTED,
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });

  return genericResponse;
});
