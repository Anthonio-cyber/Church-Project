import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requirePageUser } from '@/lib/auth/guard';
import { AppPageHeader } from '@/components/app/AppShell';
import { Badge, ButtonLink, EmptyState } from '@/components/ui';
import { relativeTime } from '@/lib/format';

export const metadata: Metadata = { title: 'Messages' };
export const dynamic = 'force-dynamic';

export default async function MessagesPage() {
  const context = await requirePageUser('/app/messages');

  const memberships = await prisma.conversationParticipant.findMany({
    where: { userId: context.user.id, leftAt: null },
    include: {
      conversation: {
        include: {
          participants: {
            include: {
              user: { select: { id: true, profile: { select: { displayName: true } } } },
            },
          },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          session: { select: { id: true, status: true } },
        },
      },
    },
  });

  // Blocked relationships are removed entirely rather than merely muted.
  const blocks = await prisma.block.findMany({
    where: { OR: [{ blockerId: context.user.id }, { blockedId: context.user.id }] },
    select: { blockerId: true, blockedId: true },
  });
  const blockedIds = new Set(
    blocks.flatMap((block) => [block.blockerId, block.blockedId]).filter((id) => id !== context.user.id),
  );

  const visible = memberships.filter((membership) =>
    membership.conversation.participants.every(
      (participant) => participant.userId === context.user.id || !blockedIds.has(participant.userId),
    ),
  );

  const peer = visible
    .filter((membership) => membership.conversation.kind === 'PEER')
    .sort(
      (a, b) =>
        (b.conversation.lastMessageAt?.getTime() ?? 0) - (a.conversation.lastMessageAt?.getTime() ?? 0),
    );
  const counselling = visible.filter((membership) => membership.conversation.kind === 'COUNSELLING');

  return (
    <>
      <AppPageHeader
        eyebrow="Messages"
        title="Your conversations"
        description="Counselling sessions are kept separate from ordinary conversations, and always will be."
      />

      {counselling.length > 0 ? (
        <section className="mb-10">
          <h2 className="mb-4 font-serif text-xl font-semibold">Pastoral sessions</h2>
          <ul className="space-y-3">
            {counselling.map((membership) => {
              const other = membership.conversation.participants.find(
                (participant) => participant.userId !== context.user.id,
              );
              return (
                <li key={membership.id}>
                  <Link
                    href={`/app/counselling/${membership.conversation.session?.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold-300 bg-gold-50/50 p-4 transition hover:border-gold-500 dark:border-gold-800 dark:bg-gold-950/20"
                  >
                    <div>
                      <p className="font-medium">
                        {other?.user.profile?.displayName ?? 'Counselling session'}
                      </p>
                      <p className="text-sm text-ink-500 dark:text-parchment-400">
                        Private pastoral session
                      </p>
                    </div>
                    <Badge
                      tone={
                        membership.conversation.session?.status === 'ACTIVE' ? 'positive' : 'gold'
                      }
                    >
                      {membership.conversation.session?.status === 'COMPLETED'
                        ? 'Completed'
                        : membership.conversation.session?.status === 'ACTIVE'
                          ? 'In progress'
                          : 'Scheduled'}
                    </Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="mb-4 font-serif text-xl font-semibold">Conversations</h2>
        {peer.length === 0 ? (
          <EmptyState
            icon="✉"
            title="You have no conversations yet"
            description="A conversation exists only after both people have agreed to connect. Send a connection request to begin one."
            action={<ButtonLink href="/app/connections">Go to connections</ButtonLink>}
          />
        ) : (
          <ul className="space-y-3">
            {peer.map((membership) => {
              const other = membership.conversation.participants.find(
                (participant) => participant.userId !== context.user.id,
              );
              const last = membership.conversation.messages[0];
              const unread =
                last &&
                last.senderId !== context.user.id &&
                (!membership.lastReadAt || last.createdAt > membership.lastReadAt);

              return (
                <li key={membership.id}>
                  <Link
                    href={`/app/messages/${membership.conversation.id}`}
                    className="flex items-center justify-between gap-4 rounded-xl border border-ink-200 bg-white p-4 transition hover:border-gold-400 dark:border-ink-800 dark:bg-ink-900"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">
                        {other?.user.profile?.displayName ?? 'Member'}
                        {unread ? (
                          <span className="ml-2 inline-block h-2 w-2 rounded-full bg-gold-500" />
                        ) : null}
                      </p>
                      <p className="truncate text-sm text-ink-500 dark:text-parchment-400">
                        {last ? (last.deletedAt ? 'Message removed' : last.body) : 'No messages yet'}
                      </p>
                    </div>
                    {membership.conversation.lastMessageAt ? (
                      <span className="shrink-0 text-xs text-ink-500 dark:text-parchment-400">
                        {relativeTime(membership.conversation.lastMessageAt)}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
