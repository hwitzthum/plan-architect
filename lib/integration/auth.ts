// Bearer auth for the two dashboard-facing endpoints (Kommandozentrale F2.5).
//
// The dashboard is a machine with no session here, so it proves itself with a
// token issued for that purpose. `configured()` is what makes that safe: with
// DASHBOARD_TOKEN unset both routes answer 503 and do nothing, so a deployment
// that has never been wired to a dashboard has no open endpoint rather than an
// unauthenticated one.

// SHA-256 digests compared byte by byte, the same shape proxy.ts uses: a plain
// === on secrets leaks the position of the first mismatch through timing.
async function tokenMatches(
  candidate: string,
  expected: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(candidate)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const bytesA = new Uint8Array(a);
  const bytesB = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < bytesA.length; i++) diff |= bytesA[i] ^ bytesB[i];
  return diff === 0;
}

/** True when this deployment has been wired to a dashboard. */
export function configured(): boolean {
  return Boolean(process.env.DASHBOARD_TOKEN);
}

/**
 * Whether the caller proved it is the dashboard. One answer for a missing,
 * malformed or wrong token — nothing here should help a caller work out which.
 */
export async function authenticated(request: Request): Promise<boolean> {
  const expected = process.env.DASHBOARD_TOKEN;
  if (!expected) return false;

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;

  const token = header.slice(7).trim();
  if (!token) return false;

  return tokenMatches(token, expected);
}
