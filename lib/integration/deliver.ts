// Hands a finished plan to the Kommandozentrale (its F2.1 intake).
//
// Same contract every integrated app implements: multipart, a `result` JSON
// part, one file part per deliverable whose field name is its label. See
// docs/INTEGRATION.md in the rautaki-dashboard repository.

import type { ProjectBrief } from "@/lib/ai/planner-schema";
import { briefToMarkdown } from "@/lib/integration/brief-markdown";
import { APP_ID } from "@/lib/integration/manifest";

export class DeliveryError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "DeliveryError";
  }
}

export function deliveryConfigured(): boolean {
  return Boolean(
    process.env.RAUTAKI_DASHBOARD_URL && process.env.RAUTAKI_RESULTS_TOKEN,
  );
}

/** The idea is the title; only its length needs deciding. */
function titleFor(idea: string): string {
  const trimmed = idea.trim().replace(/\s+/g, " ");
  const short = trimmed.length > 110 ? `${trimmed.slice(0, 107)}…` : trimmed;
  return `Plan: ${short}`;
}

export async function deliverPlan({
  idea,
  mode,
  brief,
  clientRef,
  model,
  signal,
}: {
  idea: string;
  mode: string;
  brief: ProjectBrief & { starterPrompt?: string; mode?: string };
  clientRef: string;
  model: string | null;
  signal?: AbortSignal;
}): Promise<{ resultId: string; resultUrl: string; replayed: boolean }> {
  const base = process.env.RAUTAKI_DASHBOARD_URL!.replace(/\/$/, "");

  const form = new FormData();
  form.set(
    "result",
    JSON.stringify({
      title: titleFor(idea),
      kind: "plan",
      /*
       * The starter prompt is the body, not the brief.
       *
       * The body is what the dashboard shows with a Copy button, and the
       * starter prompt is the one part of this delivery whose whole purpose is
       * to be pasted somewhere else. The brief is for reading, and it travels
       * as the file.
       */
      body: brief.starterPrompt ?? brief.appSummary,
      clientRef,
      meta: {
        app: APP_ID,
        idea,
        mode,
        model,
        features: brief.coreFeatures.length,
        phases: brief.buildPhases.length,
        entities: brief.dataModel.entities.length,
        risks: brief.risksEdgeCases.length,
        hasStarterPrompt: Boolean(brief.starterPrompt),
      },
    }),
  );

  form.append(
    "Projekt-Brief",
    new File([briefToMarkdown(brief, idea)], "projekt-brief.md", {
      type: "text/markdown",
    }),
  );

  let response: Response;
  try {
    response = await fetch(`${base}/api/results`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.RAUTAKI_RESULTS_TOKEN!}`,
      },
      body: form,
      signal,
    });
  } catch (error) {
    throw new DeliveryError(
      `Could not reach the dashboard: ${error instanceof Error ? error.message : "unknown error"}`,
      502,
    );
  }

  const payload = (await response.json().catch(() => null)) as {
    id?: string;
    replayed?: boolean;
    error?: string;
  } | null;

  if (!response.ok || !payload?.id) {
    throw new DeliveryError(
      payload?.error ??
        `The dashboard refused the delivery (${response.status})`,
      502,
    );
  }

  return {
    resultId: payload.id,
    resultUrl: `${base}/results/${payload.id}`,
    replayed: payload.replayed === true,
  };
}
