import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requirePageUser } from '@/lib/auth/guard';
import { AppPageHeader } from '@/components/app/AppShell';
import { PrayerPanel, type PrayerEntry } from '@/components/app/PrayerPanel';

export const metadata: Metadata = { title: 'Prayer' };
export const dynamic = 'force-dynamic';

export default async function PrayerPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const context = await requirePageUser('/app/prayer');
  const params = await searchParams;
  const scope = params.scope === 'mine' ? 'mine' : 'public';

  const rows = await prisma.prayerRequest.findMany({
    where:
      scope === 'mine'
        ? { authorId: context.user.id, deletedAt: null }
        : { visibility: 'PUBLIC', deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      author: { select: { id: true, profile: { select: { displayName: true } } } },
      interactions: { where: { userId: context.user.id }, select: { id: true } },
    },
  });

  const prayers: PrayerEntry[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    category: row.category,
    visibility: row.visibility,
    prayerCount: row.prayerCount,
    createdAt: row.createdAt.toISOString(),
    isMine: row.authorId === context.user.id,
    hasPrayed: row.interactions.length > 0,
    // Anonymity is applied on the server, before the data leaves it.
    authorName: row.isAnonymous
      ? 'A member of the fellowship'
      : (row.author.profile?.displayName ?? 'Member'),
  }));

  return (
    <>
      <AppPageHeader
        eyebrow="Prayer"
        title="Prayer requests"
        description="Share what you are carrying — with the fellowship, with the ministry team, or with no one but yourself and God."
      />
      <PrayerPanel initial={prayers} scope={scope} />
    </>
  );
}
