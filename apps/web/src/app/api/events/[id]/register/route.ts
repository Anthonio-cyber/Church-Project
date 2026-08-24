import { prisma } from '@/lib/db';
import { ApiError, assertSameOrigin, ok, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/context';
import { notify } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export const POST = route(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { id } = await params;
  const context = await requireUser();

  const event = await prisma.event.findUnique({
    where: { id },
    include: { _count: { select: { registrations: { where: { status: 'REGISTERED' } } } } },
  });

  if (!event || event.status !== 'PUBLISHED') {
    throw new ApiError(404, 'not_found', 'That event could not be found.');
  }
  if (event.cancelledAt) {
    throw new ApiError(409, 'event_cancelled', 'This event has been cancelled.');
  }
  if (event.registrationDeadline && event.registrationDeadline < new Date()) {
    throw new ApiError(409, 'registration_closed', 'Registration for this event has closed.');
  }

  const atCapacity =
    event.capacity !== null && event._count.registrations >= event.capacity;

  const registration = await prisma.eventRegistration.upsert({
    where: { eventId_userId: { eventId: id, userId: context.user.id } },
    create: {
      eventId: id,
      userId: context.user.id,
      status: atCapacity ? 'WAITLISTED' : 'REGISTERED',
    },
    update: { status: atCapacity ? 'WAITLISTED' : 'REGISTERED' },
  });

  await notify({
    userId: context.user.id,
    category: 'EVENT',
    title: atCapacity ? 'You are on the waiting list' : 'You are registered',
    body: `${event.title} — ${new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeStyle: 'short', timeZone: 'UTC' }).format(event.startsAt)} UTC`,
    link: '/app/events',
  });

  return ok({
    status: registration.status,
    message: atCapacity
      ? 'This event is full. You have been added to the waiting list.'
      : 'You are registered. A reminder will be sent before the event.',
    onlineUrl: registration.status === 'REGISTERED' ? event.onlineUrl : null,
  });
});

export const DELETE = route(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { id } = await params;
  const context = await requireUser();

  await prisma.eventRegistration
    .update({
      where: { eventId_userId: { eventId: id, userId: context.user.id } },
      data: { status: 'CANCELLED' },
    })
    .catch(() => undefined);

  return ok({ message: 'Your registration has been cancelled.' });
});
