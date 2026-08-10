import assert from "node:assert/strict";
import test from "node:test";

// Which header the rate limiter keys on.
//
// This has been changed four times, each time by an audit calling the previous
// choice insecure: x-vercel-forwarded-for (59d941a) -> x-real-ip (#28) ->
// x-real-ip only (#37) -> x-forwarded-for (#70). Every one of those was argued
// as the safe option, and none was pinned by a test, so each rewrite looked
// like an improvement to whoever made it.
//
// These tests exist to make the fifth change deliberate. They encode the
// property the choice has to preserve rather than the choice itself: a client
// cannot present a header that earns it a rate-limit bucket of its own. If a
// future edit reintroduces a header Vercel does not overwrite, these fail.

import { getClientKey } from "../lib/request-utils";

function requestWith(headers: Record<string, string>): Request {
  return new Request("https://plan.example/api/plan", {
    method: "POST",
    headers,
  });
}

test("the client IP comes from x-forwarded-for", () => {
  // Vercel documents this header as one it overwrites: "Vercel overwrites this
  // header and does not forward external IPs to prevent spoofing, unless a
  // trusted proxy is enabled for Enterprise customers."
  // https://vercel.com/docs/headers/request-headers
  assert.equal(
    getClientKey(requestWith({ "x-forwarded-for": "203.0.113.7" })),
    "203.0.113.7",
  );
});

test("the leftmost entry wins, and is trimmed", () => {
  // Safe to take precisely because Vercel, not the client, controls the value.
  assert.equal(
    getClientKey(
      requestWith({ "x-forwarded-for": "203.0.113.7, 198.51.100.2" }),
    ),
    "203.0.113.7",
  );
  assert.equal(
    getClientKey(
      requestWith({ "x-forwarded-for": "  203.0.113.7 , 198.51.100.2" }),
    ),
    "203.0.113.7",
  );
});

test("no client-supplied header can earn a bucket of its own", () => {
  // The spoofing bypass every one of the four rewrites was chasing: an
  // attacker sets a header, gets a fresh bucket, and rotates it per request.
  //
  // x-real-ip is the one to watch. Vercel's own @vercel/functions ipAddress()
  // reads it (IP_HEADER_NAME = "x-real-ip"), so "just use the official helper"
  // is a natural-sounding suggestion that would reintroduce exactly what #70
  // removed. Vercel's request-headers documentation does not list x-real-ip at
  // all, and so makes no promise to overwrite it.
  const spoofedHeaders: Record<string, string>[] = [
    { "x-real-ip": "1.2.3.4" },
    { "x-vercel-forwarded-for": "1.2.3.4" },
    { "x-client-ip": "1.2.3.4" },
    { forwarded: "for=1.2.3.4" },
  ];

  for (const spoofed of spoofedHeaders) {
    assert.equal(
      getClientKey(requestWith(spoofed)),
      "local",
      `${Object.keys(spoofed)[0]} must not be trusted as a client identity`,
    );
  }
});

test("a spoofed header cannot displace the one Vercel controls", () => {
  const key = getClientKey(
    requestWith({
      "x-forwarded-for": "203.0.113.7",
      "x-real-ip": "1.2.3.4",
      "x-vercel-forwarded-for": "5.6.7.8",
    }),
  );

  assert.equal(key, "203.0.113.7");
});

test("without the header every caller shares one bucket", () => {
  // Local dev with no proxy in front. Sharing a bucket is the safe direction:
  // it over-restricts rather than handing anyone their own allowance.
  assert.equal(getClientKey(requestWith({})), "local");
  assert.equal(getClientKey(requestWith({ "x-forwarded-for": "" })), "local");
  assert.equal(
    getClientKey(requestWith({ "x-forwarded-for": "   " })),
    "local",
  );
});
