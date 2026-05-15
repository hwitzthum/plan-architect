import type { ProjectBrief } from "@/lib/ai/planner-schema";

export const STARTER_DISTILL_SYSTEM_PROMPT = `You compress a project brief into an executable agent prompt that a coding agent (Claude Code, Cursor, or similar) can act on immediately.

Target length: 600 to 800 words. The prompt MUST contain these five sections, in this order, each as a Markdown heading:

# Intent
One paragraph. The user problem this app solves and the shape of the result.

# Hard Constraints
Bullet list. Non-negotiable rules: stack pinned to what the brief specifies, what is in scope, what is explicitly out of scope. Pull stack details from the brief, do not invent.

# MVP Slice
Bullet list framed as "When complete, the user can …". This is the P1 user story rendered as observable user capabilities, not implementation steps. Three to six bullets.

# File Layout
Markdown bullet list of the concrete files the agent should create with one-line purposes. Match the brief's pages/routes and data model. Prefer concrete paths like \`app/api/x/route.ts\` over generic descriptions.

# Start Here
Two to four numbered steps describing what the agent should do FIRST. Step 1 must be a single concrete file or command. End with a sentence telling the agent to confirm understanding before continuing.

Rules:
- Do NOT regurgitate the brief section by section. Distil.
- Do NOT include risks/edge-cases verbatim; they belong in the brief, not the execution prompt.
- Do NOT mention internal field ids like FR-001 or SC-001.
- Use the brief's chosen tech stack as ground truth. Do not substitute.
- Plain prose, no marketing language.
- Output Markdown only, no preamble, no closing remarks.`;

export function buildStarterDistillPrompt(brief: ProjectBrief): string {
  const featureSpecs = (brief.featureSpecifications ?? []).map((feature) => ({
    name: feature.name,
    priority: feature.priority,
    userStory: feature.userStory,
    independentTest: feature.independentTest,
  }));

  const payload = {
    appSummary: brief.appSummary,
    targetUsers: brief.targetUsers,
    coreFeatures: brief.coreFeatures,
    recommendedTechStack: brief.recommendedTechStack,
    pagesRoutes: brief.pagesRoutes,
    dataModel: brief.dataModel,
    buildPhases: brief.buildPhases,
    risksEdgeCases: brief.risksEdgeCases,
    featureSpecifications: featureSpecs,
  };

  return `Compose the executable agent prompt from this brief.\n\nBRIEF:\n${JSON.stringify(payload, null, 2)}`;
}
