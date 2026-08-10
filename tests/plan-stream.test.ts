import assert from "node:assert/strict";
import test from "node:test";

// The NDJSON event stream behind POST /api/plan.
//
// These exercise what has actually gone wrong here: a brief that never
// finished being emitted as if it had. That is a property of createPlanStream,
// so it needs no LLM — the partial stream and the distill step are injected.

import { createPlanStream, type PlanStreamDeps } from "../lib/ai/plan-stream";

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
