import assert from "node:assert/strict";
import test from "node:test";

// The NDJSON event stream behind POST /api/plan.
//
// These exercise what has actually gone wrong here: a brief that never
// finished being emitted as if it had. That is a property of createPlanStream,
// so it needs no LLM — the partial stream and the distill step are injected.

import {
  createPlanStream,
  createWriter,
  type PlanStreamDeps,
  type StreamSink,
} from "../lib/ai/plan-stream";

const BRIEF = {
  appSummary: "Eine App, die Offerten aus Sprachnotizen erstellt.",
  targetUsers: ["Handwerksbetriebe"],
  coreFeatures: ["Sprachaufnahme", "PDF-Export"],
  recommendedTechStack: ["Next.js"],
  pagesRoutes: [{ path: "/", purpose: "Aufnahme starten" }],
  dataModel: {
    entities: [
      {
        id: "offerte",
        name: "Offerte",
        description: "Ein Angebotsentwurf.",
        fields: ["id", "kunde"],
      },
    ],
    relationships: [],
  },
  buildPhases: [{ name: "Aufnahme", goals: ["Audio entgegennehmen"] }],
  risksEdgeCases: [{ title: "Dialekt", mitigation: "Modell testen" }],
};

async function* yields(...values: unknown[]) {
  for (const value of values) yield value;
}

function deps(overrides: Partial<PlanStreamDeps> = {}): PlanStreamDeps {
  return {
    partials: yields(BRIEF),
    distill: async () => ({ starterPrompt: "Baue eine App…", source: "llm" }),
    mode: "plain",
    modelId: "test/model",
    requestId: "req-test",
    aborted: () => false,
    ...overrides,
  };
}

async function collect(stream: ReadableStream<Uint8Array>) {
  const text = await new Response(stream).text();
  return text
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

test("a finished brief arrives as a done event carrying the starter prompt", async () => {
  const events = await collect(createPlanStream(deps()));

  assert.deepEqual(
    events.map((event) => event.type),
    ["partial", "status", "done"],
  );

  const done = events.at(-1)!;
  assert.equal(done.model, "test/model");
  assert.equal(done.starterPromptSource, "llm");
  const brief = done.brief as Record<string, unknown>;
  assert.equal(brief.starterPrompt, "Baue eine App…");
  assert.equal(brief.mode, "plain");
  assert.equal(brief.appSummary, BRIEF.appSummary);
});

test("a truncated brief is reported, never emitted as done", async () => {
  // What the stream leaves behind when the model runs into
  // AI_MAX_OUTPUT_TOKENS mid-object: early keys arrived, later ones did not.
  const truncated: Record<string, unknown> = { ...BRIEF };
  delete truncated.buildPhases;
  delete truncated.risksEdgeCases;

  let distillCalled = false;
  const events = await collect(
    createPlanStream(
      deps({
        partials: yields(truncated),
        distill: async () => {
          distillCalled = true;
          return { starterPrompt: "x", source: "llm" };
        },
      }),
    ),
  );

  assert.equal(
    events.some((event) => event.type === "done"),
    false,
    "a truncated brief must never reach done",
  );
  assert.equal(events.at(-1)!.type, "error");
  assert.equal(
    events.at(-1)!.error,
    "AI service returned an incomplete brief.",
  );
  // It must stop before the work, not merely refuse to report it.
  assert.equal(distillCalled, false);
});

test("a stream that yields nothing is reported as empty", async () => {
  const events = await collect(createPlanStream(deps({ partials: yields() })));

  assert.deepEqual(events, [
    { type: "error", error: "AI service returned an empty brief." },
  ]);
});

test("a failure mid-stream is reported rather than thrown", async () => {
  async function* explodes() {
    yield BRIEF;
    throw new Error("upstream LLM failure");
  }

  const events = await collect(
    createPlanStream(deps({ partials: explodes() })),
  );

  assert.equal(events.at(-1)!.type, "error");
  assert.equal(events.at(-1)!.error, "AI service is currently unavailable.");
});

// The writer, driven directly. Going through a ReadableStream cannot test this:
// the throw rejects the promise start() returns, the stream machinery handles
// that rejection, and the observable result is identical either way. A sink we
// control is what makes the guard's behaviour visible.

function cancelledSink(): StreamSink & { enqueued: number; closed: number } {
  const sink = {
    enqueued: 0,
    closed: 0,
    enqueue() {
      sink.enqueued += 1;
      throw new TypeError("Invalid state: Controller is already closed");
    },
    close() {
      sink.closed += 1;
      throw new TypeError("Invalid state: Controller is already closed");
    },
  };
  return sink;
}

test("writing to a cancelled stream does not throw", () => {
  const sink = cancelledSink();
  const { send, close } = createWriter(sink, new TextEncoder());

  // This is the call the error path makes to report an abort. Unguarded it
  // throws here and never reaches close().
  assert.doesNotThrow(() => send({ type: "error", error: "boom" }));
  assert.doesNotThrow(() => close());
});

test("a cancelled stream is written to once, then left alone", () => {
  const sink = cancelledSink();
  const { send, close } = createWriter(sink, new TextEncoder());

  send({ type: "partial" });
  send({ type: "status" });
  send({ type: "error" });
  close();

  // The first write discovers the reader is gone; the rest must not retry it,
  // and close() must not add a second throwing call on top.
  assert.equal(sink.enqueued, 1);
  assert.equal(sink.closed, 0);
});

test("an open stream is written to and closed exactly once", () => {
  const chunks: Uint8Array[] = [];
  let closed = 0;
  const { send, close } = createWriter(
    { enqueue: (c) => chunks.push(c), close: () => { closed += 1; } },
    new TextEncoder(),
  );

  send({ type: "partial" });
  close();
  close(); // idempotent — a second close must not reach the sink

  assert.equal(chunks.length, 1);
  assert.equal(closed, 1);
  assert.equal(
    new TextDecoder().decode(chunks[0]),
    JSON.stringify({ type: "partial" }) + "\n",
  );
});
