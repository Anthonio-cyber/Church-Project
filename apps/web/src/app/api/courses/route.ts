import { prisma } from '@/lib/db';
import { ok, route } from '@/lib/api';
import { getAuthContext } from '@/lib/auth/context';

export const dynamic = 'force-dynamic';

/**
 * Discipleship courses.
 *
 * Visibility is resolved server-side from the caller's own state: an anonymous
 * visitor sees only public courses, a member additionally sees members-only
 * material, and ministry-centre material is limited to that centre.
 */
export const GET = route(async (request: Request) => {
  const context = await getAuthContext();
  const url = new URL(request.url);
  const track = url.searchParams.get('track');

  const visibility = context
    ? ['PUBLIC' as const, 'MEMBERS_ONLY' as const, 'MINISTRY_CENTER' as const]
    : ['PUBLIC' as const];

  const courses = await prisma.course.findMany({
    where: {
      status: 'PUBLISHED',
      visibility: { in: visibility },
      ...(track ? { track } : {}),
      ...(context?.ministryCenterId
        ? {}
        : { OR: [{ visibility: { not: 'MINISTRY_CENTER' } }, { ministryCenterId: null }] }),
    },
    orderBy: { title: 'asc' },
    include: {
      _count: { select: { lessons: true } },
      ...(context
        ? { progress: { where: { userId: context.user.id }, take: 1 } }
        : {}),
    },
  });

  return ok({
    courses: courses.map((course) => ({
      id: course.id,
      slug: course.slug,
      title: course.title,
      track: course.track,
      summary: course.summary,
      difficulty: course.difficulty,
      language: course.language,
      authorName: course.authorName,
      thumbnailUrl: course.thumbnailUrl,
      lessonCount: course._count.lessons,
      certificateEnabled: course.certificateEnabled,
      progress:
        'progress' in course && Array.isArray(course.progress) && course.progress.length > 0
          ? {
              percentComplete: course.progress[0]!.percentComplete,
              completedAt: course.progress[0]!.completedAt,
            }
          : null,
    })),
  });
});
