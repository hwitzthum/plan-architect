import { NextResponse, type NextRequest } from "next/server";

// Matcher excludes static assets — they don't need a nonce and skipping them
// avoids the per-request nonce overhead for files served from the CDN.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

export function middleware(request: NextRequest) {
  // Unique per-request nonce for CSP script-src. Next.js reads the x-nonce
  // request header and automatically attaches it to its own inline hydration
  // scripts, so we never need to inject <script nonce=...> manually.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  const csp = [
    "default-src 'self'",
    // 'strict-dynamic' propagates trust to scripts loaded by the trusted
    // inline bootstrap; 'nonce-...' is the only way to authorise that
    // bootstrap without unsafe-inline.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    // All AI calls are proxied through server-side route handlers — no
    // browser fetch to openrouter.ai is ever needed.
    "connect-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Also propagate the CSP value as a request header so server components
  // can read it via headers() if they ever need to embed the policy value.
  requestHeaders.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("content-security-policy", csp);
  return response;
}
