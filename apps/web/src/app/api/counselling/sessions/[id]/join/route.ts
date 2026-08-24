import { prisma } from '@/lib/db';
import { ApiError, assertSameOrigin, ok, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/context';
import { assertSessionAccess, waitingRoomState } from '@/lib/domain/counselling';
import { AUDIT, writeAudit } from '@/lib/audit';
import { channels, publish } from '@/lib/realtime';
import { notify } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/**
 * Enter the waiting room, then the session itself.
 *
 * The waiting room is strictly private: it holds one member and the counsellor
 * they are meeting. There is no list of who else is waiting, because no such
 * list exists to query.
 */
export const POST = route(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { id } = await params;
  const context = await requireUser();
  const { session, accessPath } = await assertSessionAccess(context, id);

  if (accessPath === 'safeguarding') {
    throw new ApiError(
      403,
      'observer_not_permitted',
      'Safeguarding access permits record review, not joining a live pastoral session.',
    );
  }

  if (session.status === 'CANCELLED' || session.status === 'COMPLETED') {
    throw new ApiError(409, 'session_closed', 'This session is no longer open.');
  }

  const now = new Date();
  const state = waitingRoomState(session);

  if (accessPath === 'member' && !state.canEnterWaitingRoom) {
    throw new ApiError(
      409,
      'too_early',
      'The waiting room opens fifteen minutes before your session begins.',
    );
  }

  if (accessPath === 'counsellor') {
    const updated = await prisma.counsellingSession.update({
      where: { id: session.id },
      data: {
        counsellorJoinedAt: session.counsellorJoinedAt ?? now,
        status: session.memberJoinedAt ? 'ACTIVE' : 'COUNSELLOR_JOINED',
        startedAt: session.startedAt ?? (session.memberJoinedAt ? now : null),
        waitingRoomOpenedAt: session.waitingRoomOpenedAt ?? now,
      },
    });

    await prisma.sessionParticipant.upsert({
      where: { sessionId_userId: { sessionId: session.id, userId: context.user.id } },
      create: { sessionId: session.id, userId: context.user.id, role: 'counsellor', joinedAt: now },
      update: { joinedAt: now, leftAt: null },
    });

    publish(channels.counsellingSession(session.id), 'counsellor.joined', {
      sessionId: session.id,
      at: now.toISOString(),
    });
    await notify({
      userId: session.request.requesterId,
      category: 'COUNSELLING',
      title: 'Your counsellor has joined',
      body: 'You can now enter your secure pastoral session.',
      link: `/app/counselling/${session.id}`,
      push: true,
    });

    await writeAudit({
      actorId: context.user.id,
      actorEmail: context.user.email,
      actorRole: context.roles.join(','),
      action: AUDIT.COUNSELLING_SESSION_JOINED,
      targetType: 'counselling_session',
      targetId: session.id,
      metadata: { as: 'counsellor' },
      ipAddress: context.ipAddress,
    });

    return ok({ status: updated.status, joinedAt: now, role: 'counsellor' });
  }

  const updated = await prisma.counsellingSession.update({
    where: { id: session.id },
    data: {
      memberJoinedAt: session.memberJoinedAt ?? now,
      waitingRoomOpenedAt: session.waitingRoomOpenedAt ?? now,
      status: session.counsellorJoinedAt ? 'ACTIVE' : 'WAITING',
      startedAt: session.startedAt ?? (session.counsellorJoinedAt ? now : null),
    },
  });

  await prisma.sessionParticipant.upsert({
    where: { sessionId_userId: { sessionId: session.id, userId: context.user.id } },
    create: { sessionId: session.id, userId: context.user.id, role: 'member', joinedAt: now },
    update: { joinedAt: now, leftAt: null },
  });

  publish(channels.counsellingSession(session.id), 'member.waiting', {
    sessionId: session.id,
    at: now.toISOString(),
  });
  await notify({
    userId: session.counsellor.userId,
    category: 'COUNSELLING',
    title: 'A member is waiting for you',
    body: 'Someone has entered the waiting room for a scheduled session.',
    link: `/counsellor/sessions/${session.id}`,
    push: true,
  });

  await writeAudit({
    actorId: context.user.id,
    actorEmail: context.user.email,
    actorRole: context.roles.join(','),
    action: AUDIT.COUNSELLING_SESSION_JOINED,
    targetType: 'counselling_session',
    targetId: session.id,
    metadata: { as: 'member' },
    ipAddress: context.ipAddress,
  });

  return ok({
    status: updated.status,
    joinedAt: now,
    role: 'member',
    message: session.counsellorJoinedAt
      ? 'Your counsellor has joined. You can enter the secure session.'
      : 'Your counsellor has been notified.',
  });
});
