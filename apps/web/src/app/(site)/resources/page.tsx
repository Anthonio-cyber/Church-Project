import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { PageHero } from '@/components/site/SiteChrome';
import { Badge, Card, EmptyState } from '@/components/ui';
import { formatDate, titleCase } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Resources',
  description: 'Sermons, Bible studies, articles, devotionals, prayer guides and discipleship material.',
};

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ q?: string; type?: string; topic?: string }>;

export default async function ResourcesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = params.q?.trim();

  // The public library shows only PUBLIC, PUBLISHED material. Members-only
  // resources are reachable from inside the application, and nothing private
  // is searchable here at all.
  const where = {
    status: 'PUBLISHED' as const,
    visibility: 'PUBLIC' as const,
    ...(params.type ? { type: params.type as never } : {}),
    ...(params.topic ? { topic: params.topic } : {}),
    ...(query
      ? {
          OR: [
            { title: { contains: query, mode: 'insensitive' as const } },
            { description: { contains: query, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [resources, topics] = await Promise.all([
    prisma.resource.findMany({ where, orderBy: { publishedAt: 'desc' }, take: 48 }).catch(() => []),
    prisma.resource
      .findMany({
        where: { status: 'PUBLISHED', visibility: 'PUBLIC' },
        select: { topic: true },
        distinct: ['topic'],
      })
      .catch(() => []),
  ]);

  return (
    <>
      <PageHero
        eyebrow="Resources"
        title="Teaching, study and devotion"
        description="A searchable library of sermons, Bible studies, articles, devotionals and prayer guides. Members see additional material once signed in."
      />

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <form method="get" className="mb-10 flex flex-wrap items-end gap-3">
          <div className="min-w-[16rem] flex-1">
            <label htmlFor="q" className="label">
              Search
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={query ?? ''}
              placeholder="Title or description"
              className="input"
            />
          </div>
          <div>
            <label htmlFor="type" className="label">
              Type
            </label>
            <select id="type" name="type" defaultValue={params.type ?? ''} className="input">
              <option value="">All types</option>
              {['SERMON', 'BIBLE_STUDY', 'ARTICLE', 'VIDEO', 'AUDIO', 'PDF', 'DEVOTIONAL', 'PRAYER_GUIDE', 'DISCIPLESHIP_MATERIAL'].map(
                (type) => (
                  <option key={type} value={type}>
                    {titleCase(type)}
                  </option>
                ),
              )}
            </select>
          </div>
          <div>
            <label htmlFor="topic" className="label">
              Topic
            </label>
            <select id="topic" name="topic" defaultValue={params.topic ?? ''} className="input">
              <option value="">All topics</option>
              {topics.map((row) => (
                <option key={row.topic} value={row.topic}>
                  {row.topic}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="min-h-[2.75rem] rounded-lg bg-gold-sheen px-5 text-sm font-semibold text-ink-950"
          >
            Filter
          </button>
        </form>

        {resources.length === 0 ? (
          <EmptyState
            icon="📚"
            title={query ? 'Nothing matched that search' : 'No public resources yet'}
            description={
              query
                ? 'Try a different word, or clear the filters to see everything that is published.'
                : 'Resources appear here once the content team publishes them. Members can also see members-only material after signing in.'
            }
            action={
              query ? (
                <Link
                  href="/resources"
                  className="text-sm font-semibold text-gold-700 underline underline-offset-4 dark:text-gold-400"
                >
                  Clear filters
                </Link>
              ) : null
            }
          />
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {resources.map((resource) => (
              <Card key={resource.id} as="li" className="flex flex-col">
                <div className="mb-3 flex items-center gap-2">
                  <Badge tone="gold">{titleCase(resource.type)}</Badge>
                  <span className="text-xs text-ink-500 dark:text-parchment-400">
                    {resource.topic}
                  </span>
                </div>
                <h2 className="font-serif text-lg font-semibold">{resource.title}</h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-600 dark:text-parchment-300">
                  {resource.description}
                </p>
                <div className="mt-4 flex items-center justify-between text-xs text-ink-500 dark:text-parchment-400">
                  <span>{resource.speaker ?? '—'}</span>
                  <span>{resource.publishedAt ? formatDate(resource.publishedAt) : ''}</span>
                </div>
                {resource.mediaUrl ? (
                  <a
                    href={resource.mediaUrl}
                    rel="noreferrer noopener"
                    target="_blank"
                    className="mt-4 text-sm font-semibold text-gold-700 underline-offset-4 hover:underline dark:text-gold-400"
                  >
                    Open resource →
                  </a>
                ) : null}
              </Card>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
