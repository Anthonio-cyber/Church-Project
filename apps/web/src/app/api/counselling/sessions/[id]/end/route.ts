import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, assertSameOrigin, ok, parseBody, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/context';
import { assertSessionAccess, createSessionNote } from '@/lib/domain/counselling';
import { AUDIT, writeAudit } from '@/lib/audit';
import { channels, publish } from '@/lib/realtime';
import { notify } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  followUpRequired: z.boolean().default(false),
  followUpAt: z.string().datetime().optional().or(z.literal('')),
  /** Optional note the member is meant to see afterwards. */
  sharedFollowUpNote: z.string().trim().max(2000).optional().or(z.literal('')),
});

export const POST = route(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { id } = await params;
  const context = await requireUser();
  const { session, accessPath } = await assertSessionAccess(context, id);
  const input = await parseBody(request, schema);

  // Only the counsellor closes a session — that is a pastoral record decision,
  // not something either party can do casually.
  if (accessPath !== 'counsellor') {
    throw new ApiError(
      403,
      'counsellor_only',
      'Only the assigned counsellor can close a session. You can leave the session at any time.',
    );
  }
  if (session.status === 'COMPLETED') {
    throw new ApiError(409, 'already_completed', 'This session is already closed.');
  }

  const now = new Date();
  await prisma.counsellingSession.update({
    where: { id: session.id },
    data: {
      status: 'COMPLETED',
      endedAt: now,
      followUpRequired: input.followUpRequired,
      followUpAt:
        input.followUpAt && input.followUpAt.length > 0 ? new Date(input.followUpAt) : null,
    },
  });
  await prisma.counsellingRequest.update({
    where: { id: session.request.id },
    data: { status: 'CLOSED' },
  });
  await prisma.conversation.updateMany({
    where: { sessionId: session.id },
    data: { isActive: false },
  });

  if (input.sharedFollowUpNote && input.sharedFollowUpNote.length > 0) {
    await createSessionNote({
      sessionId: session.id,
      authorId: context.user.id,
      kind: 'SHARED_FOLLOW_UP',
      content: input.sharedFollowUpNote,
    });
  }

  publish(channels.counsellingSession(session.id), 'session.ended', {
    sessionId: session.id,
    at: now.toISOString(),
  });

  await notify({
    userId: session.request.requesterId,
    category: 'COUNSELLING',
    title: 'Your pastoral session has ended',
    body: input.followUpRequired
      ? 'Your counsellor has suggested a follow-up. You can view it in your counselling area.'
      : 'Thank you for meeting. Any follow-up notes are available in your counselling area.',
    link: '/app/counselling',
  });

  await writeAudit({
    actorId: context.user.id,
    actorEmail: context.user.email,
    actorRole: context.roles.join(','),
    action: AUDIT.COUNSELLING_SESSION_ENDED,
    targetType: 'counselling_session',
    targetId: session.id,
    metadata: { followUpRequired: input.followUpRequired },
    ipAddress: context.ipAddress,
  });

  return ok({ status: 'COMPLETED', endedAt: now });
});
