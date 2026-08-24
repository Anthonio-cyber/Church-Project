import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, assertSameOrigin, ok, paginationFrom, parseBody, route } from '@/lib/api';
import { requirePermission, requireUser } from '@/lib/auth/context';
import { reasonSchema } from '@/lib/validation';
import { CATEGORY_LABEL, findMatchingCounsellors } from '@/lib/domain/counselling';
import { AUDIT, writeAudit } from '@/lib/audit';
import { notify } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

/**
 * Counselling operations.
 *
 * A counselling administrator sees the operational shape of the queue — who is
 * waiting, in which category, how urgent, who is assigned — and can move work
 * around. They do not see the conversation, and this route returns no message
 * content or notes. That boundary is the point of the role.
 */
export const GET = route(async (request: Request) => {
  await requirePermission('counselling.view');
  const { take, skip } = paginationFrom(request, 25, 100);
  const url = new URL(request.url);
  const status = url.searchParams.get('status');

  const where = status ? { status: status as never } : {};

  const [requests, total, sessions, counsellors] = await Promise.all([
    prisma.counsellingRequest.findMany({
      where,
      orderBy: [{ urgency: 'desc' }, { createdAt: 'asc' }],
      take,
      skip,
      select: {
        id: true,
        category: true,
        urgency: true,
        status: true,
        preferredMethod: true,
        preferredGender: true,
        language: true,
        createdAt: true,
        safeguardingFlagged: true,
        // The member is identified by display name only; the summary of what
        // they wish to discuss is deliberately not selected here.
        requester: { select: { id: true, profile: { select: { displayName: true, ageBand: true } } } },
        assignedCounsellor: {
          select: { id: true, user: { select: { profile: { select: { displayName: true } } } } },
        },
        session: { select: { id: true, scheduledFor: true, status: true } },
      },
    }),
    prisma.counsellingRequest.count({ where }),
    prisma.counsellingSession.groupBy({ by: ['status'], _count: true }),
    prisma.counsellor.findMany({
      where: { status: 'APPROVED' },
      select: {
        id: true,
        availabilityState: true,
        categories: true,
        languages: true,
        maxConcurrentCases: true,
        acceptsMinors: true,
        user: { select: { profile: { select: { displayName: true, gender: true } } } },
        _count: { select: { sessions: { where: { status: { in: ['CONFIRMED', 'WAITING', 'ACTIVE'] } } } } },
      },
    }),
  ]);

  return ok({
    total,
    requests: requests.map((row) => ({
      id: row.id,
      categoryLabel: CATEGORY_LABEL[row.category],
      category: row.category,
      urgency: row.urgency,
      status: row.status,
      preferredMethod: row.preferredMethod,
      preferredGender: row.preferredGender,
      language: row.language,
      createdAt: row.createdAt,
      safeguardingFlagged: row.safeguardingFlagged,
      member: {
        displayName: row.requester.profile?.displayName ?? 'Member',
        isMinor: row.requester.profile?.ageBand === 'MINOR',
      },
      assignedCounsellor: row.assignedCounsellor
        ? {
            id: row.assignedCounsellor.id,
            displayName: row.assignedCounsellor.user.profile?.displayName ?? 'Counsellor',
          }
        : null,
      session: row.session,
    })),
    sessionCounts: sessions.map((row) => ({ status: row.status, count: row._count })),
    counsellors: counsellors.map((row) => ({
      id: row.id,
      displayName: row.user.profile?.displayName ?? 'Counsellor',
      gender: row.user.profile?.gender ?? 'UNSPECIFIED',
      availabilityState: row.availabilityState,
      categories: row.categories,
      languages: row.languages,
      acceptsMinors: row.acceptsMinors,
      caseload: row._count.sessions,
      capacity: row.maxConcurrentCases,
    })),
    note: 'This view shows counselling operations only. It contains no counselling conversations or notes.',
  });
});

const assignSchema = z.object({
  requestId: z.string().uuid(),
  counsellorId: z.string().uuid().nullable(),
  reason: reasonSchema,
});

