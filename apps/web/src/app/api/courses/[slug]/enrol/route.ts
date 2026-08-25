import { prisma } from '@/lib/db';
import { ApiError, assertSameOrigin, created, ok, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/context';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string }> };

/**
 * Find a course this member is allowed to enrol on, or refuse.
 *
 * Visibility is checked here rather than left to the page, so that enrolling
 * cannot become a way around a restriction the page enforces.
 */
async function enrollableCourse(slug: string, isStaff: boolean) {
  const course = await prisma.course.findUnique({
    where: { slug },
    select: { id: true, status: true, visibility: true, title: true },
  });

  if (!course || course.status !== 'PUBLISHED') {
    throw new ApiError(404, 'not_found', 'That course could not be found.');
  }
  if (course.visibility === 'LEADERSHIP_ONLY' && !isStaff) {
    throw new ApiError(403, 'not_permitted', 'This material is limited to ministry leadership.');
  }
  return course;
}

/** Enrol on a course. Idempotent: enrolling twice is not an error. */
export const POST = route(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { slug } = await params;
  const context = await requireUser();
  const course = await enrollableCourse(slug, context.isStaff);

  const progress = await prisma.courseProgress.upsert({
    where: { userId_courseId: { userId: context.user.id, courseId: course.id } },
    create: { userId: context.user.id, courseId: course.id },
    update: { lastActivityAt: new Date() },
    select: { id: true, startedAt: true, percentComplete: true },
  });

  return created({
    enrolled: true,
    startedAt: progress.startedAt,
    percentComplete: progress.percentComplete,
    message: `You are enrolled on ${course.title}.`,
  });
});

/**
 * Leave a course.
 *
 * Deleting the enrolment takes the lesson progress with it, by cascade. That
 * is the honest behaviour for "I am not doing this course": leaving a hidden
 * record of what someone once studied would be a small betrayal of a platform
 * that promises members control over their own data. Enrolling again starts
 * from the beginning, which the interface says before this is called.
 */
export const DELETE = route(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { slug } = await params;
  const context = await requireUser();

  const course = await prisma.course.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!course) {
    throw new ApiError(404, 'not_found', 'That course could not be found.');
  }

  await prisma.courseProgress.deleteMany({
    where: { userId: context.user.id, courseId: course.id },
  });

  return ok({ enrolled: false, message: 'You have left this course.' });
});
