// Upstash Redis implementation of the share store.
//
// Setup:
//   1. In the Vercel dashboard, link an Upstash for Redis integration from
//      the Marketplace. The integration auto-provisions KV_REST_API_URL and
//      KV_REST_API_TOKEN (legacy Vercel KV naming, kept for compatibility).
//   2. For local dev, pull those vars via `vercel env pull .env.local`.

import type { ProjectBriefWithStarter } from "@/lib/ai/planner-schema";
import { redis } from "@/lib/redis";

export type SharedBrief = {
  id: string;
  idea: string;
  model: string | null;
  brief: ProjectBriefWithStarter;
  createdAt: number;
};

const KEY_PREFIX = "share:";
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

/**
 * The shared client, plus this feature's own answer to it being absent.
 *
 * Sharing a brief has no degraded mode — there is nowhere to put the record —
 * so unlike the rate limiter and the replay guard, which each decide for
 * themselves what a missing store means, this throws and says how to fix it.
 * Resolving the credentials is `lib/redis.ts`'s job; what to do without them
 * belongs here.
 */
function requireRedis() {
  const client = redis();
  if (!client) {
    throw new Error(
      "Missing Upstash Redis credentials: set KV_REST_API_URL/KV_REST_API_TOKEN " +
        "(or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN). Create an Upstash for " +
        "Redis database (Vercel Marketplace or your own Upstash account), then run " +
        "`vercel env pull .env.local` for local development.",
    );
  }
  return client;
}

export function newShareId(): string {
  return crypto.randomUUID();
}

export async function putShare(record: SharedBrief): Promise<void> {
  await requireRedis().set(`${KEY_PREFIX}${record.id}`, record, {
    ex: TTL_SECONDS,
  });
}

export async function getShare(id: string): Promise<SharedBrief | null> {
  const record = await requireRedis().get<SharedBrief>(`${KEY_PREFIX}${id}`);
  return record ?? null;
}
