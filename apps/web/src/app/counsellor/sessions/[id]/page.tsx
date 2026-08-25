import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requirePageUser } from '@/lib/auth/guard';
import { AppPageHeader } from '@/components/app/AppShell';
import { CounsellingSessionRoom } from '@/components/app/CounsellingSessionRoom';
import { PermissionDenied } from '@/components/ui';
import { AuthError } from '@/lib/auth/context';
import { assertSessionAccess, CATEGORY_LABEL, waitingRoomState } from '@/lib/domain/counselling';
import { videoRoomForSession } from '@/lib/domain/video';
import { attachmentNamesFor } from '@/lib/domain/files';

export const metadata: Metadata = { title: 'Counselling session' };
export const dynamic = 'force-dynamic';

export default async function CounsellorSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await requirePageUser(`/counsellor/sessions/${id}`);

  let access;
  try {
    access = await assertSessionAccess(context, id);
  } catch (error) {
    if (error instanceof AuthError && error.status === 404) notFound();
    return (
      <PermissionDenied
        what="this session"
        detail="A counsellor can only open sessions assigned to them. Another counsellor's caseload is not reachable from here."
      />
    );
  }

  const { session, accessPath } = access;
  if (accessPath !== 'counsellor') {
    return (
      <PermissionDenied
        what="this session in the counsellor portal"
        detail="You are not the assigned counsellor for this session."
      />
    );
  }

  const [conversation, member] = await Promise.all([
    prisma.conversation.findUnique({ where: { sessionId: session.id }, select: { id: true } }),
    prisma.user.findUnique({
      where: { id: session.request.requesterId },
      select: { profile: { select: { displayName: true } } },
    }),
  ]);

  const messages = conversation
    ? await prisma.message.findMany({
        where: { conversationId: conversation.id, deletedAt: null },
        orderBy: { createdAt: 'asc' },
        take: 200,
      })
    : [];

  const attachmentNames = await attachmentNamesFor(
    messages.map((message) => message.attachmentUrl),
  );

  return (
    <>
      <AppPageHeader
        eyebrow="Counsellor Portal"
        title="Private counselling session"
        description={CATEGORY_LABEL[session.request.category]}
      />

      <CounsellingSessionRoom
        viewerId={context.user.id}
        viewerRole="counsellor"
        videoRoom={(() => {
          // Derived only after assertSessionAccess confirmed this counsellor
          // is the one assigned to the session.
          const room = videoRoomForSession(session.id, session.method);
          return room ? { origin: room.origin, url: room.url, method: session.method } : null;
        })()}
        session={{
          id: session.id,
          status: session.status,
          scheduledFor: session.scheduledFor.toISOString(),
          durationMinutes: session.durationMinutes,
          method: session.method,
          categoryLabel: CATEGORY_LABEL[session.request.category],
          summary: session.request.summary,
          conversationId: conversation?.id ?? null,
          counsellorJoinedAt: session.counsellorJoinedAt?.toISOString() ?? null,
          memberJoinedAt: session.memberJoinedAt?.toISOString() ?? null,
          startedAt: session.startedAt?.toISOString() ?? null,
          counterpartName: member?.profile?.displayName ?? 'Member',
          counterpartRole: 'Member',
          waitingRoom: waitingRoomState(session),
        }}
        initialMessages={messages.map((message) => ({
          id: message.id,
          senderId: message.senderId,
          body: message.body,
          kind: message.kind,
          scriptureRef: message.scriptureRef,
          createdAt: message.createdAt.toISOString(),
          isMine: message.senderId === context.user.id,
          attachmentUrl: message.attachmentUrl,
          attachmentName: attachmentNames.get(message.attachmentUrl ?? '')?.fileName ?? null,
          attachmentType: attachmentNames.get(message.attachmentUrl ?? '')?.contentType ?? null,
        }))}
      />
    </>
  );
}
