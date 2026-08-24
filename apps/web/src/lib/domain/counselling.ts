import type { CounsellingCategory, Gender, Prisma } from '@prisma/client';
import { prisma } from '../db';
import { AuthError, type AuthContext } from '../auth/context';
import { decryptSensitive, encryptSensitive } from '../crypto';
import { writeAudit, AUDIT } from '../audit';

export const CATEGORY_LABEL: Record<CounsellingCategory, string> = {
  SPIRITUAL_GROWTH: 'Spiritual Growth',
  PRAYER_AND_FAITH: 'Prayer and Faith',
  FAMILY: 'Family',
  MARRIAGE: 'Marriage',
  RELATIONSHIPS: 'Relationships',
  PURPOSE_AND_CALLING: 'Purpose and Calling',
  DISCIPLESHIP: 'Discipleship',
  PERSONAL_STRUGGLES: 'Personal Struggles',
  YOUTH_GUIDANCE: 'Youth and Young Adult Guidance',
  MINISTRY: 'Ministry',
  BEREAVEMENT: 'Bereavement',
  LIFE_DECISIONS: 'Life Decisions',
  OTHER: 'Other',
};

/**
 * Decide whether the caller may see a counselling session at all.
 *
 * There are exactly three ways in:
 *   1. you are the member the session belongs to;
 *   2. you are the counsellor assigned to it;
 *   3. you hold counselling.safeguarding_access and are acting under a stated
 *      safeguarding reason, which is recorded.
 *
 * Being an administrator — of any rank, including Super Admin — is not by
 * itself one of them.
 */
