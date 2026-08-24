import { prisma } from '@/lib/db';
import { ApiError, ok, route } from '@/lib/api';
import { getAuthContext } from '@/lib/auth/context';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string }> };

export const GET = route(async (_request: Request, { params }: Params) => {
  const { slug } = await params;
  const context = await getAuthContext();

  const course = await prisma.course.findUnique({
    where: { slug },
    include: { lessons: { orderBy: { orderIndex: 'asc' } } },
  });

  if (!course || course.status !== 'PUBLISHED') {
    throw new ApiError(404, 'not_found', 'That course could not be found.');
  }
  if (course.visibility !== 'PUBLIC' && !context) {
    throw new ApiError(401, 'unauthenticated', 'Please sign in to open this course.');
  }
  if (course.visibility === 'LEADERSHIP_ONLY' && !context?.isStaff) {
    throw new ApiError(403, 'forbidden', 'This course is limited to ministry leadership.');
  }

  const progress = context
    ? await prisma.courseProgress.findUnique({
        where: { userId_courseId: { userId: context.user.id, courseId: course.id } },
        include: { lessons: true },
      })
    : null;

  const completedLessonIds = new Set(
    (progress?.lessons ?? []).filter((l) => l.completedAt).map((l) => l.lessonId),
  );

  return ok({
    course: {
      id: course.id,
      slug: course.slug,
      title: course.title,
      track: course.track,
      summary: course.summary,
      description: course.description,
      difficulty: course.difficulty,
      authorName: course.authorName,
      scriptureRefs: course.scriptureRefs,
      certificateEnabled: course.certificateEnabled,
      lessons: course.lessons.map((lesson) => ({
        id: lesson.id,
        orderIndex: lesson.orderIndex,
        title: lesson.title,
        summary: lesson.summary,
        // Lesson bodies are returned only to signed-in members; the public
        // catalogue shows the outline, not the teaching itself.
        body: context ? lesson.body : null,
        videoUrl: context ? lesson.videoUrl : null,
        audioUrl: context ? lesson.audioUrl : null,
        pdfUrl: context ? lesson.pdfUrl : null,
        scriptureRefs: lesson.scriptureRefs,
        estimatedMinutes: lesson.estimatedMinutes,
        hasQuiz: Boolean(lesson.quiz),
        completed: completedLessonIds.has(lesson.id),
      })),
    },
    progress: progress
      ? { percentComplete: progress.percentComplete, completedAt: progress.completedAt }
      : null,
  });
});
