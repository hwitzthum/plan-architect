import assert from "node:assert/strict";
import test from "node:test";

// The app must not generate a brief it will then refuse to store.
//
// /api/share caps `starterPrompt`, and the deterministic fallback
// buildStarterPromptFromBrief -- used whenever distillation fails -- is bounded
// only by the brief's own field caps. A 10 000 cap sat below what a realistic
// brief renders to, so those shares failed with a flat "Invalid share payload."

import { projectBriefSchema } from "../lib/ai/planner-schema";
import { buildStarterPromptFromBrief } from "../lib/ai/starter-prompt";

// Mirrors `starterPrompt: z.string().max(40_000)` in app/api/share/route.ts.
// If that cap is lowered, this is the test that should stop it.
const SHARE_STARTER_PROMPT_CAP = 40_000;

function brief(overrides: Record<string, unknown> = {}) {
  return projectBriefSchema.parse({
    appSummary: "A tool for turning voice notes into quotes.",
    targetUsers: ["Trades businesses"],
    coreFeatures: ["Recording", "PDF export"],
    recommendedTechStack: ["Next.js"],
    pagesRoutes: [{ path: "/", purpose: "Start a recording" }],
    dataModel: {
      entities: [
        {
          id: "quote",
          name: "Quote",
          description: "A draft quote.",
          fields: ["id", "customer"],
        },
      ],
      relationships: [],
    },
    buildPhases: [{ name: "Capture", goals: ["Accept audio"] }],
    risksEdgeCases: [{ title: "Dialect", mitigation: "Test the model" }],
    ...overrides,
  });
}

test("the fallback starter prompt for a realistic brief fits the share cap", () => {
  // Nothing pathological: a large-but-ordinary spec-kit brief. At the previous
  // 10 000 cap this rendered to ~16 700 characters and Share rejected it.
  const large = brief({
    coreFeatures: Array.from(
      { length: 12 },
      (_, i) => `Feature ${i + 1}: ` + "x".repeat(200),
    ),
    pagesRoutes: Array.from({ length: 10 }, (_, i) => ({
      path: `/p${i}`,
      purpose: "y".repeat(300),
    })),
    buildPhases: Array.from({ length: 6 }, (_, i) => ({
      name: `Phase ${i}`,
      goals: ["z".repeat(300), "w".repeat(300)],
    })),
    risksEdgeCases: Array.from({ length: 8 }, (_, i) => ({
      title: `Risk ${i}`,
      mitigation: "m".repeat(400),
    })),
  });

  const prompt = buildStarterPromptFromBrief(large);

  assert.ok(prompt.length > 10_000, "the fixture must be past the old cap");
  assert.ok(
    prompt.length <= SHARE_STARTER_PROMPT_CAP,
    `fallback renders to ${prompt.length} chars, over the ${SHARE_STARTER_PROMPT_CAP} share cap`,
  );
});

test("a brief with every text field at its schema maximum still fits", () => {
  const maximal = brief({
    appSummary: "A".repeat(8000), // longText cap
    targetUsers: ["B".repeat(400)], // shortText cap
    pagesRoutes: [{ path: "/", purpose: "E".repeat(2000) }], // mediumText cap
    buildPhases: [{ name: "I".repeat(400), goals: ["J".repeat(2000)] }],
    risksEdgeCases: [{ title: "K".repeat(400), mitigation: "L".repeat(2000) }],
  });

  const prompt = buildStarterPromptFromBrief(maximal);

  assert.ok(
    prompt.length <= SHARE_STARTER_PROMPT_CAP,
    `fallback renders to ${prompt.length} chars, over the ${SHARE_STARTER_PROMPT_CAP} share cap`,
  );
});
