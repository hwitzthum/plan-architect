import { generateText, NoObjectGeneratedError, Output } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  AI_MAX_OUTPUT_TOKENS,
  AiConfigError,
  getAiConfig,
  getAiModel,
} from "@/lib/ai/ai-config";
import {
  buildClarifierPrompt,
  CLARIFIER_SYSTEM_PROMPT,
} from "@/lib/ai/clarifier-prompt";
import { clarifierSchema } from "@/lib/ai/clarifier-schema";
import { logError, newRequestId } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientKey, isSameOrigin } from "@/lib/request-utils";

export const maxDuration = 30;

const requestSchema = z.object({
  idea: z.string().trim().min(10).max(2000),
});

export async function POST(request: Request) {
  const requestId = newRequestId();

  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const limit = await checkRateLimit(getClientKey(request), {
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });

  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many clarification requests. Try again later." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a rough app idea with at least 10 characters." },
      { status: 400 },
    );
  }

  let config;
  try {
    config = getAiConfig();
  } catch (error) {
    if (error instanceof AiConfigError) {
      logError({ route: "clarify", requestId, error });
      return NextResponse.json(
        { error: "AI service is not configured." },
        { status: 503 },
      );
    }
    throw error;
  }

  try {
    const { output } = await generateText({
      model: getAiModel(config),
      system: CLARIFIER_SYSTEM_PROMPT,
      prompt: buildClarifierPrompt(parsed.data.idea),
      abortSignal: request.signal,
      maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
      output: Output.object({
        name: "ClarifierQuestions",
        description: "Three to five idea-aware clarifying questions.",
        schema: clarifierSchema,
      }),
    });

    return NextResponse.json({ questions: output.questions });
  } catch (error) {
    logError({ route: "clarify", requestId, error });
    if (NoObjectGeneratedError.isInstance(error)) {
      return NextResponse.json(
        { error: "Could not generate clarifying questions. Try again." },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: "AI service is currently unavailable." },
      { status: 503 },
    );
  }
}
