import { cookies, headers } from 'next/headers';
import type { Session, User } from '@prisma/client';
import { prisma } from '../db';
import { env } from '../env';
import { generateToken, hashToken } from '../crypto';

export const SESSION_COOKIE = '__Host-remnant.session';
const SESSION_COOKIE_INSECURE = 'remnant.session';

/** Sliding session: 12 hours of inactivity, 7 days absolute. */
export const SESSION_IDLE_MS = 12 * 60 * 60 * 1000;
export const SESSION_ABSOLUTE_MS = 7 * 24 * 60 * 60 * 1000;

/** Re-authentication older than this no longer satisfies a sensitive action. */
export const REAUTH_WINDOW_MS = 10 * 60 * 1000;

/**
 * The __Host- cookie prefix requires Secure and a "/" path with no Domain,
 * which browsers refuse over plain HTTP. Local development therefore falls back
 * to an ordinary name; production always uses the hardened one.
 */
export function sessionCookieName(): string {
  return env.isProduction ? SESSION_COOKIE : SESSION_COOKIE_INSECURE;
}

export type CreateSessionOptions = {
  userId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceLabel?: string | null;
  mfaSatisfied?: boolean;
};

export async function createSession(options: CreateSessionOptions): Promise<{
  session: Session;
  token: string;
}> {
  const token = generateToken(32);
  const now = new Date();
  const session = await prisma.session.create({
    data: {
      userId: options.userId,
      tokenHash: hashToken(token),
      ipAddress: options.ipAddress ?? null,
      userAgent: options.userAgent ?? null,
      deviceLabel: options.deviceLabel ?? null,
      expiresAt: new Date(now.getTime() + SESSION_ABSOLUTE_MS),
      mfaSatisfiedAt: options.mfaSatisfied ? now : null,
      reauthAt: now,
    },
  });
  return { session, token };
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(sessionCookieName(), token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(SESSION_ABSOLUTE_MS / 1000),
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(sessionCookieName(), '', {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

/**
 * Read the caller's session token.
 *
 * Browsers present it as an httpOnly cookie. The Android and iOS applications
 * have no cookie jar, so they present the same opaque token as a Bearer
 * credential from the device keychain. Both paths resolve to one session row,
 * one authorisation model and one audit trail.
 */
export async function readSessionToken(): Promise<string | null> {
  const store = await cookies();
  const cookieToken = store.get(sessionCookieName())?.value;
  if (cookieToken) return cookieToken;

  const headerList = await headers();
  const authorization = headerList.get('authorization');
  if (authorization?.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim() || null;
  }
  return null;
}

export type ResolvedSession = { session: Session; user: User };

/**
 * Resolve the caller's session, enforcing expiry, revocation, idle timeout and
 * account status. Returns null rather than throwing so callers can decide
 * between a redirect and a 401.
 */
export async function resolveSession(token: string | null): Promise<ResolvedSession | null> {
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session) return null;

  const now = new Date();
  if (session.revokedAt) return null;
  if (session.expiresAt <= now) return null;
  if (now.getTime() - session.lastSeenAt.getTime() > SESSION_IDLE_MS) {
    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: now, revokedReason: 'idle_timeout' },
    });
    return null;
  }

  const status = session.user.status;
  if (status === 'SUSPENDED' || status === 'DISABLED' || status === 'DELETED') {
    return null;
  }

  // Touch lastSeenAt at most once a minute to avoid a write on every request.
  if (now.getTime() - session.lastSeenAt.getTime() > 60_000) {
    await prisma.session.update({
      where: { id: session.id },
      data: { lastSeenAt: now },
    });
  }

  const { user, ...rest } = session;
  return { session: rest as Session, user };
}

export async function revokeSession(sessionId: string, reason: string) {
  await prisma.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason },
  });
}

export async function revokeAllSessions(
  userId: string,
  reason: string,
  exceptSessionId?: string,
): Promise<number> {
  const result = await prisma.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
    },
    data: { revokedAt: new Date(), revokedReason: reason },
  });
  return result.count;
}

export async function markReauthenticated(sessionId: string, mfaSatisfied: boolean) {
  const now = new Date();
  await prisma.session.update({
    where: { id: sessionId },
    data: {
      reauthAt: now,
      ...(mfaSatisfied ? { mfaSatisfiedAt: now } : {}),
    },
  });
}

export function isReauthFresh(session: Session): boolean {
  if (!session.reauthAt) return false;
  return Date.now() - session.reauthAt.getTime() <= REAUTH_WINDOW_MS;
}
