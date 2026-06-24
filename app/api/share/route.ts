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

const MAX_SHARE_JSON_BYTES = 256 * 1024; // 256 KB — well above any real LLM brief

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

  const limit = await checkRateLimit(`share:${getClientKey(request)}`, {
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

  const payloadBytes = Buffer.byteLength(JSON.stringify(parsed.data), "utf8");
  if (payloadBytes > MAX_SHARE_JSON_BYTES) {
    return NextResponse.json(
      { error: "Share payload too large." },
      { status: 413 },
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
  try {
    await putShare(record);
  } catch {
    return NextResponse.json(
      { error: "Could not save share. Try again later." },
      { status: 503 },
    );
  }

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

  let record: SharedBrief | null;
  try {
    record = await getShare(parsedId.data);
  } catch {
    return NextResponse.json(
      { error: "Could not retrieve share. Try again later." },
      { status: 503 },
    );
  }
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
