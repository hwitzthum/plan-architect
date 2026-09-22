import { NextResponse, type NextRequest } from "next/server";

// Next.js 16 renamed Middleware to Proxy — this file is `proxy.ts` and the
// export is `proxy`. Only the name changed: same code, same position in front
// of the request (node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md).

// Matcher excludes static assets — they don't need a nonce and skipping them
// avoids the per-request nonce overhead for files served from the CDN.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

export function proxy(request: NextRequest) {
  // Unique per-request nonce for CSP script-src. Next.js reads the x-nonce
  // request header and automatically attaches it to its own inline hydration
  // scripts, so we never need to inject <script nonce=...> manually.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";

  const csp = [
    "default-src 'self'",
    // 'strict-dynamic' propagates trust to scripts loaded by the trusted
    // inline bootstrap; 'nonce-...' is the only way to authorise that
    // bootstrap without unsafe-inline.
    // React needs eval() for hot reloading in development; production stays
    // strict. Never widen this beyond the dev branch.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
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
  // Load-bearing: Next.js extracts the nonce from the request's CSP header
  // (the 'nonce-{value}' pattern) and applies it to its own script tags.
  // Without this header the nonce never reaches the rendered HTML.
  requestHeaders.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("content-security-policy", csp);
  return response;
}
