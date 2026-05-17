"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { ProjectBriefWithStarter } from "@/lib/ai/planner-schema";
import { linesToList } from "@/lib/utils";

import { BriefSectionCard } from "./brief-section-card";
import { RegenerateButton } from "./regenerate-button";

type SectionProps = {
  brief: ProjectBriefWithStarter;
  onChange: (brief: ProjectBriefWithStarter) => void;
  onRegenerate?: (constraint: string | undefined) => Promise<void>;
};

type ListTextareaProps = {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
};

function ListTextarea({ label, values, onChange }: ListTextareaProps) {
  return (
    <label className="flex flex-col gap-2">
      <span className="micro-label">{label}</span>
      <Textarea
        value={values.join("\n")}
        onChange={(event) => onChange(linesToList(event.target.value))}
        className="min-h-36 bg-muted leading-7"
      />
    </label>
  );
}

export function ProjectBriefSection({ brief, onChange }: SectionProps) {
  return (
    <BriefSectionCard
      numeral="I"
      anchor="Brief"
      title="Project Brief"
      description="Refine the summary, audience, features, and stack."
    >
      <div className="flex flex-col gap-6">
        <label className="flex flex-col gap-2">
          <span className="micro-label">App Summary</span>
          <Textarea
            value={brief.appSummary}
            onChange={(event) =>
              onChange({ ...brief, appSummary: event.target.value })
            }
            className="min-h-32 bg-muted leading-7"
          />
        </label>
        <div className="grid gap-6 md:grid-cols-3">
          <ListTextarea
            label="Target users"
            values={brief.targetUsers}
            onChange={(targetUsers) => onChange({ ...brief, targetUsers })}
          />
          <ListTextarea
            label="Core Features"
            values={brief.coreFeatures}
            onChange={(coreFeatures) => onChange({ ...brief, coreFeatures })}
          />
          <ListTextarea
            label="Tech Stack"
            values={brief.recommendedTechStack}
            onChange={(recommendedTechStack) =>
              onChange({ ...brief, recommendedTechStack })
            }
          />
        </div>
      </div>
    </BriefSectionCard>
  );
}

