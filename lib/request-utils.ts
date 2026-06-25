const LOCAL_KEY = "local";

export function getClientKey(request: Request): string {
  // x-real-ip is set by Vercel's edge to the actual client IP and cannot be
  // injected by the client — use it as the primary key on Vercel.
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  // Do NOT fall back to x-forwarded-for in any environment. The leftmost
  // entries are client-controlled and even the rightmost entry is only
  // trustworthy when you control the proxy chain. Falling back to XFF in
  // dev allows any caller to rotate synthetic IPs and bypass rate limits
  // entirely. In local dev all requests share LOCAL_KEY (one bucket), which
  // is fine since no real rate-limiting is needed without a real Redis store.
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
