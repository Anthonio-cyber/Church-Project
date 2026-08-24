import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, assertSameOrigin, ok, parseBody, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/context';
import { assertSessionAccess } from '@/lib/domain/counselling';
import { AUDIT, writeAudit } from '@/lib/audit';
import { notify } from '@/lib/notifications';
import { channels, publish } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

const schema = z.object({ reason: z.string().trim().max(300).optional().or(z.literal('')) });

/** Either participant may cancel; both are told, and the record keeps who did. */
export const POST = route(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { id } = await params;
  const context = await requireUser();
  const { session, accessPath } = await assertSessionAccess(context, id);
  const { reason } = await parseBody(request, schema);

  if (accessPath === 'safeguarding') {
    throw new ApiError(403, 'forbidden', 'Safeguarding access does not permit cancelling sessions.');
  }
  if (session.status === 'COMPLETED' || session.status === 'CANCELLED') {
    throw new ApiError(409, 'not_cancellable', 'This session can no longer be cancelled.');
  }

  const now = new Date();
  await prisma.counsellingSession.update({
    where: { id: session.id },
    data: {
      status: 'CANCELLED',
      cancelledAt: now,
      cancelReason: reason || null,
    },
  });
  await prisma.counsellingRequest.update({
    where: { id: session.request.id },
    data: { status: 'CANCELLED' },
  });

  const otherUserId =
    accessPath === 'counsellor' ? session.request.requesterId : session.counsellor.userId;

  publish(channels.counsellingSession(session.id), 'session.cancelled', {
    sessionId: session.id,
    at: now.toISOString(),
  });
  await notify({
    userId: otherUserId,
    category: 'COUNSELLING',
    title: 'A scheduled pastoral session was cancelled',
    body: 'You can arrange another time from your counselling area.',
    link: accessPath === 'counsellor' ? '/app/counselling' : '/counsellor/sessions',
    push: true,
  });

  await writeAudit({
    actorId: context.user.id,
    actorEmail: context.user.email,
    actorRole: context.roles.join(','),
    action: AUDIT.COUNSELLING_SESSION_CANCELLED,
    targetType: 'counselling_session',
    targetId: session.id,
    reason: reason || null,
    metadata: { cancelledBy: accessPath },
    ipAddress: context.ipAddress,
  });

  return ok({ status: 'CANCELLED', cancelledAt: now });
});
