# Plan Architect

Turn a rough app idea into an editable project brief and an executable starter prompt for a coding agent. The brief covers app summary, target users, features (plain or spec-kit), tech stack, routes, data model, build phases, risks, and a distilled hand-off prompt.

## What it does differently

- **Clarifying questions first.** An LLM reads the idea and returns 3–5 idea-aware questions before generating anything. Skip them if your idea is already specific.
- **Mode toggles.** Spec-kit mode adds FR-### / SC-### / Given-When-Then. Tutorial mode favours the smallest workable surface. Both default off — the planner picks a stack the idea actually needs.
- **Streaming brief.** Sections appear as they generate; no all-or-nothing 30-second blank wait.
- **LLM-authored starter prompt.** A second model call distils the brief into `Intent / Hard Constraints / MVP Slice / File Layout / Start Here` — not a regurgitation of the sections.
- **Per-section regenerate.** Each section has a Regenerate button with an optional inline constraint, so you can re-roll Risks ("focus on data privacy") without rebuilding the whole brief.
- **Local persistence & share links.** Briefs auto-save to localStorage. Share writes the brief to an in-memory server store and returns a short `#s=<id>` URL. Shares live until the server restarts — swap the store for KV/Redis for durability.
- **Eval CLI.** `scripts/eval.ts` pipes the starter prompt through Claude as a coding agent and scores the response — closes the feedback loop on prompt quality.

## Stack

Next.js App Router · React 19 · Tailwind CSS v4 · shadcn/ui · AI SDK v6 · OpenRouter · React Flow · Zod

## Environment

`.env.local`:

```bash
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=anthropic/claude-sonnet-4.6   # optional
```

The eval CLI uses the same `OPENROUTER_API_KEY`.

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Usage

1. Type a rough app idea.
2. Toggle Spec-kit and Tutorial modes if you want them.
3. Click **Generate brief** — the clarifier returns a few questions. Answer or skip.
4. The brief streams in. Edit any section directly, or click **Regenerate** on a section (with an optional constraint) to re-roll just that one.
5. Click **Regenerate from brief** on the starter prompt to redistill after edits.
6. **Copy prompt** into your coding agent. **Share** to copy a URL that decodes the brief on the other end.

Briefs auto-save locally — refresh to come back to the last one.

## API

| Endpoint                   | Purpose                                                          |
| -------------------------- | ---------------------------------------------------------------- |
| `POST /api/clarify`        | Returns 3–5 idea-aware clarifying questions.                     |
| `POST /api/plan`           | Streams a project brief (NDJSON: `partial` → `status` → `done`). |
| `POST /api/plan/section`   | Regenerates a single section of an existing brief.               |
| `POST /api/starter-prompt` | Re-distills the starter prompt from a brief.                     |
| `POST /api/share`          | Stores a brief in the in-memory share store; returns a short id. |
| `GET  /api/share?id=<id>`  | Returns the stored brief for `#s=<id>` hydration.                |

All endpoints share an in-memory rate limiter keyed by client IP (per-process; on Vercel cold starts reset it).

## Eval

See `eval/README.md`. Quick start:

```bash
npm run dev   # separate terminal
npx tsx scripts/eval.ts "A decision log for small teams"
# → eval/results/<timestamp>.json
```

## Scripts

```bash
npm run dev
npm run lint
npm run build
```
