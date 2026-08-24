import { prisma } from '@/lib/db';
import { ApiError, assertSameOrigin, ok, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/context';
import { isBlockedBetween } from '@/lib/domain/connections';
import { AUDIT, writeAudit } from '@/lib/audit';
import { notify } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/**
 * Accepting is the moment a private conversation comes into existence. Before
 * this call there is no conversation row, so there is nowhere the requester
 * could have written to.
 */
export const POST = route(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { id } = await params;
  const context = await requireUser();

  const connectionRequest = await prisma.connectionRequest.findUnique({ where: { id } });
  if (!connectionRequest || connectionRequest.recipientId !== context.user.id) {
    // Only the recipient can accept, and a stranger gets the same 404 they
    // would get for an identifier that does not exist.
    throw new ApiError(404, 'not_found', 'That request could not be found.');
  }
  if (connectionRequest.status !== 'PENDING') {
    throw new ApiError(409, 'not_pending', 'That request is no longer pending.');
  }
  if (await isBlockedBetween(connectionRequest.requesterId, context.user.id)) {
    throw new ApiError(403, 'blocked', 'This request cannot be accepted.');
  }

  const conversation = await prisma.$transaction(async (tx) => {
    const created = await tx.conversation.create({
      data: {
        kind: 'PEER',
        participants: {
          create: [
            { userId: connectionRequest.requesterId },
            { userId: connectionRequest.recipientId },
          ],
        },
      },
    });
    await tx.connectionRequest.update({
      where: { id: connectionRequest.id },
      data: { status: 'ACCEPTED', respondedAt: new Date(), conversationId: created.id },
    });
    return created;
  });

  await notify({
    userId: connectionRequest.requesterId,
    category: 'CONNECTION',
    title: 'Your connection request was accepted',
    body: 'You can now message each other from the Messages page.',
    link: `/app/messages/${conversation.id}`,
    push: true,
  });

  await writeAudit({
    actorId: context.user.id,
    actorEmail: context.user.email,
    action: AUDIT.CONNECTION_ACCEPTED,
    targetType: 'connection_request',
    targetId: connectionRequest.id,
    ipAddress: context.ipAddress,
  });

  return ok({
    conversationId: conversation.id,
    message: 'Connected. You can now message each other.',
  });
});
