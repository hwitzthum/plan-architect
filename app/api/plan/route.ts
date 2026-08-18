import { Output, streamText } from "ai";
import { z } from "zod";

import {
  AI_MAX_OUTPUT_TOKENS,
  AiConfigError,
  getAiConfig,
  getAiModel,
} from "@/lib/ai/ai-config";
import { distillStarterPrompt } from "@/lib/ai/distill-starter-prompt";
import {
  buildPlannerPrompt,
  PLANNER_SYSTEM_PROMPT,
} from "@/lib/ai/planner-prompt";
import { createPlanStream } from "@/lib/ai/plan-stream";
import { projectBriefSchema } from "@/lib/ai/planner-schema";
import { logError, newRequestId } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientKey, isSameOrigin, readJsonBody } from "@/lib/request-utils";

// Two sequential LLM calls (brief stream + starter-prompt distill). Neither
// sets a per-call timeout — the only abort source is request.signal — so this
// function cap, not any library-level deadline, is the real bound on the pair.
export const maxDuration = 300;

const requestSchema = z.object({
  idea: z.string().trim().min(10).max(2000),
  mode: z.enum(["plain", "specKit"]).default("plain"),
  clarifierAnswers: z
    .array(
      z.object({
        // Clarifier questions are generated server-side by the LLM and echoed
        // back by the client. 200 chars covers any realistic question; the
        // previous 500-char limit unnecessarily expanded the prompt-injection
        // surface inside the <clarifications> block.
        question: z.string().trim().min(1).max(200),
        answer: z.string().trim().max(2000),
      }),
    )
    // Reduced from 20 to 10: 20 × (500 + 2000) = 50 000 chars of attacker-
    // controlled text injected into the LLM prompt. 10 entries is still above
    // any real clarifier flow while halving the injection surface.
    .max(10)
    .optional(),
});

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request: Request) {
  const requestId = newRequestId();

  if (!isSameOrigin(request)) {
    return jsonResponse({ error: "Forbidden." }, 403);
  }

  const limit = await checkRateLimit(`plan:${getClientKey(request)}`, {
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });

  if (!limit.allowed) {
    if (limit.status === "unavailable") {
      return jsonResponse(
        { error: "Service temporarily unavailable. Try again shortly." },
        503,
      );
    }
    return jsonResponse(
      { error: "Too many planning requests. Try again later." },
      429,
    );
  }

  const body = await readJsonBody(request);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return jsonResponse(
      { error: "Enter a rough app idea with at least 10 characters." },
      400,
    );
  }

  let apiKey: string;
  let modelId: string;
  try {
    ({ apiKey, modelId } = getAiConfig());
  } catch (error) {
    if (error instanceof AiConfigError) {
      logError({ route: "plan", requestId, error });
      return jsonResponse({ error: "AI service is not configured." }, 503);
    }
    throw error;
  }

  const { idea, mode, clarifierAnswers } = parsed.data;

  const result = streamText({
    model: getAiModel({ apiKey, modelId }),
    instructions: PLANNER_SYSTEM_PROMPT,
    prompt: buildPlannerPrompt(idea, { mode, clarifierAnswers }),
    abortSignal: request.signal,
    maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
    output: Output.object({
      name: "ProjectBrief",
      description: "An editable project brief shaped by the user's modes.",
      schema: projectBriefSchema,
    }),
  });

  const stream = createPlanStream({
    partials: result.partialOutputStream,
    distill: (brief) =>
      distillStarterPrompt(brief, apiKey, modelId, request.signal),
    mode,
    modelId,
    requestId,
    aborted: () => request.signal.aborted,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-store",
      "X-Accel-Buffering": "no",
      "X-Request-Id": requestId,
    },
  });
}
