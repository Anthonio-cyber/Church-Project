import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, assertSameOrigin, created, ok, parseBody, route } from '@/lib/api';
import { requireAuthorityOver, requirePermission, requireUser } from '@/lib/auth/context';
import { reasonSchema } from '@/lib/validation';
import { AUDIT, writeAudit } from '@/lib/audit';
import { notify } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

/** Support-mode sessions that are currently open. */
export const GET = route(async () => {
  await requirePermission('support_mode.use', { reason: 'Reviewing open support sessions.' });

  const sessions = await prisma.supportModeSession.findMany({
    where: { endedAt: null, expiresAt: { gt: new Date() } },
    include: {
      subject: { select: { id: true, email: true, profile: { select: { displayName: true } } } },
    },
    orderBy: { startedAt: 'desc' },
  });

  return ok({ sessions });
});

const startSchema = z.object({
  subjectId: z.string().uuid(),
  reason: reasonSchema,
  durationMinutes: z.number().int().min(5).max(120).default(30),
});

/**
 * Support mode.
 *
 * Deliberately not impersonation. There is no way here to become another
 * person: what this creates is a time-boxed, recorded window in which support
 * staff may view an account's configuration to troubleshoot it. Counselling
 * content, session notes and safeguarding records are outside its scope
 * entirely — those routes check their own permissions and know nothing about
 * support mode.
 *
 * The member is told. Invisible administrator access to someone's account is
 * exactly what a platform holding pastoral confidences must never have.
 */
export const POST = route(async (request: Request) => {
  assertSameOrigin(request);
  const base = await requireUser();
  const input = await parseBody(request, startSchema);

  const context = await requirePermission('support_mode.use', {
    context: base,
    reason: input.reason,
    targetType: 'user',
    targetId: input.subjectId,
  });

  await requireAuthorityOver(context, input.subjectId);

  const existing = await prisma.supportModeSession.findFirst({
    where: { subjectId: input.subjectId, endedAt: null, expiresAt: { gt: new Date() } },
  });
  if (existing) {
    throw new ApiError(
      409,
      'already_open',
      'A support session is already open on this account.',
    );
  }

  const now = new Date();
  const session = await prisma.supportModeSession.create({
    data: {
      operatorId: context.user.id,
      subjectId: input.subjectId,
      reason: input.reason,
      expiresAt: new Date(now.getTime() + input.durationMinutes * 60_000),
      subjectNotifiedAt: now,
    },
  });

  await notify({
    userId: input.subjectId,
    category: 'SECURITY',
    title: 'A support session has been opened on your account',
    body: `Support staff are looking at your account settings to help with an issue. Reason given: ${input.reason}`,
    link: '/app/privacy',
    isCritical: true,
    email: {
      subject: 'A support session has been opened on your account',
      text: `Support staff have opened a time-limited support session on your account.\n\nReason: ${input.reason}\n\nThis does not give them access to your counselling conversations or notes. If you did not expect this, contact the ministry office.`,
    },
  });

  await writeAudit({
    actorId: context.user.id,
    actorEmail: context.user.email,
    actorRole: context.roles.join(','),
    action: AUDIT.SUPPORT_MODE_STARTED,
    targetType: 'user',
    targetId: input.subjectId,
    reason: input.reason,
    metadata: { expiresAt: session.expiresAt.toISOString(), durationMinutes: input.durationMinutes },
    ipAddress: context.ipAddress,
  });

  return created({
    session: { id: session.id, expiresAt: session.expiresAt },
    scope: {
      included: ['Account settings', 'Privacy and notification preferences', 'Active devices', 'Roles and status'],
      excluded: [
        'Counselling conversations',
        'Counselling notes',
        'Private messages',
        'Safeguarding records',
        'Prayer request content',
      ],
    },
    message:
      'Support session opened. The member has been notified and the session ends automatically.',
  });
});

const endSchema = z.object({ sessionId: z.string().uuid() });

export const DELETE = route(async (request: Request) => {
  assertSameOrigin(request);
  const context = await requirePermission('support_mode.use', {
    reason: 'Ending a support session.',
  });
  const { sessionId } = await parseBody(request, endSchema);

  const session = await prisma.supportModeSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new ApiError(404, 'not_found', 'That support session could not be found.');

  await prisma.supportModeSession.update({
    where: { id: sessionId },
    data: { endedAt: new Date() },
  });

  await writeAudit({
    actorId: context.user.id,
    actorEmail: context.user.email,
    actorRole: context.roles.join(','),
    action: AUDIT.SUPPORT_MODE_ENDED,
    targetType: 'user',
    targetId: session.subjectId,
    ipAddress: context.ipAddress,
  });

  return ok({ message: 'Support session ended.' });
});
