import assert from "node:assert/strict";
import test from "node:test";

// eval's ambiguityCount. The metric exists to answer "did the prompt leave the
// agent guessing", and eval/README.md tells you to rewrite the distillation
// prompt when it climbs — so a count inflated by the agent's own code samples
// sends you rewriting a prompt that was fine.

import { countAmbiguitySignals, stripCode } from "../lib/eval/ambiguity";

test("prose hedging is counted", () => {
  assert.equal(countAmbiguitySignals("The auth flow is unclear."), 1);
  assert.equal(countAmbiguitySignals("This requirement is ambiguous."), 1);
  assert.equal(
    countAmbiguitySignals("The retention window is unspecified."),
    1,
  );
  assert.equal(countAmbiguitySignals("The error contract is missing."), 1);
  assert.equal(countAmbiguitySignals("Rate limits: TBD."), 1);
});

test("every natural phrasing of asking for clarification is counted", () => {
  for (const phrasing of [
    "I need clarification on the schema.",
    "This needs clarification.",
    "That needed clarification.",
    "It requires clarification.",
    "This required clarification.",
    "I need to clarify the scope.",
  ]) {
    assert.equal(countAmbiguitySignals(phrasing), 1, phrasing);
  }
});

test("code samples do not count as hedging", () => {
  // Each of these is an identifier or a placeholder, not the agent saying it
  // was left guessing.
  assert.equal(
    countAmbiguitySignals(
      "```ts\ntype S = { missing: string; tbd: number };\n```",
    ),
    0,
  );
  assert.equal(countAmbiguitySignals("Use `missingFields` for the diff."), 0);
  assert.equal(
    countAmbiguitySignals("```ts\n// TBD: wire this up\nconst x = 1;\n```"),
    0,
  );
});

test("a response truncated mid-code-block does not count its tail", () => {
  // probeAgent caps the reply at 2048 tokens, so an unterminated fence is an
  // ordinary outcome rather than a malformed edge case.
  const truncated =
    "Here is the shape:\n\n```ts\ntype T = {\n  missing: string;\n  tbd: numb";
  assert.equal(countAmbiguitySignals(truncated), 0);
});

test("prose is still counted when the response also contains code", () => {
  const response = [
    "The data model is unclear from the prompt.",
    "",
    "```ts",
    "type Quote = { missing: string; tbd: number };",
    "```",
    "",
    "I also need clarification on retention.",
  ].join("\n");

  // Two prose signals: "unclear" and "need clarification". The code block's
  // `missing` and `tbd` contribute nothing.
  assert.equal(countAmbiguitySignals(response), 2);
});

test("`undefined` is not a signal", () => {
  // It is a TypeScript literal far more often than a complaint, which is why
  // it was dropped from the pattern.
  assert.equal(countAmbiguitySignals("The helper returns undefined."), 0);
});

test("stripCode leaves prose intact", () => {
  assert.equal(
    stripCode("before `code` after").trim(),
    "before   after".trim(),
  );
  assert.match(stripCode("keep me\n```\ndrop me\n```\nkeep me too"), /keep me/);
  assert.doesNotMatch(stripCode("keep\n```\ndrop me\n```\nkeep"), /drop me/);
});
