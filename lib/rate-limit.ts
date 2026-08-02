// Upstash Redis fixed-window rate limiter.
//
// The bucket key embeds the current window index (floor(now / windowMs)), so a
// new key — and a new TTL — starts every window automatically. INCR is atomic;
// PEXPIRE only fires on the first hit per window (count === 1).
//
// The client and its credential handling live in lib/redis.ts, which the run
// replay guard shares.

import { redis } from "@/lib/redis";

type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  // Distinguishes a genuine over-limit rejection from operational states.
  // "ok"          — the limiter ran; `allowed` reflects the real count.
  // "disabled"    — no Redis configured (local dev / un-provisioned); allowed.
  // "unavailable" — Redis configured but unreachable; failed closed.
  // Callers MUST send 503 (not 429) when status is "unavailable" so clients
  // retry instead of seeing a misleading rate-limit message.
  status: "ok" | "disabled" | "unavailable";
};

export async function checkRateLimit(
  key: string,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const client = redis();
  if (!client) {
    // No shared store configured.
    if (process.env.NODE_ENV === "production") {
      // In production this is a misconfiguration, not an expected state. Fail
      // closed (callers return 503) so endpoints are never left silently
      // unprotected; redis() has already logged a loud warning to surface it.
      return {
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + options.windowMs,
        status: "unavailable",
      };
    }
    // Outside production rate limiting is an unnecessary no-op — allow the
    // request so local dev runs with no Redis setup and no spurious 429.
    return {
      allowed: true,
      remaining: options.limit,
      resetAt: Date.now() + options.windowMs,
      status: "disabled",
    };
  }

  const bucketKey = `rl:${key}:${Math.floor(Date.now() / options.windowMs)}`;
  try {
    const count = await client.incr(bucketKey);

    if (count === 1) {
      await client.pexpire(bucketKey, options.windowMs);
    }

    const ttl = await client.pttl(bucketKey);
    const resetAt = Date.now() + (ttl > 0 ? ttl : options.windowMs);

    if (count > options.limit) {
      return { allowed: false, remaining: 0, resetAt, status: "ok" };
    }

    return {
      allowed: true,
      remaining: Math.max(0, options.limit - count),
      resetAt,
      status: "ok",
    };
  } catch {
    // Redis configured but unreachable — fail closed, but flag the outage so
    // callers return 503, not a misleading 429 (it's not the client's fault).
    return {
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + options.windowMs,
      status: "unavailable",
    };
  }
}
