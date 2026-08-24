import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, assertSameOrigin, ok, parseBody, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/context';
import { DECLINE_COOLDOWN_DAYS } from '@/lib/domain/connections';
import { AUDIT, writeAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

const schema = z.object({ block: z.boolean().default(false) });

export const POST = route(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { id } = await params;
  const context = await requireUser();
  const { block } = await parseBody(request, schema);

  const connectionRequest = await prisma.connectionRequest.findUnique({ where: { id } });
  if (!connectionRequest || connectionRequest.recipientId !== context.user.id) {
    throw new ApiError(404, 'not_found', 'That request could not be found.');
  }
  if (connectionRequest.status !== 'PENDING') {
    throw new ApiError(409, 'not_pending', 'That request is no longer pending.');
  }

  const cooldownUntil = new Date(Date.now() + DECLINE_COOLDOWN_DAYS * 24 * 3600 * 1000);

  await prisma.connectionRequest.update({
    where: { id: connectionRequest.id },
    data: {
      status: block ? 'BLOCKED' : 'DECLINED',
      respondedAt: new Date(),
      cooldownUntil,
    },
  });

  if (block) {
    await prisma.block.upsert({
      where: {
        blockerId_blockedId: {
          blockerId: context.user.id,
          blockedId: connectionRequest.requesterId,
        },
      },
      create: {
        blockerId: context.user.id,
        blockedId: connectionRequest.requesterId,
        reason: 'Blocked when declining a connection request.',
      },
      update: {},
    });
  }

  await writeAudit({
    actorId: context.user.id,
    actorEmail: context.user.email,
    action: block ? AUDIT.USER_BLOCKED : AUDIT.CONNECTION_DECLINED,
    targetType: 'connection_request',
    targetId: connectionRequest.id,
    ipAddress: context.ipAddress,
  });

  // The requester is deliberately not notified of a decline. Being told
  // "declined" invites pressure; silence is the safer default for the recipient.
  return ok({
    message: block
      ? 'Request declined and the member blocked.'
      : 'Request declined.',
  });
});
