// Upstash Redis fixed-window rate limiter.
//
// The bucket key embeds the current window index (floor(now / windowMs)), so a
// new key — and a new TTL — starts every window automatically. INCR is atomic;
// PEXPIRE only fires on the first hit per window (count === 1).
//
// Env vars (KV_REST_API_URL, KV_REST_API_TOKEN) are auto-provisioned by the
// Vercel Marketplace Upstash for Redis integration.

import { Redis } from "@upstash/redis";

import { logWarn } from "@/lib/logger";

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

let redisClient: Redis | null = null;
let warnedDisabled = false;
function redis(): Redis | null {
  if (!redisClient) {
    // Accept either the Vercel-KV names (auto-provisioned by the Marketplace
    // integration) or Upstash's native names (when bringing your own Upstash
    // database), so credentials work whichever way they are supplied.
    const url =
      process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
    const token =
      process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
    // No credentials — rate limiting is unconfigured (e.g. local dev). Return
    // null so the limiter degrades to a no-op rather than throwing on every
    // request. Provision an Upstash for Redis database to enable limiting.
    if (!url || !token) {
      if (process.env.NODE_ENV === "production" && !warnedDisabled) {
        warnedDisabled = true;
        logWarn({
          route: "rate-limit",
          message:
            "Rate limiting DISABLED in production: no Redis credentials " +
            "(set KV_REST_API_URL/TOKEN or UPSTASH_REDIS_REST_URL/TOKEN).",
        });
      }
      return null;
    }
    redisClient = new Redis({ url, token });
  }
  return redisClient;
}

export async function checkRateLimit(
  key: string,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const client = redis();
  if (!client) {
    // No shared store configured — allow the request so the app stays usable
    // instead of returning a spurious 429 on the very first call.
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
