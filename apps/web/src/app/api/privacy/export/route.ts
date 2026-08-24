import { prisma } from '@/lib/db';
import { ok, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/context';
import { AUDIT, writeAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/**
 * Personal data export.
 *
 * The member receives everything the platform holds *about them* that is theirs
 * to have: profile, consents, their own messages, their prayer requests, their
 * counselling requests and any follow-up notes written for them.
 *
 * Deliberately excluded, and the response says so plainly rather than quietly
 * omitting them:
 *   — a counsellor's internal notes, which are the counsellor's pastoral record
 *     and may concern third parties;
 *   — safeguarding case narratives, whose disclosure could endanger someone;
 *   — the other side of a conversation, which belongs to the other person.
 * Those are handled through a data-rights request with human review.
 */
export const GET = route(async () => {
  const context = await requireUser();

  const [profile, privacy, prefs, consents, prayers, counselling, registrations, ownMessages, connections, notifications] =
    await Promise.all([
      prisma.profile.findUnique({ where: { userId: context.user.id } }),
      prisma.privacySettings.findUnique({ where: { userId: context.user.id } }),
      prisma.notificationPreference.findUnique({ where: { userId: context.user.id } }),
      prisma.consent.findMany({ where: { userId: context.user.id } }),
      prisma.prayerRequest.findMany({
        where: { authorId: context.user.id },
        select: { title: true, body: true, category: true, visibility: true, createdAt: true },
      }),
      prisma.counsellingRequest.findMany({
        where: { requesterId: context.user.id },
        select: { category: true, summary: true, urgency: true, status: true, createdAt: true },
      }),
      prisma.eventRegistration.findMany({
        where: { userId: context.user.id },
        select: { status: true, registeredAt: true, event: { select: { title: true, startsAt: true } } },
      }),
      prisma.message.findMany({
        where: { senderId: context.user.id, deletedAt: null },
        select: { body: true, kind: true, createdAt: true, conversationId: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.connectionRequest.findMany({
        where: { OR: [{ requesterId: context.user.id }, { recipientId: context.user.id }] },
        select: { status: true, createdAt: true, respondedAt: true },
      }),
      prisma.notification.findMany({
        where: { userId: context.user.id },
        select: { category: true, title: true, createdAt: true },
      }),
    ]);

  const sharedFollowUps = await prisma.sessionNote.findMany({
    where: {
      kind: 'SHARED_FOLLOW_UP',
      session: { request: { requesterId: context.user.id } },
    },
    select: { createdAt: true },
  });

  await writeAudit({
    actorId: context.user.id,
    actorEmail: context.user.email,
    action: AUDIT.DATA_EXPORTED,
    targetType: 'user',
    targetId: context.user.id,
    metadata: { self_service: true },
    ipAddress: context.ipAddress,
  });

  return ok({
    exportedAt: new Date().toISOString(),
    account: {
      email: context.user.email,
      status: context.user.status,
      createdAt: context.user.createdAt,
      lastLoginAt: context.user.lastLoginAt,
      mfaEnabled: context.user.mfaEnabled,
    },
    profile,
    privacySettings: privacy,
    notificationPreferences: prefs,
    consents,
    prayerRequests: prayers,
    counsellingRequests: counselling,
    sharedFollowUpNoteCount: sharedFollowUps.length,
    eventRegistrations: registrations,
    messagesYouSent: ownMessages,
    connections,
    notifications,
    notIncluded: [
      "A counsellor's internal session notes. These form the counsellor's pastoral record, may concern other people, and are released only through a reviewed data-rights request.",
      'Safeguarding case narratives, where disclosure could place someone at risk.',
      'Messages written by other people, which are their personal data rather than yours.',
      'Internal moderation and administrative records about reports you were involved in.',
    ],
    howToRequestMore:
      'Submit a data-rights request from the Privacy Centre. A data governance administrator will review it under the organisation’s policy and respond.',
  });
});
