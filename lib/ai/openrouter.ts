import { createOpenRouter } from "@openrouter/ai-sdk-provider";

export const DEFAULT_OPENROUTER_MODEL = "anthropic/claude-sonnet-4.6";

export function getOpenRouterModel(apiKey: string, modelId: string) {
  const openrouter = createOpenRouter({ apiKey });

  return openrouter.chat(modelId);
}
