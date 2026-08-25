import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requirePageUser } from '@/lib/auth/guard';
import { AppPageHeader } from '@/components/app/AppShell';
import { LessonList } from '@/components/app/LessonList';
import { CourseEnrolment } from '@/components/app/CourseEnrolment';
import { Badge, PermissionDenied } from '@/components/ui';

export const metadata: Metadata = { title: 'Course' };
export const dynamic = 'force-dynamic';

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const context = await requirePageUser(`/app/discipleship/${slug}`);

  const course = await prisma.course.findUnique({
    where: { slug },
    include: { lessons: { orderBy: { orderIndex: 'asc' } } },
  });

  if (!course || course.status !== 'PUBLISHED') notFound();

  if (course.visibility === 'LEADERSHIP_ONLY' && !context.isStaff) {
    return (
      <PermissionDenied
        what="this course"
        detail="This material is limited to ministry leadership."
      />
    );
  }

  const progress = await prisma.courseProgress.findUnique({
    where: { userId_courseId: { userId: context.user.id, courseId: course.id } },
    include: { lessons: true },
  });

  const completedIds = new Set(
    (progress?.lessons ?? []).filter((lesson) => lesson.completedAt).map((lesson) => lesson.lessonId),
  );

  return (
    <div className="mx-auto max-w-3xl">
      <AppPageHeader
        eyebrow={course.track}
        title={course.title}
        description={course.description}
      />

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <Badge tone="gold">{course.difficulty}</Badge>
        <Badge>{course.lessons.length} lessons</Badge>
        <Badge>{course.authorName}</Badge>
        {course.certificateEnabled ? <Badge tone="positive">Certificate on completion</Badge> : null}
      </div>

      {progress ? (
        <div className="mb-8 rounded-xl border border-ink-200 bg-white p-5 dark:border-ink-800 dark:bg-ink-900">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Your progress</span>
            <span className="font-semibold tabular-nums">{progress.percentComplete}%</span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={progress.percentComplete}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Course progress"
            className="mt-3 h-2.5 overflow-hidden rounded-full bg-ink-200 dark:bg-ink-800"
          >
            <div
              className="h-full rounded-full bg-gold-sheen"
              style={{ width: `${progress.percentComplete}%` }}
            />
          </div>
          {progress.certificateIssuedAt ? (
            <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">
              Completed on {progress.completedAt?.toLocaleDateString()} — certificate issued.
            </p>
          ) : null}
        </div>
      ) : null}

      {course.scriptureRefs.length > 0 ? (
        <p className="mb-8 text-sm italic text-gold-700 dark:text-gold-400">
          {course.scriptureRefs.join(' · ')}
        </p>
      ) : null}

      {progress ? (
        <>
          <LessonList
            courseSlug={course.slug}
            lessons={course.lessons.map((lesson) => ({
              id: lesson.id,
              orderIndex: lesson.orderIndex,
              title: lesson.title,
              summary: lesson.summary,
              body: lesson.body,
              scriptureRefs: lesson.scriptureRefs,
              estimatedMinutes: lesson.estimatedMinutes,
              videoUrl: lesson.videoUrl,
              audioUrl: lesson.audioUrl,
              pdfUrl: lesson.pdfUrl,
              completed: completedIds.has(lesson.id),
            }))}
          />
          <div className="mt-8 text-center">
            <CourseEnrolment
              courseSlug={course.slug}
              enrolled
              lessonCount={course.lessons.length}
            />
          </div>
        </>
      ) : (
        <>
          <CourseEnrolment
            courseSlug={course.slug}
            enrolled={false}
            lessonCount={course.lessons.length}
          />

          {/* What the course covers, without giving away the teaching itself.
              The lesson bodies and any linked video are not sent to the browser
              at all until someone has enrolled — hiding them with CSS would
              leave them in the page source. */}
          <section className="mt-8">
            <h2 className="mb-4 font-serif text-xl font-semibold">What you will cover</h2>
            <ol className="space-y-3">
              {course.lessons.map((lesson) => (
                <li
                  key={lesson.id}
                  className="flex gap-4 rounded-xl border border-ink-200/70 bg-white px-5 py-4 dark:border-ink-800 dark:bg-ink-900"
                >
                  <span className="font-mono text-sm text-gold-700 dark:text-gold-500">
                    {String(lesson.orderIndex + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium">{lesson.title}</p>
                    <p className="mt-1 text-sm text-ink-600 dark:text-parchment-300">
                      {lesson.summary}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </div>
  );
}
