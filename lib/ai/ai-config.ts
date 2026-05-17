import {
  DEFAULT_OPENROUTER_MODEL,
  getOpenRouterModel,
} from "@/lib/ai/openrouter";

export class AiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiConfigError";
  }
}

export type AiConfig = {
  apiKey: string;
  modelId: string;
};

export function getAiConfig(): AiConfig {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new AiConfigError("OPENROUTER_API_KEY is not set");
  }
  const modelId = process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL;
  return { apiKey, modelId };
}

export function getAiModel(config: AiConfig = getAiConfig()) {
  return getOpenRouterModel(config.apiKey, config.modelId);
}

export const AI_MAX_OUTPUT_TOKENS = Number.parseInt(
  process.env.OPENROUTER_MAX_OUTPUT_TOKENS ?? "8000",
  10,
);

export const AI_REQUEST_TIMEOUT_MS = 90_000;
