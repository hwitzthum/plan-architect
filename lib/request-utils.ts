const LOCAL_KEY = "local";

export function getClientKey(request: Request): string {
  // Keyed on x-forwarded-for, and deliberately only that.
  //
  // Vercel documents this header as one it controls: "Vercel overwrites this
  // header and does not forward external IPs to prevent spoofing, unless a
  // trusted proxy is enabled for Enterprise customers"
  // (https://vercel.com/docs/headers/request-headers). That written guarantee
  // is the whole basis for trusting it, and for taking split(",")[0] — Vercel,
  // not the caller, decides what ends up in the value.
  //
  // Do not move this to x-real-ip, including by way of @vercel/functions'
  // ipAddress(), which reads exactly that header (IP_HEADER_NAME =
  // "x-real-ip", v3.9.1). Vercel's request-header documentation does not list
  // x-real-ip at all, so nothing published promises it is overwritten. An
  // earlier version of this function trusted it, which let a caller hand
  // itself a fresh rate-limit bucket on every request by sending the header.
  // "Just use the official helper" is the most plausible route back into that
  // bug, so it is named here rather than left to be rediscovered.
  //
  // This choice has been reversed four times, each time by an audit calling
  // the previous one insecure. tests/client-key.test.ts pins the property that
  // actually matters — no client-supplied header earns its own bucket — so a
  // fifth change has to be deliberate rather than plausible-looking.
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
