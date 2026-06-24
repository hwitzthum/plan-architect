"use client";

import { CheckIcon, Share2Icon } from "lucide-react";
import { startTransition, useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type {
  ClarifierAnswers,
  ClarifierQuestion,
} from "@/lib/ai/clarifier-schema";
import {
  projectBriefSchema,
  type BriefMode,
  type ProjectBriefWithStarter,
} from "@/lib/ai/planner-schema";
import type { SectionName } from "@/lib/ai/section-schemas";
import { parseNdjsonStream } from "@/lib/ndjson-stream";
import {
  buildShareUrlForId,
  clearCurrentHash,
  loadLastBrief,
  newBriefId,
  readShareIdFromHash,
  saveBrief,
} from "@/lib/persistence/brief-storage";

import {
  BuildPhasesSection,
  PagesRoutesSection,
  ProjectBriefSection,
  RisksSection,
} from "./brief-editor";
import { DataModelEditor } from "./data-model-editor";
import { DataModelFlow } from "./data-model-flow";
import { ClarifierDialog } from "./clarifier-dialog";
import { FeatureSpecificationsEditor } from "./feature-specifications-editor";
import { IdeaForm } from "./idea-form";
import { ModeToggles } from "./mode-toggles";
import { StarterPromptCard } from "./starter-prompt-card";
import { StreamingPreview } from "./streaming-preview";

const exampleIdea =
  "A lightweight project planner that turns a rough app idea into a structured brief, routes, data model, phases, risks, and a coding-agent prompt.";

export function PlannerApp() {
  const [idea, setIdea] = useState(exampleIdea);
  const [brief, setBrief] = useState<ProjectBriefWithStarter | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [briefId, setBriefId] = useState<string | null>(null);
  const [mode, setMode] = useState<BriefMode>("plain");
  const [clarifierQuestions, setClarifierQuestions] = useState<
    ClarifierQuestion[] | null
  >(null);
  const [clarifierLoading, setClarifierLoading] = useState(false);
  const [streamingBrief, setStreamingBrief] = useState<Record<
    string,
    unknown
  > | null>(null);

  useEffect(() => {
    const shareId = readShareIdFromHash(window.location.hash);
    if (shareId) {
      let cancelled = false;
      (async () => {
        try {
          const response = await fetch(
            `/api/share?id=${encodeURIComponent(shareId)}`,
          );
          if (cancelled) return;
          if (!response.ok) {
            setError("That share link is no longer available.");
            clearCurrentHash();
            return;
          }
          const payload = (await response.json()) as {
            id: string;
            idea: string;
            model: string | null;
            brief: ProjectBriefWithStarter;
          };
          setBriefId(newBriefId());
          setIdea(payload.idea);
          setModel(payload.model);
          setBrief(payload.brief);
          setMode(payload.brief.mode ?? "plain");
          clearCurrentHash();
        } catch {
          if (!cancelled) {
            setError("That share link could not be loaded.");
            clearCurrentHash();
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    const last = loadLastBrief();
    if (last) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot hydration from localStorage
      setBriefId(last.id);
      setIdea(last.idea);
      setModel(last.model);
      setBrief(last.brief);
      setMode(last.brief.mode ?? "plain");
    }
  }, []);

  useEffect(() => {
    if (!brief) return;
    const id = briefId ?? newBriefId();
    if (!briefId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- assigning generated id once
      setBriefId(id);
    }
    saveBrief({
      id,
      idea,
      model,
      savedAt: Date.now(),
      brief,
    });
  }, [brief, idea, model, briefId]);

  const handleBriefChange = useCallback((next: ProjectBriefWithStarter) => {
    setBrief(next);
  }, []);

  async function requestClarifier() {
    const trimmedIdea = idea.trim();

    if (trimmedIdea.length < 10) {
      setError("Enter a more specific app idea before generating a brief.");
      return;
    }

    setClarifierLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/clarify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: trimmedIdea }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload.error || "Could not generate clarifying questions.",
        );
      }

      setClarifierQuestions(payload.questions as ClarifierQuestion[]);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Could not generate clarifying questions.",
      );
    } finally {
      setClarifierLoading(false);
    }
  }

  async function generateBriefWithAnswers(answers: ClarifierAnswers) {
    const trimmedIdea = idea.trim();
    if (trimmedIdea.length < 10) return;

    setIsLoading(true);
    setError(null);
    setBriefId(newBriefId());
    setBrief(null);
    setStreamingBrief(null);

    const formatted = (clarifierQuestions ?? [])
      .map((question) => {
        const answer = answers[question.id];
        if (!answer) return null;
        return { question: question.question, answer };
      })
      .filter(
        (entry): entry is { question: string; answer: string } =>
          entry !== null,
      );

    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea: trimmedIdea,
          mode,
          clarifierAnswers: formatted.length > 0 ? formatted : undefined,
        }),
      });

      if (!response.ok || !response.body) {
        const message = await response
          .json()
          .then((data: { error?: string }) => data.error)
          .catch(() => null);
        throw new Error(message || "The project brief could not be generated.");
      }

      let finalBrief: ProjectBriefWithStarter | null = null;
      let finalModel: string | null = null;
      let streamError: string | null = null;
      let latestPartial: Record<string, unknown> | null = null;

      type StreamEvent =
        | { type: "partial"; brief: Record<string, unknown> }
        | { type: "status"; message: string }
        | { type: "done"; brief: ProjectBriefWithStarter; model: string }
        | { type: "error"; error: string };

      for await (const event of parseNdjsonStream<StreamEvent>(response.body)) {
        if (event.type === "partial") {
          latestPartial = event.brief;
          setStreamingBrief(event.brief);
        } else if (event.type === "status") {
          setStreamingBrief((prev) => ({
            ...(prev ?? {}),
            __status: event.message,
          }));
        } else if (event.type === "done") {
          finalBrief = event.brief;
          finalModel = event.model;
        } else if (event.type === "error") {
          streamError = event.error;
        }
      }

      if (!finalBrief) {
        // The stream ended without a `done` event (function timeout, network
        // drop, or distill failure). If the brief itself finished streaming,
        // recover it instead of discarding the draft.
        const salvaged = salvagePartialBrief(latestPartial, mode);
        if (salvaged) {
          startTransition(() => {
            setBrief(salvaged);
            setModel(null);
            setStreamingBrief(null);
            setClarifierQuestions(null);
          });
          setError(
            "The brief was recovered, but the starter prompt could not be generated. Use Regenerate in the Hand-off section.",
          );
          return;
        }
        throw new Error(
          streamError || "The project brief could not be generated.",
        );
      }
      if (streamError) throw new Error(streamError);

      const briefForState = finalBrief;
      startTransition(() => {
        setBrief(briefForState);
        setModel(finalModel);
        setStreamingBrief(null);
        setClarifierQuestions(null);
      });
    } catch (fetchError) {
      setStreamingBrief(null);
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "The project brief could not be generated.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  function skipClarifier() {
    generateBriefWithAnswers({});
  }

  async function regenerateStarterPrompt() {
    if (!brief) return;
    const { starterPrompt: _omit, mode: _mode, ...payload } = brief;
    void _omit;
    void _mode;
    try {
      const response = await fetch("/api/starter-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: payload }),
      });
      const data = (await response.json()) as {
        starterPrompt?: string;
        error?: string;
      };
      if (!response.ok || !data.starterPrompt) {
        throw new Error(data.error || "Could not regenerate the prompt.");
      }
      setBrief({ ...brief, starterPrompt: data.starterPrompt });
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Could not regenerate the prompt.",
      );
    }
  }

  async function regenerateSection(
    section: SectionName,
    constraint: string | undefined,
  ) {
    if (!brief) return;
    const {
      starterPrompt: _starterPrompt,
      mode: _bMode,
      ...briefPayload
    } = brief;
    void _starterPrompt;
    void _bMode;

    try {
      const response = await fetch("/api/plan/section", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: briefPayload,
          section,
          constraint,
          mode,
        }),
      });
      const data = (await response.json()) as {
        section?: SectionName;
        value?: unknown;
        error?: string;
      };
      if (!response.ok || !data.value) {
        throw new Error(data.error || "Could not regenerate this section.");
      }

      const next = applySectionPatch(brief, section, data.value);
      setBrief(next);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Could not regenerate this section.",
      );
    }
  }

  return (
    <main className="planner-bg min-h-screen flex-1 overflow-hidden">
      <div className="container mx-auto flex max-w-[1420px] flex-col gap-14 px-5 py-12 lg:px-10 lg:py-16">
        <div className="masthead flex flex-wrap items-end justify-between gap-8 text-foreground">
          <div className="flex flex-col gap-3">
            <RautakiLogo />
            <p className="micro-label">Strategy · Advisory · Growth</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="micro-label">
              Next.js
            </Badge>
            <Badge variant="outline" className="micro-label">
              AI SDK
            </Badge>
            <Badge variant="outline" className="micro-label">
              React Flow
            </Badge>
            {brief ? (
              <ShareButton brief={brief} idea={idea} model={model} />
            ) : null}
          </div>
        </div>

        <IdeaForm
          idea={idea}
          error={error}
          isLoading={isLoading || clarifierLoading}
          model={model}
          onIdeaChange={setIdea}
          onSubmit={requestClarifier}
        />

        <ModeToggles
          mode={mode}
          disabled={isLoading || clarifierLoading}
          onModeChange={setMode}
        />

        {clarifierQuestions ? (
          <ClarifierDialog
            questions={clarifierQuestions}
            isSubmitting={isLoading}
            onSubmit={generateBriefWithAnswers}
            onSkip={skipClarifier}
          />
        ) : null}

        <div className="grid gap-10 lg:grid-cols-[minmax(320px,0.72fr)_minmax(0,1.28fr)] lg:items-start">
          <aside className="flex flex-col gap-8 lg:sticky lg:top-8">
            {brief ? (
              <DataModelFlow dataModel={brief.dataModel} />
            ) : (
              <EmptyGraphCard isLoading={isLoading} />
            )}
          </aside>

          <section className="flex min-w-0 flex-col gap-10">
            {isLoading && !brief ? (
              <StreamingPreview partial={streamingBrief ?? {}} />
            ) : null}
            {brief ? (
              <>
                <ProjectBriefSection
                  brief={brief}
                  onChange={handleBriefChange}
                />
                {brief.featureSpecifications &&
                brief.featureSpecifications.length > 0 ? (
                  <FeatureSpecificationsEditor
                    brief={brief}
                    onChange={handleBriefChange}
                    onRegenerate={(constraint) =>
                      regenerateSection("featureSpecifications", constraint)
                    }
                  />
                ) : null}
                <PagesRoutesSection
                  brief={brief}
                  onChange={handleBriefChange}
                  onRegenerate={(constraint) =>
                    regenerateSection("pagesRoutes", constraint)
                  }
                />
                <DataModelEditor
                  brief={brief}
                  onChange={handleBriefChange}
                  onRegenerate={(constraint) =>
                    regenerateSection("dataModel", constraint)
                  }
                />
                <BuildPhasesSection
                  brief={brief}
                  onChange={handleBriefChange}
                  onRegenerate={(constraint) =>
                    regenerateSection("buildPhases", constraint)
                  }
                />
                <RisksSection
                  brief={brief}
                  onChange={handleBriefChange}
                  onRegenerate={(constraint) =>
                    regenerateSection("risksEdgeCases", constraint)
                  }
                />
                <StarterPromptCard
                  value={brief.starterPrompt}
                  onChange={(starterPrompt) =>
                    setBrief({ ...brief, starterPrompt })
                  }
                  onRegenerate={regenerateStarterPrompt}
                />
              </>
            ) : !isLoading ? (
              <DossierEmptyState />
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}

function DossierEmptyState() {
  return (
    <section className="dossier-empty flex min-h-[520px] flex-col">
      <div className="flex items-center justify-between gap-6 border-b border-border px-10 pt-10 pb-6">
        <span className="section-anchor">Brief pending</span>
        <span className="numeral-eyebrow">№ 001</span>
      </div>
      <div className="flex flex-1 flex-col items-start justify-center gap-6 px-10 py-16">
        <h2 className="font-display text-4xl font-normal leading-[1.05] tracking-[-0.03em] md:text-5xl">
          A folded sheet,
          <br />
          waiting to be opened.
        </h2>
        <p className="max-w-xl text-base leading-8 text-muted-foreground">
          Start with an unfinished product thought above. Rautaki will return a
          calm, editable dossier: features as independently testable user
          stories, routes, a visual data model, phases, risks, and a starter
          prompt for a coding agent.
        </p>
        <span className="hairline-gold mt-2 max-w-[180px]" />
      </div>
    </section>
  );
}

function EmptyGraphCard({ isLoading }: { isLoading: boolean }) {
  return (
    <Card className="paper-card">
      <CardContent className="pt-4">
        <div className="memo-surface flex h-80 flex-col items-center justify-center gap-4 border border-border text-center">
          <span className="section-anchor">Data model</span>
          <p className="max-w-xs text-sm leading-6 text-muted-foreground">
            {isLoading ? (
              <>
                Drafting entities and relationships
                <span className="animate-pulse">…</span>
              </>
            ) : (
              "React Flow will visualise generated entities and relationships once the first brief is created."
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function RautakiLogo() {
  return (
    <div aria-label="Rautaki" className="rautaki-logo">
      Raut<span className="accent-letter">a</span>k
      <span className="accent-letter">i</span>
    </div>
  );
}

function salvagePartialBrief(
  partial: Record<string, unknown> | null,
  mode: BriefMode,
): ProjectBriefWithStarter | null {
  if (!partial) return null;
  const { __status: _status, ...candidate } = partial;
  void _status;
  const parsed = projectBriefSchema.safeParse(candidate);
  if (!parsed.success) return null;
  return { ...parsed.data, mode, starterPrompt: "" };
}

function applySectionPatch(
  brief: ProjectBriefWithStarter,
  section: SectionName,
  value: unknown,
): ProjectBriefWithStarter {
  if (section === "dataModel") {
    const dataModel = value as ProjectBriefWithStarter["dataModel"];
    const entityIds = new Set(dataModel.entities.map((entity) => entity.id));
    const prunedRelationships = dataModel.relationships.filter(
      (relationship) =>
        entityIds.has(relationship.sourceEntityId) &&
        entityIds.has(relationship.targetEntityId),
    );
    return {
      ...brief,
      dataModel: { ...dataModel, relationships: prunedRelationships },
    };
  }
  return { ...brief, [section]: value } as ProjectBriefWithStarter;
}

type ShareButtonProps = {
  brief: ProjectBriefWithStarter;
  idea: string;
  model: string | null;
};

function ShareButton({ brief, idea, model }: ShareButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [busy, setBusy] = useState(false);
  const [failReason, setFailReason] = useState("");

  async function handleClick() {
    setBusy(true);
    setFailReason("");
    try {
      const response = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, model, brief }),
      });
      const data = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !data.id) {
        throw new Error(data.error || "Could not create share link.");
      }
      const url = buildShareUrlForId(data.id);
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        // clipboard may be blocked; the status indicator still flips
      }
      setStatus("copied");
    } catch (e) {
      setFailReason(e instanceof Error ? e.message : "");
      setStatus("failed");
    } finally {
      setBusy(false);
      window.setTimeout(() => { setStatus("idle"); setFailReason(""); }, 1800);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={busy}
      className="micro-label"
      title={status === "failed" && failReason ? failReason : undefined}
    >
      {status === "copied" ? (
        <CheckIcon data-icon="inline-start" />
      ) : (
        <Share2Icon data-icon="inline-start" />
      )}
      {status === "copied"
        ? "Link copied"
        : status === "failed"
          ? "Share failed"
          : busy
            ? "Preparing"
            : "Share"}
    </Button>
  );
}
