import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Headers applied in every environment.
// CSP is intentionally absent here — it is set dynamically per-request in
// middleware.ts with a fresh nonce so that 'unsafe-inline' can be dropped
// from script-src.
// HSTS is intentionally absent here — see productionHeaders below.
const baseHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
];

// HSTS is production-only: sending it over HTTP in dev would cause browsers
// (particularly Firefox) to pin localhost and all its subdomains for 2 years,
// breaking other local HTTP services.
const productionHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const securityHeaders = isDev ? baseHeaders : [...productionHeaders, ...baseHeaders];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
