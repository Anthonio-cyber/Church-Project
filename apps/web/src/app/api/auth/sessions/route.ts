import { z } from 'zod';
import { prisma } from '@/lib/db';
import { assertSameOrigin, ok, parseBody, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/context';
import { revokeAllSessions, revokeSession } from '@/lib/auth/session';
import { AUDIT, writeAudit, writeSecurityEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/** The member's own device list, for the Privacy & Security centre. */
export const GET = route(async () => {
  const context = await requireUser();
  const sessions = await prisma.session.findMany({
    where: { userId: context.user.id, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: 'desc' },
    select: {
      id: true,
      ipAddress: true,
      userAgent: true,
      deviceLabel: true,
      createdAt: true,
      lastSeenAt: true,
      expiresAt: true,
    },
  });

  return ok({
    sessions: sessions.map((session) => ({
      ...session,
      isCurrent: session.id === context.session.id,
    })),
  });
});

const revokeSchema = z.object({
  sessionId: z.string().uuid().optional(),
  all: z.boolean().optional(),
});

export const DELETE = route(async (request: Request) => {
  assertSameOrigin(request);
  const context = await requireUser();
  const input = await parseBody(request, revokeSchema);

  if (input.all) {
    const count = await revokeAllSessions(
      context.user.id,
      'user_revoked_all',
      context.session.id,
    );
    await writeSecurityEvent({
      userId: context.user.id,
      kind: 'SESSION_REVOKED',
      detail: `Member revoked ${count} other device(s).`,
      ipAddress: context.ipAddress,
    });
    await writeAudit({
      actorId: context.user.id,
      actorEmail: context.user.email,
      action: AUDIT.SESSION_REVOKED,
      metadata: { count },
      ipAddress: context.ipAddress,
    });
    return ok({ message: `Signed out of ${count} other device(s).`, count });
  }

  if (!input.sessionId) {
    return ok({ message: 'Nothing to do.', count: 0 });
  }

  // Scoped to the caller's own sessions: one member can never revoke another's.
  const owned = await prisma.session.findFirst({
    where: { id: input.sessionId, userId: context.user.id },
    select: { id: true },
  });
  if (!owned) return ok({ message: 'Nothing to do.', count: 0 });

  await revokeSession(owned.id, 'user_revoked_device');
  await writeAudit({
    actorId: context.user.id,
    actorEmail: context.user.email,
    action: AUDIT.SESSION_REVOKED,
    targetType: 'session',
    targetId: owned.id,
    ipAddress: context.ipAddress,
  });

  return ok({ message: 'That device has been signed out.', count: 1 });
});
