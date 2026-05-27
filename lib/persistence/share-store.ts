// Upstash Redis implementation of the share store.
//
// Setup:
//   1. In the Vercel dashboard, link an Upstash for Redis integration from
//      the Marketplace. The integration auto-provisions KV_REST_API_URL and
//      KV_REST_API_TOKEN (legacy Vercel KV naming, kept for compatibility).
//   2. For local dev, pull those vars via `vercel env pull .env.local`.

import { Redis } from "@upstash/redis";

import type { ProjectBriefWithStarter } from "@/lib/ai/planner-schema";

export type SharedBrief = {
  id: string;
  idea: string;
  model: string | null;
  brief: ProjectBriefWithStarter;
  createdAt: number;
};

const KEY_PREFIX = "share:";
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

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

export function newShareId(): string {
  return crypto.randomUUID();
}

export async function putShare(record: SharedBrief): Promise<void> {
  await redis().set(`${KEY_PREFIX}${record.id}`, record, { ex: TTL_SECONDS });
}

export async function getShare(id: string): Promise<SharedBrief | null> {
  const record = await redis().get<SharedBrief>(`${KEY_PREFIX}${id}`);
  return record ?? null;
}
