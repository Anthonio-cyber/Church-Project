import type { SessionStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { ok, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/context';
import { CATEGORY_LABEL, waitingRoomState } from '@/lib/domain/counselling';

export const dynamic = 'force-dynamic';

/**
 * Sessions the caller is genuinely part of — as the member who requested them
 * or as the assigned counsellor. Nothing else is reachable from this route.
 */
export const GET = route(async (request: Request) => {
  const context = await requireUser();
  const url = new URL(request.url);
  const scope = url.searchParams.get('scope') ?? 'upcoming';

  const counsellor = await prisma.counsellor.findUnique({
    where: { userId: context.user.id },
    select: { id: true },
  });

  const statusFilter: { in: SessionStatus[] } =
    scope === 'past'
      ? { in: ['COMPLETED', 'CANCELLED', 'NO_SHOW'] }
      : { in: ['REQUESTED', 'CONFIRMED', 'WAITING', 'COUNSELLOR_JOINED', 'ACTIVE'] };

  const sessions = await prisma.counsellingSession.findMany({
    where: {
      status: statusFilter,
      OR: [
        { request: { requesterId: context.user.id } },
        ...(counsellor ? [{ counsellorId: counsellor.id }] : []),
      ],
    },
    orderBy: { scheduledFor: scope === 'past' ? 'desc' : 'asc' },
    take: 50,
    include: {
      request: {
        select: {
          id: true,
          category: true,
          summary: true,
          urgency: true,
          requesterId: true,
          requester: { select: { profile: { select: { displayName: true, avatarUrl: true } } } },
        },
      },
      counsellor: {
        select: {
          id: true,
          userId: true,
          ministryRole: true,
          user: { select: { profile: { select: { displayName: true, avatarUrl: true } } } },
        },
      },
    },
  });

  return ok({
    sessions: sessions.map((session) => {
      const viewerIsCounsellor = session.counsellor.userId === context.user.id;
      const state = waitingRoomState(session);
      return {
        id: session.id,
        scheduledFor: session.scheduledFor,
        durationMinutes: session.durationMinutes,
        method: session.method,
        status: session.status,
        viewerRole: viewerIsCounsellor ? 'counsellor' : 'member',
        category: session.request.category,
        categoryLabel: CATEGORY_LABEL[session.request.category],
        // A counsellor sees the summary of what the person wants to discuss;
        // the member already knows it. Neither sees anything about anyone else.
        summary: session.request.summary,
        urgency: session.request.urgency,
        counterpart: viewerIsCounsellor
          ? {
              displayName: session.request.requester.profile?.displayName ?? 'Member',
              avatarUrl: session.request.requester.profile?.avatarUrl ?? null,
              role: 'Member',
            }
          : {
              displayName: session.counsellor.user.profile?.displayName ?? 'Counsellor',
              avatarUrl: session.counsellor.user.profile?.avatarUrl ?? null,
              role: session.counsellor.ministryRole,
            },
        waitingRoom: state,
        counsellorJoinedAt: session.counsellorJoinedAt,
        endedAt: session.endedAt,
      };
    }),
  });
});
