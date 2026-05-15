import { Output, streamText } from "ai";
import { z } from "zod";

import { distillStarterPrompt } from "@/lib/ai/distill-starter-prompt";
import {
  DEFAULT_OPENROUTER_MODEL,
  getOpenRouterModel,
} from "@/lib/ai/openrouter";
import {
  buildPlannerPrompt,
  PLANNER_SYSTEM_PROMPT,
} from "@/lib/ai/planner-prompt";
import { projectBriefSchema } from "@/lib/ai/planner-schema";
import { checkRateLimit } from "@/lib/rate-limit";

const requestSchema = z.object({
  idea: z.string().trim().min(10).max(2000),
  mode: z.enum(["plain", "specKit"]).default("plain"),
  tutorial: z.boolean().default(false),
  clarifierAnswers: z
    .array(
      z.object({
        question: z.string(),
        answer: z.string(),
      }),
    )
    .optional(),
});

function getClientKey(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request: Request) {
  const limit = checkRateLimit(getClientKey(request), {
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

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return jsonResponse(
      { error: "Missing OPENROUTER_API_KEY in the server environment." },
      500,
    );
  }

  const modelId = process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL;
  const { idea, mode, tutorial, clarifierAnswers } = parsed.data;

  const result = streamText({
    model: getOpenRouterModel(apiKey, modelId),
    system: PLANNER_SYSTEM_PROMPT,
    prompt: buildPlannerPrompt(idea, { mode, tutorial, clarifierAnswers }),
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
          send({ type: "error", error: "Empty brief from the model." });
          controller.close();
          return;
        }

        send({ type: "status", message: "Distilling starter prompt…" });

        const { starterPrompt, source } = await distillStarterPrompt(
          finalBrief,
          apiKey,
          modelId,
        );

        send({
          type: "done",
          brief: { ...finalBrief, mode, tutorial, starterPrompt },
          model: modelId,
          starterPromptSource: source,
        });
        controller.close();
      } catch (error) {
        console.error("Planner stream failed", error);
        send({
          type: "error",
          error: "Planner generation failed. Check the OpenRouter key.",
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
