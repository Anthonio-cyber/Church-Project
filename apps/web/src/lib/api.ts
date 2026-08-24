import { NextResponse } from 'next/server';
import { ZodError, type z, type ZodTypeAny } from 'zod';
import { AuthError } from './auth/context';
import { consumeRateLimit, type RateLimitBucket } from './rate-limit';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, { status: 200, ...init });
}

export function created<T>(data: T) {
  return NextResponse.json({ ok: true, data }, { status: 201 });
}

export function failure(status: number, code: string, message: string, detail?: unknown) {
  return NextResponse.json({ ok: false, error: { code, message, detail } }, { status });
}

/**
 * Wraps a route handler so every failure produces a consistent, non-leaky
 * response. Unexpected errors never surface internal detail to the client.
 */
export function route<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof AuthError) {
        return failure(error.status, error.code, error.message, error.detail);
      }
      if (error instanceof ApiError) {
        return failure(error.status, error.code, error.message, error.detail);
      }
      if (error instanceof ZodError) {
        return failure(422, 'validation_failed', 'Please check the highlighted fields.', {
          issues: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        });
      }
      console.error('[api] unhandled error', error);
      return failure(500, 'internal_error', 'Something went wrong. Please try again.');
    }
  };
}

/**
 * Parse and validate a JSON body. Rejects anything that is not valid JSON.
 *
 * Generic over the schema rather than over a value type, so that a field with a
 * zod `.default()` is typed as present in the parsed result — which is what it
 * is at runtime.
 */
export async function parseBody<S extends ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<z.output<S>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError(400, 'invalid_json', 'The request body must be valid JSON.');
  }
  return schema.parse(raw);
}

export function parseQuery<S extends ZodTypeAny>(request: Request, schema: S): z.output<S> {
  const url = new URL(request.url);
  const entries: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    entries[key] = value;
  });
  return schema.parse(entries);
}

export async function enforceRateLimit(bucket: RateLimitBucket, identity: string) {
  const result = await consumeRateLimit(bucket, identity);
  if (!result.allowed) {
    throw new ApiError(
      429,
      'rate_limited',
      'You have made too many requests. Please wait before trying again.',
      { retryAfterSeconds: result.retryAfterSeconds },
    );
  }
  return result;
}

/**
 * Same-origin check for state-changing requests.
 *
 * Session cookies are SameSite=Lax, which already blocks cross-site POSTs from
 * forms; this is defence in depth for fetch-based requests.
 */
export function assertSameOrigin(request: Request) {
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;

  const origin = request.headers.get('origin');
  if (!origin) return; // Native mobile clients send no Origin header.

  const host = request.headers.get('host');
  try {
    const originHost = new URL(origin).host;
    if (host && originHost !== host) {
      throw new ApiError(403, 'cross_origin_blocked', 'Cross-origin request refused.');
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(403, 'cross_origin_blocked', 'Cross-origin request refused.');
  }
}

export function clientIdentity(request: Request, userId?: string): string {
  if (userId) return `user:${userId}`;
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0]!.trim() : 'unknown';
  return `ip:${ip}`;
}

export function paginationFrom(request: Request, defaultTake = 20, maxTake = 100) {
  const url = new URL(request.url);
  const take = Math.min(maxTake, Math.max(1, Number(url.searchParams.get('take') ?? defaultTake)));
  const skip = Math.max(0, Number(url.searchParams.get('skip') ?? 0));
  return { take, skip: Number.isFinite(skip) ? skip : 0 };
}
