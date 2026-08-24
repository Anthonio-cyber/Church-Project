import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/auth/guard';
import { AppPageHeader } from '@/components/app/AppShell';
import { EventManager } from '@/components/app/EventManager';

export const metadata: Metadata = { title: 'Events' };
export const dynamic = 'force-dynamic';

export default async function AdminEventsPage() {
  const context = await requirePagePermission(['events.edit', 'events.create'], '/admin/events');

  const [events, centers] = await Promise.all([
    prisma.event.findMany({
      orderBy: { startsAt: 'desc' },
      take: 60,
      include: {
        ministryCenter: { select: { id: true, name: true } },
        _count: { select: { registrations: true } },
      },
    }),
    prisma.ministryCenter.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <>
      <AppPageHeader
        eyebrow="Admin Portal"
        title="Events"
        description="Create, publish, cancel and remind. Cancelling notifies every registrant with the reason you give."
      />

      <EventManager
        canCreate={context.permissions.has('events.create')}
        canPublish={context.permissions.has('events.publish')}
        canCancel={context.permissions.has('events.cancel')}
        canRemind={context.permissions.has('announcements.send')}
        centers={centers}
        events={events.map((event) => ({
          id: event.id,
          slug: event.slug,
          title: event.title,
          description: event.description,
          category: event.category,
          startsAt: event.startsAt.toISOString(),
          mode: event.mode,
          location: event.location,
          speaker: event.speaker,
          capacity: event.capacity,
          status: event.status,
          visibility: event.visibility,
          cancelledAt: event.cancelledAt?.toISOString() ?? null,
          cancelReason: event.cancelReason,
          registrationCount: event._count.registrations,
          ministryCenter: event.ministryCenter?.name ?? null,
        }))}
      />
    </>
  );
}
