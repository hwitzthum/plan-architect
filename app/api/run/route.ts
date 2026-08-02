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
import { logError, logWarn, newRequestId } from "@/lib/logger";

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

  let done: DoneEvent | null = null;
  let failure: string | null = null;

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
    const delivered = await deliverPlan({
      idea,
      mode,
      brief: done.brief,
      // The caller's ref when it sent one; ours otherwise. Only the caller's
      // makes a retry idempotent — ours is new on every request by definition.
      clientRef: clientRef ?? requestId,
      model: done.model ?? null,
      signal: request.signal,
    });

    return Response.json({
      ok: true,
      app: APP_ID,
      requestId,
      ...delivered,
    });
  } catch (error) {
    if (error instanceof DeliveryError) {
      logError({ route: "run", requestId, error });
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
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
