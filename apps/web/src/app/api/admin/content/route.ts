import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, assertSameOrigin, created, ok, paginationFrom, parseBody, route } from '@/lib/api';
import { requirePermission, requireUser } from '@/lib/auth/context';
import { AUDIT, writeAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export const GET = route(async (request: Request) => {
  await requirePermission('content.edit');
  const { take, skip } = paginationFrom(request, 25, 100);
  const url = new URL(request.url);
  const status = url.searchParams.get('status');

  const where = status ? { status: status as never } : {};

  const [resources, courses, total] = await Promise.all([
    prisma.resource.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take,
      skip,
      include: { ministryCenter: { select: { name: true } } },
    }),
    prisma.course.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { lessons: true, progress: true } } },
    }),
    prisma.resource.count({ where }),
  ]);

  return ok({ total, resources, courses });
});

const resourceSchema = z.object({
  title: z.string().trim().min(3).max(160),
  slug: z.string().trim().min(3).max(160).regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers and hyphens.'),
  description: z.string().trim().min(10).max(1000),
  body: z.string().trim().max(60000).optional().or(z.literal('')),
  type: z.enum([
    'SERMON', 'BIBLE_STUDY', 'ARTICLE', 'VIDEO', 'AUDIO', 'PDF',
    'DEVOTIONAL', 'PRAYER_GUIDE', 'DISCIPLESHIP_MATERIAL',
  ]),
  topic: z.string().trim().min(2).max(60),
  speaker: z.string().trim().max(80).optional().or(z.literal('')),
  mediaUrl: z.string().url().max(600).optional().or(z.literal('')),
  thumbnailUrl: z.string().url().max(600).optional().or(z.literal('')),
  durationMinutes: z.number().int().min(1).max(1000).optional(),
  language: z.string().trim().min(2).max(10).default('en'),
  difficulty: z.string().trim().max(40).default('All levels'),
  scriptureRefs: z.array(z.string().trim().max(60)).max(20).default([]),
  tags: z.array(z.string().trim().max(40)).max(20).default([]),
  visibility: z.enum(['PUBLIC', 'MEMBERS_ONLY', 'MINISTRY_CENTER', 'LEADERSHIP_ONLY']).default('PUBLIC'),
  ministryCenterId: z.string().uuid().optional(),
});

export const POST = route(async (request: Request) => {
  assertSameOrigin(request);
  const context = await requirePermission('content.create');
  const input = await parseBody(request, resourceSchema);

  const existing = await prisma.resource.findUnique({ where: { slug: input.slug } });
  if (existing) throw new ApiError(409, 'slug_taken', 'That web address is already in use.');

  const resource = await prisma.resource.create({
    data: {
      ...input,
      body: input.body || null,
      speaker: input.speaker || null,
      mediaUrl: input.mediaUrl || null,
      thumbnailUrl: input.thumbnailUrl || null,
      // New content always starts as a draft. Publishing is a separate,
      // separately-permissioned act.
      status: 'DRAFT',
      createdById: context.user.id,
    },
  });

  await writeAudit({
    actorId: context.user.id,
    actorEmail: context.user.email,
    actorRole: context.roles.join(','),
    action: 'ADMIN_CONTENT_CREATED',
    targetType: 'resource',
    targetId: resource.id,
    metadata: { type: resource.type, slug: resource.slug },
    ipAddress: context.ipAddress,
  });

  return created({ resource, message: 'Draft created.' });
});

const statusSchema = z.object({
  resourceId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED']),
});

export const PATCH = route(async (request: Request) => {
  assertSameOrigin(request);
  const base = await requireUser();
  const input = await parseBody(request, statusSchema);

  // Moving something to PUBLISHED needs content.publish; everything else needs
  // only content.edit. That separation lets an organisation give someone the
  // ability to prepare material without the authority to release it.
  const context = await requirePermission(
    input.status === 'PUBLISHED' ? 'content.publish' : 'content.edit',
    { context: base },
  );

  const now = new Date();

  if (input.resourceId) {
    const resource = await prisma.resource.update({
      where: { id: input.resourceId },
      data: {
        status: input.status,
        publishedAt: input.status === 'PUBLISHED' ? now : null,
        approvedById: input.status === 'PUBLISHED' ? context.user.id : null,
      },
    });
    await writeAudit({
      actorId: context.user.id,
      actorEmail: context.user.email,
      actorRole: context.roles.join(','),
      action: input.status === 'PUBLISHED' ? AUDIT.CONTENT_PUBLISHED : AUDIT.CONTENT_ARCHIVED,
      targetType: 'resource',
      targetId: resource.id,
      metadata: { status: input.status },
      ipAddress: context.ipAddress,
    });
    return ok({ resource, message: `Resource moved to ${input.status.toLowerCase()}.` });
  }

  if (input.courseId) {
    const course = await prisma.course.update({
      where: { id: input.courseId },
      data: {
        status: input.status,
        publishedAt: input.status === 'PUBLISHED' ? now : null,
        approvedById: input.status === 'PUBLISHED' ? context.user.id : null,
      },
    });
    await writeAudit({
      actorId: context.user.id,
      actorEmail: context.user.email,
      actorRole: context.roles.join(','),
      action: input.status === 'PUBLISHED' ? AUDIT.CONTENT_PUBLISHED : AUDIT.CONTENT_ARCHIVED,
      targetType: 'course',
      targetId: course.id,
      metadata: { status: input.status },
      ipAddress: context.ipAddress,
    });
    return ok({ course, message: `Course moved to ${input.status.toLowerCase()}.` });
  }

  throw new ApiError(400, 'target_required', 'Choose a resource or a course.');
});
