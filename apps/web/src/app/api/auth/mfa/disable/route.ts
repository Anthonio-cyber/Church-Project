import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, assertSameOrigin, ok, parseBody, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/context';
import { verifyPassword } from '@/lib/crypto';
import { MFA_REQUIRED_ROLES } from '@/lib/permissions';
import { AUDIT, writeAudit, writeSecurityEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const schema = z.object({ password: z.string().min(1) });

export const POST = route(async (request: Request) => {
  assertSameOrigin(request);
  const context = await requireUser();
  const { password } = await parseBody(request, schema);

  if (!(await verifyPassword(password, context.user.passwordHash))) {
    throw new ApiError(401, 'invalid_credentials', 'That password is not correct.');
  }

  // Counsellors, moderators and administrators cannot switch off their second
  // factor: the requirement follows the office, not personal preference.
  if (
    context.user.mfaRequired ||
    context.roles.some((role) => MFA_REQUIRED_ROLES.includes(role))
  ) {
    throw new ApiError(
      403,
      'mfa_mandatory',
      'Multi-factor authentication is required for your role and cannot be disabled.',
    );
  }

  await prisma.user.update({
    where: { id: context.user.id },
    data: { mfaEnabled: false, mfaSecret: null },
  });

  await writeSecurityEvent({
    userId: context.user.id,
    kind: 'MFA_DISABLED',
    severity: 'warning',
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });
  await writeAudit({
    actorId: context.user.id,
    actorEmail: context.user.email,
    actorRole: context.roles.join(','),
    action: AUDIT.MFA_DISABLED,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  return ok({ message: 'Multi-factor authentication has been disabled.' });
});
