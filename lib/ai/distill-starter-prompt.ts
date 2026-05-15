import { generateText } from "ai";

import { getOpenRouterModel } from "@/lib/ai/openrouter";
import type { ProjectBrief } from "@/lib/ai/planner-schema";
import {
  buildStarterDistillPrompt,
  STARTER_DISTILL_SYSTEM_PROMPT,
} from "@/lib/ai/starter-distill-prompt";
import { buildStarterPromptFromBrief } from "@/lib/ai/starter-prompt";

export type StarterPromptResult = {
  starterPrompt: string;
  source: "llm" | "fallback";
};

export async function distillStarterPrompt(
  brief: ProjectBrief,
  apiKey: string,
  modelId: string,
): Promise<StarterPromptResult> {
  try {
    const { text } = await generateText({
      model: getOpenRouterModel(apiKey, modelId),
      system: STARTER_DISTILL_SYSTEM_PROMPT,
      prompt: buildStarterDistillPrompt(brief),
    });

    if (!text || text.trim().length < 200) {
      return {
        starterPrompt: buildStarterPromptFromBrief(brief),
        source: "fallback",
      };
    }

    return { starterPrompt: text.trim(), source: "llm" };
  } catch (error) {
    console.error("Starter-prompt distillation failed", error);
    return {
      starterPrompt: buildStarterPromptFromBrief(brief),
      source: "fallback",
    };
  }
}
