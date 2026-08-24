import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requirePageUser } from '@/lib/auth/guard';
import { AppPageHeader } from '@/components/app/AppShell';
import { ConnectionsPanel, type ConnectionEntry } from '@/components/app/ConnectionsPanel';
import { getFlag } from '@/lib/domain/settings';
import { EmptyState } from '@/components/ui';

export const metadata: Metadata = { title: 'Connections' };
export const dynamic = 'force-dynamic';

export default async function ConnectionsPage() {
  const context = await requirePageUser('/app/connections');
  const enabled = await getFlag('connections.enabled');

  const rows = await prisma.connectionRequest.findMany({
    where: {
      OR: [{ requesterId: context.user.id }, { recipientId: context.user.id }],
      status: { in: ['PENDING', 'ACCEPTED'] },
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      requester: {
        select: { id: true, profile: { select: { displayName: true, avatarUrl: true, country: true } } },
      },
      recipient: {
        select: { id: true, profile: { select: { displayName: true, avatarUrl: true, country: true } } },
      },
    },
  });

  const shape = (row: (typeof rows)[number]): ConnectionEntry => {
    const outgoing = row.requesterId === context.user.id;
    const other = outgoing ? row.recipient : row.requester;
    return {
      id: row.id,
      status: row.status,
      introMessage: row.introMessage,
      createdAt: row.createdAt.toISOString(),
      conversationId: row.conversationId,
      person: {
        id: other.id,
        displayName: other.profile?.displayName ?? 'Member',
        avatarUrl: other.profile?.avatarUrl ?? null,
        country: other.profile?.country ?? null,
      },
    };
  };

  return (
    <>
      <AppPageHeader
        eyebrow="Fellowship"
        title="Connections"
        description="Nobody can start a private conversation with you unless you accept their request. That is the rule, and it is enforced by the platform, not by etiquette."
      />

      {enabled ? (
        <ConnectionsPanel
          incoming={rows.filter((r) => r.status === 'PENDING' && r.recipientId === context.user.id).map(shape)}
          outgoing={rows.filter((r) => r.status === 'PENDING' && r.requesterId === context.user.id).map(shape)}
          connections={rows.filter((r) => r.status === 'ACCEPTED').map(shape)}
        />
      ) : (
        <EmptyState
          icon="⏸"
          title="Connection requests are temporarily paused"
          description="New connection requests have been switched off by the ministry’s administrators. Existing conversations are unaffected."
        />
      )}
    </>
  );
}
