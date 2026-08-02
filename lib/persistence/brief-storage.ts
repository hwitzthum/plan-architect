import { z } from "zod";

import {
  projectBriefSchema,
  type ProjectBriefWithStarter,
} from "@/lib/ai/planner-schema";

const STORAGE_PREFIX = "plan-architect:brief:";
const LAST_BRIEF_KEY = "plan-architect:last-brief-id";
const SHARE_HASH_KEY = "s";

const storedBriefSchema = z.object({
  id: z.string().min(1),
  idea: z.string(),
  model: z.string().nullable(),
  savedAt: z.number(),
  brief: projectBriefSchema.extend({
    starterPrompt: z.string(),
    mode: z.enum(["plain", "specKit"]),
  }),
});

export type StoredBrief = {
  id: string;
  idea: string;
  model: string | null;
  savedAt: number;
  brief: ProjectBriefWithStarter;
};

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function newBriefId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function saveBrief(record: StoredBrief): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_PREFIX + record.id, JSON.stringify(record));
    localStorage.setItem(LAST_BRIEF_KEY, record.id);
  } catch {
    // localStorage may be full or blocked; non-fatal.
  }
}

/** Internal: `loadLastBrief` is the way in from outside this module. */
function loadBrief(id: string): StoredBrief | null {
  if (!isBrowser()) return null;
  const raw = localStorage.getItem(STORAGE_PREFIX + id);
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    localStorage.removeItem(STORAGE_PREFIX + id);
    return null;
  }
  const result = storedBriefSchema.safeParse(parsed);
  if (!result.success) {
    // Stored shape no longer matches schema (drift / older version). Discard.
    localStorage.removeItem(STORAGE_PREFIX + id);
    if (localStorage.getItem(LAST_BRIEF_KEY) === id) {
      localStorage.removeItem(LAST_BRIEF_KEY);
    }
    return null;
  }
  return result.data as StoredBrief;
}

export function loadLastBrief(): StoredBrief | null {
  if (!isBrowser()) return null;
  const id = localStorage.getItem(LAST_BRIEF_KEY);
  if (!id) return null;
  return loadBrief(id);
}

export function readShareIdFromHash(hash: string): string | null {
  const cleaned = hash.replace(/^#?/, "");
  const params = new URLSearchParams(cleaned);
  return params.get(SHARE_HASH_KEY);
}

export function buildShareUrlForId(id: string): string {
  if (!isBrowser()) return "";
  const url = new URL(window.location.href);
  url.hash = `${SHARE_HASH_KEY}=${id}`;
  return url.toString();
}

export function clearCurrentHash(): void {
  if (!isBrowser()) return;
  if (window.location.hash) {
    history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );
  }
}
