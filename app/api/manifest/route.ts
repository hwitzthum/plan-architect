// GET /api/manifest — what this app tells the Kommandozentrale it can do.
//
// Authenticates itself with DASHBOARD_TOKEN and refuses outright when the
// integration is not configured, so an un-wired deployment has no open endpoint.

import { authenticated, configured } from "@/lib/integration/auth";
import { manifest } from "@/lib/integration/manifest";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientKey } from "@/lib/request-utils";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!configured()) {
    return Response.json(
      { error: "This deployment is not connected to a dashboard." },
      { status: 503 },
    );
  }

  /*
   * Generous, because this is a cheap read of a static document and Phase 3's
   * command router will collect it often. It is here at all so that no endpoint
   * on this app is unmetered — reading the manifest is how an attacker with a
   * stolen token would enumerate what else it can reach.
   */
  const limit = await checkRateLimit(`manifest:${getClientKey(request)}`, {
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });

  if (!limit.allowed) {
    if (limit.status === "unavailable") {
      return Response.json(
        { error: "Service temporarily unavailable. Try again shortly." },
        { status: 503 },
      );
    }
    return Response.json(
      { error: "Too many requests." },
      { status: 429, headers: { "retry-after": "3600" } },
    );
  }

  if (!(await authenticated(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json(manifest(), {
    // Capabilities change when the app is redeployed, not between requests, but
    // a stale manifest would have the dashboard offering something that no
    // longer exists.
    headers: { "cache-control": "no-store" },
  });
}
