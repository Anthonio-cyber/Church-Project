import { z } from 'zod';
import { ApiError, assertSameOrigin, created, ok, parseBody, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/context';
import {
  assertSessionAccess,
  createSessionNote,
  readSessionNotes,
} from '@/lib/domain/counselling';
import { AUDIT, writeAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/**
 * Counselling notes.
 *
 * Two kinds exist and they are not the same thing:
 *   INTERNAL           — the counsellor's own pastoral record. The member never
 *                        sees it. Encrypted at rest, every read recorded.
 *   SHARED_FOLLOW_UP   — written deliberately for the member to read.
 *
 * A member reading this route receives only the shared notes. No administrative
 * role reaches internal notes through here at all; safeguarding access has its
 * own route with its own recorded reason.
 */
export const GET = route(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const context = await requireUser();
  const url = new URL(request.url);
  const safeguardingReason = url.searchParams.get('reason') ?? undefined;

  const { accessPath } = await assertSessionAccess(context, id, { safeguardingReason });

  const includeInternal =
    accessPath === 'counsellor' ||
    (accessPath === 'safeguarding' && context.permissions.has('counselling.notes_access'));

  if (accessPath === 'safeguarding' && !includeInternal) {
    throw new ApiError(
      403,
      'forbidden',
      'Safeguarding access alone does not include internal counselling notes.',
    );
  }

  const notes = await readSessionNotes({
    sessionId: id,
    actorId: context.user.id,
    actorIp: context.ipAddress,
    includeInternal,
    reason: accessPath === 'safeguarding' ? safeguardingReason : undefined,
  });

  if (accessPath === 'safeguarding') {
    await writeAudit({
      actorId: context.user.id,
      actorEmail: context.user.email,
      actorRole: context.roles.join(','),
      action: AUDIT.SESSION_NOTE_ACCESSED,
      targetType: 'counselling_session',
      targetId: id,
      reason: safeguardingReason,
      metadata: { noteCount: notes.length, accessPath },
      ipAddress: context.ipAddress,
    });
  }

  return ok({ notes, accessPath, includesInternal: includeInternal });
});

const createSchema = z.object({
  kind: z.enum(['INTERNAL', 'SHARED_FOLLOW_UP']).default('INTERNAL'),
  content: z.string().trim().min(1).max(8000),
  retentionMonths: z.number().int().min(1).max(120).optional(),
});

export const POST = route(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { id } = await params;
  const context = await requireUser();
  const { accessPath } = await assertSessionAccess(context, id);

  if (accessPath !== 'counsellor') {
    throw new ApiError(
      403,
      'counsellor_only',
      'Only the assigned counsellor can write session notes.',
    );
  }

  const input = await parseBody(request, createSchema);
  const retentionUntil = input.retentionMonths
    ? new Date(Date.now() + input.retentionMonths * 30 * 24 * 3600 * 1000)
    : null;

  const note = await createSessionNote({
    sessionId: id,
    authorId: context.user.id,
    kind: input.kind,
    content: input.content,
    retentionUntil,
  });

  await writeAudit({
    actorId: context.user.id,
    actorEmail: context.user.email,
    actorRole: context.roles.join(','),
    action: AUDIT.SESSION_NOTE_CREATED,
    targetType: 'session_note',
    targetId: note.id,
    // The note's content is never written to the audit log — only that one was
    // written, of which kind, and by whom.
    metadata: { kind: input.kind, sessionId: id },
    ipAddress: context.ipAddress,
  });

  return created({
    note: { id: note.id, kind: note.kind, createdAt: note.createdAt },
    message: 'Note saved.',
  });
});
