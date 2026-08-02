// Remembering what was delivered against a caller's key (dashboard F2.2/F2.5).
//
// A run takes minutes, so a caller whose HTTP timeout is shorter *will* retry —
// that is a certainty at this duration, not an edge case. Without a guard the
// retry pays for a second full generation, which is the one failure that costs
// real money rather than merely being wrong.
//
// The naive version — a cache of finished deliveries — does not help, because
// the expensive retry is the one that arrives while the first run is still in
// flight. So this is a *claim*, taken atomically before the planner is touched:
//
//   fresh      the caller owns this run; nothing else has claimed the key
//   running    an earlier call is still working on it; do not start a second
//   delivered  it finished; here is what it produced, no pipeline involved
//   unguarded  there is no shared store, so nothing can be promised
//
// Fails **open**, unlike the rate limiter. A dedup store that is down should not
// stop work from happening: the cost of running twice is a second generation,
// where the cost of refusing is that the dashboard cannot run this app at all.
// The dashboard's own unique index still keeps a replayed delivery from
// becoming a duplicate row on its side.

import { logWarn } from "@/lib/logger";
import { redis } from "@/lib/redis";

export type Delivery = { resultId: string; resultUrl: string };

export type Claim =
  | { state: "fresh" }
  | { state: "running" }
  | { state: "delivered"; delivery: Delivery }
  | { state: "unguarded" };

/**
 * Longer than /api/run's own 300 s ceiling, so a process that dies mid-run
 * releases its key by expiry rather than locking the caller out of retrying.
 */
const RUNNING_TTL_MS = 10 * 60 * 1000;

/** How long a finished run stays replayable. A retry is minutes away, not days. */
const DELIVERED_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * The store this needs, which is smaller than a Redis. Injectable so the
 * behaviour above can be tested without one — the seam is the abstraction, not
 * a hook cut into the module for the tests' benefit.
 */
export type ClaimStore = {
  /** Writes only if the key is absent. True when this caller took it. */
  claim(key: string, value: string, ttlMs: number): Promise<boolean>;
  read(key: string): Promise<string | null>;
  write(key: string, value: string, ttlMs: number): Promise<void>;
  drop(key: string): Promise<void>;
};

function redisStore(): ClaimStore | null {
  const client = redis();
  if (!client) return null;

  return {
    async claim(key, value, ttlMs) {
      return (await client.set(key, value, { nx: true, px: ttlMs })) === "OK";
    },
    async read(key) {
      // Upstash decodes JSON responses, so a stored object can come back as an
      // object rather than the string it was written as. Normalise both.
      const value = await client.get<unknown>(key);
      if (value === null || value === undefined) return null;
      return typeof value === "string" ? value : JSON.stringify(value);
    },
    async write(key, value, ttlMs) {
      await client.set(key, value, { px: ttlMs });
    },
    async drop(key) {
      await client.del(key);
    },
  };
}

function keyFor(clientRef: string): string {
  return `run:plan:${clientRef}`;
}

function parse(raw: string): Claim {
  try {
    const value = JSON.parse(raw) as {
      status?: string;
      resultId?: string;
      resultUrl?: string;
    };
    if (value.status === "delivered" && value.resultId && value.resultUrl) {
      return {
        state: "delivered",
        delivery: { resultId: value.resultId, resultUrl: value.resultUrl },
      };
    }
  } catch {
    // A value this module did not write, or wrote in an older shape. Treating
    // it as a run in progress is the safe reading: it expires on its own.
  }
  return { state: "running" };
}

/** Takes the key for this run, or reports who already has it. */
export async function claimRun(
  clientRef: string,
  store: ClaimStore | null = redisStore(),
): Promise<Claim> {
  if (!store) return { state: "unguarded" };

  const key = keyFor(clientRef);

  try {
    if (
      await store.claim(
        key,
        JSON.stringify({ status: "running" }),
        RUNNING_TTL_MS,
      )
    ) {
      return { state: "fresh" };
    }

    const existing = await store.read(key);
    // Claimed by someone, yet gone by the time it was read: it expired in the
    // gap. "running" is the conservative answer and self-correcting — the next
    // retry finds the key absent and claims it.
    return existing === null ? { state: "running" } : parse(existing);
  } catch (error) {
    logWarn({
      route: "replay",
      message: `claim failed, running unguarded: ${error instanceof Error ? error.message : "unknown error"}`,
    });
    return { state: "unguarded" };
  }
}

/** Records what this key produced, so a later retry gets it back for nothing. */
export async function completeRun(
  clientRef: string,
  delivery: Delivery,
  store: ClaimStore | null = redisStore(),
): Promise<void> {
  if (!store) return;

  try {
    await store.write(
      keyFor(clientRef),
      JSON.stringify({ status: "delivered", ...delivery }),
      DELIVERED_TTL_MS,
    );
  } catch {
    // The run succeeded and the caller is about to be told so. Failing to
    // remember it costs a second generation on a retry; throwing here would
    // cost the delivery that already exists.
  }
}

/**
 * Gives the key back after a failed run.
 *
 * Without this a run that failed would hold its claim for the full ten minutes
 * and answer `409` to the retry that was meant to fix it.
 */
export async function releaseRun(
  clientRef: string,
  store: ClaimStore | null = redisStore(),
): Promise<void> {
  if (!store) return;
  try {
    await store.drop(keyFor(clientRef));
  } catch {
    // Expires by itself; nothing here is worth failing a response over.
  }
}
