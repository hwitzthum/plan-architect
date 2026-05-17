// In-process rate limiter. Counters are held in a module-level Map and reset
// on every cold start. This is acceptable for a single-user deployment behind
// Vercel Password Protection; for a multi-user public deployment, swap the
// `buckets` store for a durable KV (Vercel KV, Upstash Redis) with the same
// `checkRateLimit` signature so callers do not need to change.

type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type GlobalWithBuckets = typeof globalThis & {
  __planArchitectRateBuckets?: Map<string, RateLimitEntry>;
};

function buckets(): Map<string, RateLimitEntry> {
  const g = globalThis as GlobalWithBuckets;
  if (!g.__planArchitectRateBuckets) {
    g.__planArchitectRateBuckets = new Map();
  }
  return g.__planArchitectRateBuckets;
}

export function checkRateLimit(key: string, options: RateLimitOptions) {
  const now = Date.now();
  const store = buckets();
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + options.windowMs });
    return {
      allowed: true,
      remaining: options.limit - 1,
      resetAt: now + options.windowMs,
    };
  }

  if (current.count >= options.limit) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }

  current.count += 1;
  store.set(key, current);

  return {
    allowed: true,
    remaining: options.limit - current.count,
    resetAt: current.resetAt,
  };
}
