import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requirePageUser } from '@/lib/auth/guard';
import { AppPageHeader } from '@/components/app/AppShell';
import { Badge, Card, EmptyState } from '@/components/ui';

export const metadata: Metadata = { title: 'Discipleship' };
export const dynamic = 'force-dynamic';

export default async function DiscipleshipPage() {
  const context = await requirePageUser('/app/discipleship');

  const courses = await prisma.course.findMany({
    where: {
      status: 'PUBLISHED',
      visibility: { in: ['PUBLIC', 'MEMBERS_ONLY', 'MINISTRY_CENTER'] },
    },
    orderBy: [{ track: 'asc' }, { title: 'asc' }],
    include: {
      _count: { select: { lessons: true } },
      progress: { where: { userId: context.user.id }, take: 1 },
    },
  });

  const inProgress = courses.filter(
    (course) => course.progress[0] && !course.progress[0].completedAt,
  );
  const completed = courses.filter((course) => course.progress[0]?.completedAt);
  const available = courses.filter((course) => !course.progress[0]);

  function CourseCard({ course }: { course: (typeof courses)[number] }) {
    const progress = course.progress[0];
    return (
      <Card as="li" className="flex flex-col">
        <div className="mb-2 flex items-center gap-2">
          <Badge tone="gold">{course.track}</Badge>
          {progress?.certificateIssuedAt ? <Badge tone="positive">Certificate</Badge> : null}
        </div>
        <h3 className="font-serif text-lg font-semibold">{course.title}</h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-600 dark:text-parchment-300">
          {course.summary}
        </p>

        {progress ? (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-600 dark:text-parchment-300">Progress</span>
              <span className="font-semibold tabular-nums">{progress.percentComplete}%</span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={progress.percentComplete}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${course.title} progress`}
              className="mt-2 h-2 overflow-hidden rounded-full bg-ink-200 dark:bg-ink-800"
            >
              <div
                className="h-full rounded-full bg-gold-sheen"
                style={{ width: `${progress.percentComplete}%` }}
              />
            </div>
          </div>
        ) : (
          <p className="mt-4 text-xs text-ink-500 dark:text-parchment-400">
            {course._count.lessons} lesson{course._count.lessons === 1 ? '' : 's'} ·{' '}
            {course.difficulty}
          </p>
        )}

        <Link
          href={`/app/discipleship/${course.slug}`}
          className="mt-4 text-sm font-semibold text-gold-700 underline-offset-4 hover:underline dark:text-gold-400"
        >
          {progress ? 'Continue' : 'Start course'} →
        </Link>
      </Card>
    );
  }

  return (
    <>
      <AppPageHeader
        eyebrow="Discipleship"
        title="Grow in the Word"
        description="Structured courses with lessons, scripture, media and quizzes. Your progress is saved as you go."
      />

      {courses.length === 0 ? (
        <EmptyState
          icon="📖"
          title="No courses are available yet"
          description="Discipleship courses appear here once the content team publishes them."
        />
      ) : (
        <div className="space-y-12">
          {inProgress.length > 0 ? (
            <section>
              <h2 className="mb-5 font-serif text-xl font-semibold">Continue learning</h2>
              <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {inProgress.map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </ul>
            </section>
          ) : null}

          {available.length > 0 ? (
            <section>
              <h2 className="mb-5 font-serif text-xl font-semibold">Available courses</h2>
              <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {available.map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </ul>
            </section>
          ) : null}

          {completed.length > 0 ? (
            <section>
              <h2 className="mb-5 font-serif text-xl font-semibold">Completed</h2>
              <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {completed.map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}
