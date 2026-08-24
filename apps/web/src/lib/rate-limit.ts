import { prisma } from './db';

export type RateLimitRule = { limit: number; windowSeconds: number };

/**
 * Named rate-limit buckets.
 *
 * Connection requests and counselling requests are limited as much for member
 * safety as for infrastructure: they are the two routes an abusive account
 * would otherwise use to pressure people.
 */
export const RATE_LIMITS = {
  login: { limit: 8, windowSeconds: 300 },
  register: { limit: 5, windowSeconds: 3600 },
  passwordReset: { limit: 5, windowSeconds: 3600 },
  connectionRequest: { limit: 5, windowSeconds: 86400 },
  counsellingRequest: { limit: 3, windowSeconds: 86400 },
  message: { limit: 60, windowSeconds: 60 },
  prayerRequest: { limit: 10, windowSeconds: 3600 },
  report: { limit: 10, windowSeconds: 3600 },
  mfaChallenge: { limit: 10, windowSeconds: 900 },
  generalWrite: { limit: 120, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitBucket = keyof typeof RATE_LIMITS;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * Fixed-window counter held in Postgres so the limit survives restarts and is
 * shared across every application instance. A Redis adapter can replace this
 * without changing any call site.
 */
export async function consumeRateLimit(
  bucket: RateLimitBucket,
  identity: string,
): Promise<RateLimitResult> {
  const rule = RATE_LIMITS[bucket];
  const now = new Date();
  const windowStartCutoff = new Date(now.getTime() - rule.windowSeconds * 1000);

  const existing = await prisma.rateLimitCounter.findUnique({
    where: { bucket_identity: { bucket, identity } },
  });

  if (!existing || existing.windowStart < windowStartCutoff) {
    await prisma.rateLimitCounter.upsert({
      where: { bucket_identity: { bucket, identity } },
      create: { bucket, identity, count: 1, windowStart: now },
      update: { count: 1, windowStart: now },
    });
    return { allowed: true, remaining: rule.limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= rule.limit) {
    const elapsed = (now.getTime() - existing.windowStart.getTime()) / 1000;
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil(rule.windowSeconds - elapsed)),
    };
  }

  const updated = await prisma.rateLimitCounter.update({
    where: { bucket_identity: { bucket, identity } },
    data: { count: { increment: 1 } },
  });

  return {
    allowed: true,
    remaining: Math.max(0, rule.limit - updated.count),
    retryAfterSeconds: 0,
  };
}

export async function peekRateLimit(
  bucket: RateLimitBucket,
  identity: string,
): Promise<number> {
  const rule = RATE_LIMITS[bucket];
  const existing = await prisma.rateLimitCounter.findUnique({
    where: { bucket_identity: { bucket, identity } },
  });
  if (!existing) return rule.limit;
  const cutoff = new Date(Date.now() - rule.windowSeconds * 1000);
  if (existing.windowStart < cutoff) return rule.limit;
  return Math.max(0, rule.limit - existing.count);
}

export async function resetRateLimit(bucket: RateLimitBucket, identity: string) {
  await prisma.rateLimitCounter
    .delete({ where: { bucket_identity: { bucket, identity } } })
    .catch(() => undefined);
}
