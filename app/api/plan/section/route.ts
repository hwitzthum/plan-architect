import { generateText, NoObjectGeneratedError, Output } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  DEFAULT_OPENROUTER_MODEL,
  getOpenRouterModel,
} from "@/lib/ai/openrouter";
import { PLANNER_SYSTEM_PROMPT } from "@/lib/ai/planner-prompt";
import { projectBriefSchema } from "@/lib/ai/planner-schema";
import {
  SECTION_LABELS,
  SECTION_NAMES,
  sectionSchemas,
  type SectionName,
} from "@/lib/ai/section-schemas";
import { checkRateLimit } from "@/lib/rate-limit";

const requestSchema = z.object({
  brief: projectBriefSchema,
  section: z.enum(SECTION_NAMES as [SectionName, ...SectionName[]]),
  constraint: z.string().trim().max(500).optional(),
  mode: z.enum(["plain", "specKit"]).default("plain"),
  tutorial: z.boolean().default(false),
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
    limit: 40,
    windowMs: 60 * 60 * 1000,
  });

  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many regeneration requests. Try again later." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid section regeneration request." },
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
  const { brief, section, constraint, mode, tutorial } = parsed.data;

  const sectionSchema = sectionSchemas[section];
  const sectionLabel = SECTION_LABELS[section];

  const sectionPrompt = `You are revising one section of an existing project brief.

The brief so far (for context, do NOT change other sections):
${JSON.stringify(brief, null, 2)}

Regenerate ONLY the "${sectionLabel}" section.
${constraint ? `Apply this extra constraint: ${constraint}` : ""}

Modes for this brief:
- spec-kit mode: ${mode === "specKit" ? "ON" : "OFF"}
- tutorial mode: ${tutorial ? "ON" : "OFF"}

For the data model section, every relationship's sourceEntityId and targetEntityId must match a generated entity id. Use kebab-case ids.

Return only the new value for this section.`;

  try {
    const { output } = await generateText({
      model: getOpenRouterModel(apiKey, modelId),
      system: PLANNER_SYSTEM_PROMPT,
      prompt: sectionPrompt,
      output: Output.object({
        name: `Section_${section}`,
        description: `New value for the ${sectionLabel} section.`,
        schema: sectionSchema as unknown as Parameters<
          typeof Output.object
        >[0]["schema"],
      }),
    });

    return NextResponse.json({ section, value: output });
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      console.error("Section regeneration failed", error.cause);
      return NextResponse.json(
        {
          error:
            "Could not regenerate this section. Try a different constraint.",
        },
        { status: 502 },
      );
    }
    console.error("Section regeneration failed", error);
    return NextResponse.json(
      { error: "Section regeneration failed. Check the OpenRouter key." },
      { status: 500 },
    );
  }
}
