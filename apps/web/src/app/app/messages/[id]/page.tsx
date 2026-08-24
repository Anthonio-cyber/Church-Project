import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requirePageUser } from '@/lib/auth/guard';
import { AppPageHeader } from '@/components/app/AppShell';
import { ConversationView } from '@/components/app/ConversationView';
import { PermissionDenied } from '@/components/ui';
import { isBlockedBetween } from '@/lib/domain/connections';

export const metadata: Metadata = { title: 'Conversation' };
export const dynamic = 'force-dynamic';

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requirePageUser(`/app/messages/${id}`);

  // Membership is looked up by the composite key, so a conversation the caller
  // is not part of simply does not resolve.
  const membership = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId: id, userId: context.user.id } },
    include: {
      conversation: {
        include: {
          participants: {
            include: { user: { select: { id: true, profile: { select: { displayName: true } } } } },
          },
          session: { select: { id: true } },
        },
      },
    },
  });

  if (!membership || membership.leftAt) notFound();

  const other = membership.conversation.participants.find(
    (participant) => participant.userId !== context.user.id,
  );

  if (other && (await isBlockedBetween(context.user.id, other.userId))) {
    return (
      <PermissionDenied
        what="this conversation"
        detail="This conversation is unavailable because of a block between the two accounts."
      />
    );
  }

  // Counselling conversations belong in the session room, not the message list.
  if (membership.conversation.kind === 'COUNSELLING' && membership.conversation.session) {
    return (
      <PermissionDenied
        what="this conversation here"
        detail="Pastoral sessions open in the counselling area, where the session information and privacy notices belong with them."
      />
    );
  }

  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId: id, userId: context.user.id } },
    data: { lastReadAt: new Date() },
  });

  const messages = await prisma.message.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });

  return (
    <div className="mx-auto max-w-3xl">
      <AppPageHeader
        eyebrow="Messages"
        title={other?.user.profile?.displayName ?? 'Conversation'}
      />
      <ConversationView
        conversationId={id}
        viewerId={context.user.id}
        otherPersonId={other?.userId ?? ''}
        otherPersonName={other?.user.profile?.displayName ?? 'Member'}
        isActive={membership.conversation.isActive}
        initialMessages={messages.map((message) => ({
          id: message.id,
          senderId: message.senderId,
          body: message.body,
          createdAt: message.createdAt.toISOString(),
          isMine: message.senderId === context.user.id,
          deleted: Boolean(message.deletedAt),
        }))}
      />
    </div>
  );
}