export const PATCH = route(async (request: Request) => {
  assertSameOrigin(request);
  const base = await requireUser();
  const input = await parseBody(request, assignSchema);
  const context = await requirePermission('counselling.assign', {
    context: base,
    reason: input.reason,
    targetType: 'counselling_request',
    targetId: input.requestId,
  });

  const counsellingRequest = await prisma.counsellingRequest.findUnique({
    where: { id: input.requestId },
    include: { session: { select: { id: true } }, requester: { include: { profile: true } } },
  });
  if (!counsellingRequest) {
    throw new ApiError(404, 'not_found', 'That request could not be found.');
  }
  if (counsellingRequest.session) {
    throw new ApiError(
      409,
      'already_scheduled',
      'That request already has a scheduled session. Cancel it before reassigning.',
    );
  }

  if (input.counsellorId === null) {
    await prisma.counsellingRequest.update({
      where: { id: input.requestId },
      data: { status: 'MATCHING', assignedCounsellorId: null, assignedAt: null },
    });
    await writeAudit({
      actorId: context.user.id,
      actorEmail: context.user.email,
      actorRole: context.roles.join(','),
      action: AUDIT.COUNSELLING_ASSIGNED,
      targetType: 'counselling_request',
      targetId: input.requestId,
      reason: input.reason,
      metadata: { unassigned: true },
      ipAddress: context.ipAddress,
    });
    return ok({ message: 'Request returned to the matching queue.' });
  }

  const counsellor = await prisma.counsellor.findUnique({
    where: { id: input.counsellorId },
    select: { id: true, userId: true, status: true, acceptsMinors: true },
  });
  if (!counsellor || counsellor.status !== 'APPROVED') {
    throw new ApiError(400, 'invalid_counsellor', 'That counsellor is not approved.');
  }
  if (counsellingRequest.requester.profile?.ageBand === 'MINOR' && !counsellor.acceptsMinors) {
    throw new ApiError(
      403,
      'not_approved_for_minors',
      'That counsellor is not approved to work with young people.',
    );
  }

  await prisma.counsellingRequest.update({
    where: { id: input.requestId },
    data: {
      status: 'ASSIGNED',
      assignedCounsellorId: counsellor.id,
      assignedAt: new Date(),
      assignedById: context.user.id,
    },
  });

  await notify({
    userId: counsellor.userId,
    category: 'COUNSELLING',
    title: 'A counselling request has been assigned to you',
    body: 'Open your counsellor portal to accept and schedule it.',
    link: '/counsellor/requests',
    push: true,
  });

  await writeAudit({
    actorId: context.user.id,
    actorEmail: context.user.email,
    actorRole: context.roles.join(','),
    action: AUDIT.COUNSELLING_ASSIGNED,
    targetType: 'counselling_request',
    targetId: input.requestId,
    reason: input.reason,
    metadata: { counsellorId: counsellor.id },
    ipAddress: context.ipAddress,
  });

  return ok({ message: 'Counsellor assigned and notified.' });
});

/** Suggested matches for a request, used by the assignment interface. */
export const POST = route(async (request: Request) => {
  assertSameOrigin(request);
  await requirePermission('counselling.assign');
  const { requestId } = await parseBody(request, z.object({ requestId: z.string().uuid() }));

  const counsellingRequest = await prisma.counsellingRequest.findUnique({
    where: { id: requestId },
    include: { requester: { include: { profile: true } } },
  });
  if (!counsellingRequest) {
    throw new ApiError(404, 'not_found', 'That request could not be found.');
  }

  const matches = await findMatchingCounsellors({
    category: counsellingRequest.category,
    language: counsellingRequest.language,
    preferredGender: counsellingRequest.preferredGender,
    ministryCenterId: counsellingRequest.ministryCenterId,
    requesterIsMinor: counsellingRequest.requester.profile?.ageBand === 'MINOR',
    limit: 5,
  });

  return ok({
    matches: matches.map((match) => ({
      counsellorId: match.counsellor.id,
      displayName: match.counsellor.user.profile?.displayName ?? 'Counsellor',
      ministryRole: match.counsellor.ministryRole,
      score: match.score,
      caseload: match.load,
      availabilityState: match.counsellor.availabilityState,
      languages: match.counsellor.languages,
    })),
  });
});
