// Shared, bounded rate limiter for public + admin endpoints.
//
// WHY THIS EXISTS
// The audit found that /api/orders, /api/chat and /api/products could be called
// by anyone, without limit, which allows bot abuse, catalogue vandalism and
// uncontrolled OpenRouter spend.
//
// IMPORTANT LIMITATION (deliberate, and documented rather than hidden)
// This store is per serverless instance, so the effective limit is
// "MAX_ATTEMPTS x number of warm instances". That is still a large improvement
// over no limit, but it is NOT a hard global cap. A durable global limit needs
// a shared store (Vercel KV / Upstash Redis), which is a deployment decision -
// see docs/STAGING_AND_OBSERVABILITY.md. Until then this limiter deliberately
// fails OPEN for legitimate traffic and fails CLOSED only per instance.
//
// It is intentionally simple and dependency-free.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/**
 * Hard ceiling on tracked keys so a flood of unique IPs (a botnet) cannot
 * grow this Map without bound and OOM the function.
 */
const MAX_TRACKED_KEYS = 10_000;

/** Drop expired buckets so long-lived instances do not accumulate entries. */
function sweep(now: number): void {
  if (buckets.size < MAX_TRACKED_KEYS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  // Still oversized after dropping expired entries: evict the oldest so the
  // Map stays bounded. Worst case an attacker's entries are evicted first.
  while (buckets.size >= MAX_TRACKED_KEYS) {
    const oldest = buckets.keys().next();
    if (oldest.done) break;
    buckets.delete(oldest.value);
  }
}

/**
 * Best-effort client identity. On Vercel the left-most x-forwarded-for entry is
 * the client. Falls back to a constant so an unset header cannot be used to get
 * a fresh bucket on every request.
 */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim();
  if (ip) return ip;
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimitOptions {
  /** Unique namespace, e.g. "orders". Keep stable so buckets are not reset. */
  bucket: string;
  /** Requests allowed per window. */
  max: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Optional trusted client identity. Defaults to clientKey(request). */
  key?: string;
}

/**
 * Counts one hit against the caller's bucket.
 * Returns ok=false once the window's allowance is exhausted.
 */
export function rateLimit(
  request: Request,
  { bucket, max, windowMs, key }: RateLimitOptions,
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const id = `${bucket}:${key ?? clientKey(request)}`;
  const existing = buckets.get(id);

  if (!existing || existing.resetAt <= now) {
    buckets.set(id, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: max - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > max) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  return {
    ok: true,
    remaining: max - existing.count,
    retryAfterSeconds: 0,
  };
}

/**
 * Named policies. Values are deliberately generous for real shoppers - the goal
 * is to stop abuse, not to block a busy customer.
 */
export const RATE_LIMITS = {
  /** Placing an order. Normal shoppers never come close to this. */
  orders: { bucket: 'orders', max: 10, windowMs: 10 * 60 * 1000 },
  /** Chat messages - also caps OpenRouter spend. */
  chat: { bucket: 'chat', max: 20, windowMs: 10 * 60 * 1000 },
  /** Admin catalogue writes. */
  productWrites: { bucket: 'product-writes', max: 60, windowMs: 10 * 60 * 1000 },
  /** Admin password attempts. Matches the previous per-IP behaviour. */
  login: { bucket: 'login', max: 8, windowMs: 10 * 60 * 1000 },
} as const;

/** Standard 429 response with the headers a client needs to back off. */
export function rateLimitResponse(result: RateLimitResult, message = 'Too many requests. Please try again shortly.') {
  return Response.json(
    { success: false, error: message },
    {
      status: 429,
      headers: {
        'Retry-After': String(result.retryAfterSeconds),
        'X-RateLimit-Remaining': '0',
      },
    },
  );
}

/** Reads a bucket WITHOUT consuming an attempt. */
export function peekRateLimit(
  request: Request,
  { bucket, max, key }: { bucket: string; max: number; key?: string },
): RateLimitResult {
  const now = Date.now();
  const id = `${bucket}:${key ?? clientKey(request)}`;
  const existing = buckets.get(id);

  if (!existing || existing.resetAt <= now) {
    return { ok: true, remaining: max, retryAfterSeconds: 0 };
  }
  if (existing.count >= max) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  return { ok: true, remaining: max - existing.count, retryAfterSeconds: 0 };
}

/** Clears a bucket after a successful action (used by login on success). */
export function resetRateLimit(request: Request, bucket: string, key?: string): void {
  buckets.delete(`${bucket}:${key ?? clientKey(request)}`);
}
