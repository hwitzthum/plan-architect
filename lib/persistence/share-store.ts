import type { ProjectBriefWithStarter } from "@/lib/ai/planner-schema";

export type SharedBrief = {
  id: string;
  idea: string;
  model: string | null;
  brief: ProjectBriefWithStarter;
  createdAt: number;
};

// In-memory share store. Suitable for a single-user deployment behind
// Vercel Password Protection. To migrate to durable storage (Vercel KV,
// Upstash Redis), swap the three functions below — `newShareId`, `putShare`,
// `getShare` — to a KV-backed implementation. The rest of the codebase
// imports through this module so no other files need to change.

type GlobalWithStore = typeof globalThis & {
  __planArchitectShareStore?: Map<string, SharedBrief>;
};

function store(): Map<string, SharedBrief> {
  const g = globalThis as GlobalWithStore;
  if (!g.__planArchitectShareStore) {
    g.__planArchitectShareStore = new Map();
  }
  return g.__planArchitectShareStore;
}

const MAX_ENTRIES = 500;
const TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export function newShareId(): string {
  return crypto.randomUUID();
}

function evictExpired(): void {
  const s = store();
  const cutoff = Date.now() - TTL_MS;
  for (const [id, record] of s) {
    if (record.createdAt < cutoff) {
      s.delete(id);
    }
  }
}

export function putShare(record: SharedBrief): void {
  evictExpired();
  const s = store();
  if (s.size >= MAX_ENTRIES) {
    const oldestKey = s.keys().next().value;
    if (oldestKey) s.delete(oldestKey);
  }
  s.set(record.id, record);
}

export function getShare(id: string): SharedBrief | null {
  const record = store().get(id);
  if (!record) return null;
  if (Date.now() - record.createdAt > TTL_MS) {
    store().delete(id);
    return null;
  }
  return record;
}
