import type { BriefMode } from "@/lib/ai/planner-schema";

export type PlannerOptions = {
  mode: BriefMode;
  tutorial: boolean;
  clarifierAnswers?: Array<{ question: string; answer: string }>;
};

export const PLANNER_SYSTEM_PROMPT = `You are a senior product engineer turning a rough idea into a focused, implementation-ready project brief.

Your job is to make decisions that move the user from a vague intention to something a coding agent can act on. Choose a stack appropriate to the idea and to the user's chosen modes. Do not impose blanket bans on technologies; pick what actually fits.

Cover every requested section concisely. Use stable kebab-case ids for data-model entities and relationships. Every relationship sourceEntityId and targetEntityId must match one of the generated entity ids. Do not author a starterPrompt field; the starter prompt is composed in a separate pass.

When spec-kit mode is enabled, feature specifications must follow GitHub spec-kit conventions exactly:
- Produce 3 to 5 user stories. Each must be independently testable, independently demonstrable, and deliver a viable slice of value on its own.
- Order stories by priority. The first story is P1 (must-have MVP), then P2, P3, ... Never assign the same priority to two stories. Never skip P1.
- whyPriority explains why this story has this priority relative to the others, not generic value statements.
- independentTest describes one concrete tester action and the observable value that proves the slice works.
- Acceptance scenarios MUST use Given/When/Then phrasing. 2 to 4 per story. One string each: "Given <state>, When <action>, Then <observable outcome>."
- Functional requirements use MUST language, numbered FR-001, FR-002, ... continuing across the whole feature. Mark unresolved details with "[NEEDS CLARIFICATION: ...]". 3 to 6 per story.
- Success criteria are measurable and technology-agnostic, numbered SC-001, SC-002, ... 2 to 4 per story.
- Edge cases: 2 to 4 boundary or error conditions per story, framed as short questions or scenarios.
- Assumptions: 1 to 3 explicit assumptions or dependencies per story.

When tutorial mode is enabled, deliberately favour the smallest workable surface: prefer local React state over persistent storage, prefer a single Next.js App Router page with one API route over multi-page architectures, and avoid auth, databases, payments, and background jobs unless the idea itself depends on them.

When tutorial mode is disabled, choose the stack the idea actually needs. If the idea calls for auth, payments, a real database, or background work, recommend them concretely.`;

export function buildPlannerPrompt(idea: string, options: PlannerOptions) {
  const { mode, tutorial, clarifierAnswers } = options;

  const sections: string[] = [
    `Create an editable project brief for this rough app idea:`,
    "",
    idea,
  ];

  if (clarifierAnswers && clarifierAnswers.length > 0) {
    sections.push("", "User-supplied clarifications:");
    for (const entry of clarifierAnswers) {
      sections.push(`- ${entry.question} — ${entry.answer}`);
    }
  }

  sections.push(
    "",
    `Modes for this generation:`,
    `- spec-kit mode: ${mode === "specKit" ? "ON" : "OFF"}`,
    `- tutorial mode: ${tutorial ? "ON" : "OFF"}`,
    "",
    "Return a realistic implementation plan with:",
    "- app summary",
    "- 2-6 target users",
    "- 3-8 core features (short bullet labels only)",
  );

  if (mode === "specKit") {
    sections.push(
      "- 3-5 spec-kit feature specifications, each with a P1/P2/P3/... priority, an independently testable user story, Given/When/Then acceptance scenarios, FR-### functional requirements, SC-### success criteria, edge cases, and assumptions",
    );
  } else {
    sections.push(
      "- omit featureSpecifications entirely; the user has chosen plain mode",
    );
  }

  sections.push(
    "- 4-9 recommended tech stack items",
    "- 1-8 pages/routes",
    "- possible data model with 2-8 entities and clear relationships",
    "- 3-6 build phases",
    "- 3-8 risks/edge cases",
    "",
    tutorial
      ? "Keep the plan tutorial-friendly: prefer no auth, no persistent database, no payments, and a single small surface unless the idea explicitly requires more."
      : "Pick whatever stack and architecture genuinely fits the idea. Do not artificially constrain to a tutorial-sized scope.",
    "Do not author a final starter prompt; that artifact is composed separately.",
  );

  return sections.join("\n");
}
