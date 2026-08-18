const LOCAL_KEY = "local";

// The largest payload any POST route accepts post-parse is the 64 KB brief
// cap (share, plan/section, starter-prompt — see MAX_SHARE_JSON_BYTES /
// MAX_BRIEF_JSON_BYTES in those routes, pinned against real output by
// tests/share-payload.test.ts). 128 KB gives that headroom without raising
// the real ceiling: an oversized body is now rejected while it is still
// streaming in, instead of after `JSON.parse` and a full zod walk have
// already paid for it. request.json() has no size argument, so this reads
// the stream by hand rather than trusting the platform's own limit, which
// only Vercel's deployment provides.
const MAX_JSON_BODY_BYTES = 128 * 1024;

// Drop-in replacement for `request.json().catch(() => null)` that stops
// reading — and never calls JSON.parse — once the body exceeds maxBytes.
// Content-Length is checked first as a fast, if spoofable, reject; the byte
// counter on the stream itself is what actually enforces the limit.
export async function readJsonBody(
  request: Request,
  maxBytes: number = MAX_JSON_BODY_BYTES,
): Promise<unknown | null> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const declared = Number(contentLength);
    if (Number.isFinite(declared) && declared > maxBytes) return null;
  }

  if (!request.body) {
    return request.json().catch(() => null);
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }

  try {
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

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
