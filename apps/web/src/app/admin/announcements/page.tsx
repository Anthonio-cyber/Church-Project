import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/auth/guard';
import { AppPageHeader } from '@/components/app/AppShell';
import { AnnouncementComposer } from '@/components/app/AnnouncementComposer';

export const metadata: Metadata = { title: 'Announcements' };
export const dynamic = 'force-dynamic';

export default async function AdminAnnouncementsPage() {
  await requirePagePermission(['announcements.send'], '/admin/announcements');

  const [announcements, centers, countries] = await Promise.all([
    prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { ministryCenter: { select: { name: true } } },
    }),
    prisma.ministryCenter.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.profile.findMany({
      where: { country: { not: null } },
      select: { country: true },
      distinct: ['country'],
    }),
  ]);

  return (
    <>
      <AppPageHeader
        eyebrow="Admin Portal"
        title="Announcements"
        description="Ministry communication to members, a country, a centre or a role. Announcements are a category members can switch off — they are not a channel for security notices."
      />

      <AnnouncementComposer
        centers={centers}
        countries={countries.map((row) => row.country).filter(Boolean) as string[]}
        announcements={announcements.map((announcement) => ({
          id: announcement.id,
          title: announcement.title,
          body: announcement.body,
          audienceRole: announcement.audienceRole,
          audienceCountry: announcement.audienceCountry,
          ministryCenter: announcement.ministryCenter?.name ?? null,
          channels: announcement.channels,
          status: announcement.status,
          scheduledFor: announcement.scheduledFor?.toISOString() ?? null,
          sentAt: announcement.sentAt?.toISOString() ?? null,
          createdAt: announcement.createdAt.toISOString(),
        }))}
      />
    </>
  );
}
