import { NextResponse } from "next/server";
import { z } from "zod";

import { projectBriefSchema } from "@/lib/ai/planner-schema";
import {
  getShare,
  newShareId,
  putShare,
  type SharedBrief,
} from "@/lib/persistence/share-store";
import { checkRateLimit } from "@/lib/rate-limit";

const requestSchema = z.object({
  idea: z.string().trim().min(1).max(4000),
  model: z.string().nullable(),
  brief: projectBriefSchema.extend({
    starterPrompt: z.string(),
    mode: z.enum(["plain", "specKit"]),
    tutorial: z.boolean(),
  }),
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
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });

  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many share requests. Try again later." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid share payload." },
      { status: 400 },
    );
  }

  const id = newShareId();
  const record: SharedBrief = {
    id,
    idea: parsed.data.idea,
    model: parsed.data.model,
    brief: parsed.data.brief as SharedBrief["brief"],
    createdAt: Date.now(),
  };
  putShare(record);

  return NextResponse.json({ id });
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }

  const record = getShare(id);
  if (!record) {
    return NextResponse.json({ error: "Share not found." }, { status: 404 });
  }

  return NextResponse.json({
    id: record.id,
    idea: record.idea,
    model: record.model,
    brief: record.brief,
  });
}
