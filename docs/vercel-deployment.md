# Vercel deployment

## Required environment variables

Set these in **Vercel → Project Settings → Environment Variables**:

| Name                                                  | Required                      | Notes                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OPENROUTER_API_KEY`                                  | yes                           | OpenRouter API key for all AI routes.                                                                                                                                                                                                                                                                                        |
| `OPENROUTER_MODEL`                                    | no                            | Defaults to `DEFAULT_OPENROUTER_MODEL` in `lib/ai/openrouter.ts`.                                                                                                                                                                                                                                                            |
| `OPENROUTER_MAX_OUTPUT_TOKENS`                        | no                            | Defaults to `8000`.                                                                                                                                                                                                                                                                                                          |
| `KV_REST_API_URL` + `KV_REST_API_TOKEN`               | yes, for production           | Upstash Redis REST credentials. Auto-provisioned by the Vercel Marketplace "Upstash for Redis" integration. Required for `/api/share` to work at all, and for rate limiting to be enabled — without them, `lib/rate-limit.ts` fails closed and every rate-limited route (all AI routes + share) returns `503` in production. |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | alternative to the pair above | Native Upstash console naming; either pair works, both are read (see `lib/rate-limit.ts` / `lib/persistence/share-store.ts`).                                                                                                                                                                                                |
| `DASHBOARD_TOKEN`                                     | no                            | Proves an incoming `/api/manifest` or `/api/run` call is the dashboard; same value as the dashboard's `RUN_TOKEN_PLAN`. Leave all three integration vars unset and both routes answer `503` rather than standing open.                                                                                                        |
| `RAUTAKI_DASHBOARD_URL`                               | no                            | Where finished briefs are delivered. Use the production alias, never a deployment URL — the latter changes every deploy and sits behind Deployment Protection.                                                                                                                                                               |
| `RAUTAKI_RESULTS_TOKEN`                               | no                            | Proves an outgoing delivery came from this app; same value as the dashboard's `APP_TOKEN_PLAN`. A separate secret from `DASHBOARD_TOKEN` so either can be rotated alone — they must never match.                                                                                                                             |

## Function timeouts

Set per-route via `export const maxDuration` (already configured):

- `app/api/plan/route.ts` — 300s (two sequential LLM calls).
- `app/api/run/route.ts` — 300s (drives `/api/plan` in-process, then delivers).
- `app/api/clarify/route.ts` — 30s.
- `app/api/starter-prompt/route.ts` — 30s.
- `app/api/plan/section/route.ts` — 30s.

Hobby plan caps at 60s. Pro plan allows up to 300s, so the two 300s routes
above require Pro — on Hobby they are truncated to 60s and a slow model will
fail the run.

## Required: enable Password Protection

`lib/persistence/share-store.ts` and `lib/rate-limit.ts` are already
backed by Upstash Redis (see the env vars above) — state is durable and
synchronised across serverless instances out of the box; there is no
in-memory fallback and no further migration step needed for multi-instance
correctness.

What Redis does **not** give you is per-user isolation: this app has no
accounts, and anyone who can reach a deployment can read any share-link
payload and will burn through the shared `OPENROUTER_API_KEY` on every AI
route. Vercel Password Protection (Project Settings → Deployment
Protection) is the actual access-control boundary — enable it on every
environment (production and preview) before sharing a deployment URL.
Rate limiting is defence-in-depth on top of that gate, not a substitute
for it.

For a genuinely public / multi-user deployment, Password Protection is not
enough — see "If you instead want a public deployment" in the main
[README](../README.md#deployment--security).

## Notes

- `next.config.ts` and `proxy.ts` already set strict security headers (CSP, HSTS,
  X-Frame-Options) in production.
- The `eval/` directory is dev-only evaluation tooling and should not be
  deployed. Vercel ignores it by default (no Python runtime configured), but
  verify it is not imported by any code in `app/` or `lib/`.
- `main.py` and `pyproject.toml` are not evaluation tooling: `main.py` is the
  unmodified PyCharm sample script and `pyproject.toml` declares no
  dependencies. Nothing reads either one. They are leftover scaffolding, kept
  here only so this list matches what is actually in the repository.
