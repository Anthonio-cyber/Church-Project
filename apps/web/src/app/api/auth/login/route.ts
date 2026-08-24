import { prisma } from '@/lib/db';
import {
  ApiError,
  assertSameOrigin,
  clientIdentity,
  enforceRateLimit,
  ok,
  parseBody,
  route,
} from '@/lib/api';
import { loginSchema } from '@/lib/validation';
import { verifyPassword, verifyTotp } from '@/lib/crypto';
import { createSession, setSessionCookie } from '@/lib/auth/session';
import { AUDIT, writeAudit, writeSecurityEvent } from '@/lib/audit';
import { loadAuthorization, requestMeta } from '@/lib/auth/context';
import { MFA_REQUIRED_ROLES } from '@/lib/permissions';
import { sendMail, templates } from '@/lib/mail';

export const dynamic = 'force-dynamic';

const MAX_FAILED_ATTEMPTS = 8;
const LOCKOUT_MINUTES = 15;

export const POST = route(async (request: Request) => {
  assertSameOrigin(request);
  const input = await parseBody(request, loginSchema);
  const meta = await requestMeta();

  // Two buckets: one per address so an attacker cannot lock everyone out from
  // a single IP, and one per IP so a botnet cannot spray many addresses.
  await enforceRateLimit('login', `email:${input.email}`);
  await enforceRateLimit('login', clientIdentity(request));

  const genericFailure = () =>
    new ApiError(401, 'invalid_credentials', 'That email address or password is not correct.');

  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: { profile: true },
  });

  if (!user) {
    // Hash-equivalent work is not performed here because the rate limiter
    // already bounds attempts; the response shape stays identical either way.
    await writeSecurityEvent({
      kind: 'LOGIN_FAILURE',
      severity: 'info',
      detail: `Unknown address attempted: ${input.email}`,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    throw genericFailure();
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new ApiError(
      423,
      'account_locked',
      'This account is temporarily locked after repeated failed sign-in attempts. Please try again shortly or reset your password.',
    );
  }

  const passwordValid = await verifyPassword(input.password, user.passwordHash);

  if (!passwordValid) {
    const failedCount = user.failedLoginCount + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: failedCount,
        lockedUntil:
          failedCount >= MAX_FAILED_ATTEMPTS
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
            : null,
      },
    });
    await writeSecurityEvent({
      userId: user.id,
      kind: 'LOGIN_FAILURE',
      severity: failedCount >= MAX_FAILED_ATTEMPTS ? 'warning' : 'info',
      detail: `Failed attempt ${failedCount}`,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    await writeAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: AUDIT.LOGIN_FAILED,
      outcome: 'FAILURE',
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    if (failedCount >= MAX_FAILED_ATTEMPTS) {
      const alert = templates.securityAlert(
        user.profile?.firstName ?? 'there',
        'Your account was temporarily locked after repeated failed sign-in attempts.',
      );
      await sendMail({ to: user.email, ...alert });
    }
    throw genericFailure();
  }

  if (user.status === 'SUSPENDED') {
    throw new ApiError(
      403,
      'account_suspended',
      'This account is suspended. Please contact the ministry office.',
    );
  }
  if (user.status === 'DISABLED' || user.status === 'DELETED') {
    throw new ApiError(403, 'account_unavailable', 'This account is no longer active.');
  }
  if (user.status === 'PENDING_VERIFICATION') {
    throw new ApiError(
      403,
      'email_unverified',
      'Please confirm your email address using the link we sent you.',
    );
  }

  const { roles } = await loadAuthorization(user.id);
  const mfaMandatory = user.mfaRequired || roles.some((role) => MFA_REQUIRED_ROLES.includes(role));

  let mfaSatisfied = false;

  if (user.mfaEnabled && user.mfaSecret) {
    if (!input.mfaCode) {
      // Credentials verified but the second factor is still outstanding. No
      // session is issued and no cookie is set.
      return ok({ mfaRequired: true, message: 'Enter the six-digit code from your authenticator app.' });
    }
    await enforceRateLimit('mfaChallenge', `user:${user.id}`);
    if (!verifyTotp(user.mfaSecret, input.mfaCode)) {
      await writeSecurityEvent({
        userId: user.id,
        kind: 'MFA_CHALLENGE_FAILURE',
        severity: 'warning',
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      });
      throw new ApiError(401, 'invalid_mfa_code', 'That code is not correct or has expired.');
    }
    mfaSatisfied = true;
  } else if (mfaMandatory) {
    // The role demands MFA but it is not yet configured. Sign-in proceeds so
    // the person can set it up, but every sensitive permission stays blocked
    // until they do — requirePermission enforces that independently.
    await prisma.user.update({ where: { id: user.id }, data: { mfaRequired: true } });
  }

  const { session, token } = await createSession({
    userId: user.id,
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
    deviceLabel: input.deviceLabel ?? null,
    mfaSatisfied,
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  await setSessionCookie(token);

  await writeSecurityEvent({
    userId: user.id,
    kind: 'LOGIN_SUCCESS',
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  await writeAudit({
    actorId: user.id,
    actorEmail: user.email,
    actorRole: roles.join(','),
    action: AUDIT.LOGIN,
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });

  return ok({
    mfaRequired: false,
    // The API mirrors the session cookie in the body for native mobile clients,
    // which manage their own secure storage rather than a browser cookie jar.
    sessionToken: token,
    sessionId: session.id,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.profile?.displayName ?? 'Member',
      firstName: user.profile?.firstName ?? '',
      roles,
      mfaEnabled: user.mfaEnabled,
      mfaSetupRequired: mfaMandatory && !user.mfaEnabled,
      mustChangePassword: user.mustChangePassword,
    },
  });
});