export async function assertSessionAccess(
  context: AuthContext,
  sessionId: string,
  options: { safeguardingReason?: string } = {},
): Promise<{ session: SessionWithRelations; accessPath: 'member' | 'counsellor' | 'safeguarding' }> {
  const session = await prisma.counsellingSession.findUnique({
    where: { id: sessionId },
    include: {
      request: { select: { id: true, requesterId: true, category: true, summary: true, urgency: true, preferredMethod: true } },
      counsellor: { select: { id: true, userId: true, ministryRole: true } },
      participants: true,
    },
  });

  if (!session) {
    throw new AuthError(404, 'not_found', 'That session could not be found.');
  }

  if (session.request.requesterId === context.user.id) {
    return { session, accessPath: 'member' };
  }

  if (session.counsellor.userId === context.user.id) {
    return { session, accessPath: 'counsellor' };
  }

  if (context.permissions.has('counselling.safeguarding_access')) {
    if (!options.safeguardingReason || options.safeguardingReason.trim().length < 8) {
      throw new AuthError(
        400,
        'reason_required',
        'Accessing counselling records under safeguarding requires a written reason.',
      );
    }
    await writeAudit({
      actorId: context.user.id,
      actorEmail: context.user.email,
      actorRole: context.roles.join(','),
      action: AUDIT.COUNSELLING_SESSION_JOINED,
      targetType: 'counselling_session',
      targetId: sessionId,
      reason: options.safeguardingReason,
      metadata: { accessPath: 'safeguarding' },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    return { session, accessPath: 'safeguarding' };
  }

  throw new AuthError(
    403,
    'forbidden',
    'This is a private counselling session. You are not a participant.',
  );
}

export type SessionWithRelations = Prisma.CounsellingSessionGetPayload<{
  include: {
    request: { select: { id: true; requesterId: true; category: true; summary: true; urgency: true; preferredMethod: true } };
    counsellor: { select: { id: true; userId: true; ministryRole: true } };
    participants: true;
  };
}>;

/**
 * Counsellor matching.
 *
 * Ordering considers category fit, language, preferred counsellor gender,
 * ministry centre and current caseload, then availability state. Preferences
 * are honoured where they can be; where they cannot, the request stays in the
 * queue for a counselling administrator rather than being silently mismatched.
 */
export async function findMatchingCounsellors(input: {
  category: CounsellingCategory;
  language: string;
  preferredGender: Gender;
  ministryCenterId?: string | null;
  requesterIsMinor: boolean;
  limit?: number;
}) {
  const candidates = await prisma.counsellor.findMany({
    where: {
      status: 'APPROVED',
      user: { status: 'ACTIVE' },
      ...(input.requesterIsMinor ? { acceptsMinors: true } : {}),
    },
    include: {
      user: { include: { profile: true } },
      _count: { select: { sessions: { where: { status: { in: ['CONFIRMED', 'WAITING', 'ACTIVE'] } } } } },
    },
  });

  const scored = candidates
    .map((counsellor) => {
      let score = 0;
      if (counsellor.categories.includes(input.category)) score += 50;
      if (counsellor.languages.includes(input.language)) score += 20;
      if (
        input.preferredGender !== 'UNSPECIFIED' &&
        counsellor.user.profile?.gender === input.preferredGender
      ) {
        score += 15;
      }
      if (
        input.ministryCenterId &&
        counsellor.ministryCenterId === input.ministryCenterId
      ) {
        score += 10;
      }
      if (counsellor.availabilityState === 'AVAILABLE') score += 10;
      if (counsellor.availabilityState === 'UNAVAILABLE') score -= 20;

      const load = counsellor._count.sessions;
      if (load >= counsellor.maxConcurrentCases) score -= 100;
      else score -= load * 2;

      return { counsellor, score, load };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, input.limit ?? 5);
}

/**
 * Create an internal counselling note. Content is encrypted before it reaches
 * the database, so a database dump alone does not disclose pastoral notes.
 */
export async function createSessionNote(input: {
  sessionId: string;
  authorId: string;
  kind: 'INTERNAL' | 'SHARED_FOLLOW_UP';
  content: string;
  retentionUntil?: Date | null;
}) {
  const { cipher, iv } = encryptSensitive(input.content);
  return prisma.sessionNote.create({
    data: {
      sessionId: input.sessionId,
      authorId: input.authorId,
      kind: input.kind,
      contentCipher: cipher,
      contentIv: iv,
      lastModifiedById: input.authorId,
      retentionUntil: input.retentionUntil ?? null,
    },
  });
}

/**
 * Read notes for a session, recording every access against each note.
 *
 * `includeInternal` is false for the member: they see only the follow-up notes
 * the counsellor deliberately chose to share with them.
 */
export async function readSessionNotes(input: {
  sessionId: string;
  actorId: string;
  actorIp?: string | null;
  includeInternal: boolean;
  reason?: string;
}) {
  const notes = await prisma.sessionNote.findMany({
    where: {
      sessionId: input.sessionId,
      ...(input.includeInternal ? {} : { kind: 'SHARED_FOLLOW_UP' }),
    },
    orderBy: { createdAt: 'desc' },
  });

  if (notes.length > 0) {
    const now = new Date();
    await prisma.$transaction([
      ...notes.map((note) =>
        prisma.sessionNote.update({
          where: { id: note.id },
          data: { lastAccessedAt: now, lastAccessedById: input.actorId },
        }),
      ),
      prisma.sessionNoteAccess.createMany({
        data: notes.map((note) => ({
          noteId: note.id,
          actorId: input.actorId,
          action: 'READ',
          reason: input.reason ?? null,
          ipAddress: input.actorIp ?? null,
        })),
      }),
    ]);
  }

  return notes.map((note) => ({
    id: note.id,
    kind: note.kind,
    content: decryptSensitive(note.contentCipher, note.contentIv),
    authorId: note.authorId,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    lastAccessedAt: note.lastAccessedAt,
    lastAccessedById: note.lastAccessedById,
    lastModifiedById: note.lastModifiedById,
  }));
}

/** Waiting-room state machine, expressed once so every surface agrees. */
export function waitingRoomState(session: {
  status: string;
  scheduledFor: Date;
  counsellorJoinedAt: Date | null;
}): {
  canEnterWaitingRoom: boolean;
  canEnterSession: boolean;
  label: string;
  detail: string;
} {
  const now = Date.now();
  const startsIn = session.scheduledFor.getTime() - now;
  // The waiting room opens fifteen minutes before the appointment.
  const openWindow = 15 * 60 * 1000;

  if (session.status === 'CANCELLED') {
    return {
      canEnterWaitingRoom: false,
      canEnterSession: false,
      label: 'Cancelled',
      detail: 'This session was cancelled.',
    };
  }
  if (session.status === 'COMPLETED') {
    return {
      canEnterWaitingRoom: false,
      canEnterSession: false,
      label: 'Completed',
      detail: 'This session has ended.',
    };
  }
  if (session.status === 'ACTIVE') {
    return {
      canEnterWaitingRoom: true,
      canEnterSession: true,
      label: 'Session active',
      detail: 'Your session is in progress.',
    };
  }
  if (session.counsellorJoinedAt) {
    return {
      canEnterWaitingRoom: true,
      canEnterSession: true,
      label: 'Your counsellor has joined',
      detail: 'You can enter the secure session now.',
    };
  }
  if (startsIn <= openWindow) {
    return {
      canEnterWaitingRoom: true,
      canEnterSession: false,
      label: 'Waiting room open',
      detail: 'Your counsellor has been notified.',
    };
  }
  return {
    canEnterWaitingRoom: false,
    canEnterSession: false,
    label: 'Confirmed',
    detail: 'The waiting room opens fifteen minutes before your session.',
  };
}
