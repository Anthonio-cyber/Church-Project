import { prisma } from '@/lib/db';
import { ok, route } from '@/lib/api';
import { getAuthContext } from '@/lib/auth/context';

export const dynamic = 'force-dynamic';

export const GET = route(async (request: Request) => {
  const context = await getAuthContext();
  const url = new URL(request.url);
  const scope = url.searchParams.get('scope') ?? 'upcoming';

  const visibility = context
    ? (['PUBLIC', 'MEMBERS_ONLY', 'MINISTRY_CENTER'] as const)
    : (['PUBLIC'] as const);

  const events = await prisma.event.findMany({
    where: {
      status: 'PUBLISHED',
      visibility: { in: [...visibility] },
      cancelledAt: null,
      ...(scope === 'past'
        ? { startsAt: { lt: new Date() } }
        : { startsAt: { gte: new Date() } }),
    },
    orderBy: { startsAt: scope === 'past' ? 'desc' : 'asc' },
    take: 50,
    include: {
      ministryCenter: { select: { name: true, city: true, country: true } },
      _count: { select: { registrations: { where: { status: 'REGISTERED' } } } },
      ...(context
        ? { registrations: { where: { userId: context.user.id }, take: 1 } }
        : {}),
    },
  });

  return ok({
    events: events.map((event) => ({
      id: event.id,
      slug: event.slug,
      title: event.title,
      description: event.description,
      category: event.category,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      mode: event.mode,
      location: event.location,
      speaker: event.speaker,
      bannerUrl: event.bannerUrl,
      capacity: event.capacity,
      registrationDeadline: event.registrationDeadline,
      registeredCount: event._count.registrations,
      spacesRemaining:
        event.capacity === null ? null : Math.max(0, event.capacity - event._count.registrations),
      ministryCenter: event.ministryCenter,
      // The joining link is released only to registered members, and only for
      // events that have not been cancelled.
      onlineUrl:
        context && 'registrations' in event && Array.isArray(event.registrations) && event.registrations.length > 0
          ? event.onlineUrl
          : null,
      isRegistered:
        context && 'registrations' in event && Array.isArray(event.registrations)
          ? event.registrations.length > 0
          : false,
    })),
  });
});
