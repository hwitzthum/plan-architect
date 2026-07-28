const LOCAL_KEY = "local";

export function getClientKey(request: Request): string {
  // x-forwarded-for is the header Vercel's own docs document as spoof-proof:
  // "Vercel overwrites this header and does not forward external IPs to
  // prevent spoofing" (https://vercel.com/docs/headers/request-headers),
  // unless a trusted proxy is explicitly configured (Enterprise-only, opt-in,
  // not applicable here). Neither x-real-ip nor x-vercel-forwarded-for is a
  // header Vercel documents as platform-managed — a prior version of this
  // function trusted x-real-ip on that unverified assumption, which let an
  // attacker supply an arbitrary X-Real-IP header that passed straight
  // through untouched and got a fresh rate-limit bucket on every request,
  // reopening the exact spoofing bypass earlier fixes here targeted.
  //
  // The leftmost entry is the original client; Vercel appends/overwrites
  // trusted hops after it, so split(",")[0] is safe to take here precisely
  // because Vercel — not the client — controls what ends up in this header.
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  if (forwarded) return forwarded;

  // No header present (e.g. local dev without a proxy in front). All requests
  // share LOCAL_KEY (one bucket), which is fine since no real rate-limiting
  // is needed without a real Redis store.
  return LOCAL_KEY;
}

export function isSameOrigin(request: Request): boolean {
  // Prefer Sec-Fetch-Site when available (set by all modern browsers on every
  // request, cannot be set by a cross-origin page because it is a forbidden
  // header name). "cross-site" or "same-site" means a different origin.
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite) {
    return secFetchSite === "same-origin" || secFetchSite === "none";
  }

  // Fall back to the Origin header. Absent Origin is allowed only for
  // requests that do not include an Origin at all (e.g., server-to-server
  // calls — no cookies are attached so there is no CSRF risk).
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const originHost = new URL(origin).host;
    const requestHost = new URL(request.url).host;
    return originHost === requestHost;
  } catch {
    return false;
  }
}
