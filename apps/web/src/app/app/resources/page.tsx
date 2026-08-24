import type { Metadata } from 'next';
import Link from 'next/link';
import type { Visibility } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requirePageUser } from '@/lib/auth/guard';
import { AppPageHeader } from '@/components/app/AppShell';
import { Badge, Card, EmptyState } from '@/components/ui';
import { formatDate, titleCase } from '@/lib/format';

export const metadata: Metadata = { title: 'Resources' };
export const dynamic = 'force-dynamic';

export default async function ResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; topic?: string }>;
}) {
  const context = await requirePageUser('/app/resources');
  const params = await searchParams;
  const query = params.q?.trim();

  // Members see public and members-only material. Search never reaches
  // counselling records, messages, notes or private prayer — none of those are
  // in this query, and there is no parameter that would add them.
  const where = {
    status: 'PUBLISHED' as const,
    visibility: {
      in: context.isStaff
        ? (['PUBLIC', 'MEMBERS_ONLY', 'MINISTRY_CENTER', 'LEADERSHIP_ONLY'] as Visibility[])
        : (['PUBLIC', 'MEMBERS_ONLY', 'MINISTRY_CENTER'] as Visibility[]),
    },
    ...(params.type ? { type: params.type as never } : {}),
    ...(params.topic ? { topic: params.topic } : {}),
    ...(query
      ? {
          OR: [
            { title: { contains: query, mode: 'insensitive' as const } },
            { description: { contains: query, mode: 'insensitive' as const } },
            { tags: { has: query.toLowerCase() } },
          ],
        }
      : {}),
  };

  const [resources, topics] = await Promise.all([
    prisma.resource.findMany({ where, orderBy: { publishedAt: 'desc' }, take: 60 }),
    prisma.resource.findMany({
      where: { status: 'PUBLISHED' },
      select: { topic: true },
      distinct: ['topic'],
    }),
  ]);

  return (
    <>
      <AppPageHeader
        eyebrow="Library"
        title="Resources"
        description="Sermons, Bible studies, articles, devotionals, prayer guides and discipleship material."
      />

      <form method="get" className="mb-8 flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="q" className="label">
            Search
          </label>
          <input id="q" name="q" type="search" defaultValue={query ?? ''} className="input" />
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
          icon="❖"
          title={query ? 'Nothing matched that search' : 'No resources yet'}
          description={
            query
              ? 'Try a different word, or clear the filters.'
              : 'Resources appear here once the content team publishes them.'
          }
          action={
            query ? (
              <Link
                href="/app/resources"
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
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge tone="gold">{titleCase(resource.type)}</Badge>
                {resource.visibility !== 'PUBLIC' ? <Badge>Members</Badge> : null}
              </div>
              <h2 className="font-serif text-lg font-semibold">{resource.title}</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-600 dark:text-parchment-300">
                {resource.description}
              </p>
              {resource.scriptureRefs.length > 0 ? (
                <p className="mt-3 text-xs italic text-gold-700 dark:text-gold-400">
                  {resource.scriptureRefs.join(' · ')}
                </p>
              ) : null}
              <div className="mt-4 flex items-center justify-between text-xs text-ink-500 dark:text-parchment-400">
                <span>{resource.speaker ?? resource.topic}</span>
                <span>{resource.publishedAt ? formatDate(resource.publishedAt) : ''}</span>
              </div>
              {resource.mediaUrl ? (
                <a
                  href={resource.mediaUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-4 text-sm font-semibold text-gold-700 underline-offset-4 hover:underline dark:text-gold-400"
                >
                  Open →
                </a>
              ) : null}
            </Card>
          ))}
        </ul>
      )}
    </>
  );
}