export function PagesRoutesSection({
  brief,
  onChange,
  onRegenerate,
}: SectionProps) {
  return (
    <BriefSectionCard
      numeral="III"
      anchor="Surface"
      title="Pages & Routes"
      description="Keep the product surface area small and explicit."
      actions={
        onRegenerate ? <RegenerateButton onRegenerate={onRegenerate} /> : null
      }
    >
      <div className="flex flex-col gap-4">
        {brief.pagesRoutes.map((route, index) => (
          <div
            className="border border-border bg-muted p-4"
            key={`${route.path}-${index}`}
          >
            <div className="grid gap-4 md:grid-cols-[0.45fr_1fr_auto]">
              <Input
                value={route.path}
                onChange={(event) => {
                  const pagesRoutes = brief.pagesRoutes.map(
                    (item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, path: event.target.value }
                        : item,
                  );
                  onChange({ ...brief, pagesRoutes });
                }}
                aria-label="Route path"
                className="id-chip h-auto bg-card px-3 py-2 shadow-none"
              />
              <Input
                value={route.purpose}
                onChange={(event) => {
                  const pagesRoutes = brief.pagesRoutes.map(
                    (item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, purpose: event.target.value }
                        : item,
                  );
                  onChange({ ...brief, pagesRoutes });
                }}
                aria-label="Route purpose"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove route"
                onClick={() =>
                  onChange({
                    ...brief,
                    pagesRoutes: brief.pagesRoutes.filter(
                      (_, itemIndex) => itemIndex !== index,
                    ),
                  })
                }
              >
                <Trash2Icon />
              </Button>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          onClick={() =>
            onChange({
              ...brief,
              pagesRoutes: [
                ...brief.pagesRoutes,
                { path: "/new", purpose: "Describe what this route does." },
              ],
            })
          }
        >
          <PlusIcon data-icon="inline-start" />
          Add route
        </Button>
      </div>
    </BriefSectionCard>
  );
}

export function BuildPhasesSection({
  brief,
  onChange,
  onRegenerate,
}: SectionProps) {
  return (
    <BriefSectionCard
      numeral="V"
      anchor="Cadence"
      title="Build Phases"
      description="A calm sequence for the first implementation pass."
      actions={
        onRegenerate ? <RegenerateButton onRegenerate={onRegenerate} /> : null
      }
    >
      <div className="flex flex-col gap-5">
        {brief.buildPhases.map((phase, index) => (
          <div
            className="flex flex-col gap-4 border border-border bg-muted p-4"
            key={`${phase.name}-${index}`}
          >
            <div className="flex gap-3">
              <Input
                value={phase.name}
                onChange={(event) => {
                  const buildPhases = brief.buildPhases.map(
                    (item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, name: event.target.value }
                        : item,
                  );
                  onChange({ ...brief, buildPhases });
                }}
                aria-label="Build Phase Name"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove phase"
                onClick={() =>
                  onChange({
                    ...brief,
                    buildPhases: brief.buildPhases.filter(
                      (_, itemIndex) => itemIndex !== index,
                    ),
                  })
                }
              >
                <Trash2Icon />
              </Button>
            </div>
            <ListTextarea
              label="Goals"
              values={phase.goals}
              onChange={(goals) => {
                const buildPhases = brief.buildPhases.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, goals } : item,
                );
                onChange({ ...brief, buildPhases });
              }}
            />
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          onClick={() =>
            onChange({
              ...brief,
              buildPhases: [
                ...brief.buildPhases,
                {
                  name: "New phase",
                  goals: ["Add the next implementation goal."],
                },
              ],
            })
          }
        >
          <PlusIcon data-icon="inline-start" />
          Add phase
        </Button>
      </div>
    </BriefSectionCard>
  );
}

export function RisksSection({ brief, onChange, onRegenerate }: SectionProps) {
  return (
    <BriefSectionCard
      numeral="VI"
      anchor="Watchouts"
      title="Risks & Edge Cases"
      description="Clarify likely problems before a coding agent starts."
      actions={
        onRegenerate ? <RegenerateButton onRegenerate={onRegenerate} /> : null
      }
    >
      <div className="flex flex-col gap-4">
        {brief.risksEdgeCases.map((risk, index) => (
          <div
            className="grid gap-4 border border-border bg-muted p-4 md:grid-cols-[0.6fr_1fr_auto]"
            key={`${risk.title}-${index}`}
          >
            <Input
              value={risk.title}
              onChange={(event) => {
                const risksEdgeCases = brief.risksEdgeCases.map(
                  (item, itemIndex) =>
                    itemIndex === index
                      ? { ...item, title: event.target.value }
                      : item,
                );
                onChange({ ...brief, risksEdgeCases });
              }}
              aria-label="Risk title"
            />
            <Input
              value={risk.mitigation}
              onChange={(event) => {
                const risksEdgeCases = brief.risksEdgeCases.map(
                  (item, itemIndex) =>
                    itemIndex === index
                      ? { ...item, mitigation: event.target.value }
                      : item,
                );
                onChange({ ...brief, risksEdgeCases });
              }}
              aria-label="Risk mitigation"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remove risk"
              onClick={() =>
                onChange({
                  ...brief,
                  risksEdgeCases: brief.risksEdgeCases.filter(
                    (_, itemIndex) => itemIndex !== index,
                  ),
                })
              }
            >
              <Trash2Icon />
            </Button>
          </div>
        ))}
        <Separator />
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          onClick={() =>
            onChange({
              ...brief,
              risksEdgeCases: [
                ...brief.risksEdgeCases,
                { title: "New risk", mitigation: "Add a concrete mitigation." },
              ],
            })
          }
        >
          <PlusIcon data-icon="inline-start" />
          Add risk
        </Button>
      </div>
    </BriefSectionCard>
  );
}
