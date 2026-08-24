import { prisma } from '@/lib/db';
import {
  assertSameOrigin,
  created,
  enforceRateLimit,
  ok,
  paginationFrom,
  parseBody,
  route,
} from '@/lib/api';
import { requireUser } from '@/lib/auth/context';
import { prayerRequestSchema } from '@/lib/validation';
import { assertFeatureEnabled, getFlag } from '@/lib/domain/settings';
import { ApiError } from '@/lib/api';

export const dynamic = 'force-dynamic';

/**
 * The prayer wall.
 *
 * A public request shows only what its author chose to make public, and an
 * anonymous request shows no author at all. Private requests are visible to
 * their author alone; ministry-team requests additionally to the pastoral team.
 */
export const GET = route(async (request: Request) => {
  const context = await requireUser();
  const { take, skip } = paginationFrom(request, 20, 50);
  const url = new URL(request.url);
  const scope = url.searchParams.get('scope') ?? 'public';

  const isMinistryTeam = context.roles.some((role) =>
    ['COUNSELLOR', 'PASTOR', 'MINISTRY_LEADER', 'ADMIN', 'SENIOR_LEADERSHIP_ADMIN', 'SUPER_ADMIN'].includes(role),
  );

  const where =
    scope === 'mine'
      ? { authorId: context.user.id, deletedAt: null }
      : scope === 'ministry' && isMinistryTeam
        ? { visibility: 'MINISTRY_TEAM_ONLY' as const, deletedAt: null }
        : { visibility: 'PUBLIC' as const, deletedAt: null };

  const [rows, total] = await Promise.all([
    prisma.prayerRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      include: {
        author: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
        interactions: { where: { userId: context.user.id }, select: { id: true } },
      },
    }),
    prisma.prayerRequest.count({ where }),
  ]);

  return ok({
    total,
    prayers: rows.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      category: row.category,
      visibility: row.visibility,
      prayerCount: row.prayerCount,
      createdAt: row.createdAt,
      answeredAt: row.answeredAt,
      isMine: row.authorId === context.user.id,
      hasPrayed: row.interactions.length > 0,
      // Anonymity is honoured at the API boundary, not merely in the interface.
      author: row.isAnonymous
        ? { displayName: 'A member of the fellowship', avatarUrl: null }
        : {
            displayName: row.author.profile?.displayName ?? 'Member',
            avatarUrl: row.author.profile?.avatarUrl ?? null,
          },
    })),
  });
});

export const POST = route(async (request: Request) => {
  assertSameOrigin(request);
  const context = await requireUser();
  await enforceRateLimit('prayerRequest', `user:${context.user.id}`);
  const input = await parseBody(request, prayerRequestSchema);

  if (input.visibility === 'PUBLIC' && !(await getFlag('prayer.public_enabled'))) {
    throw new ApiError(
      503,
      'feature_disabled',
      'The public prayer wall is temporarily unavailable. You can still submit a private request.',
    );
  }

  const prayer = await prisma.prayerRequest.create({
    data: {
      authorId: context.user.id,
      title: input.title,
      body: input.body,
      category: input.category,
      visibility: input.visibility,
      isAnonymous: input.isAnonymous,
    },
  });

  return created({
    prayer: { id: prayer.id, visibility: prayer.visibility, createdAt: prayer.createdAt },
    message:
      input.visibility === 'PUBLIC'
        ? 'Your prayer request has been shared with the fellowship.'
        : 'Your prayer request has been received.',
  });
});
