/**
 * Plan Architect eval CLI.
 *
 * Usage:
 *   npx tsx scripts/eval.ts "A decision log for small teams"
 *   npx tsx scripts/eval.ts --brief path/to/brief.json
 *
 * Environment:
 *   OPENROUTER_API_KEY — required, used to test the starter prompt against a real coding agent
 *   OPENROUTER_MODEL   — optional, defaults to anthropic/claude-sonnet-4.6
 *   PLAN_API_URL       — optional, defaults to http://localhost:3000/api/plan
 */
import { config as loadEnv } from "dotenv";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

if (existsSync(".env.local")) loadEnv({ path: ".env.local" });
if (existsSync(".env")) loadEnv({ path: ".env" });

const DEFAULT_MODEL = "anthropic/claude-sonnet-4.6";

type StarterPromptBrief = {
  starterPrompt?: string;
  featureSpecifications?: Array<{
    name?: string;
    priority?: string;
    userStory?: string;
  }>;
  appSummary?: string;
};

type EvalReport = {
  generatedAt: string;
  input: { idea?: string; briefPath?: string };
  model: string | null;
  starterPrompt: {
    length: number;
    hasIntent: boolean;
    hasHardConstraints: boolean;
    hasMvpSlice: boolean;
    hasFileLayout: boolean;
    hasStartHere: boolean;
  };
  agentResponse: {
    durationMs: number;
    text: string;
    filePathCount: number;
    stepCount: number;
    ambiguityCount: number;
    p1OverlapRatio: number;
    p1MatchedTokens: string[];
    referencesP1: boolean;
  };
};

type ParsedArgs =
  | { kind: "brief"; briefPath: string }
  | { kind: "idea"; idea: string };

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  if (args.length === 0) {
    throw new Error("Usage: tsx scripts/eval.ts <idea> | --brief <path>");
  }
  if (args[0] === "--brief") {
    if (!args[1]) throw new Error("--brief requires a path");
    return { kind: "brief", briefPath: args[1] };
  }
  return { kind: "idea", idea: args.join(" ") };
}

async function fetchBrief(idea: string): Promise<{
  brief: StarterPromptBrief;
  model: string | null;
}> {
  const url = process.env.PLAN_API_URL ?? "http://localhost:3000/api/plan";
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idea, mode: "specKit", tutorial: false }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Plan API responded with ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let brief: StarterPromptBrief | null = null;
  let model: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (line.length > 0) {
        try {
          const event = JSON.parse(line) as
            | { type: "done"; brief: StarterPromptBrief; model: string }
            | { type: "partial" | "status" | "error" };
          if (event.type === "done") {
            brief = event.brief;
            model = event.model;
          }
        } catch {
          // ignore
        }
      }
      newlineIndex = buffer.indexOf("\n");
    }
  }

  if (!brief) throw new Error("Plan API did not return a final brief.");
  return { brief, model };
}

function loadBriefFromFile(path: string): StarterPromptBrief {
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as StarterPromptBrief;
}

function scoreStarterPrompt(text: string): EvalReport["starterPrompt"] {
  const lower = text.toLowerCase();
  return {
    length: text.length,
    hasIntent: lower.includes("# intent"),
    hasHardConstraints: lower.includes("# hard constraints"),
    hasMvpSlice: lower.includes("# mvp slice"),
    hasFileLayout: lower.includes("# file layout"),
    hasStartHere: lower.includes("# start here"),
  };
}

async function probeAgent(starterPrompt: string): Promise<{
  durationMs: number;
  text: string;
}> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is required.");
  }
  const model = process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL;

  const start = performance.now();
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        messages: [
          {
            role: "system",
            content:
              "You are a coding agent receiving a fresh project. Without writing code yet, respond with: (a) the first 3 files you would create with their concrete paths and a one-line purpose each, (b) the first 5 implementation steps numbered, (c) any ambiguities or unanswered questions about the spec.",
          },
          { role: "user", content: starterPrompt },
        ],
      }),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `OpenRouter responded with ${response.status}: ${errorBody}`,
    );
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const durationMs = performance.now() - start;
  const text = payload.choices?.[0]?.message?.content ?? "";

  return { durationMs, text };
}

