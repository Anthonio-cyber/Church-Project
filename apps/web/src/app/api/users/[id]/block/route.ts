import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, assertSameOrigin, ok, parseBody, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/context';
import { AUDIT, writeAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

const schema = z.object({ reason: z.string().trim().max(300).optional().or(z.literal('')) });

/**
 * Block another member.
 *
 * Blocking hides existing private communication in both directions, stops
 * notifications, and prevents any further connection request. It takes effect
 * immediately at every read and write path, not just in the interface.
 */
export const POST = route(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { id } = await params;
  const context = await requireUser();
  const { reason } = await parseBody(request, schema);

  if (id === context.user.id) {
    throw new ApiError(400, 'invalid_target', 'You cannot block yourself.');
  }
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!target) throw new ApiError(404, 'not_found', 'That member could not be found.');

  await prisma.$transaction(async (tx) => {
    await tx.block.upsert({
      where: { blockerId_blockedId: { blockerId: context.user.id, blockedId: id } },
      create: { blockerId: context.user.id, blockedId: id, reason: reason || null },
      update: { reason: reason || null },
    });
    await tx.connectionRequest.updateMany({
      where: {
        OR: [
          { requesterId: context.user.id, recipientId: id },
          { requesterId: id, recipientId: context.user.id },
        ],
      },
      data: { status: 'BLOCKED', respondedAt: new Date() },
    });
    // Peer conversations are deactivated. Counselling conversations are left
    // alone: a pastoral session is closed through the counselling workflow,
    // not by a block.
    const conversations = await tx.conversationParticipant.findMany({
      where: { userId: context.user.id },
      select: { conversationId: true },
    });
    const shared = await tx.conversationParticipant.findMany({
      where: {
        userId: id,
        conversationId: { in: conversations.map((c) => c.conversationId) },
      },
      select: { conversationId: true },
    });
    if (shared.length > 0) {
      await tx.conversation.updateMany({
        where: { id: { in: shared.map((c) => c.conversationId) }, kind: 'PEER' },
        data: { isActive: false },
      });
    }
  });

  await writeAudit({
    actorId: context.user.id,
    actorEmail: context.user.email,
    action: AUDIT.USER_BLOCKED,
    targetType: 'user',
    targetId: id,
    reason: reason || null,
    ipAddress: context.ipAddress,
  });

  return ok({ message: 'That member has been blocked.' });
});

export const DELETE = route(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { id } = await params;
  const context = await requireUser();

  await prisma.block
    .delete({ where: { blockerId_blockedId: { blockerId: context.user.id, blockedId: id } } })
    .catch(() => undefined);

  await writeAudit({
    actorId: context.user.id,
    actorEmail: context.user.email,
    action: AUDIT.USER_UNBLOCKED,
    targetType: 'user',
    targetId: id,
    ipAddress: context.ipAddress,
  });

  return ok({ message: 'That member has been unblocked.' });
});
