import assert from "node:assert/strict";
import test from "node:test";

// readJsonBody exists because `request.json()` has no size argument: it
// buffers the whole body and runs JSON.parse before any route gets a chance
// to reject an oversized one. The three "brief" routes (share, plan/section,
// starter-prompt) already cap the *parsed* payload at 64 KB, but pay the
// parse cost first — a caller can still push an arbitrarily large body
// through `request.json()` itself. These tests pin that the new helper stops
// reading, and never calls JSON.parse, once a body crosses the limit.

import { readJsonBody } from "../lib/request-utils";

function requestWith(body: string, headers: Record<string, string> = {}) {
  return new Request("https://plan.example/api/plan", {
    method: "POST",
    headers,
    body,
  });
}

test("a normal small body parses as usual", async () => {
  const req = requestWith(JSON.stringify({ idea: "A tool for cats" }));
  assert.deepEqual(await readJsonBody(req), { idea: "A tool for cats" });
});

test("invalid JSON returns null, matching request.json().catch(() => null)", async () => {
  const req = requestWith("not json");
  assert.equal(await readJsonBody(req), null);
});

test("a body over the limit is rejected by declared Content-Length alone", async () => {
  // Content-Length is set automatically by the Request constructor from the
  // body string, so this exercises the fast pre-read reject.
  const huge = "x".repeat(200 * 1024);
  const req = requestWith(JSON.stringify({ idea: huge }), {});
  assert.equal(await readJsonBody(req, 128 * 1024), null);
});

test("a chunked body with no Content-Length is still capped by the byte counter", async () => {
  const maxBytes = 1024;
  const chunk = new TextEncoder().encode("a".repeat(600));
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(chunk);
      controller.enqueue(chunk);
      controller.enqueue(chunk);
      controller.close();
    },
  });
  // duplex: "half" is required by undici for a Request with a stream body.
  const req = new Request("https://plan.example/api/plan", {
    method: "POST",
    body: stream,
    duplex: "half",
  } as RequestInit & { duplex: "half" });

  assert.equal(await readJsonBody(req, maxBytes), null);
});

test("a body at exactly the limit still parses", async () => {
  // { "a": "..." } padded so the whole JSON string is exactly maxBytes.
  const maxBytes = 64;
  const prefix = '{"a":"';
  const suffix = '"}';
  const padding = "x".repeat(maxBytes - prefix.length - suffix.length);
  const body = prefix + padding + suffix;
  assert.equal(Buffer.byteLength(body, "utf8"), maxBytes);

  const req = requestWith(body);
  assert.deepEqual(await readJsonBody(req, maxBytes), { a: padding });
});
