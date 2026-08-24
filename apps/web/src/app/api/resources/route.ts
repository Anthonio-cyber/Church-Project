import { prisma } from '@/lib/db';
import { ok, paginationFrom, route } from '@/lib/api';
import { getAuthContext } from '@/lib/auth/context';

export const dynamic = 'force-dynamic';

/**
 * Resource library search.
 *
 * Search only ever spans published content the caller is entitled to see.
 * Counselling records, private messages, prayer requests and internal notes are
 * not in this index and have no code path that could put them there.
 */
export const GET = route(async (request: Request) => {
  const context = await getAuthContext();
  const { take, skip } = paginationFrom(request, 24, 60);
  const url = new URL(request.url);

  const query = url.searchParams.get('q')?.trim();
  const type = url.searchParams.get('type');
  const topic = url.searchParams.get('topic');
  const speaker = url.searchParams.get('speaker');
  const language = url.searchParams.get('language');
  const difficulty = url.searchParams.get('difficulty');

  const visibility = context
    ? (['PUBLIC', 'MEMBERS_ONLY', 'MINISTRY_CENTER'] as const)
    : (['PUBLIC'] as const);

  const where = {
    status: 'PUBLISHED' as const,
    visibility: { in: [...visibility] },
    ...(type ? { type: type as never } : {}),
    ...(topic ? { topic } : {}),
    ...(speaker ? { speaker } : {}),
    ...(language ? { language } : {}),
    ...(difficulty ? { difficulty } : {}),
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

  const [rows, total, topics, speakers] = await Promise.all([
    prisma.resource.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      take,
      skip,
      include: { ministryCenter: { select: { name: true } } },
    }),
    prisma.resource.count({ where }),
    prisma.resource.findMany({
      where: { status: 'PUBLISHED' },
      select: { topic: true },
      distinct: ['topic'],
    }),
    prisma.resource.findMany({
      where: { status: 'PUBLISHED', speaker: { not: null } },
      select: { speaker: true },
      distinct: ['speaker'],
    }),
  ]);

  return ok({
    total,
    filters: {
      topics: topics.map((row) => row.topic).sort(),
      speakers: speakers.map((row) => row.speaker).filter(Boolean).sort(),
    },
    resources: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      type: row.type,
      topic: row.topic,
      speaker: row.speaker,
      language: row.language,
      difficulty: row.difficulty,
      durationMinutes: row.durationMinutes,
      thumbnailUrl: row.thumbnailUrl,
      scriptureRefs: row.scriptureRefs,
      publishedAt: row.publishedAt,
      ministryCenter: row.ministryCenter?.name ?? null,
      // Media links are withheld from anonymous visitors for members-only items.
      mediaUrl: row.visibility === 'PUBLIC' || context ? row.mediaUrl : null,
    })),
  });
});
