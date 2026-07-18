# Vercel deployment

## Required environment variables

Set these in **Vercel → Project Settings → Environment Variables**:

| Name                           | Required | Notes                                                            |
| ------------------------------ | -------- | ---------------------------------------------------------------- |
| `OPENROUTER_API_KEY`           | yes      | OpenRouter API key for all AI routes.                            |
| `OPENROUTER_MODEL`             | no       | Defaults to `DEFAULT_OPENROUTER_MODEL` in `lib/ai/openrouter.ts`. |
| `OPENROUTER_MAX_OUTPUT_TOKENS` | no       | Defaults to `8000`.                                              |

## Function timeouts

Set per-route via `export const maxDuration` (already configured):

- `app/api/plan/route.ts` — 300s (two sequential LLM calls).
- `app/api/clarify/route.ts` — 30s.
- `app/api/starter-prompt/route.ts` — 30s.
- `app/api/plan/section/route.ts` — 30s.

Hobby plan caps at 60s. Pro plan allows up to 300s. If `/api/plan` ever
times out with slower models, bump it to 300 and confirm the project is
on Pro.

## Recommended: enable Password Protection

The in-memory share store and rate limiter (default implementation) reset
on every cold start and do not synchronise across serverless instances.
This is fine for a single-user deployment **behind Vercel Password
Protection** (Project Settings → Deployment Protection). For public /
multi-user use, migrate to Vercel KV (below).

## Migrating to Vercel KV (multi-user / durable state)

The default `lib/persistence/share-store.ts` and `lib/rate-limit.ts` use
module-level Maps. To swap in durable KV-backed equivalents:

1. `npm install @vercel/kv`
2. In the Vercel dashboard: **Storage → Create → KV**, then link it to
   this project. Vercel auto-injects `KV_REST_API_URL` and
   `KV_REST_API_TOKEN`.
3. Replace the two files:

   ```bash
   mv lib/persistence/share-store-kv.ts.example lib/persistence/share-store.ts
   mv lib/rate-limit-kv.ts.example             lib/rate-limit.ts
   ```

4. The KV versions are async. Update the four call sites:
   - `app/api/plan/route.ts`
   - `app/api/clarify/route.ts`
   - `app/api/starter-prompt/route.ts`
   - `app/api/plan/section/route.ts`
   - `app/api/share/route.ts` (also for `putShare` / `getShare`)

   Change `const limit = checkRateLimit(...)` → `const limit = await checkRateLimit(...)`,
   `putShare(record)` → `await putShare(record)`, and
   `getShare(id)` → `await getShare(id)`.

5. `npm run build` to verify, then deploy.

## Notes

- `next.config.ts` and `middleware.ts` already set strict security headers (CSP, HSTS,
  X-Frame-Options) in production.
- The `eval/` directory and `main.py` / `pyproject.toml` are dev-only
  evaluation tooling and should not be deployed. Vercel ignores them by
  default (no Python runtime configured), but verify they are not
  imported by any code in `app/` or `lib/`.
