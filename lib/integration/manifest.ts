// What this app tells the Kommandozentrale it can do (dashboard F2.5).
//
// The dashboard reads this rather than hard-coding what the plan architect
// accepts, and Phase 3's command router will classify free-text requests
// against exactly this document.

import { z } from "zod";

export const APP_ID = "plan-architect";

/**
 * The inputs a dashboard-triggered run accepts.
 *
 * `clarifierAnswers` is deliberately absent: the clarifier is an interactive
 * back-and-forth with a person, and a one-shot run has nobody to ask. The
 * bounds match /api/plan's own schema — the test asserts they still agree.
 */
export const runInputSchema = z.object({
  idea: z
    .string()
    .trim()
    .min(10)
    .max(2000)
    .describe("Die Idee, aus der ein Projekt-Brief werden soll."),
  mode: z
    .enum(["plain", "specKit"])
    .default("plain")
    .describe(
      "plain: ein lesbarer Brief. specKit: zusätzlich ausformulierte " +
        "Feature-Spezifikationen mit Akzeptanzkriterien.",
    ),
  clientRef: z
    .string()
    .trim()
    .min(1)
    .max(128)
    .optional()
    .describe(
      "Eigene ID des Aufrufers. Ein Wiederholungsversuch mit derselben ID " +
        "liefert dieselbe Lieferung, statt erneut zu planen.",
    ),
});

export type RunInput = z.infer<typeof runInputSchema>;

export function manifest() {
  return {
    app: APP_ID,
    name: "Plan Architect",
    description:
      "Macht aus einer groben Idee einen Projekt-Brief — Zusammenfassung, " +
      "Nutzer, Features, Stack, Routen, Datenmodell, Phasen, Risiken — und " +
      "destilliert daraus einen Startprompt für einen Coding-Agenten.",
    version: 1,
    languages: ["de", "en"],
    capabilities: [
      {
        id: "plan",
        label: "Projekt-Brief aus einer Idee",
        resultKind: "plan",
        estimate: "1–3 min",
      },
    ],
    input: z.toJSONSchema(runInputSchema, { io: "input" }),
  };
}
