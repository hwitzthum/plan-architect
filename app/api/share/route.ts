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
import { getClientKey, isSameOrigin } from "@/lib/request-utils";

const requestSchema = z.object({
  idea: z.string().trim().min(1).max(4000),
  model: z.string().max(200).nullable(),
  brief: projectBriefSchema.extend({
    starterPrompt: z.string().max(40_000),
    mode: z.enum(["plain", "specKit"]),
  }),
});

const shareIdSchema = z.string().uuid();

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const limit = await checkRateLimit(getClientKey(request), {
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
  await putShare(record);

  return NextResponse.json({ id });
}

export async function GET(request: Request) {
  const limit = await checkRateLimit(`share-get:${getClientKey(request)}`, {
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });

  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const id = new URL(request.url).searchParams.get("id");
  const parsedId = shareIdSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "Share not found." }, { status: 404 });
  }

  const record = await getShare(parsedId.data);
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
