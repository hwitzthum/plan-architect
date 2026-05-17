import { z } from "zod";

// String bounds are kept as `.max()` because JSON Schema `maxLength` is
// supported by every major LLM provider. Array bounds are NOT in the schema
// because some providers (notably Amazon Bedrock / Anthropic routed through
// OpenRouter) reject `maxItems`. We enforce array size limits at the API
// route layer instead — see `MAX_BRIEF_JSON_BYTES` and per-route checks.

const shortText = z.string().min(1).max(400);
const mediumText = z.string().min(1).max(2000);
const longText = z.string().min(1).max(8000);
const idText = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z][a-z0-9-]*$/);

export const featureSpecificationField = z.object({
  name: shortText.describe("Brief feature name, e.g. 'Idea capture'."),
  priority: z
    .string()
    .regex(/^P[1-5]$/)
    .describe("Priority label P1 through P5. P1 is the must-have MVP slice."),
  userStory: mediumText.describe(
    "Plain-language user journey for this feature, written from the user's perspective.",
  ),
  whyPriority: mediumText.describe(
    "Why this story has this priority relative to the others.",
  ),
  independentTest: mediumText.describe(
    "One concrete action a tester can take, and the observable value that proves the slice works.",
  ),
  acceptanceScenarios: z
    .array(mediumText)
    .min(1)
    .describe(
      "Given/When/Then phrasing: 'Given <state>, When <action>, Then <observable outcome>.'",
    ),
  edgeCases: z.array(mediumText).min(1),
  functionalRequirements: z
    .array(
      z.object({
        id: z
          .string()
          .regex(/^FR-\d{3}$/)
          .describe("Requirement id formatted as FR-001, FR-002, ..."),
        requirement: mediumText.describe(
          "Specific system capability using MUST language. May contain '[NEEDS CLARIFICATION: ...]'.",
        ),
      }),
    )
    .min(1),
  successCriteria: z
    .array(
      z.object({
        id: z
          .string()
          .regex(/^SC-\d{3}$/)
          .describe("Success criterion id formatted as SC-001, SC-002, ..."),
        outcome: mediumText.describe(
          "Measurable, technology-agnostic success outcome.",
        ),
      }),
    )
    .min(1),
  assumptions: z.array(mediumText).min(1),
});

export const projectBriefSchema = z.object({
  appSummary: longText.describe(
    "A concise summary of the app idea and the user problem it solves.",
  ),
  targetUsers: z
    .array(shortText)
    .min(1)
    .describe("The most likely users or personas for the app."),
  coreFeatures: z
    .array(shortText)
    .min(1)
    .describe("Short bullet labels for the essential first-version features."),
  featureSpecifications: z
    .array(featureSpecificationField)
    .optional()
    .describe(
      "Spec-kit feature specifications, ordered strictly by priority. Present only in spec-kit mode.",
    ),
  recommendedTechStack: z
    .array(shortText)
    .min(1)
    .describe(
      "A practical stack suited to the idea and the user's chosen modes.",
    ),
  pagesRoutes: z
    .array(
      z.object({
        path: shortText.describe("The route path, such as / or /settings."),
        purpose: mediumText.describe("What the page lets the user do."),
      }),
    )
    .min(1),
  dataModel: z.object({
    entities: z
      .array(
        z.object({
          id: idText.describe("Stable kebab-case id used by relationships."),
          name: shortText,
          description: mediumText,
          fields: z.array(shortText).min(1),
        }),
      )
      .min(1),
    relationships: z
      .array(
        z.object({
          id: idText.describe("Stable kebab-case relationship id."),
          sourceEntityId: idText,
          targetEntityId: idText,
          label: shortText,
        }),
      )
      .min(0)
      .describe(
        "Pair-wise entity relationships. May be empty for very simple models.",
      ),
  }),
  buildPhases: z
    .array(
      z.object({
        name: shortText,
        goals: z.array(mediumText).min(1),
      }),
    )
    .min(1),
  risksEdgeCases: z
    .array(
      z.object({
        title: shortText,
        mitigation: mediumText,
      }),
    )
    .min(1),
});

export type ProjectBrief = z.infer<typeof projectBriefSchema>;
export type FeatureSpecification = z.infer<typeof featureSpecificationField>;
export type ProjectEntity = ProjectBrief["dataModel"]["entities"][number];
export type ProjectRelationship =
  ProjectBrief["dataModel"]["relationships"][number];

export type BriefMode = "plain" | "specKit";

export type ProjectBriefWithStarter = ProjectBrief & {
  starterPrompt: string;
  mode: BriefMode;
};
