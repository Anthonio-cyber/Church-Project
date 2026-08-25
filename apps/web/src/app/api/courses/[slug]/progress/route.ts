import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, assertSameOrigin, ok, parseBody, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/context';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string }> };

const schema = z.object({
  lessonId: z.string().uuid(),
  completed: z.boolean().default(true),
  quizScore: z.number().int().min(0).max(100).optional(),
});

/** Record lesson completion and recompute the member's course progress. */
export const POST = route(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { slug } = await params;
  const context = await requireUser();
  const input = await parseBody(request, schema);

  const course = await prisma.course.findUnique({
    where: { slug },
    include: { lessons: { select: { id: true } } },
  });
  if (!course || course.status !== 'PUBLISHED') {
    throw new ApiError(404, 'not_found', 'That course could not be found.');
  }
  if (!course.lessons.some((lesson) => lesson.id === input.lessonId)) {
    throw new ApiError(400, 'invalid_lesson', 'That lesson is not part of this course.');
  }

  // Enrolment must already exist. Upserting here would have quietly enrolled
  // anyone who posted a lesson id, which is the whole gate.
  const existing = await prisma.courseProgress.findUnique({
    where: { userId_courseId: { userId: context.user.id, courseId: course.id } },
    select: { id: true, certificateIssuedAt: true },
  });
  if (!existing) {
    throw new ApiError(409, 'not_enrolled', 'Enrol on this course before recording progress.');
  }

  const progress = await prisma.courseProgress.update({
    where: { id: existing.id },
    data: { lastActivityAt: new Date() },
  });

  await prisma.lessonProgress.upsert({
    where: {
      courseProgressId_lessonId: {
        courseProgressId: progress.id,
        lessonId: input.lessonId,
      },
    },
    create: {
      courseProgressId: progress.id,
      lessonId: input.lessonId,
      completedAt: input.completed ? new Date() : null,
      quizScore: input.quizScore ?? null,
    },
    update: {
      completedAt: input.completed ? new Date() : null,
      quizScore: input.quizScore ?? null,
    },
  });

  const completedCount = await prisma.lessonProgress.count({
    where: { courseProgressId: progress.id, completedAt: { not: null } },
  });
  const percent =
    course.lessons.length === 0
      ? 0
      : Math.round((completedCount / course.lessons.length) * 100);

  const updated = await prisma.courseProgress.update({
    where: { id: progress.id },
    data: {
      percentComplete: percent,
      completedAt: percent >= 100 ? new Date() : null,
      certificateIssuedAt:
        percent >= 100 && course.certificateEnabled && !progress.certificateIssuedAt
          ? new Date()
          : progress.certificateIssuedAt,
    },
  });

  return ok({
    percentComplete: updated.percentComplete,
    completedAt: updated.completedAt,
    certificateIssuedAt: updated.certificateIssuedAt,
  });
});
