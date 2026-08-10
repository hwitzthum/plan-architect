import type { StarterPromptResult } from "@/lib/ai/distill-starter-prompt";
import { projectBriefSchema, type ProjectBrief } from "@/lib/ai/planner-schema";
import { logError, logWarn } from "@/lib/logger";

export type PlanStreamDeps = {
  /**
   * The planner's deep-partial stream. Typed as `unknown` per item on purpose:
   * only the last value is ever trusted, and only after it parses.
   */
  partials: AsyncIterable<unknown>;
  distill: (brief: ProjectBrief) => Promise<StarterPromptResult>;
  mode: "plain" | "specKit";
  modelId: string;
  requestId: string;
  /** Read at failure time, so an abort mid-stream is reported as one. */
  aborted: () => boolean;
};

/**
 * The NDJSON event stream behind POST /api/plan.
 *
 * Split out of the route so it can be tested without an LLM. The property
 * worth pinning down — that a truncated brief never reaches `done` — belongs
 * to this function, not to the transport around it.
 */
/** The subset of the controller the writer touches. */
export type StreamSink = {
  enqueue: (chunk: Uint8Array) => void;
  close: () => void;
};

/**
 * A writer that goes quiet once its reader is gone.
 *
 * A client that navigates away cancels the stream, and the controller then
 * rejects every further enqueue/close with "Invalid state: Controller is
 * already closed". The stream's own error path reports failures by writing to
 * it, so unguarded, reporting an abort throws — and whatever follows the write,
 * today `close()`, never runs.
 *
 * That throw is currently absorbed: it rejects the promise `start()` returns,
 * which the stream machinery handles, so nothing reaches the process as an
 * unhandled rejection. The guard is not there to stop a crash. It is there so
 * that "the client left" stays an ordinary outcome rather than control flow
 * that skips the rest of the function, which is what makes the next line added
 * after a send() safe by default.
 */
export function createWriter(sink: StreamSink, encoder: TextEncoder) {
  let writable = true;

  return {
    send(payload: unknown) {
      if (!writable) return;
      try {
        sink.enqueue(encoder.encode(JSON.stringify(payload) + "\n"));
      } catch {
        writable = false;
      }
    },
    close() {
      if (!writable) return;
      writable = false;
      try {
        sink.close();
      } catch {
        // Cancelled between the last send() and here.
      }
    },
  };
}

export function createPlanStream(
  deps: PlanStreamDeps,
): ReadableStream<Uint8Array> {
  const { partials, distill, mode, modelId, requestId, aborted } = deps;
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const { send, close } = createWriter(controller, encoder);

      try {
        let latestPartial: unknown = null;

        for await (const partial of partials) {
          latestPartial = partial;
          send({ type: "partial", brief: partial });
        }

        if (!latestPartial) {
          send({ type: "error", error: "AI service returned an empty brief." });
          close();
          return;
        }

        // The stream yields deep partials, so the last one is a complete
        // ProjectBrief only if the model actually finished. Hitting
        // AI_MAX_OUTPUT_TOKENS stops it mid-object, and every consumer of the
        // `done` brief dereferences required fields unguarded — distill here,
        // and deliver() when /api/run drives this route in-process, where the
        // resulting TypeError is not a DeliveryError and escapes as an
        // uncaught 500.
        const validated = projectBriefSchema.safeParse(latestPartial);

        if (!validated.success) {
          logError({ route: "plan", requestId, error: validated.error });
          send({
            type: "error",
            error: "AI service returned an incomplete brief.",
          });
          close();
          return;
        }

        const finalBrief = validated.data;

        send({ type: "status", message: "Distilling starter prompt…" });

        const { starterPrompt, source } = await distill(finalBrief);

        send({
          type: "done",
          brief: { ...finalBrief, mode, starterPrompt },
          model: modelId,
          starterPromptSource: source,
        });
        close();
      } catch (error) {
        if (aborted()) {
          logWarn({ route: "plan", requestId, message: "client aborted" });
        } else {
          logError({ route: "plan", requestId, error });
        }
        send({ type: "error", error: "AI service is currently unavailable." });
        close();
      }
    },
  });
}
