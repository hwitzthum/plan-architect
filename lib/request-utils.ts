const LOCAL_KEY = "local";

export function getClientKey(request: Request): string {
  // x-real-ip is set by Vercel's edge to the actual client IP and cannot be
  // injected by the client — use it as the primary key on Vercel.
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  // In dev, the rightmost XFF entry (added by the proxy closest to the server)
  // is the most trustworthy; leftmost entries can be client-controlled.
  if (process.env.NODE_ENV !== "production") {
    const forwarded = request.headers
      .get("x-forwarded-for")
      ?.split(",")
      .at(-1)
      ?.trim();
    if (forwarded) return forwarded;
  }

  return LOCAL_KEY;
}

export function isSameOrigin(request: Request): boolean {
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
