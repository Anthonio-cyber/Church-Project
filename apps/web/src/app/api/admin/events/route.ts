import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, assertSameOrigin, created, ok, parseBody, route } from '@/lib/api';
import { requirePermission, requireUser } from '@/lib/auth/context';
import { AUDIT, writeAudit } from '@/lib/audit';
import { notify } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  await requirePermission('events.edit');
  const events = await prisma.event.findMany({
    orderBy: { startsAt: 'desc' },
    take: 100,
    include: {
      ministryCenter: { select: { name: true } },
      _count: { select: { registrations: true } },
    },
  });
  return ok({ events });
});

const eventSchema = z.object({
  title: z.string().trim().min(3).max(160),
  slug: z.string().trim().min(3).max(160).regex(/^[a-z0-9-]+$/),
  description: z.string().trim().min(10).max(4000),
  category: z.string().trim().min(2).max(60),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional().or(z.literal('')),
  mode: z.enum(['PHYSICAL', 'ONLINE', 'HYBRID']).default('PHYSICAL'),
  location: z.string().trim().max(240).optional().or(z.literal('')),
  onlineUrl: z.string().url().max(600).optional().or(z.literal('')),
  speaker: z.string().trim().max(120).optional().or(z.literal('')),
  bannerUrl: z.string().url().max(600).optional().or(z.literal('')),
  capacity: z.number().int().min(1).max(1000000).optional(),
  registrationDeadline: z.string().datetime().optional().or(z.literal('')),
  visibility: z.enum(['PUBLIC', 'MEMBERS_ONLY', 'MINISTRY_CENTER', 'LEADERSHIP_ONLY']).default('PUBLIC'),
  ministryCenterId: z.string().uuid().optional(),
});

export const POST = route(async (request: Request) => {
  assertSameOrigin(request);
  const context = await requirePermission('events.create');
  const input = await parseBody(request, eventSchema);

  const existing = await prisma.event.findUnique({ where: { slug: input.slug } });
  if (existing) throw new ApiError(409, 'slug_taken', 'That web address is already in use.');

  const event = await prisma.event.create({
    data: {
      title: input.title,
      slug: input.slug,
      description: input.description,
      category: input.category,
      startsAt: new Date(input.startsAt),
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      mode: input.mode,
      location: input.location || null,
      onlineUrl: input.onlineUrl || null,
      speaker: input.speaker || null,
      bannerUrl: input.bannerUrl || null,
      capacity: input.capacity ?? null,
      registrationDeadline: input.registrationDeadline ? new Date(input.registrationDeadline) : null,
      visibility: input.visibility,
      ministryCenterId: input.ministryCenterId ?? null,
      status: 'DRAFT',
      createdById: context.user.id,
    },
  });

  await writeAudit({
    actorId: context.user.id,
    actorEmail: context.user.email,
    actorRole: context.roles.join(','),
    action: 'ADMIN_EVENT_CREATED',
    targetType: 'event',
    targetId: event.id,
    ipAddress: context.ipAddress,
  });

  return created({ event, message: 'Event draft created.' });
});

const patchSchema = z.object({
  eventId: z.string().uuid(),
  action: z.enum(['publish', 'unpublish', 'cancel', 'duplicate', 'send_reminder']),
  reason: z.string().trim().max(500).optional(),
});

export const PATCH = route(async (request: Request) => {
  assertSameOrigin(request);
  const base = await requireUser();
  const input = await parseBody(request, patchSchema);

  const permission =
    input.action === 'cancel'
      ? 'events.cancel'
      : input.action === 'publish' || input.action === 'unpublish'
        ? 'events.publish'
        : input.action === 'send_reminder'
          ? 'announcements.send'
          : 'events.create';

  const context = await requirePermission(permission, { context: base });

  const event = await prisma.event.findUnique({ where: { id: input.eventId } });
  if (!event) throw new ApiError(404, 'not_found', 'That event could not be found.');

  const auditBase = {
    actorId: context.user.id,
    actorEmail: context.user.email,
    actorRole: context.roles.join(','),
    targetType: 'event',
    targetId: event.id,
    reason: input.reason ?? null,
    ipAddress: context.ipAddress,
  };

  switch (input.action) {
    case 'publish': {
      await prisma.event.update({
        where: { id: event.id },
        data: { status: 'PUBLISHED', publishedAt: new Date() },
      });
      await writeAudit({ ...auditBase, action: AUDIT.EVENT_PUBLISHED });
      return ok({ message: 'Event published.' });
    }
    case 'unpublish': {
      await prisma.event.update({ where: { id: event.id }, data: { status: 'DRAFT' } });
      await writeAudit({ ...auditBase, action: 'ADMIN_EVENT_UNPUBLISHED' });
      return ok({ message: 'Event unpublished.' });
    }
    case 'cancel': {
      if (!input.reason || input.reason.trim().length < 8) {
        throw new ApiError(400, 'reason_required', 'Tell registrants why the event is cancelled.');
      }
      await prisma.event.update({
        where: { id: event.id },
        data: { cancelledAt: new Date(), cancelReason: input.reason, status: 'ARCHIVED' },
      });
      const registrations = await prisma.eventRegistration.findMany({
        where: { eventId: event.id, status: { in: ['REGISTERED', 'WAITLISTED'] } },
        select: { userId: true },
      });
      for (const registration of registrations) {
        await notify({
          userId: registration.userId,
          category: 'EVENT',
          title: `${event.title} has been cancelled`,
          body: input.reason,
          link: '/app/events',
          push: true,
        });
      }
      await writeAudit({
        ...auditBase,
        action: AUDIT.EVENT_CANCELLED,
        metadata: { notified: registrations.length },
      });
      return ok({ message: `Event cancelled and ${registrations.length} registrant(s) notified.` });
    }
    case 'duplicate': {
      const copy = await prisma.event.create({
        data: {
          title: `${event.title} (copy)`,
          slug: `${event.slug}-copy-${Date.now().toString(36)}`,
          description: event.description,
          category: event.category,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          mode: event.mode,
          location: event.location,
          onlineUrl: event.onlineUrl,
          speaker: event.speaker,
          bannerUrl: event.bannerUrl,
          capacity: event.capacity,
          visibility: event.visibility,
          ministryCenterId: event.ministryCenterId,
          status: 'DRAFT',
          createdById: context.user.id,
        },
      });
      await writeAudit({ ...auditBase, action: 'ADMIN_EVENT_DUPLICATED', metadata: { copyId: copy.id } });
      return ok({ event: copy, message: 'Event duplicated as a draft.' });
    }
    case 'send_reminder': {
      const registrations = await prisma.eventRegistration.findMany({
        where: { eventId: event.id, status: 'REGISTERED' },
        select: { userId: true },
      });
      const whenLabel = new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'full',
        timeStyle: 'short',
        timeZone: 'UTC',
      }).format(event.startsAt);
      for (const registration of registrations) {
        await notify({
          userId: registration.userId,
          category: 'EVENT',
          title: `Reminder: ${event.title}`,
          body: `${whenLabel} UTC`,
          link: '/app/events',
          push: true,
          email: { subject: `Reminder: ${event.title}`, text: `${event.title} — ${whenLabel} UTC.` },
        });
      }
      await writeAudit({
        ...auditBase,
        action: 'ADMIN_EVENT_REMINDER_SENT',
        metadata: { recipients: registrations.length },
      });
      return ok({ message: `Reminder sent to ${registrations.length} registrant(s).` });
    }
  }
});
