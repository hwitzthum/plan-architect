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
import { projectBriefSchema } from "@/lib/ai/planner-schema";
import { logError, logWarn, newRequestId } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientKey, isSameOrigin } from "@/lib/request-utils";

export const maxDuration = 60;

const requestSchema = z.object({
  idea: z.string().trim().min(10).max(2000),
  mode: z.enum(["plain", "specKit"]).default("plain"),
  clarifierAnswers: z
    .array(
      z.object({
        question: z.string().max(500),
        answer: z.string().max(2000),
      }),
    )
    .max(20)
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

  const limit = await checkRateLimit(getClientKey(request), {
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });

  if (!limit.allowed) {
    return jsonResponse(
      { error: "Too many planning requests. Try again later." },
      429,
    );
  }

  const body = await request.json().catch(() => null);
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
    system: PLANNER_SYSTEM_PROMPT,
    prompt: buildPlannerPrompt(idea, { mode, clarifierAnswers }),
    abortSignal: request.signal,
    maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
    experimental_output: Output.object({
      name: "ProjectBrief",
      description: "An editable project brief shaped by the user's modes.",
      schema: projectBriefSchema,
    }),
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function send(payload: unknown) {
        controller.enqueue(encoder.encode(JSON.stringify(payload) + "\n"));
      }

      try {
        let latestPartial: Record<string, unknown> | null = null;

        for await (const partial of result.partialOutputStream) {
          latestPartial = partial as Record<string, unknown>;
          send({ type: "partial", brief: partial });
        }

        const finalBrief =
          (latestPartial as Parameters<typeof distillStarterPrompt>[0]) ?? null;

        if (!finalBrief) {
          send({ type: "error", error: "AI service returned an empty brief." });
          controller.close();
          return;
        }

        send({ type: "status", message: "Distilling starter prompt…" });

        const { starterPrompt, source } = await distillStarterPrompt(
          finalBrief,
          apiKey,
          modelId,
          request.signal,
        );

        send({
          type: "done",
          brief: { ...finalBrief, mode, starterPrompt },
          model: modelId,
          starterPromptSource: source,
        });
        controller.close();
      } catch (error) {
        if (request.signal.aborted) {
          logWarn({ route: "plan", requestId, message: "client aborted" });
        } else {
          logError({ route: "plan", requestId, error });
        }
        send({ type: "error", error: "AI service is currently unavailable." });
        controller.close();
      }
    },
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