function scoreAgentResponse(
  text: string,
  brief: StarterPromptBrief,
): Omit<EvalReport["agentResponse"], "durationMs" | "text"> {
  const filePathMatches =
    text.match(/`[A-Za-z0-9_./-]+\.(ts|tsx|js|jsx|py|sql|md|json|css)`/g) ?? [];
  const stepMatches = text.match(/^\s*\d+\.\s/gm) ?? [];
  const ambiguityMatches =
    text
      .toLowerCase()
      .match(
        /\b(unclear|ambiguous|unspecified|missing|undefined|tbd|need(?: to)? clarif)/g,
      ) ?? [];

  const p1Story = (brief.featureSpecifications ?? []).find(
    (feature) => feature.priority === "P1",
  );
  const { ratio: p1OverlapRatio, matched: p1MatchedTokens } = scoreP1Overlap(
    p1Story,
    text,
  );
  // Threshold: at least a quarter of the distinctive tokens from the P1 user
  // story appear in the agent response. Tuned loose on purpose — small briefs
  // can have only a handful of distinctive words.
  const referencesP1 = p1OverlapRatio >= 0.25;

  return {
    filePathCount: filePathMatches.length,
    stepCount: stepMatches.length,
    ambiguityCount: ambiguityMatches.length,
    p1OverlapRatio: Number(p1OverlapRatio.toFixed(3)),
    p1MatchedTokens,
    referencesP1,
  };
}

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "of",
  "to",
  "in",
  "on",
  "for",
  "with",
  "by",
  "from",
  "as",
  "at",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "i",
  "you",
  "they",
  "we",
  "he",
  "she",
  "them",
  "their",
  "our",
  "us",
  "my",
  "your",
  "via",
  "into",
  "over",
  "under",
  "between",
  "than",
  "then",
  "so",
  "if",
  "when",
  "while",
  "each",
  "any",
  "all",
  "every",
  "such",
  "also",
  "just",
  "very",
  "user",
  "users",
  "app",
  "apps",
  "application",
  "system",
  "systems",
  "feature",
  "features",
  "brief",
  "plan",
  "project",
  "can",
  "will",
  "may",
  "should",
  "must",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "not",
  "no",
  "yes",
  "new",
  "one",
  "two",
  "three",
  "p1",
  "p2",
  "p3",
  "p4",
  "p5",
  "tester",
  "testers",
  "story",
]);

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z0-9-]{3,}/g) ?? []).filter(
    (token) => !STOPWORDS.has(token),
  );
}

function scoreP1Overlap(
  p1Story:
    | NonNullable<StarterPromptBrief["featureSpecifications"]>[number]
    | undefined,
  agentText: string,
): { ratio: number; matched: string[] } {
  if (!p1Story?.userStory) return { ratio: 0, matched: [] };
  const storyTokens = new Set(tokenize(p1Story.userStory));
  if (storyTokens.size === 0) return { ratio: 0, matched: [] };
  const agentTokens = new Set(tokenize(agentText));
  const matched: string[] = [];
  for (const token of storyTokens) {
    if (agentTokens.has(token)) matched.push(token);
  }
  return { ratio: matched.length / storyTokens.size, matched };
}

async function main() {
  const parsed = parseArgs(process.argv);

  let brief: StarterPromptBrief;
  let model: string | null = null;
  if (parsed.kind === "brief") {
    brief = loadBriefFromFile(parsed.briefPath);
  } else {
    const result = await fetchBrief(parsed.idea);
    brief = result.brief;
    model = result.model;
  }

  const starterPrompt = brief.starterPrompt ?? "";
  if (!starterPrompt) throw new Error("Brief is missing a starterPrompt.");

  const starterScore = scoreStarterPrompt(starterPrompt);
  const probe = await probeAgent(starterPrompt);
  const responseScore = scoreAgentResponse(probe.text, brief);

  const report: EvalReport = {
    generatedAt: new Date().toISOString(),
    input:
      parsed.kind === "brief"
        ? { briefPath: parsed.briefPath }
        : { idea: parsed.idea },
    model,
    starterPrompt: starterScore,
    agentResponse: {
      ...responseScore,
      durationMs: probe.durationMs,
      text: probe.text,
    },
  };

  const outDir = join(process.cwd(), "eval", "results");
  mkdirSync(outDir, { recursive: true });
  const filename = `${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const outPath = join(outDir, filename);
  writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

  console.log(`Eval written to ${outPath}`);
  console.log(
    `Starter sections present: ${
      Object.entries(starterScore).filter(
        ([key, value]) => key.startsWith("has") && value === true,
      ).length
    } / 5`,
  );
  console.log(
    `Agent response: ${responseScore.filePathCount} file paths, ${responseScore.stepCount} steps, ${responseScore.ambiguityCount} ambiguities, P1 overlap: ${responseScore.p1OverlapRatio} (${responseScore.p1MatchedTokens.length} tokens, referenced: ${responseScore.referencesP1})`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
