# Vercel deployment

## Required environment variables

Set these in **Vercel → Project Settings → Environment Variables**:

| Name                                                   | Required                      | Notes                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OPENROUTER_API_KEY`                                   | yes                            | OpenRouter API key for all AI routes.                                                                                                                                                                                                                                           |
| `OPENROUTER_MODEL`                                     | no                              | Defaults to `DEFAULT_OPENROUTER_MODEL` in `lib/ai/openrouter.ts`.                                                                                                                                                                                                               |
| `OPENROUTER_MAX_OUTPUT_TOKENS`                         | no                              | Defaults to `8000`.                                                                                                                                                                                                                                                             |
| `KV_REST_API_URL` + `KV_REST_API_TOKEN`                | yes, for production             | Upstash Redis REST credentials. Auto-provisioned by the Vercel Marketplace "Upstash for Redis" integration. Required for `/api/share` to work at all, and for rate limiting to be enabled — without them, `lib/rate-limit.ts` fails closed and every rate-limited route (all AI routes + share) returns `503` in production. |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`  | alternative to the pair above   | Native Upstash console naming; either pair works, both are read (see `lib/rate-limit.ts` / `lib/persistence/share-store.ts`).                                                                                                                                                  |

## Function timeouts

Set per-route via `export const maxDuration` (already configured):

- `app/api/plan/route.ts` — 300s (two sequential LLM calls).
- `app/api/clarify/route.ts` — 30s.
- `app/api/starter-prompt/route.ts` — 30s.
- `app/api/plan/section/route.ts` — 30s.

Hobby plan caps at 60s. Pro plan allows up to 300s. If `/api/plan` ever
times out with slower models, bump it to 300 and confirm the project is
on Pro.

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

- `next.config.ts` and `middleware.ts` already set strict security headers (CSP, HSTS,
  X-Frame-Options) in production.
- The `eval/` directory and `main.py` / `pyproject.toml` are dev-only
  evaluation tooling and should not be deployed. Vercel ignores them by
  default (no Python runtime configured), but verify they are not
  imported by any code in `app/` or `lib/`.
