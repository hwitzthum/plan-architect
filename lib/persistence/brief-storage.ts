import type { ProjectBriefWithStarter } from "@/lib/ai/planner-schema";

const STORAGE_PREFIX = "plan-architect:brief:";
const LAST_BRIEF_KEY = "plan-architect:last-brief-id";
const SHARE_HASH_KEY = "s";

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
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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

export function loadBrief(id: string): StoredBrief | null {
  if (!isBrowser()) return null;
  const raw = localStorage.getItem(STORAGE_PREFIX + id);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredBrief;
  } catch {
    return null;
  }
}

export function loadLastBrief(): StoredBrief | null {
  if (!isBrowser()) return null;
  const id = localStorage.getItem(LAST_BRIEF_KEY);
  if (!id) return null;
  return loadBrief(id);
}

export function listBriefs(): StoredBrief[] {
  if (!isBrowser()) return [];
  const briefs: StoredBrief[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      briefs.push(JSON.parse(raw) as StoredBrief);
    } catch {
      // ignore corrupted entry
    }
  }
  return briefs.sort((a, b) => b.savedAt - a.savedAt);
}

export function deleteBrief(id: string): void {
  if (!isBrowser()) return;
  localStorage.removeItem(STORAGE_PREFIX + id);
  if (localStorage.getItem(LAST_BRIEF_KEY) === id) {
    localStorage.removeItem(LAST_BRIEF_KEY);
  }
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
