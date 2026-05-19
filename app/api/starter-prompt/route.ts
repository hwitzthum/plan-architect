import { NextResponse } from "next/server";
import { z } from "zod";

import { AiConfigError, getAiConfig } from "@/lib/ai/ai-config";
import { distillStarterPrompt } from "@/lib/ai/distill-starter-prompt";
import { projectBriefSchema } from "@/lib/ai/planner-schema";
import { logError, newRequestId } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientKey, isSameOrigin } from "@/lib/request-utils";

export const maxDuration = 30;

const requestSchema = z.object({
  brief: projectBriefSchema,
});

export async function POST(request: Request) {
  const requestId = newRequestId();

  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

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

  let apiKey: string;
  let modelId: string;
  try {
    ({ apiKey, modelId } = getAiConfig());
  } catch (error) {
    if (error instanceof AiConfigError) {
      logError({ route: "starter-prompt", requestId, error });
      return NextResponse.json(
        { error: "AI service is not configured." },
        { status: 503 },
      );
    }
    throw error;
  }

  const { starterPrompt, source } = await distillStarterPrompt(
    parsed.data.brief,
    apiKey,
    modelId,
    request.signal,
  );

  return NextResponse.json({ starterPrompt, source });
}
