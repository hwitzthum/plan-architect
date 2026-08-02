import assert from "node:assert/strict";
import test from "node:test";

// The run replay guard (dashboard F2.2's idempotency rule, F2.5's app).
//
// What matters here is not caching a finished result — it is that the retry
// arriving *while the first run is still planning* does not start a second
// generation. So the tests are about the claim, not about storage.

import {
  claimRun,
  completeRun,
  releaseRun,
  type ClaimStore,
} from "../lib/integration/replay";

/** An in-memory ClaimStore. No TTLs — expiry is Redis's job, not this logic's. */
function memoryStore(): ClaimStore & { size: () => number } {
  const values = new Map<string, string>();
  return {
    async claim(key, value) {
      if (values.has(key)) return false;
      values.set(key, value);
      return true;
    },
    async read(key) {
      return values.get(key) ?? null;
    },
    async write(key, value) {
      values.set(key, value);
    },
    async drop(key) {
      values.delete(key);
    },
    size: () => values.size,
  };
}

/** A store that is configured and broken — the outage case. */
const brokenStore: ClaimStore = {
  async claim() {
    throw new Error("ECONNREFUSED");
  },
  async read() {
    throw new Error("ECONNREFUSED");
  },
  async write() {
    throw new Error("ECONNREFUSED");
  },
  async drop() {
    throw new Error("ECONNREFUSED");
  },
};

const REF = "run-42";
const DELIVERY = {
  resultId: "29",
  resultUrl: "https://dashboard.example/results/29",
};

test("the first caller takes the key", async () => {
  const store = memoryStore();
  assert.deepEqual(await claimRun(REF, store), { state: "fresh" });
});

/**
 * The expensive case. A run takes minutes, the caller times out and retries,
 * and the second call must not reach the planner.
 */
test("a retry arriving mid-run is told to wait, not run again", async () => {
  const store = memoryStore();

  assert.equal((await claimRun(REF, store)).state, "fresh");
  assert.equal((await claimRun(REF, store)).state, "running");
  assert.equal((await claimRun(REF, store)).state, "running");
});

test("a retry after the run finished gets the original delivery back", async () => {
  const store = memoryStore();

  await claimRun(REF, store);
  await completeRun(REF, DELIVERY, store);

  const claim = await claimRun(REF, store);
  assert.equal(claim.state, "delivered");
  assert.deepEqual(
    claim.state === "delivered" ? claim.delivery : null,
    DELIVERY,
  );
});

/**
 * A failed run must give its key back. Otherwise the retry meant to fix it
 * meets the failed run's own claim until that claim expires.
 */
test("a failed run releases its key for the retry", async () => {
  const store = memoryStore();

  await claimRun(REF, store);
  await releaseRun(REF, store);

  assert.deepEqual(await claimRun(REF, store), { state: "fresh" });
});

test("two different refs never collide", async () => {
  const store = memoryStore();

  assert.equal((await claimRun("a", store)).state, "fresh");
  assert.equal((await claimRun("b", store)).state, "fresh");
  assert.equal(store.size(), 2);
});

/**
 * Fails open, unlike the rate limiter: a dedup store that is down must not stop
 * the app from working. Running twice costs a generation; refusing costs the
 * integration entirely, and the dashboard's unique index still catches the
 * duplicate row.
 */
test("no store configured means every run proceeds unguarded", async () => {
  assert.deepEqual(await claimRun(REF, null), { state: "unguarded" });
  // Neither of these may throw with nothing to write to.
  await completeRun(REF, DELIVERY, null);
  await releaseRun(REF, null);
});

test("a store that is down is treated as no store at all", async () => {
  assert.deepEqual(await claimRun(REF, brokenStore), { state: "unguarded" });
  // The run has already succeeded by the time these are called; an outage here
  // must not turn a delivered plan into a failed request.
  await completeRun(REF, DELIVERY, brokenStore);
  await releaseRun(REF, brokenStore);
});

/** A value written by an older shape, or by something else, is not a delivery. */
test("an unreadable stored value is treated as a run in progress", async () => {
  const store = memoryStore();
  await store.write("run:plan:" + REF, "not json at all", 0);

  assert.deepEqual(await claimRun(REF, store), { state: "running" });
});

/** A delivery missing its ids is not a delivery — replaying it would return nothing. */
test("a half-written delivery is not replayed", async () => {
  const store = memoryStore();
  await store.write(
    "run:plan:" + REF,
    JSON.stringify({ status: "delivered", resultId: "29" }),
    0,
  );

  assert.deepEqual(await claimRun(REF, store), { state: "running" });
});
