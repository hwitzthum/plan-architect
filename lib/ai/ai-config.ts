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

// Clamp to [1, 32000] so a misconfigured or very large env value cannot
// trigger runaway API cost. parseInt returns NaN for non-numeric strings;
// the fallback keeps NaN and values outside the window at 8 000.
//
// Read inside a function, not into a module-level constant: every other env
// var in this app is read at request time (see README), so a var changed
// in the environment takes effect on the next request rather than only
// after the next cold start.
export function getAiMaxOutputTokens(): number {
  const rawTokens = Number.parseInt(
    process.env.OPENROUTER_MAX_OUTPUT_TOKENS ?? "8000",
    10,
  );
  return Number.isFinite(rawTokens) && rawTokens >= 1 && rawTokens <= 32_000
    ? rawTokens
    : 8_000;
}
