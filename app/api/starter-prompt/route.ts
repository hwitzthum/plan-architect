import { NextResponse } from "next/server";
import { z } from "zod";

import { distillStarterPrompt } from "@/lib/ai/distill-starter-prompt";
import { DEFAULT_OPENROUTER_MODEL } from "@/lib/ai/openrouter";
import { projectBriefSchema } from "@/lib/ai/planner-schema";
import { checkRateLimit } from "@/lib/rate-limit";

const requestSchema = z.object({
  brief: projectBriefSchema,
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
      { error: "Too many starter-prompt requests. Try again later." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "A valid brief is required." },
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

  const { starterPrompt, source } = await distillStarterPrompt(
    parsed.data.brief,
    apiKey,
    modelId,
  );

  return NextResponse.json({ starterPrompt, source });
}
