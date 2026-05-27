// Upstash Redis fixed-window rate limiter.
//
// The bucket key embeds the current window index (floor(now / windowMs)), so a
// new key — and a new TTL — starts every window automatically. INCR is atomic;
// PEXPIRE only fires on the first hit per window (count === 1).
//
// Env vars (KV_REST_API_URL, KV_REST_API_TOKEN) are auto-provisioned by the
// Vercel Marketplace Upstash for Redis integration.

import { Redis } from "@upstash/redis";

type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

let redisClient: Redis | null = null;
function redis(): Redis {
  if (!redisClient) {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    if (!url || !token) {
      throw new Error(
        "Missing Upstash Redis credentials: KV_REST_API_URL and KV_REST_API_TOKEN must be set. " +
          "Link an Upstash for Redis integration in the Vercel dashboard, then run " +
          "`vercel env pull .env.local` for local development.",
      );
    }
    redisClient = new Redis({ url, token });
  }
  return redisClient;
}

export async function checkRateLimit(
  key: string,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const bucketKey = `rl:${key}:${Math.floor(Date.now() / options.windowMs)}`;
  const count = await redis().incr(bucketKey);

  if (count === 1) {
    await redis().pexpire(bucketKey, options.windowMs);
  }

  const ttl = await redis().pttl(bucketKey);
  const resetAt = Date.now() + (ttl > 0 ? ttl : options.windowMs);

  if (count > options.limit) {
    return { allowed: false, remaining: 0, resetAt };
  }

  return {
    allowed: true,
    remaining: Math.max(0, options.limit - count),
    resetAt,
  };
}
