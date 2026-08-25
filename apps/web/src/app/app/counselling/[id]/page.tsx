import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requirePageUser } from '@/lib/auth/guard';
import { AppPageHeader } from '@/components/app/AppShell';
import { CounsellingSessionRoom } from '@/components/app/CounsellingSessionRoom';
import { PermissionDenied } from '@/components/ui';
import { AuthError } from '@/lib/auth/context';
import { assertSessionAccess, CATEGORY_LABEL, readSessionNotes, waitingRoomState } from '@/lib/domain/counselling';
import { videoRoomForSession } from '@/lib/domain/video';

export const metadata: Metadata = { title: 'Private pastoral session' };
export const dynamic = 'force-dynamic';

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requirePageUser(`/app/counselling/${id}`);

  let access;
  try {
    // The same guard the API uses. A member who has been sent someone else's
    // session link sees the permission-denied panel, not the session.
    access = await assertSessionAccess(context, id);
  } catch (error) {
    if (error instanceof AuthError && error.status === 404) notFound();
    return (
      <PermissionDenied
        what="this counselling session"
        detail="This is a private pastoral session between a member and their assigned counsellor. You are not a participant in it."
      />
    );
  }

  const { session, accessPath } = access;
  if (accessPath === 'safeguarding') {
    return (
      <PermissionDenied
        what="this session as a participant"
        detail="Safeguarding access permits reviewing counselling records with a recorded reason. It does not permit joining a live pastoral session. Use the safeguarding portal instead."
      />
    );
  }

  const viewerRole = accessPath === 'counsellor' ? ('counsellor' as const) : ('member' as const);

  const [conversation, counterpart, sharedNotes] = await Promise.all([
    prisma.conversation.findUnique({
      where: { sessionId: session.id },
      select: { id: true },
    }),
    prisma.user.findUnique({
      where: {
        id: viewerRole === 'counsellor' ? session.request.requesterId : session.counsellor.userId,
      },
      select: { profile: { select: { displayName: true } } },
    }),
    // Members see only follow-up notes deliberately shared with them.
    viewerRole === 'member'
      ? readSessionNotes({
          sessionId: session.id,
          actorId: context.user.id,
          actorIp: context.ipAddress,
          includeInternal: false,
        })
      : Promise.resolve([]),
  ]);

  const messages = conversation
    ? await prisma.message.findMany({
        where: { conversationId: conversation.id, deletedAt: null },
        orderBy: { createdAt: 'asc' },
        take: 200,
      })
    : [];

  const state = waitingRoomState(session);

  // Derived only after assertSessionAccess has confirmed this viewer is a
  // participant, so the room name never reaches anyone else.
  const videoRoom = videoRoomForSession(session.id, session.method);

  return (
    <>
      <AppPageHeader
        eyebrow={viewerRole === 'counsellor' ? 'Counsellor' : 'Pastoral counselling'}
        title={state.canEnterSession ? 'Secure session' : 'Waiting room'}
        description={CATEGORY_LABEL[session.request.category]}
      />

      <CounsellingSessionRoom
        viewerId={context.user.id}
        viewerRole={viewerRole}
        videoRoom={
          videoRoom
            ? { origin: videoRoom.origin, url: videoRoom.url, method: session.method }
            : null
        }
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
          counterpartName: counterpart?.profile?.displayName ?? 'Your counsellor',
          counterpartRole:
            viewerRole === 'counsellor' ? 'Member' : session.counsellor.ministryRole,
          waitingRoom: state,
        }}
        initialMessages={messages.map((message) => ({
          id: message.id,
          senderId: message.senderId,
          body: message.body,
          kind: message.kind,
          scriptureRef: message.scriptureRef,
          createdAt: message.createdAt.toISOString(),
          isMine: message.senderId === context.user.id,
        }))}
      />

      {sharedNotes.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-4 font-serif text-xl font-semibold">Follow-up notes for you</h2>
          <ul className="space-y-4">
            {sharedNotes.map((note) => (
              <li
                key={note.id}
                className="rounded-xl border border-ink-200 bg-white p-5 dark:border-ink-800 dark:bg-ink-900"
              >
                <p className="text-xs text-ink-500 dark:text-parchment-400">
                  {note.createdAt.toLocaleString()}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-700 dark:text-parchment-200">
                  {note.content}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
