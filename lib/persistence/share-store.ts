import type { ProjectBriefWithStarter } from "@/lib/ai/planner-schema";

export type SharedBrief = {
  id: string;
  idea: string;
  model: string | null;
  brief: ProjectBriefWithStarter;
  createdAt: number;
};

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

export function newShareId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function putShare(record: SharedBrief): void {
  const s = store();
  if (s.size >= MAX_ENTRIES) {
    // Drop the oldest entry to bound memory usage.
    const oldestKey = s.keys().next().value;
    if (oldestKey) s.delete(oldestKey);
  }
  s.set(record.id, record);
}

export function getShare(id: string): SharedBrief | null {
  return store().get(id) ?? null;
}
