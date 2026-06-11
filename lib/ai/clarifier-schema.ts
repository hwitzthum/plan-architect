import { z } from "zod";

export const clarifierQuestionSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .describe("Stable kebab-case id for this question."),
  question: z.string().describe("The user-facing question text."),
  options: z
    .array(z.string())
    .min(1)
    .describe("Two to five concrete choices the user can pick from."),
  allowMultiple: z
    .boolean()
    .describe(
      "If true, the user can select every option that applies instead of exactly one.",
    ),
  allowFreeText: z
    .boolean()
    .describe("If true, the UI also offers a free-text 'Other' field."),
});

export const clarifierSchema = z.object({
  questions: z
    .array(clarifierQuestionSchema)
    .min(1)
    .describe(
      "Three to five idea-aware questions that meaningfully change the eventual plan.",
    ),
});

export type ClarifierQuestion = z.infer<typeof clarifierQuestionSchema>;
export type ClarifierAnswers = Record<string, string>;
