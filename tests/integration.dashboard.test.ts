import assert from "node:assert/strict";
import test from "node:test";

// The Kommandozentrale-facing surface (dashboard F2.5).
//
// The two routes are the only way into this app that is not a person, so these
// tests are about the boundary and the delivery's shape — not about planning,
// which is /api/plan's business.

import { authenticated, configured } from "../lib/integration/auth";
import { briefToMarkdown } from "../lib/integration/brief-markdown";
import { manifest, runInputSchema } from "../lib/integration/manifest";
import { projectBriefSchema } from "../lib/ai/planner-schema";

const TOKEN = "dashboard-token-0123456789abcdef";

async function withEnv<T>(
  vars: Record<string, string | undefined>,
  fn: () => T | Promise<T>,
): Promise<T> {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(vars)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function request(token: string | null): Request {
  const headers: Record<string, string> = {};
  if (token !== null) headers.authorization = `Bearer ${token}`;
  return new Request("https://plan.example/api/run", {
    method: "POST",
    headers,
  });
}

const BRIEF = {
  appSummary: "Eine App, die Offerten aus Sprachnotizen erstellt.",
  targetUsers: ["Handwerksbetriebe", "Aussendienst"],
  coreFeatures: ["Sprachaufnahme", "Positionserkennung", "PDF-Export"],
  recommendedTechStack: ["Next.js", "Postgres"],
  pagesRoutes: [
    { path: "/", purpose: "Aufnahme starten" },
    { path: "/offerten", purpose: "Entwürfe prüfen" },
  ],
  dataModel: {
    entities: [
      {
        id: "offerte",
        name: "Offerte",
        description: "Ein Angebotsentwurf.",
        fields: ["id", "kunde", "positionen"],
      },
      {
        id: "kunde",
        name: "Kunde",
        description: "Wer die Offerte bekommt.",
        fields: ["id", "name"],
      },
    ],
    relationships: [
      {
        id: "offerte-kunde",
        sourceEntityId: "offerte",
        targetEntityId: "kunde",
        label: "gehört zu",
      },
    ],
  },
  buildPhases: [
    { name: "Aufnahme", goals: ["Audio entgegennehmen", "Transkribieren"] },
    { name: "Entwurf", goals: ["Positionen vorschlagen"] },
  ],
  risksEdgeCases: [
    { title: "Dialekt", mitigation: "Modell mit Schweizerdeutsch testen" },
  ],
};

test("the integration is unconfigured until a token is set", async () => {
  await withEnv({ DASHBOARD_TOKEN: undefined }, () => {
    assert.equal(configured(), false);
  });
  await withEnv({ DASHBOARD_TOKEN: TOKEN }, () => {
    assert.equal(configured(), true);
  });
});

test("a missing, malformed or wrong token is refused identically", async () => {
  await withEnv({ DASHBOARD_TOKEN: TOKEN }, async () => {
    for (const candidate of [
      null,
      "",
      "wrong",
      `${TOKEN}x`,
      TOKEN.slice(0, -1),
    ]) {
      assert.equal(
        await authenticated(request(candidate)),
        false,
        String(candidate),
      );
    }
    assert.equal(await authenticated(request(TOKEN)), true);
  });
});

test("no token configured means no caller is ever authenticated", async () => {
  await withEnv({ DASHBOARD_TOKEN: undefined }, async () => {
    assert.equal(await authenticated(request(TOKEN)), false);
  });
});

test("the manifest describes the capability and derives its input schema", () => {
  const document = manifest();

  assert.equal(document.app, "plan-architect");
  assert.equal(document.capabilities[0].resultKind, "plan");
  assert.deepEqual(Object.keys(document.input.properties ?? {}).sort(), [
    "clientRef",
    "idea",
    "mode",
  ]);
  // The derived schema is a JSON Schema, so its nodes are loosely typed —
  // narrowed here rather than asserted through `any`.
  const idea = document.input.properties?.idea;
  assert.ok(idea && typeof idea === "object" && "description" in idea);
  assert.match(String(idea.description), /Idee/);
});

/**
 * The run contract is public. If /api/plan's own bounds move, the manifest must
 * move with them rather than promising an input the planner will refuse.
 */
test("the input bounds agree with what /api/plan accepts", () => {
  assert.equal(runInputSchema.safeParse({ idea: "zu kurz" }).success, false);
  assert.equal(
    runInputSchema.safeParse({ idea: "x".repeat(2001) }).success,
    false,
  );
  assert.equal(
    runInputSchema.safeParse({ idea: "Eine App für Offerten" }).success,
    true,
  );

  // The clarifier is an interactive loop with a person; a one-shot run has
  // nobody to ask, so the manifest must not advertise it.
  assert.equal(
    "clarifierAnswers" in (manifest().input.properties ?? {}),
    false,
  );
});

test("defaults to a plain brief without being asked", () => {
  assert.equal(
    runInputSchema.parse({ idea: "Eine App für Offerten" }).mode,
    "plain",
  );
});

test("the brief becomes a readable document", () => {
  const parsed = projectBriefSchema.safeParse(BRIEF);
  assert.equal(parsed.success, true, "the fixture must be a real brief");

  const markdown = briefToMarkdown(
    { ...BRIEF, starterPrompt: "Baue eine App, die …", mode: "plain" },
    "Offerten aus Sprachnotizen",
  );

  assert.match(markdown, /^# Offerten aus Sprachnotizen/);
  assert.match(markdown, /## Zusammenfassung/);
  assert.match(markdown, /- Handwerksbetriebe/);
  assert.match(markdown, /`\/offerten` — Entwürfe prüfen/);
  // Relationships read as ids in the data and as names to a person.
  assert.match(markdown, /Offerte → Kunde · gehört zu/);
  assert.match(markdown, /### 1\. Aufnahme/);
  assert.match(
    markdown,
    /\*\*Dialekt\*\* — Modell mit Schweizerdeutsch testen/,
  );
  // Fenced, because it is meant to be copied whole into an agent.
  assert.match(markdown, /## Startprompt\n\n```\nBaue eine App, die …\n```/);
});

test("a plain-mode brief carries no spec-kit section", () => {
  const markdown = briefToMarkdown({ ...BRIEF, mode: "plain" }, "Eine Idee");
  assert.equal(markdown.includes("Feature-Spezifikationen"), false);
});

test("a spec-kit brief carries its specifications", () => {
  const markdown = briefToMarkdown(
    {
      ...BRIEF,
      mode: "specKit",
      featureSpecifications: [
        {
          name: "Sprachaufnahme",
          priority: "P1",
          userStory: "Als Monteur spreche ich die Positionen ein.",
          whyPriority: "Ohne sie gibt es keinen Entwurf.",
          independentTest: "Eine Aufnahme erzeugt einen Entwurf.",
          acceptanceScenarios: ["Gegeben eine Aufnahme, dann ein Entwurf"],
          edgeCases: ["Lärm auf der Baustelle"],
          functionalRequirements: [
            { id: "FR-001", requirement: "Audio bis 10 Minuten aufnehmen" },
          ],
          successCriteria: [
            { id: "SC-001", outcome: "80 % der Positionen erkannt" },
          ],
          assumptions: ["Das Handy hat ein Mikrofon"],
        },
      ],
    } as Parameters<typeof briefToMarkdown>[0],
    "Eine Idee",
  );

  assert.match(markdown, /## Feature-Spezifikationen/);
  assert.match(markdown, /### 1\. Sprachaufnahme — P1/);
  assert.match(markdown, /Lärm auf der Baustelle/);
  // Ids travel with the text: an agent working from this brief refers to them.
  assert.match(markdown, /- FR-001 — Audio bis 10 Minuten aufnehmen/);
  assert.match(markdown, /- SC-001 — 80 % der Positionen erkannt/);
});
