import { prisma } from '@/lib/db';
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
import { assessPasswordStrength, hashPassword } from '@/lib/crypto';
import { AUDIT, writeAudit } from '@/lib/audit';
import { assertFeatureEnabled } from '@/lib/domain/settings';
import { requestMeta } from '@/lib/auth/context';

export const dynamic = 'force-dynamic';

/** Said in both cases, so the two are indistinguishable. */
const ACCOUNT_READY = 'Your account is ready. You can sign in now.';

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

  // Account enumeration defence: the response is word for word the same
  // whether or not this address is already registered. On a platform where
  // having an account at all is sensitive, "that address is taken" is itself
  // something worth learning about someone.
  //
  // The wording below is true either way — a person who already has an
  // account can indeed sign in now, with the password they originally chose.
  if (existing) {
    return created({ message: ACCOUNT_READY });
  }

  const dateOfBirth =
    input.dateOfBirth && input.dateOfBirth.length > 0 ? new Date(input.dateOfBirth) : null;

  const passwordHash = await hashPassword(input.password);

  // Creating an account does not involve email at all.
  //
  // An address is still what someone signs in with, but nothing is sent to it
  // and nothing waits on it: the account is usable the moment it is made.
  // Confirming an address is a real protection when the mail actually
  // arrives; when it does not, it is only a locked door with no key, and a
  // member who cannot reach their own account is worse than an unconfirmed
  // one. Password reset — the other thing email is for — is unaffected.

  const user = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        email: input.email,
        passwordHash,
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
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


    return createdUser;
  });


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

  return created({ message: ACCOUNT_READY });
});
