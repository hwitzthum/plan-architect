# Eval

A small CLI that closes the feedback loop on the starter prompts Plan Architect produces. The script does not benchmark — it gives you a repeatable signal that you can watch move as you change prompts.

## Why

The risk in this tool is that a starter prompt _reads_ well but is not _actionable_ by a real coding agent. The eval pipes the generated starter prompt into Claude as if it were a coding agent, then scores the response for the things that matter most: specificity (concrete file paths), traceability (does it reference the P1 user story), and clarity (how many ambiguities does the agent flag back).

## Setup

The script reads `.env.local` (and `.env`) automatically via `dotenv`. Make sure these are set:

```bash
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=anthropic/claude-sonnet-4.6   # optional
PLAN_API_URL=http://localhost:3000/api/plan    # optional
```

The agent-probe step calls OpenRouter directly so the same key powers both the planner and the eval.

## Run

Generate a brief and evaluate the starter prompt:

```bash
npm run dev   # in a separate terminal
npx tsx scripts/eval.ts "A decision log for small teams"
```

Or evaluate a pre-saved brief JSON (the brief must contain a `starterPrompt` field):

```bash
npx tsx scripts/eval.ts --brief ./my-brief.json
```

Reports land in `eval/results/<timestamp>.json`.

## What gets scored

**Starter prompt shape** — does the output contain all five expected sections (`# Intent`, `# Hard Constraints`, `# MVP Slice`, `# File Layout`, `# Start Here`)?

**Agent response**:

- `filePathCount` — how many concrete code paths the agent listed (looks for backtick-wrapped paths ending in `.ts/.tsx/.js/.jsx/.py/.sql/.md/.json/.css`).
- `stepCount` — how many numbered steps the agent emitted.
- `ambiguityCount` — how many times the agent flagged something as `unclear`, `ambiguous`, `unspecified`, `missing`, `TBD`, or said it needed clarification. **Higher is worse** — it means the prompt left too much undefined.
- `p1OverlapRatio` — fraction (0.0–1.0) of distinctive tokens from the P1 user story that appear in the agent response. Stopwords and very short words are dropped. Higher means the agent's plan is genuinely addressing the P1 slice rather than wandering.
- `p1MatchedTokens` — the actual words that overlapped. Useful for debugging false negatives.
- `referencesP1` — convenience boolean, true when `p1OverlapRatio >= 0.25`.
- `durationMs` — round-trip latency.

## Interpreting results

- High `filePathCount` (≥3), low `ambiguityCount` (≤1), `referencesP1: true` → the prompt is doing its job.
- Low `filePathCount` or high `ambiguityCount` → tighten the distillation prompt in `lib/ai/starter-distill-prompt.ts`, or improve the brief's spec-kit fields.
- `hasFileLayout: false` or `hasStartHere: false` → the LLM is skipping a required section. Make the system prompt stricter.

The numbers are loose. Trust direction of travel between runs more than absolute values.
