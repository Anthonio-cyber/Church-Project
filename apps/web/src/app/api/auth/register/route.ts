import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import {
  assertSameOrigin,
  clientIdentity,
  created,
  enforceRateLimit,
  parseBody,
  route,
  ApiError,
} from '@/lib/api';
import { registerSchema } from '@/lib/validation';
import { assessPasswordStrength, generateToken, hashPassword, hashToken } from '@/lib/crypto';
import { AUDIT, writeAudit } from '@/lib/audit';
import { assertFeatureEnabled } from '@/lib/domain/settings';
import { sendMail, templates } from '@/lib/mail';
import { requestMeta } from '@/lib/auth/context';

export const dynamic = 'force-dynamic';

/** Members under 18 receive the protected age band and its restrictions. */
function ageBandFor(dateOfBirth: Date | null): 'MINOR' | 'YOUNG_ADULT' | 'ADULT' | 'UNDECLARED' {
  if (!dateOfBirth) return 'UNDECLARED';
  const years = (Date.now() - dateOfBirth.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (years < 18) return 'MINOR';
  if (years < 26) return 'YOUNG_ADULT';
  return 'ADULT';
}

export const POST = route(async (request: Request) => {
  assertSameOrigin(request);
  await assertFeatureEnabled('registration.enabled');
  await enforceRateLimit('register', clientIdentity(request));

  const input = await parseBody(request, registerSchema);
  const strength = assessPasswordStrength(input.password);
  if (!strength.ok) {
    throw new ApiError(422, 'weak_password', 'Please choose a stronger password.', {
      problems: strength.problems,
    });
  }

  const meta = await requestMeta();
  const existing = await prisma.user.findUnique({ where: { email: input.email } });

  // Account enumeration defence: the response is identical whether or not the
  // address is already registered. An existing account is told by email.
  if (existing) {
    await sendMail({
      to: input.email,
      subject: 'Someone tried to register with your email address',
      text:
        'An account already exists for this email address. If this was you, ' +
        'please sign in or reset your password instead.',
    });
    return created({
      message:
        'Check your inbox. If we can create an account for this address, a confirmation link is on its way.',
    });
  }

  const dateOfBirth =
    input.dateOfBirth && input.dateOfBirth.length > 0 ? new Date(input.dateOfBirth) : null;

  const passwordHash = await hashPassword(input.password);
  const verificationToken = generateToken(32);

  const user = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        email: input.email,
        passwordHash,
        status: 'PENDING_VERIFICATION',
        profile: {
          create: {
            firstName: input.firstName,
            lastName: input.lastName,
            displayName: input.displayName,
            country: input.country,
            preferredLanguage: input.preferredLanguage,
            gender: input.gender,
            dateOfBirth,
            ageBand: ageBandFor(dateOfBirth),
            phone: input.phone && input.phone.length > 0 ? input.phone : null,
          },
        },
        // Privacy defaults are deliberately closed: a new member is not
        // discoverable and does not appear in search until they choose to be.
        privacySettings: { create: { discoverable: false, publicProfile: false } },
        notificationPrefs: { create: {} },
      },
    });

    const memberRole = await tx.role.findUnique({ where: { key: 'USER' } });
    if (memberRole) {
      await tx.userRole.create({
        data: { userId: createdUser.id, roleId: memberRole.id },
      });
    }

    const now = new Date();
    await tx.consent.createMany({
      data: [
        { userId: createdUser.id, policyKey: 'terms', policyVersion: '1.0', grantedAt: now, ipAddress: meta.ip },
        { userId: createdUser.id, policyKey: 'privacy', policyVersion: '1.0', grantedAt: now, ipAddress: meta.ip },
        { userId: createdUser.id, policyKey: 'counselling_disclaimer', policyVersion: '1.0', grantedAt: now, ipAddress: meta.ip },
      ],
    });

    await tx.verificationToken.create({
      data: {
        userId: createdUser.id,
        purpose: 'email_verification',
        tokenHash: hashToken(verificationToken),
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      },
    });

    return createdUser;
  });

  const link = `${env.appUrl}/verify-email?token=${verificationToken}`;
  const template = templates.verifyEmail(input.firstName, link);
  await sendMail({ to: input.email, ...template });

  await writeAudit({
    actorId: user.id,
    actorEmail: user.email,
    actorRole: 'USER',
    action: AUDIT.REGISTER,
    targetType: 'user',
    targetId: user.id,
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });

  return created({
    message:
      'Check your inbox. If we can create an account for this address, a confirmation link is on its way.',
    // In development the verification link is returned so the flow can be
    // completed without a configured mail provider.
    developmentVerificationLink: env.isProduction ? undefined : link,
  });
});
