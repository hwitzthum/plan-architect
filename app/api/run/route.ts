// POST /api/run — the Kommandozentrale asks for a project brief.
//
// The planning is NOT reimplemented here. This calls the app's own /api/plan
// handler in-process and reads the `done` event off its NDJSON stream.
//
// That route carries the planner prompt, the model configuration, the output
// schema, the rate limits and — usefully for this integration — the starter
// prompt distillation, which it already performs before finishing. A second
// path beside it would be free to drift into producing briefs the app itself
// would not, and the dashboard would be the only place that showed. Calling it
// over HTTP would work too (isSameOrigin allows an Origin-less
// server-to-server request) but spends a second function invocation to reach a
// function this process already has.

import { z } from "zod";

import { POST as plan } from "@/app/api/plan/route";
import type { ProjectBrief } from "@/lib/ai/planner-schema";
import { authenticated, configured } from "@/lib/integration/auth";
import {
  deliverPlan,
  DeliveryError,
  deliveryConfigured,
} from "@/lib/integration/deliver";
import { APP_ID, runInputSchema } from "@/lib/integration/manifest";
import { claimRun, completeRun, releaseRun } from "@/lib/integration/replay";
import { logError, logWarn, newRequestId } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientKey } from "@/lib/request-utils";

export const runtime = "nodejs";
// Matches /api/plan's own ceiling: this waits for all of it.
export const maxDuration = 300;

type DoneEvent = {
  type: "done";
  brief: ProjectBrief & { starterPrompt?: string; mode?: string };
  model?: string;
};

export async function POST(request: Request) {
  const requestId = newRequestId();

  if (!configured() || !deliveryConfigured()) {
    return Response.json(
      { error: "This deployment is not connected to a dashboard." },
      { status: 503 },
    );
  }

  /*
   * Counted before the token is checked, like every other route here: an
   * unauthenticated flood should be metered rather than merely rejected fast.
   *
   * The same ceiling as /api/plan, because each run *is* a plan — and this is
   * the one endpoint a leaked DASHBOARD_TOKEN could spend real money through.
   * The replay guard below only stops a repeat of the *same* clientRef; ten
   * distinct ideas an hour is what actually bounds the bill.
   */
  const limit = await checkRateLimit(`run:${getClientKey(request)}`, {
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });

  if (!limit.allowed) {
    if (limit.status === "unavailable") {
      return Response.json(
        { error: "Service temporarily unavailable. Try again shortly." },
        { status: 503 },
      );
    }
    return Response.json(
      { error: "Too many runs. Try again later." },
      { status: 429, headers: { "retry-after": "3600" } },
    );
  }

  if (!(await authenticated(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = runInputSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid input", issues: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }

  const { idea, mode, clientRef } = parsed.data;
  // The caller's ref when it sent one; ours otherwise. Only the caller's makes
  // a retry idempotent — ours is new on every request by definition, so a run
  // without one claims a key nothing will ever ask for again.
  const ref = clientRef ?? requestId;

  /*
   * Claimed before the planner is touched. A run costs minutes and money, and
   * the retry that matters is the one arriving while the first is still in
   * flight — see lib/integration/replay.ts.
   */
  const claim = await claimRun(ref);

  if (claim.state === "delivered") {
    return Response.json({
      ok: true,
      app: APP_ID,
      requestId,
      ...claim.delivery,
      replayed: true,
    });
  }

  if (claim.state === "running") {
    return Response.json(
      {
        error:
          "Ein Lauf mit dieser clientRef ist noch unterwegs. " +
          "Dieselbe ID erneut senden, sobald er fertig ist.",
      },
      { status: 409, headers: { "retry-after": "60" } },
    );
  }

  let done: DoneEvent | null = null;
  let failure: string | null = null;
  /*
   * Every path out of here that is not a delivery has to give the key back, or
   * the retry meant to fix a failed run meets this run's own `409` for the next
   * ten minutes. A flag and a `finally` cover them all — including the ones a
   * later edit adds, which is the point of doing it this way rather than
   * releasing at each `return`.
   */
  let delivered = false;

  try {
    try {
      const inner = await plan(
        new Request("https://internal.invalid/api/plan", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ idea, mode }),
          signal: request.signal,
        }),
      );

      if (!inner.ok || !inner.body) {
        const detail = (await inner.json().catch(() => null)) as {
          error?: string;
        } | null;
        return Response.json(
          { error: detail?.error ?? "The plan architect refused the run." },
          { status: inner.status },
        );
      }

      for await (const event of ndjson(inner.body)) {
        if (event.type === "done") done = event as unknown as DoneEvent;
        // The planner reports its own failures on the stream rather than by
        // throwing; keep the message it wrote.
        else if (event.type === "error" && typeof event.error === "string") {
          failure = event.error;
        }
        // `partial` events are the live preview for a browser. Nothing here
        // watches a plan being written, so they are read and dropped.
      }
    } catch (error) {
      logError({ route: "run", requestId, error });
      return Response.json(
        { error: "The run failed unexpectedly." },
        { status: 500 },
      );
    }

    if (failure || !done?.brief) {
      logWarn({
        route: "run",
        requestId,
        message: `run produced no brief (${failure ?? "stream ended without a done event"})`,
      });
      return Response.json(
        { error: failure ?? "The run finished without producing a brief." },
        { status: 502 },
      );
    }

    try {
      const result = await deliverPlan({
        idea,
        mode,
        brief: done.brief,
        clientRef: ref,
        model: done.model ?? null,
        signal: request.signal,
      });

      // Recorded before the response, so the retry that crosses it in flight
      // finds a delivery rather than a claim it has to wait behind.
      await completeRun(ref, {
        resultId: result.resultId,
        resultUrl: result.resultUrl,
      });
      delivered = true;

      return Response.json({
        ok: true,
        app: APP_ID,
        requestId,
        ...result,
      });
    } catch (error) {
      if (error instanceof DeliveryError) {
        logError({ route: "run", requestId, error });
        return Response.json(
          { error: error.message },
          { status: error.status },
        );
      }
      throw error;
    }
  } finally {
    if (!delivered) await releaseRun(ref);
  }
}

/** Parses the NDJSON stream a line at a time, tolerating split chunks. */
async function* ndjson(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<Record<string, unknown>> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf("\n");

    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");

      if (!line) continue;
      try {
        yield JSON.parse(line) as Record<string, unknown>;
      } catch {
        // A malformed line is the stream's problem, not this loop's.
      }
    }
  }
}
