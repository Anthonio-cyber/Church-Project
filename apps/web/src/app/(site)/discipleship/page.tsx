import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { PageHero } from '@/components/site/SiteChrome';
import { ButtonLink, Card, EmptyState } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Discipleship',
  description: 'Structured biblical teaching: foundations, prayer, character, the Holy Spirit, evangelism, leadership and ministry training.',
};

export const dynamic = 'force-dynamic';

const TRACKS = [
  { name: 'Bible Study', body: 'Book-by-book study with scripture references and reflection.' },
  { name: 'Foundations of Faith', body: 'Repentance, faith, baptism, the new birth and assurance.' },
  { name: 'Prayer', body: 'Learning to pray: intercession, fasting, praying the Scriptures.' },
  { name: 'Spiritual Growth', body: 'Walking with God over time, in ordinary life.' },
  { name: 'Christian Character', body: 'The fruit of the Spirit and the shaping of a life.' },
  { name: 'Holy Spirit', body: 'The person, work and gifts of the Spirit in the church.' },
  { name: 'Evangelism', body: 'Sharing the gospel clearly, faithfully and personally.' },
  { name: 'Discipleship', body: 'Making disciples: how one believer helps another mature.' },
  { name: 'Leadership', body: 'Servant leadership, character and accountability in ministry.' },
  { name: 'Ministry Training', body: 'Practical preparation for those serving in the church.' },
  { name: 'Apostolic Christianity', body: 'The faith of the apostles and its outworking today.' },
  { name: 'Missions', body: 'The heart of God for the nations, and the sending of the church.' },
];

export default async function DiscipleshipPage() {
  const courses = await prisma.course
    .findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { title: 'asc' },
      select: {
        id: true,
        slug: true,
        title: true,
        track: true,
        summary: true,
        difficulty: true,
        visibility: true,
        _count: { select: { lessons: true } },
      },
    })
    .catch(() => []);

  return (
    <>
      <PageHero
        eyebrow="Discipleship"
        title="Grow in the knowledge of God"
        description="Courses with lessons, scripture references, media and quizzes — with your progress saved so you can return where you left off."
      >
        <ButtonLink href="/register">Start learning</ButtonLink>
      </PageHero>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="mb-8 font-serif text-2xl font-semibold">Tracks</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TRACKS.map((track) => (
            <div
              key={track.name}
              className="rounded-xl border border-ink-200/70 bg-white p-5 dark:border-ink-800 dark:bg-ink-900"
            >
              <h3 className="font-serif text-base font-semibold text-gold-800 dark:text-gold-300">
                {track.name}
              </h3>
              <p className="mt-1.5 text-sm text-ink-600 dark:text-parchment-300">{track.body}</p>
            </div>
          ))}
        </div>

        <h2 className="mb-8 mt-16 font-serif text-2xl font-semibold">Published courses</h2>
        {courses.length === 0 ? (
          <EmptyState
            icon="📖"
            title="No courses have been published yet"
            description="Courses appear here once the content team publishes them from the administration portal."
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <Card key={course.id} as="article" className="flex flex-col">
                <p className="eyebrow">{course.track}</p>
                <h3 className="mt-2 font-serif text-lg font-semibold">{course.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-600 dark:text-parchment-300">
                  {course.summary}
                </p>
                <p className="mt-4 text-xs text-ink-500 dark:text-parchment-400">
                  {course._count.lessons} lesson{course._count.lessons === 1 ? '' : 's'} ·{' '}
                  {course.difficulty}
                  {course.visibility !== 'PUBLIC' ? ' · Members only' : ''}
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
