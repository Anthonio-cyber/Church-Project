import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requirePageUser } from '@/lib/auth/guard';
import { AppPageHeader } from '@/components/app/AppShell';
import { SessionNotesEditor } from '@/components/app/SessionNotesEditor';
import { PermissionDenied } from '@/components/ui';
import { AuthError } from '@/lib/auth/context';
import { assertSessionAccess, readSessionNotes } from '@/lib/domain/counselling';

export const metadata: Metadata = { title: 'Session notes' };
export const dynamic = 'force-dynamic';

export default async function SessionNotesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requirePageUser(`/counsellor/sessions/${id}/notes`);

  let access;
  try {
    access = await assertSessionAccess(context, id);
  } catch (error) {
    if (error instanceof AuthError && error.status === 404) notFound();
    return <PermissionDenied what="these notes" />;
  }

  if (access.accessPath !== 'counsellor') {
    return (
      <PermissionDenied
        what="these notes"
        detail="Internal counselling notes belong to the assigned counsellor. They are not readable by other counsellors, by administrators as a matter of rank, or by the member."
      />
    );
  }

  // Reading notes records the access against each note, here as everywhere.
  const notes = await readSessionNotes({
    sessionId: id,
    actorId: context.user.id,
    actorIp: context.ipAddress,
    includeInternal: true,
  });

  return (
    <>
      <AppPageHeader
        eyebrow="Counsellor Portal"
        title="Session notes"
        description="Your own pastoral record, and any follow-up you want the member to read. Both are encrypted at rest; every access to an internal note is logged."
      />
      <SessionNotesEditor
        sessionId={id}
        notes={notes.map((note) => ({
          id: note.id,
          kind: note.kind,
          content: note.content,
          createdAt: note.createdAt.toISOString(),
          lastAccessedAt: note.lastAccessedAt?.toISOString() ?? null,
          lastModifiedById: note.lastModifiedById,
        }))}
      />
    </>
  );
}
