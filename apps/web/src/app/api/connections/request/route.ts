import { prisma } from '@/lib/db';
import {
  assertSameOrigin,
  created,
  enforceRateLimit,
  parseBody,
  route,
} from '@/lib/api';
import { requireUser } from '@/lib/auth/context';
import { connectionRequestSchema } from '@/lib/validation';
import { assertGuard, guardConnectionRequest } from '@/lib/domain/connections';
import { assertFeatureEnabled } from '@/lib/domain/settings';
import { AUDIT, writeAudit } from '@/lib/audit';
import { notify } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

/**
 * Ask permission to communicate with another member.
 *
 * This is the whole of what a requester can do. One short introduction message
 * is permitted and no more; no conversation row is created, so there is nothing
 * for the requester to send further messages into. If the recipient declines,
 * a cooldown prevents the request being repeated straight away.
 */
export const POST = route(async (request: Request) => {
  assertSameOrigin(request);
  await assertFeatureEnabled('connections.enabled');
  const context = await requireUser();
  await enforceRateLimit('connectionRequest', `user:${context.user.id}`);

  const input = await parseBody(request, connectionRequestSchema);
  assertGuard(await guardConnectionRequest(context.user.id, input.recipientId));

  const existing = await prisma.connectionRequest.findFirst({
    where: {
      OR: [
        { requesterId: context.user.id, recipientId: input.recipientId },
        { requesterId: input.recipientId, recipientId: context.user.id },
      ],
    },
  });

  const data = {
    requesterId: context.user.id,
    recipientId: input.recipientId,
    introMessage: input.introMessage && input.introMessage.length > 0 ? input.introMessage : null,
    status: 'PENDING' as const,
    respondedAt: null,
    cooldownUntil: null,
  };

  const connectionRequest = existing
    ? await prisma.connectionRequest.update({ where: { id: existing.id }, data })
    : await prisma.connectionRequest.create({ data });

  await notify({
    userId: input.recipientId,
    category: 'CONNECTION',
    title: 'You have a new connection request',
    body: 'Someone has asked permission to connect with you. No conversation exists unless you accept.',
    link: '/app/connections',
    push: true,
    email: {
      subject: 'You have a new connection request',
      text: 'Someone has asked permission to connect with you. You can accept, decline or block the request from your Connections page.',
    },
  });

  await writeAudit({
    actorId: context.user.id,
    actorEmail: context.user.email,
    action: AUDIT.CONNECTION_REQUESTED,
    targetType: 'user',
    targetId: input.recipientId,
    ipAddress: context.ipAddress,
  });

  return created({
    request: { id: connectionRequest.id, status: connectionRequest.status },
    message:
      'Your request has been sent. A private conversation will only exist if they accept.',
  });
});
