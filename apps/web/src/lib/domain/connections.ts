import { prisma } from '../db';
import { ApiError } from '../api';

/**
 * Consent-gated contact.
 *
 * The rule this module exists to enforce: no private conversation exists
 * between two members until the recipient has accepted. Nothing in the product
 * lets one member open another's profile and start talking.
 */

/** Cooldown after a decline before the same person may ask again. */
export const DECLINE_COOLDOWN_DAYS = 30;

export async function isBlockedBetween(a: string, b: string): Promise<boolean> {
  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
    select: { id: true },
  });
  return Boolean(block);
}

/**
 * Whether `viewerId` may exchange private messages with `otherId` right now.
 * Used both when listing conversations and before every message send.
 */
export async function canMessage(viewerId: string, otherId: string): Promise<boolean> {
  if (viewerId === otherId) return false;
  if (await isBlockedBetween(viewerId, otherId)) return false;
  const accepted = await prisma.connectionRequest.findFirst({
    where: {
      status: 'ACCEPTED',
      OR: [
        { requesterId: viewerId, recipientId: otherId },
        { requesterId: otherId, recipientId: viewerId },
      ],
    },
    select: { id: true },
  });
  return Boolean(accepted);
}

export type ConnectionGuardResult = { ok: true } | { ok: false; reason: string; status: number };

/**
 * All the reasons a connection request may not be sent, checked in the order a
 * member would find most useful to hear about.
 */
export async function guardConnectionRequest(
  requesterId: string,
  recipientId: string,
): Promise<ConnectionGuardResult> {
  if (requesterId === recipientId) {
    return { ok: false, status: 400, reason: 'You cannot connect with yourself.' };
  }

  const recipient = await prisma.user.findUnique({
    where: { id: recipientId },
    include: { privacySettings: true, profile: true },
  });
  if (!recipient || recipient.status !== 'ACTIVE') {
    return { ok: false, status: 404, reason: 'That member could not be found.' };
  }

  if (await isBlockedBetween(requesterId, recipientId)) {
    // Deliberately vague: confirming a block would tell the blocked person that
    // they were blocked, which is information the blocker did not consent to share.
    return { ok: false, status: 403, reason: 'This request cannot be sent.' };
  }

  const requester = await prisma.user.findUnique({
    where: { id: requesterId },
    include: { profile: true },
  });
  if (!requester) {
    return { ok: false, status: 404, reason: 'Account not found.' };
  }

  // Age-aware protection: adults and minors may not open private channels with
  // each other through ordinary connection requests. Pastoral contact with a
  // young person goes through the counselling workflow, where the counsellor is
  // verified, approved to work with minors, and supervised.
  const requesterBand = requester.profile?.ageBand ?? 'UNDECLARED';
  const recipientBand = recipient.profile?.ageBand ?? 'UNDECLARED';
  const oneIsMinor = requesterBand === 'MINOR' || recipientBand === 'MINOR';
  const bothMinors = requesterBand === 'MINOR' && recipientBand === 'MINOR';
  if (oneIsMinor && !bothMinors) {
    return {
      ok: false,
      status: 403,
      reason:
        'For safeguarding reasons this connection cannot be created. Young people are supported through the counselling and ministry team.',
    };
  }

  const privacy = recipient.privacySettings;
  if (privacy?.whoCanRequestConnection === 'NOBODY') {
    return {
      ok: false,
      status: 403,
      reason: 'This member is not accepting connection requests.',
    };
  }
  if (privacy?.whoCanRequestConnection === 'MINISTRY_CENTER') {
    if (!requester.ministryCenterId || requester.ministryCenterId !== recipient.ministryCenterId) {
      return {
        ok: false,
        status: 403,
        reason: 'This member only accepts requests from their ministry centre.',
      };
    }
  }

  const existing = await prisma.connectionRequest.findFirst({
    where: {
      OR: [
        { requesterId, recipientId },
        { requesterId: recipientId, recipientId: requesterId },
      ],
    },
  });

  if (existing) {
    if (existing.status === 'ACCEPTED') {
      return { ok: false, status: 409, reason: 'You are already connected.' };
    }
    if (existing.status === 'PENDING') {
      return { ok: false, status: 409, reason: 'A request is already pending.' };
    }
    if (existing.status === 'BLOCKED') {
      return { ok: false, status: 403, reason: 'This request cannot be sent.' };
    }
    if (existing.cooldownUntil && existing.cooldownUntil > new Date()) {
      return {
        ok: false,
        status: 429,
        reason:
          'This member declined a previous request. You can ask again after the cooling-off period.',
      };
    }
  }

  return { ok: true };
}

export function assertGuard(result: ConnectionGuardResult): void {
  if (!result.ok) {
    throw new ApiError(result.status, 'connection_refused', result.reason);
  }
}

/**
 * Members are never enumerable. Directory search only ever returns people who
 * have deliberately made themselves discoverable, never minors, and never the
 * caller's blocked relationships.
 */
export async function searchDirectory(viewerId: string, query: string, take = 20) {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const blocked = await prisma.block.findMany({
    where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
    select: { blockerId: true, blockedId: true },
  });
  const excluded = new Set<string>([viewerId]);
  for (const row of blocked) {
    excluded.add(row.blockerId);
    excluded.add(row.blockedId);
  }

  const results = await prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      id: { notIn: Array.from(excluded) },
      privacySettings: { discoverable: true },
      profile: {
        ageBand: { not: 'MINOR' },
        displayName: { contains: trimmed, mode: 'insensitive' },
      },
    },
    select: {
      id: true,
      profile: {
        select: { displayName: true, avatarUrl: true, country: true, bio: true },
      },
      ministryCenter: { select: { name: true } },
    },
    take,
  });

  // Note the shape: no email address, no real name, no account status.
  return results.map((row) => ({
    id: row.id,
    displayName: row.profile?.displayName ?? 'Member',
    avatarUrl: row.profile?.avatarUrl ?? null,
    country: row.profile?.country ?? null,
    bio: row.profile?.bio ?? null,
    ministryCenter: row.ministryCenter?.name ?? null,
  }));
}
