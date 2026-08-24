import { prisma } from '@/lib/db';
import { ok, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/context';
import { assertSessionAccess, CATEGORY_LABEL, waitingRoomState } from '@/lib/domain/counselling';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export const GET = route(async (_request: Request, { params }: Params) => {
  const { id } = await params;
  const context = await requireUser();

  // Every read of a counselling session goes through this guard. An identifier
  // guessed or copied from elsewhere gets a 403, not the record.
  const { session, accessPath } = await assertSessionAccess(context, id);

  const conversation = await prisma.conversation.findUnique({
    where: { sessionId: session.id },
    select: { id: true },
  });

  const counsellorProfile = await prisma.user.findUnique({
    where: { id: session.counsellor.userId },
    select: { profile: { select: { displayName: true, avatarUrl: true } } },
  });
  const memberProfile = await prisma.user.findUnique({
    where: { id: session.request.requesterId },
    select: { profile: { select: { displayName: true, avatarUrl: true } } },
  });

  return ok({
    session: {
      id: session.id,
      status: session.status,
      scheduledFor: session.scheduledFor,
      durationMinutes: session.durationMinutes,
      method: session.method,
      category: session.request.category,
      categoryLabel: CATEGORY_LABEL[session.request.category],
      summary: session.request.summary,
      urgency: session.request.urgency,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      counsellorJoinedAt: session.counsellorJoinedAt,
      memberJoinedAt: session.memberJoinedAt,
      recordingEnabled: session.recordingEnabled,
      conversationId: conversation?.id ?? null,
      waitingRoom: waitingRoomState(session),
      counsellor: {
        displayName: counsellorProfile?.profile?.displayName ?? 'Counsellor',
        avatarUrl: counsellorProfile?.profile?.avatarUrl ?? null,
        ministryRole: session.counsellor.ministryRole,
      },
      member: {
        displayName: memberProfile?.profile?.displayName ?? 'Member',
        avatarUrl: memberProfile?.profile?.avatarUrl ?? null,
      },
    },
    viewer: {
      accessPath,
      isCounsellor: accessPath === 'counsellor',
      isMember: accessPath === 'member',
    },
  });
});
