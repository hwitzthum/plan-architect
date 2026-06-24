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

const _rawTokens = Number.parseInt(
  process.env.OPENROUTER_MAX_OUTPUT_TOKENS ?? "",
  10,
);
// Fall back to 8000 if the env var is unset, empty, or non-numeric (e.g. "8k").
// Passing NaN to the AI SDK removes the cap entirely, risking unbounded billing.
export const AI_MAX_OUTPUT_TOKENS = Number.isNaN(_rawTokens) ? 8000 : _rawTokens;

export const AI_REQUEST_TIMEOUT_MS = 90_000;
