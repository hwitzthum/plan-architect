import assert from "node:assert/strict";
import test from "node:test";

// The CI audit gate. It fails on every high/critical advisory except the ones
// explicitly accepted — and an acceptance only holds while the advisory is
// dev-only and still present, so an exception can't outlive its reason.

import { evaluateAudit, type AuditReport } from "../lib/audit/gate";

const BRACES = "GHSA-vfj7-8cjw-p6xm";

function advisory(name: string, ghsa: string, severity: string) {
  return {
    name,
    severity,
    title: `${name} advisory`,
    url: `https://github.com/advisories/${ghsa}`,
  };
}

function report(
  ...advisories: ReturnType<typeof advisory>[]
): AuditReport {
  const vulnerabilities: AuditReport["vulnerabilities"] = {};
  for (const a of advisories) {
    vulnerabilities[a.name] = { severity: a.severity, via: [a] };
  }
  // A transitive entry points at its cause by name, not by advisory object.
  if (advisories.length) {
    vulnerabilities["dependent"] = {
      severity: advisories[0].severity,
      via: [advisories[0].name],
    };
  }
  return { vulnerabilities };
}

const empty: AuditReport = { vulnerabilities: {} };

test("a clean tree passes", () => {
  assert.deepEqual(evaluateAudit({ all: empty, prod: empty }, {}), {
    blocking: [],
    accepted: [],
    problems: [],
  });
});

test("an unaccepted high advisory blocks, whether dev or prod", () => {
  const all = report(advisory("sharp", "GHSA-wq5f-xc86-pv6w", "high"));
  const result = evaluateAudit({ all, prod: empty }, {});
  assert.deepEqual(
    result.blocking.map((a) => a.id),
    ["GHSA-wq5f-xc86-pv6w"],
  );
});

test("critical blocks; moderate and low do not", () => {
  const all = report(
    advisory("proxy-addr", "GHSA-jqcg-44mw-7w3h", "critical"),
    advisory("left-pad", "GHSA-aaaa-bbbb-cccc", "moderate"),
    advisory("is-odd", "GHSA-dddd-eeee-ffff", "low"),
  );
  const result = evaluateAudit({ all, prod: empty }, {});
  assert.deepEqual(
    result.blocking.map((a) => a.id),
    ["GHSA-jqcg-44mw-7w3h"],
  );
});

test("an advisory reached through several paths is reported once", () => {
  const braces = advisory("braces", BRACES, "high");
  const all: AuditReport = {
    vulnerabilities: {
      braces: { severity: "high", via: [braces] },
      "braces-copy": { severity: "high", via: [braces] },
    },
  };
  assert.equal(evaluateAudit({ all, prod: empty }, {}).blocking.length, 1);
});

test("an accepted dev-only advisory passes", () => {
  const all = report(advisory("braces", BRACES, "high"));
  const result = evaluateAudit(
    { all, prod: empty },
    { [BRACES]: "no patched release exists" },
  );
  assert.deepEqual(result.blocking, []);
  assert.deepEqual(result.problems, []);
  assert.deepEqual(
    result.accepted.map((a) => a.id),
    [BRACES],
  );
});

test("an accepted advisory that reaches production blocks", () => {
  const all = report(advisory("braces", BRACES, "high"));
  const result = evaluateAudit(
    { all, prod: all },
    { [BRACES]: "no patched release exists" },
  );
  assert.deepEqual(
    result.blocking.map((a) => a.id),
    [BRACES],
  );
});

test("an acceptance whose advisory is gone is a problem, so it gets removed", () => {
  const result = evaluateAudit(
    { all: empty, prod: empty },
    { [BRACES]: "no patched release exists" },
  );
  assert.equal(result.problems.length, 1);
  assert.match(result.problems[0], new RegExp(BRACES));
});

test("an npm audit error is a problem, not a pass", () => {
  const failed = { error: { code: "ENOAUDIT", summary: "network down" } };
  const result = evaluateAudit(
    { all: failed as AuditReport, prod: empty },
    {},
  );
  assert.equal(result.problems.length, 1);
  assert.match(result.problems[0], /network down/);
});
