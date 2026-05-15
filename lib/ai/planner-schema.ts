import { z } from "zod";

export const featureSpecificationField = z.object({
  name: z.string().describe("Brief feature name, e.g. 'Idea capture'."),
  priority: z
    .string()
    .regex(/^P[1-5]$/)
    .describe("Priority label P1 through P5. P1 is the must-have MVP slice."),
  userStory: z
    .string()
    .describe(
      "Plain-language user journey for this feature, written from the user's perspective.",
    ),
  whyPriority: z
    .string()
    .describe("Why this story has this priority relative to the others."),
  independentTest: z
    .string()
    .describe(
      "One concrete action a tester can take, and the observable value that proves the slice works.",
    ),
  acceptanceScenarios: z
    .array(z.string())
    .min(1)
    .describe(
      "Given/When/Then phrasing: 'Given <state>, When <action>, Then <observable outcome>.'",
    ),
  edgeCases: z.array(z.string()).min(1),
  functionalRequirements: z
    .array(
      z.object({
        id: z
          .string()
          .regex(/^FR-\d{3}$/)
          .describe("Requirement id formatted as FR-001, FR-002, ..."),
        requirement: z
          .string()
          .describe(
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
        outcome: z
          .string()
          .describe("Measurable, technology-agnostic success outcome."),
      }),
    )
    .min(1),
  assumptions: z.array(z.string()).min(1),
});

export const projectBriefSchema = z.object({
  appSummary: z
    .string()
    .describe(
      "A concise summary of the app idea and the user problem it solves.",
    ),
  targetUsers: z
    .array(z.string())
    .min(1)
    .describe("The most likely users or personas for the app."),
  coreFeatures: z
    .array(z.string())
    .min(1)
    .describe("Short bullet labels for the essential first-version features."),
  featureSpecifications: z
    .array(featureSpecificationField)
    .optional()
    .describe(
      "Spec-kit feature specifications, ordered strictly by priority. Present only in spec-kit mode.",
    ),
  recommendedTechStack: z
    .array(z.string())
    .min(1)
    .describe(
      "A practical stack suited to the idea and the user's chosen modes.",
    ),
  pagesRoutes: z
    .array(
      z.object({
        path: z.string().describe("The route path, such as / or /settings."),
        purpose: z.string().describe("What the page lets the user do."),
      }),
    )
    .min(1),
  dataModel: z.object({
    entities: z
      .array(
        z.object({
          id: z
            .string()
            .regex(/^[a-z][a-z0-9-]*$/)
            .describe("Stable kebab-case id used by relationships."),
          name: z.string(),
          description: z.string(),
          fields: z.array(z.string()).min(1),
        }),
      )
      .min(1),
    relationships: z
      .array(
        z.object({
          id: z
            .string()
            .regex(/^[a-z][a-z0-9-]*$/)
            .describe("Stable kebab-case relationship id."),
          sourceEntityId: z.string(),
          targetEntityId: z.string(),
          label: z.string(),
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
        name: z.string(),
        goals: z.array(z.string()).min(1),
      }),
    )
    .min(1),
  risksEdgeCases: z
    .array(
      z.object({
        title: z.string(),
        mitigation: z.string(),
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
