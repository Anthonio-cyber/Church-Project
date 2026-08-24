import { assertSameOrigin, ok, route } from '@/lib/api';
import { getAuthContext } from '@/lib/auth/context';
import { clearSessionCookie, revokeSession } from '@/lib/auth/session';
import { AUDIT, writeAudit, writeSecurityEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export const POST = route(async (request: Request) => {
  assertSameOrigin(request);
  const context = await getAuthContext();

  if (context) {
    await revokeSession(context.session.id, 'user_logout');
    await writeSecurityEvent({
      userId: context.user.id,
      kind: 'LOGOUT',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    await writeAudit({
      actorId: context.user.id,
      actorEmail: context.user.email,
      actorRole: context.roles.join(','),
      action: AUDIT.LOGOUT,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  }

  await clearSessionCookie();
  return ok({ message: 'You have been signed out.' });
});
