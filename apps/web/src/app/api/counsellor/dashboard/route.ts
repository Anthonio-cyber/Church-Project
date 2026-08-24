import { prisma } from '@/lib/db';
import { ApiError, ok, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/context';
import { CATEGORY_LABEL, waitingRoomState } from '@/lib/domain/counselling';

export const dynamic = 'force-dynamic';

/**
 * The counsellor's own dashboard.
 *
 * Everything is scoped to this counsellor's record. There is no parameter that
 * would show another counsellor's caseload — a counsellor sees the people
 * assigned to them and no one else.
 */
export const GET = route(async () => {
  const context = await requireUser();

  const counsellor = await prisma.counsellor.findUnique({
    where: { userId: context.user.id },
    include: { availability: { orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }] } },
  });

  if (!counsellor) {
    throw new ApiError(403, 'not_a_counsellor', 'You do not have a counsellor profile.');
  }
  if (counsellor.status !== 'APPROVED') {
    return ok({
      counsellor: { status: counsellor.status },
      // An unapproved counsellor sees their application state and nothing else.
      pendingApproval: true,
      message:
        counsellor.status === 'SUSPENDED'
          ? 'Your counsellor account is suspended. Please speak with your supervising leader.'
          : 'Your counsellor application is still under review.',
    });
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay.getTime() + 24 * 3600 * 1000);

  const [today, upcoming, pendingRequests, completedCount, followUps] = await Promise.all([
    prisma.counsellingSession.findMany({
      where: {
        counsellorId: counsellor.id,
        scheduledFor: { gte: startOfDay, lt: endOfDay },
        status: { notIn: ['CANCELLED'] },
      },
      orderBy: { scheduledFor: 'asc' },
      include: {
        request: {
          select: {
            category: true,
            summary: true,
            urgency: true,
            requester: { select: { profile: { select: { displayName: true, avatarUrl: true } } } },
          },
        },
      },
    }),
    prisma.counsellingSession.findMany({
      where: {
        counsellorId: counsellor.id,
        scheduledFor: { gte: endOfDay },
        status: { in: ['CONFIRMED', 'WAITING'] },
      },
      orderBy: { scheduledFor: 'asc' },
      take: 10,
      include: { request: { select: { category: true, summary: true, urgency: true } } },
    }),
    prisma.counsellingRequest.findMany({
      where: {
        status: { in: ['MATCHING', 'ASSIGNED'] },
        OR: [
          { assignedCounsellorId: counsellor.id },
          {
            assignedCounsellorId: null,
            category: { in: counsellor.categories },
            language: { in: counsellor.languages.length > 0 ? counsellor.languages : ['en'] },
          },
        ],
      },
      orderBy: [{ urgency: 'desc' }, { createdAt: 'asc' }],
      take: 20,
      select: {
        id: true,
        category: true,
        summary: true,
        urgency: true,
        preferredMethod: true,
        preferredDate: true,
        createdAt: true,
        assignedCounsellorId: true,
      },
    }),
    prisma.counsellingSession.count({
      where: { counsellorId: counsellor.id, status: 'COMPLETED' },
    }),
    prisma.counsellingSession.findMany({
      where: { counsellorId: counsellor.id, followUpRequired: true, status: 'COMPLETED' },
      orderBy: { followUpAt: 'asc' },
      take: 10,
      select: { id: true, followUpAt: true, request: { select: { category: true } } },
    }),
  ]);

  return ok({
    counsellor: {
      id: counsellor.id,
      status: counsellor.status,
      availabilityState: counsellor.availabilityState,
      categories: counsellor.categories,
      languages: counsellor.languages,
      acceptsMinors: counsellor.acceptsMinors,
      maxConcurrentCases: counsellor.maxConcurrentCases,
      availability: counsellor.availability,
    },
    stats: {
      todayCount: today.length,
      upcomingCount: upcoming.length,
      pendingRequests: pendingRequests.length,
      completedCount,
      followUpCount: followUps.length,
    },
    todaysSessions: today.map((session) => ({
      id: session.id,
      scheduledFor: session.scheduledFor,
      status: session.status,
      method: session.method,
      categoryLabel: CATEGORY_LABEL[session.request.category],
      summary: session.request.summary,
      urgency: session.request.urgency,
      member: {
        displayName: session.request.requester.profile?.displayName ?? 'Member',
        avatarUrl: session.request.requester.profile?.avatarUrl ?? null,
      },
      waitingRoom: waitingRoomState(session),
      memberWaiting: session.status === 'WAITING',
    })),
    upcomingSessions: upcoming.map((session) => ({
      id: session.id,
      scheduledFor: session.scheduledFor,
      categoryLabel: CATEGORY_LABEL[session.request.category],
      urgency: session.request.urgency,
    })),
    pendingRequests: pendingRequests.map((row) => ({
      ...row,
      categoryLabel: CATEGORY_LABEL[row.category],
      directlyAssigned: row.assignedCounsellorId === counsellor.id,
    })),
    followUps,
  });
});
