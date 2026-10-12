/**
 * CI audit gate: `npm audit` at high severity, with explicit acceptances.
 *
 * Usage:
 *   npx tsx scripts/audit.ts
 *
 * See lib/audit/gate.ts for the rules. To accept an advisory, add its GHSA id
 * below with the reason it cannot be fixed; the gate rejects the acceptance as
 * soon as the advisory reaches production dependencies or disappears.
 */
import { spawnSync } from "node:child_process";

import { evaluateAudit, type AuditReport } from "../lib/audit/gate";

const ACCEPTANCES: Record<string, string> = {
  // Added 2026-10-12. braces <=3.0.3 has no patched release (3.0.3 is the
  // latest, from 2024). It is reached only through dev tooling —
  // eslint-config-next and the shadcn CLI, via fast-glob → micromatch — and
  // only with glob patterns from this repo, never user input.
  "GHSA-vfj7-8cjw-p6xm":
    "braces stack-exhaustion DoS; no fix exists, dev tooling only",
};

function audit(...args: string[]): AuditReport {
  // npm audit exits non-zero whenever it finds anything, so the exit code says
  // nothing here; the JSON is the result.
  const run = spawnSync("npm", ["audit", "--json", ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  try {
    return JSON.parse(run.stdout) as AuditReport;
  } catch {
    return { error: { summary: run.stderr.trim() || "no JSON output" } };
  }
}

const { blocking, accepted, problems } = evaluateAudit(
  { all: audit(), prod: audit("--omit=dev") },
  ACCEPTANCES,
);

for (const a of accepted) {
  console.log(`accepted  ${a.severity}  ${a.name}  ${a.id}  (${ACCEPTANCES[a.id]})`);
}
for (const a of blocking) {
  console.log(`BLOCKING  ${a.severity}  ${a.name}  ${a.title}  ${a.url}`);
}
for (const p of problems) console.log(`PROBLEM   ${p}`);

if (blocking.length || problems.length) process.exit(1);
console.log("audit gate passed");
