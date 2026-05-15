import { generateText, NoObjectGeneratedError, Output } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  buildClarifierPrompt,
  CLARIFIER_SYSTEM_PROMPT,
} from "@/lib/ai/clarifier-prompt";
import { clarifierSchema } from "@/lib/ai/clarifier-schema";
import {
  DEFAULT_OPENROUTER_MODEL,
  getOpenRouterModel,
} from "@/lib/ai/openrouter";
import { checkRateLimit } from "@/lib/rate-limit";

const requestSchema = z.object({
  idea: z.string().trim().min(10).max(2000),
});

function getClientKey(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}

export async function POST(request: Request) {
  const limit = checkRateLimit(getClientKey(request), {
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

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing OPENROUTER_API_KEY in the server environment." },
      { status: 500 },
    );
  }

  const modelId = process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL;

  try {
    const { output } = await generateText({
      model: getOpenRouterModel(apiKey, modelId),
      system: CLARIFIER_SYSTEM_PROMPT,
      prompt: buildClarifierPrompt(parsed.data.idea),
      output: Output.object({
        name: "ClarifierQuestions",
        description: "Three to five idea-aware clarifying questions.",
        schema: clarifierSchema,
      }),
    });

    return NextResponse.json({ questions: output.questions });
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      console.error("Clarifier structured output failed", error.cause);
      return NextResponse.json(
        { error: "Could not generate clarifying questions. Try again." },
        { status: 502 },
      );
    }
    console.error("Clarifier generation failed", error);
    return NextResponse.json(
      { error: "Clarifier generation failed. Check the OpenRouter key." },
      { status: 500 },
    );
  }
}
