// GET /api/manifest — what this app tells the Kommandozentrale it can do.
//
// Authenticates itself with DASHBOARD_TOKEN and refuses outright when the
// integration is not configured, so an un-wired deployment has no open endpoint.

import { authenticated, configured } from "@/lib/integration/auth";
import { manifest } from "@/lib/integration/manifest";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!configured()) {
    return Response.json(
      { error: "This deployment is not connected to a dashboard." },
      { status: 503 },
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
