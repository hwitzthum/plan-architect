/**
 * The CI audit gate's decision, kept apart from the npm call so it can be
 * tested.
 *
 * `npm audit --audit-level=high` has no way to accept an advisory, so a single
 * unfixable one — braces, which has no patched release at all — turns the job
 * red on every PR for as long as it exists, and a gate that is always red stops
 * catching anything. This gate fails on every high/critical advisory except the
 * accepted ones, and an acceptance only holds while it is still true: the
 * advisory must be dev-only (absent from the `--omit=dev` report) and still
 * present (a stale acceptance is reported so it gets deleted).
 */

export type AuditAdvisory = {
  name: string;
  severity: string;
  title: string;
  url: string;
};

/** The subset of `npm audit --json` (report v2) the gate reads. */
export type AuditReport = {
  vulnerabilities?: Record<
    string,
    { severity: string; via: Array<string | AuditAdvisory> }
  >;
  error?: { code?: string; summary?: string };
};

export type Finding = { id: string; name: string; severity: string; title: string; url: string };

const BLOCKING_SEVERITIES = new Set(["high", "critical"]);

/**
 * Advisories in a report, deduplicated by GHSA id.
 *
 * Only `via` entries that are objects are advisories; string entries name
 * another vulnerable package, whose own entry carries the advisory, so every
 * transitive chain is covered by reading the objects alone.
 */
function advisoriesIn(report: AuditReport): Map<string, Finding> {
  const found = new Map<string, Finding>();
  for (const entry of Object.values(report.vulnerabilities ?? {})) {
    for (const via of entry.via) {
      if (typeof via === "string") continue;
      const id = via.url.split("/").pop() ?? via.url;
      found.set(id, {
        id,
        name: via.name,
        severity: via.severity,
        title: via.title,
        url: via.url,
      });
    }
  }
  return found;
}

export function evaluateAudit(
  reports: { all: AuditReport; prod: AuditReport },
  acceptances: Record<string, string>,
): { blocking: Finding[]; accepted: Finding[]; problems: string[] } {
  const problems: string[] = [];
  for (const [label, report] of Object.entries(reports)) {
    if (report.error) {
      problems.push(
        `npm audit (${label}) failed: ${report.error.summary ?? report.error.code ?? "unknown error"}`,
      );
    }
  }

  const all = advisoriesIn(reports.all);
  const prod = advisoriesIn(reports.prod);
  const blocking: Finding[] = [];
  const accepted: Finding[] = [];

  for (const finding of all.values()) {
    if (!BLOCKING_SEVERITIES.has(finding.severity)) continue;
    if (finding.id in acceptances && !prod.has(finding.id)) {
      accepted.push(finding);
    } else {
      blocking.push(finding);
    }
  }

  for (const id of Object.keys(acceptances)) {
    if (!all.has(id)) {
      problems.push(
        `${id} is accepted but no longer reported — remove it from the acceptances.`,
      );
    }
  }

  return { blocking, accepted, problems };
}
