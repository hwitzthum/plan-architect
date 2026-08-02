// The shared Upstash Redis client.
//
// Two features need it now — the rate limiter and the run replay guard — so the
// credential handling lives here rather than being written twice and drifting.
//
// Env vars: either the Vercel-KV names (auto-provisioned by the Marketplace
// Upstash for Redis integration) or Upstash's native names, so credentials work
// whichever way they are supplied.

import { Redis } from "@upstash/redis";

import { logWarn } from "@/lib/logger";

let redisClient: Redis | null = null;
let warnedDisabled = false;

export function redis(): Redis | null {
  if (!redisClient) {
    const url =
      process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
    const token =
      process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

    // No credentials — no shared store (e.g. local dev). Callers decide what
    // that means for them: the rate limiter fails closed in production, the
    // replay guard fails open, and both say so where they do it.
    if (!url || !token) {
      if (process.env.NODE_ENV === "production" && !warnedDisabled) {
        warnedDisabled = true;
        logWarn({
          route: "redis",
          message:
            "No Redis credentials in production: rate-limited routes will " +
            "fail closed (503) and repeated runs will not be deduplicated. " +
            "Set KV_REST_API_URL/TOKEN or UPSTASH_REDIS_REST_URL/TOKEN.",
        });
      }
      return null;
    }
    redisClient = new Redis({ url, token });
  }
  return redisClient;
}
