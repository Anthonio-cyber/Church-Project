import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, assertSameOrigin, created, ok, parseBody, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/context';
import { notify } from '@/lib/notifications';
import { writeAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const schema = z.object({
  ministryRole: z.string().trim().min(2).max(80),
  biography: z.string().trim().min(50, 'Please tell us a little more.').max(3000),
  categories: z
    .array(
      z.enum([
        'SPIRITUAL_GROWTH', 'PRAYER_AND_FAITH', 'FAMILY', 'MARRIAGE', 'RELATIONSHIPS',
        'PURPOSE_AND_CALLING', 'DISCIPLESHIP', 'PERSONAL_STRUGGLES', 'YOUTH_GUIDANCE',
        'MINISTRY', 'BEREAVEMENT', 'LIFE_DECISIONS', 'OTHER',
      ]),
    )
    .min(1, 'Choose at least one area of service.'),
  languages: z.array(z.string().trim().min(2).max(10)).min(1),
  experienceYears: z.number().int().min(0).max(80).default(0),
  qualifications: z.string().trim().max(1000).optional().or(z.literal('')),
  referenceInfo: z.string().trim().max(500).optional().or(z.literal('')),
  ministryCenterId: z.string().uuid().optional(),
  sessionTypes: z.array(z.enum(['TEXT', 'VOICE', 'VIDEO', 'IN_PERSON'])).min(1),
  acceptsMinors: z.boolean().default(false),
  agreeToCounsellingPolicies: z.literal(true, {
    errorMap: () => ({ message: 'You must agree to the counselling policies.' }),
  }),
  acknowledgeSafeguarding: z.literal(true, {
    errorMap: () => ({ message: 'You must acknowledge the safeguarding policy.' }),
  }),
});

export const GET = route(async () => {
  const context = await requireUser();
  const counsellor = await prisma.counsellor.findUnique({
    where: { userId: context.user.id },
    select: { id: true, status: true, statusReason: true, createdAt: true, verifiedAt: true },
  });
  return ok({ application: counsellor });
});

/**
 * Apply to serve as a counsellor.
 *
 * Applying grants nothing. The record is created as PENDING and only an
 * administrator holding counsellors.verify can approve it — which is what makes
 * "can a member become a counsellor by changing frontend data?" answer no: the
 * status field is not writable from this route at all.
 */
export const POST = route(async (request: Request) => {
  assertSameOrigin(request);
  const context = await requireUser();
  const input = await parseBody(request, schema);

  const existing = await prisma.counsellor.findUnique({
    where: { userId: context.user.id },
  });
  if (existing && existing.status !== 'REJECTED') {
    throw new ApiError(
      409,
      'application_exists',
      'You already have a counsellor application or profile.',
    );
  }

  const now = new Date();
  const data = {
    userId: context.user.id,
    ministryRole: input.ministryRole,
    biography: input.biography,
    categories: input.categories,
    languages: input.languages,
    experienceYears: input.experienceYears,
    qualifications: input.qualifications || null,
    referenceInfo: input.referenceInfo || null,
    ministryCenterId: input.ministryCenterId ?? context.user.ministryCenterId,
    sessionTypes: input.sessionTypes,
    acceptsMinors: input.acceptsMinors,
    policiesAcceptedAt: now,
    safeguardingAcknowledgedAt: now,
    // Set explicitly, never taken from the request body.
    status: 'PENDING' as const,
    verifiedAt: null,
    verifiedById: null,
  };

  const counsellor = existing
    ? await prisma.counsellor.update({ where: { id: existing.id }, data })
    : await prisma.counsellor.create({ data });

  const verifiers = await prisma.userRole.findMany({
    where: { role: { key: { in: ['COUNSELLING_ADMIN', 'ADMIN', 'SENIOR_LEADERSHIP_ADMIN'] } } },
    select: { userId: true },
  });
  for (const verifier of new Set(verifiers.map((v) => v.userId))) {
    await notify({
      userId: verifier,
      category: 'ADMINISTRATIVE',
      title: 'A counsellor application is awaiting review',
      body: 'A new application has been submitted for verification.',
      link: '/admin/counsellors',
    });
  }

  await writeAudit({
    actorId: context.user.id,
    actorEmail: context.user.email,
    action: 'COUNSELLOR_APPLICATION_SUBMITTED',
    targetType: 'counsellor',
    targetId: counsellor.id,
    ipAddress: context.ipAddress,
  });

  return created({
    application: { id: counsellor.id, status: counsellor.status },
    message:
      'Your application has been submitted for verification. You will be notified once it has been reviewed.',
  });
});
