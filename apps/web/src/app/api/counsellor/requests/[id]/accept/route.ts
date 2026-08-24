import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, assertSameOrigin, created, parseBody, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/context';
import { AUDIT, writeAudit } from '@/lib/audit';
import { notify } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  scheduledFor: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(180).default(45),
  method: z.enum(['TEXT', 'VOICE', 'VIDEO', 'IN_PERSON']).default('TEXT'),
});

/**
 * A counsellor accepts a request and schedules the session.
 *
 * Accepting creates the session and its private conversation in one
 * transaction, so a session always has exactly one conversation and that
 * conversation always has exactly the two participants.
 */
export const POST = route(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { id } = await params;
  const context = await requireUser();
  const input = await parseBody(request, schema);

  const counsellor = await prisma.counsellor.findUnique({
    where: { userId: context.user.id },
    include: { _count: { select: { sessions: { where: { status: { in: ['CONFIRMED', 'WAITING', 'ACTIVE'] } } } } } },
  });
  if (!counsellor || counsellor.status !== 'APPROVED') {
    throw new ApiError(403, 'not_approved', 'Only approved counsellors can accept requests.');
  }
  if (counsellor._count.sessions >= counsellor.maxConcurrentCases) {
    throw new ApiError(
      409,
      'at_capacity',
      'You are at your caseload limit. Complete or reassign an existing session first.',
    );
  }

  const counsellingRequest = await prisma.counsellingRequest.findUnique({
    where: { id },
    include: { requester: { include: { profile: true } }, session: true },
  });
  if (!counsellingRequest) {
    throw new ApiError(404, 'not_found', 'That request could not be found.');
  }
  if (counsellingRequest.session) {
    throw new ApiError(409, 'already_scheduled', 'That request already has a session.');
  }
  if (!['SUBMITTED', 'MATCHING', 'ASSIGNED', 'TRIAGED'].includes(counsellingRequest.status)) {
    throw new ApiError(409, 'not_open', 'That request is no longer open.');
  }
  // A request assigned to a specific counsellor cannot be taken by another.
  if (
    counsellingRequest.assignedCounsellorId &&
    counsellingRequest.assignedCounsellorId !== counsellor.id
  ) {
    throw new ApiError(409, 'assigned_elsewhere', 'That request is assigned to another counsellor.');
  }
  // Age-aware protection: only counsellors approved to work with young people
  // may take a request from a minor.
  if (counsellingRequest.requester.profile?.ageBand === 'MINOR' && !counsellor.acceptsMinors) {
    throw new ApiError(
      403,
      'not_approved_for_minors',
      'This request is from a young person and requires a counsellor approved for that work.',
    );
  }

  const scheduledFor = new Date(input.scheduledFor);
  if (scheduledFor.getTime() < Date.now() - 60_000) {
    throw new ApiError(400, 'invalid_time', 'Choose a time in the future.');
  }

  const session = await prisma.$transaction(async (tx) => {
    const createdSession = await tx.counsellingSession.create({
      data: {
        requestId: counsellingRequest.id,
        counsellorId: counsellor.id,
        scheduledFor,
        durationMinutes: input.durationMinutes,
        method: input.method,
        status: 'CONFIRMED',
        participants: {
          create: [
            { userId: counsellingRequest.requesterId, role: 'member' },
            { userId: context.user.id, role: 'counsellor' },
          ],
        },
      },
    });

    await tx.conversation.create({
      data: {
        kind: 'COUNSELLING',
        sessionId: createdSession.id,
        participants: {
          create: [
            { userId: counsellingRequest.requesterId, role: 'member' },
            { userId: context.user.id, role: 'counsellor' },
          ],
        },
      },
    });

    await tx.counsellingRequest.update({
      where: { id: counsellingRequest.id },
      data: {
        status: 'SCHEDULED',
        assignedCounsellorId: counsellor.id,
        assignedAt: new Date(),
      },
    });

    return createdSession;
  });

  const whenLabel = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: counsellingRequest.requester.profile?.timezone ?? 'UTC',
  }).format(scheduledFor);

  await notify({
    userId: counsellingRequest.requesterId,
    category: 'COUNSELLING',
    title: 'Your private pastoral session is confirmed',
    body: `Scheduled for ${whenLabel}. The waiting room opens fifteen minutes beforehand.`,
    link: '/app/counselling',
    push: true,
    email: {
      subject: 'Your private pastoral session is confirmed',
      text: `Your private pastoral session is confirmed for ${whenLabel}. Sign in shortly before and open the waiting room from your dashboard.`,
    },
  });

  await writeAudit({
    actorId: context.user.id,
    actorEmail: context.user.email,
    actorRole: context.roles.join(','),
    action: AUDIT.COUNSELLING_ACCEPTED,
    targetType: 'counselling_session',
    targetId: session.id,
    metadata: { requestId: counsellingRequest.id, scheduledFor: scheduledFor.toISOString() },
    ipAddress: context.ipAddress,
  });

  return created({
    session: { id: session.id, scheduledFor: session.scheduledFor, status: session.status },
    message: 'Session scheduled and the member has been notified.',
  });
});
