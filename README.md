# Plan Architect

Turn a rough app idea into an editable project brief and an executable starter prompt for a coding agent. The brief covers app summary, target users, features (plain or spec-kit), tech stack, routes, data model, build phases, risks, and a distilled hand-off prompt.

## Stack

Next.js App Router · React 19 · Tailwind CSS v4 · shadcn/ui · AI SDK v6 · OpenRouter · React Flow · Zod

## Environment

`.env` (or `.env.local`):

```bash
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=anthropic/claude-sonnet-4.6   # optional
```

The eval CLI reads the same key.

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

---

## A typical user journey

1. **Land on the page.** If you've used the app before, your last brief is restored from `localStorage`. Otherwise you see an empty dossier and a textarea.
2. **Type a rough idea** — one or two sentences. Example: _"A SaaS for tracking team OKRs with Stripe billing."_
3. **Decide on spec-kit mode.** Toggle it on if you want each feature spelled out in GitHub spec-kit format (priorities, FR-### / SC-###, Given/When/Then). Off by default.
4. **Click "Generate brief."** The clarifier returns 3–5 questions tailored to your idea. Answer the ones that matter; skip if you're already specific.
5. **Watch the brief stream in.** Sections appear as the model produces them — app summary first, then users, features, routes, data model, etc. The data-model panel renders a live React Flow diagram on the left.
6. **Edit anything in place.** Every text field is editable. Add or remove list items. Rename data-model entities — references update automatically.
7. **Re-roll a single section if it's off.** Each section has a Regenerate button. Open it, optionally type a constraint (_"focus on PCI compliance"_), hit Run. The rest of the brief stays put.
8. **Regenerate the starter prompt after edits.** The hand-off prompt at the bottom is LLM-distilled from the brief. Click "Regenerate from brief" to redistill once you've made changes.
9. **Copy the starter prompt** into your coding agent (Claude Code, Cursor, etc.).
10. **Share if needed.** Click "Share" to copy a short `#s=<id>` URL. Anyone with the link sees the same brief.
11. **Refresh later.** Your brief is auto-saved locally and waiting for you next time.

---

## Features in detail

### The idea form and clarifier

The textarea is intentionally a one-shot rough sketch — keep it short. Two sentences is plenty. When you click **Generate brief**, the app makes a short first LLM call to `/api/clarify` and returns 3–5 idea-specific questions before generating anything.

The questions are not boilerplate. For _"A SaaS for tracking team OKRs with Stripe billing"_ it will ask about OKR hierarchy depth, billing structure (per-seat vs flat vs tiered), and how teams update progress. For _"A decision log for small teams"_ it will ask about multi-user, persistence, and Slack integration. Each question has 2–5 mutually-exclusive options plus an optional **Other…** free-text fallback.

You can **Skip questions** at any time — useful when your idea already specifies the answers. Answered or skipped, your answers are forwarded as extra context to the brief-generation call.

### Spec-kit mode

Toggle this on when you want each feature spelled out in [GitHub spec-kit](https://github.com/github/spec-kit) format — the structured format senior product/engineering teams use to write reviewable specs.

With spec-kit mode ON, the brief generates **3 to 5 feature specifications**, each with:

- **Priority**: P1, P2, P3, ... (P1 is the must-have MVP slice; no duplicates, no gaps).
- **User story**: a plain-language sentence from the user's perspective.
- **Why this priority**: why this story ranks where it does relative to the others.
- **Independent test**: one concrete tester action and the observable value that proves the slice works on its own.
- **Acceptance scenarios** in Given/When/Then phrasing — 2 to 4 per story.
- **Functional requirements** numbered `FR-001`, `FR-002`, ... with `MUST` language. Unresolved details are marked `[NEEDS CLARIFICATION: ...]`.
- **Success criteria** numbered `SC-001`, `SC-002`, ... — measurable and technology-agnostic.
- **Edge cases** — short questions about boundary conditions.
- **Assumptions** the planner is making about scope.

With spec-kit mode OFF, the brief is **plain mode**: just `coreFeatures` as bullet labels. Faster to skim, less work to maintain, suitable for personal projects or quick prototypes.

You can toggle spec-kit on or off between generations. The starter prompt distillation deliberately _omits_ the `FR-###` / `SC-###` IDs — those are useful inside the dossier for editing and review, but adding them to an executable agent prompt creates noise without value.

The planner always picks a stack appropriate to the idea. If you describe a SaaS with Stripe billing, you'll get Stripe, Postgres, Prisma, NextAuth, and a background queue in the recommended stack — no apologies, no silent scope reduction. This is a tool for shipping real things, not tutorials.

### The streaming brief

The `/api/plan` endpoint streams NDJSON — one JSON event per line — with three event types:

- `partial` — a partial brief; the client renders a live preview that fills in section by section.
- `status` — short progress messages like "Distilling starter prompt…".
- `done` — the final brief plus the LLM-distilled starter prompt and model id.

This is why sections appear progressively in the UI rather than all at once. End-to-end time is typically ~25–45 seconds; first content shows up in 3–5 seconds.

### Per-section regenerate

Each section card with a Regenerate button covers one piece of the brief: Feature Specifications, Pages & Routes, Data Model, Build Phases, Risks & Edge Cases. Click **Regenerate**, optionally type a constraint, click **Run** (or press Enter).

Behind the scenes the app POSTs to `/api/plan/section` with:

- the current brief (as context — so the regeneration stays consistent with the rest of the plan),
- the section name to regenerate,
- your optional constraint string,
- the current modes.

The model replaces only that section. Other sections, your edits, and the starter prompt are untouched. Examples of useful constraints:

- Risks: _"focus on PCI compliance"_, _"only operational risks, not technical"_.
- Pages & Routes: _"add an admin dashboard"_, _"drop the public marketing pages"_.
- Build Phases: _"split into 5 phases instead of 3"_.
- Data Model: _"add a billing_event entity"_.

When the data model is regenerated, the client also prunes any relationships that reference entity ids that no longer exist — your visualisation stays consistent.

### The data model and React Flow visualisation

Two views on the same data:

**The Data Model editor card** is where you actually change things. Add an entity. Rename one (and every relationship referring to it is updated automatically). Edit fields as a newline-delimited list. Add or remove relationships using dropdowns of source/target entity ids.

**The React Flow diagram** on the left is a live visualisation of the data model. As you edit entities or relationships in the editor, the graph re-renders immediately — and so does it during the initial stream as the model arrives.

The diagram lets you:

- **Pan** by dragging the canvas.
- **Zoom** with the mouse wheel or the `+` / `−` controls.
- **Fit View** — re-centres the diagram to fit all entities.
- **Toggle Interactivity** — locks node positions so the layout doesn't shift while you scroll.

Each entity shows its name and the first few fields. Relationships are labelled edges between entity nodes. This view is read-only on purpose — the editor card is the source of truth, and the diagram is for sanity-checking the shape of your data model at a glance.

### The starter prompt and "Regenerate from brief"

At the bottom of the dossier is the **Coding Agent Starter Prompt**. This is the artifact you copy into your coding agent. It is _not_ a concatenation of the brief sections — it's a separate LLM call that distils the brief into an executable instruction set with five sections:

- `# Intent` — one paragraph: what to build and why.
- `# Hard Constraints` — bullet list, pulled from the brief's tech stack and mode choices.
- `# MVP Slice` — the P1 user story rendered as "when complete, the user can …" capabilities.
- `# File Layout` — concrete paths the agent should create, matching the brief's routes and data model.
- `# Start Here` — 2–4 numbered first steps, with a final instruction asking the agent to confirm understanding before continuing.

Target length is 600–800 words. The distillation deliberately skips internal field ids (`FR-001`, `SC-001`) and risks-and-edge-cases content — those live in the brief for humans to review, not for the agent to execute.

**"Regenerate from brief"** is the button next to **Copy prompt**. Use it whenever you've edited the brief (renamed an entity, added a route, regenerated risks) and want the starter prompt to reflect the new state. It re-runs the same distillation pass via `/api/starter-prompt`, replacing only the prompt text. Your edits everywhere else are kept.

**Copy prompt** writes the current prompt text to your clipboard for pasting into Claude Code, Cursor, ChatGPT, or any other coding agent.

If the distillation call fails for some reason, the app silently falls back to a deterministic concatenation so you always have _something_ to copy.

### Sharing via short URL

The **Share** button in the masthead does the following:

1. POSTs the full brief + idea + model to `/api/share`.
2. The server stores the payload in an in-memory map and returns a short 36-character id.
3. The client builds a short URL of the form `http://your-host/#s=<id>` and writes it to your clipboard.

Anyone opening that URL — incognito, different browser, different machine — will have the app fetch `/api/share?id=<id>` on mount, hydrate the brief, clear the hash from the address bar, and auto-save the brief to their own `localStorage`. They can edit, regenerate, and re-share from there independently.

**Trade-offs to know:**

- **In-memory store.** Shares live until the server restarts. Restart the dev server and old `#s=<id>` URLs return a "share is no longer available" error. The store interface in `lib/persistence/share-store.ts` is the single swap-in point for Vercel KV, Upstash Redis, or a small database — the rest of the codebase imports through it.
- **Single-user deployment assumed.** This codebase is meant to be deployed behind Vercel Password Protection (see "Deployment & Security" below). Without that, anyone with the URL can drain your OpenRouter key.
- **Cryptographic IDs.** Share ids are `crypto.randomUUID()` (128-bit). The store keeps at most 500 shares and expires entries after 30 days.

### Local persistence

Every change to a brief — generation, edit, section regeneration, starter-prompt regeneration — auto-saves to `localStorage` under `plan-architect:brief:<id>`. The most-recent brief id is tracked separately, so a hard refresh restores exactly the state you left.

There is no UI for managing multiple saved briefs in this version, but the data is all there in `localStorage` if you need it. Generating a fresh brief mints a new id; the previous one stays in storage until the browser evicts it.

---

## API

| Endpoint                   | Purpose                                                          |
| -------------------------- | ---------------------------------------------------------------- |
| `POST /api/clarify`        | Returns 3–5 idea-aware clarifying questions.                     |
| `POST /api/plan`           | Streams a project brief (NDJSON: `partial` → `status` → `done`). |
| `POST /api/plan/section`   | Regenerates a single section of an existing brief.               |
| `POST /api/starter-prompt` | Re-distills the starter prompt from a brief.                     |
| `POST /api/share`          | Stores a brief in the in-memory share store; returns a short id. |
| `GET  /api/share?id=<id>`  | Returns the stored brief for `#s=<id>` hydration.                |

All endpoints share an in-memory rate limiter keyed by client IP (`x-vercel-forwarded-for`, falling back to `x-real-ip`). The limiter is per-process — on Vercel cold starts reset it. Treat it as defence-in-depth, not as a security boundary; the production gate is Vercel Password Protection (see below).

All POST endpoints reject cross-origin requests via an `Origin` header check.

## Deployment & Security

This app is designed for a **single-user deployment behind Vercel Password Protection**. The threat model assumes:

1. **The deployment URL is protected** — Vercel Password Protection (Pro/Enterprise) or your equivalent SSO/proxy gate sits in front of every route, including `/api/*`. Without this gate, the AI endpoints will silently bill your OpenRouter key for anyone who finds the URL.
2. **The OpenRouter key never leaves the server.** It is read only from `process.env.OPENROUTER_API_KEY` inside route handlers. There is no `NEXT_PUBLIC_*` exposure.
3. **Briefs are not multi-tenant.** Anyone past the gate can read any share-link payload.

If you instead want a public deployment, replace Password Protection with: real auth (NextAuth / Clerk), per-user scoping on the share store, and Turnstile/hCaptcha on AI endpoints. The current code is not hardened for that scenario.

### Built-in hardening

The codebase ships with the following protections:

- **Security headers** in `next.config.ts`: CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`.
- **Same-origin check** on every POST route.
- **Rate limiting** per client IP, with a separate budget on `GET /api/share` to prevent enumeration.
- **`crypto.randomUUID()` share ids** (128 bits) with a 30-day TTL.
- **Input bounds** via Zod `.max()` on every brief field; the section-regenerate route rejects briefs > 64 KB JSON.
- **AbortSignal forwarding** to OpenRouter — when a client disconnects, the upstream call cancels.
- **`maxOutputTokens` cap** on every AI call (default 8000, override with `OPENROUTER_MAX_OUTPUT_TOKENS`).
- **XML-delimited user input** in prompts to reduce stored prompt-injection.
- **Structured error logging** — client responses are generic; details are JSON-logged server-side keyed by `requestId`.

## Eval

See [`eval/README.md`](./eval/README.md). Quick start:

```bash
npm run dev   # in a separate terminal
npx tsx scripts/eval.ts "A decision log for small teams"
# → eval/results/<timestamp>.json
```

The eval pipes your generated starter prompt through Claude (as if it were a coding agent receiving the spec) and scores the response on:

- concrete file path count,
- numbered step count,
- ambiguity count (signals an under-specified prompt),
- P1 user-story token overlap (signals whether the agent stayed on-topic),
- round-trip latency.

Use it as a regression signal when tuning the distillation prompt — the absolute numbers matter less than how they move between runs.

## Scripts

```bash
npm run dev     # local development
npm run lint    # eslint
npm run build   # production build
```
