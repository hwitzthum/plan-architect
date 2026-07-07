import { generateText } from "ai";

import { AI_MAX_OUTPUT_TOKENS } from "@/lib/ai/ai-config";
import { getOpenRouterModel } from "@/lib/ai/openrouter";
import type { ProjectBrief } from "@/lib/ai/planner-schema";
import {
  buildStarterDistillPrompt,
  STARTER_DISTILL_SYSTEM_PROMPT,
} from "@/lib/ai/starter-distill-prompt";
import { buildStarterPromptFromBrief } from "@/lib/ai/starter-prompt";
import { logError, newRequestId } from "@/lib/logger";

export type StarterPromptResult = {
  starterPrompt: string;
  source: "llm" | "fallback";
};

export async function distillStarterPrompt(
  brief: ProjectBrief,
  apiKey: string,
  modelId: string,
  abortSignal?: AbortSignal,
): Promise<StarterPromptResult> {
  try {
    const { text } = await generateText({
      model: getOpenRouterModel(apiKey, modelId),
      instructions: STARTER_DISTILL_SYSTEM_PROMPT,
      prompt: buildStarterDistillPrompt(brief),
      abortSignal,
      maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
    });

    if (!text || text.trim().length < 200) {
      return {
        starterPrompt: buildStarterPromptFromBrief(brief),
        source: "fallback",
      };
    }

    return { starterPrompt: text.trim(), source: "llm" };
  } catch (error) {
    logError({
      route: "distill-starter-prompt",
      requestId: newRequestId(),
      error,
    });
    return {
      starterPrompt: buildStarterPromptFromBrief(brief),
      source: "fallback",
    };
  }
}
