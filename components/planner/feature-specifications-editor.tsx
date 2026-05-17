"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn, linesToList } from "@/lib/utils";
import type {
  FeatureSpecification,
  ProjectBriefWithStarter,
} from "@/lib/ai/planner-schema";

import { BriefSectionCard } from "./brief-section-card";
import { RegenerateButton } from "./regenerate-button";

type FeatureSpecificationsEditorProps = {
  brief: ProjectBriefWithStarter;
  onChange: (brief: ProjectBriefWithStarter) => void;
  onRegenerate?: (constraint: string | undefined) => Promise<void>;
};

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

type Feature = FeatureSpecification;

function nextPriority(existing: Feature[]) {
  for (let i = 1; i <= 5; i += 1) {
    const label = `P${i}`;
    if (!existing.some((feature) => feature.priority === label)) return label;
  }
  return "P5";
}

function nextSequenceId(existing: string[], prefix: "FR" | "SC") {
  const used = new Set(existing);
  for (let i = 1; i < 1000; i += 1) {
    const candidate = `${prefix}-${String(i).padStart(3, "0")}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${prefix}-999`;
}

function blankFeature(existing: Feature[]): Feature {
  return {
    name: "New user story",
    priority: nextPriority(existing),
    userStory:
      "Describe the user journey in plain language from the user's perspective.",
    whyPriority:
      "Explain why this story has this priority relative to the others.",
    independentTest:
      "Describe one concrete action a tester can take and the observable value it delivers.",
    acceptanceScenarios: [
      "Given <initial state>, When <action>, Then <observable outcome>.",
      "Given <initial state>, When <action>, Then <observable outcome>.",
    ],
    edgeCases: [
      "What happens when <boundary condition>?",
      "How does the system handle <error scenario>?",
    ],
    functionalRequirements: [
      { id: "FR-001", requirement: "System MUST <specific capability>." },
      { id: "FR-002", requirement: "Users MUST be able to <key interaction>." },
      {
        id: "FR-003",
        requirement: "System MUST <data or behaviour requirement>.",
      },
    ],
    successCriteria: [
      { id: "SC-001", outcome: "Measurable, technology-agnostic outcome." },
      { id: "SC-002", outcome: "Measurable, technology-agnostic outcome." },
    ],
    assumptions: ["Reasonable default that the user did not specify."],
  };
}

export function FeatureSpecificationsEditor({
  brief,
  onChange,
  onRegenerate,
}: FeatureSpecificationsEditorProps) {
  const features = brief.featureSpecifications ?? [];

  function updateFeatures(next: Feature[]) {
    onChange({ ...brief, featureSpecifications: next });
  }

  function updateFeature(index: number, feature: Feature) {
    updateFeatures(
      features.map((item, itemIndex) => (itemIndex === index ? feature : item)),
    );
  }

  return (
    <BriefSectionCard
      numeral="II"
      anchor="Stories"
      title="Feature Specifications"
      description="Each story is a P-prioritised, independently testable slice. Shipping any single P1/P2/P3 slice produces a viable MVP on its own."
      actions={
        onRegenerate ? <RegenerateButton onRegenerate={onRegenerate} /> : null
      }
    >
      <div className="flex flex-col gap-10">
        {features.map((feature, index) => (
          <FeatureCard
            key={`${feature.priority}-${index}`}
            feature={feature}
            ordinal={ROMAN[index] ?? `${index + 1}`}
            onChange={(next) => updateFeature(index, next)}
            onRemove={() =>
              updateFeatures(
                features.filter((_, itemIndex) => itemIndex !== index),
              )
            }
          />
        ))}

        <div className="flex items-center justify-between gap-4 pt-2">
          <span className="text-sm text-muted-foreground">
            Add another independently testable slice. Priorities advance
            automatically.
          </span>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              updateFeatures([...features, blankFeature(features)])
            }
          >
            <PlusIcon data-icon="inline-start" />
            Add user story
          </Button>
        </div>
      </div>
    </BriefSectionCard>
  );
}

type FeatureCardProps = {
  feature: Feature;
  ordinal: string;
  onChange: (feature: Feature) => void;
  onRemove: () => void;
};

function FeatureCard({
  feature,
  ordinal,
  onChange,
  onRemove,
}: FeatureCardProps) {
  const priorityToken = feature.priority?.toUpperCase().match(/^P[1-5]$/)
    ? feature.priority.toUpperCase()
    : "P3";

  function updateAcceptance(index: number, value: string) {
    onChange({
      ...feature,
      acceptanceScenarios: feature.acceptanceScenarios.map((item, itemIndex) =>
        itemIndex === index ? value : item,
      ),
    });
  }

  function removeAcceptance(index: number) {
    onChange({
      ...feature,
      acceptanceScenarios: feature.acceptanceScenarios.filter(
        (_, itemIndex) => itemIndex !== index,
      ),
    });
  }

  function updateRequirement(
    index: number,
    key: "id" | "requirement",
    value: string,
  ) {
    onChange({
      ...feature,
      functionalRequirements: feature.functionalRequirements.map(
        (item, itemIndex) =>
          itemIndex === index ? { ...item, [key]: value } : item,
      ),
    });
  }

  function removeRequirement(index: number) {
    onChange({
      ...feature,
      functionalRequirements: feature.functionalRequirements.filter(
        (_, itemIndex) => itemIndex !== index,
      ),
    });
  }

  function updateCriterion(
    index: number,
    key: "id" | "outcome",
    value: string,
  ) {
    onChange({
      ...feature,
      successCriteria: feature.successCriteria.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    });
  }

  function removeCriterion(index: number) {
    onChange({
      ...feature,
      successCriteria: feature.successCriteria.filter(
        (_, itemIndex) => itemIndex !== index,
      ),
    });
  }

  const nextFr = nextSequenceId(
    feature.functionalRequirements.map((item) => item.id),
    "FR",
  );
  const nextSc = nextSequenceId(
    feature.successCriteria.map((item) => item.id),
    "SC",
  );

  return (
    <article className="flex flex-col gap-7 border border-border bg-card p-6 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="numeral-eyebrow">{ordinal}.</span>
            <span className="priority-chip" data-priority={priorityToken}>
              {priorityToken}
            </span>
            <span className="micro-label">User Story</span>
          </div>
          <Input
            value={feature.name}
            onChange={(event) =>
              onChange({ ...feature, name: event.target.value })
            }
            aria-label="Feature name"
            className={cn(
              "h-auto w-full min-w-0 border-0 border-b border-border bg-transparent px-0 py-2",
              "font-display text-xl font-normal tracking-[-0.02em] leading-tight md:text-2xl",
              "focus-visible:border-primary focus-visible:ring-0",
            )}
          />
        </div>
        <div className="flex items-center gap-2">
          <PrioritySelect
            value={priorityToken}
            onChange={(priority) => onChange({ ...feature, priority })}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Remove story"
            onClick={onRemove}
          >
            <Trash2Icon />
          </Button>
        </div>
      </header>

      <div className="grid gap-7 md:grid-cols-[1.4fr_1fr]">
        <label className="flex flex-col gap-2">
          <span className="micro-label">User Journey</span>
          <Textarea
            value={feature.userStory}
            onChange={(event) =>
              onChange({ ...feature, userStory: event.target.value })
            }
            className="min-h-28 bg-muted leading-7"
          />
        </label>

        <div className="flex flex-col gap-3">
          <span className="micro-label">Why This Priority</span>
          <Textarea
            value={feature.whyPriority}
            onChange={(event) =>
              onChange({ ...feature, whyPriority: event.target.value })
            }
            className={cn(
              "min-h-28 border-0 border-l-2 border-l-primary bg-transparent leading-7 shadow-none",
              "px-4 py-1 font-display text-[15px] italic",
              "focus-visible:ring-0",
            )}
          />
        </div>
      </div>

      <label className="flex flex-col gap-2">
        <span className="micro-label">Independent Test</span>
        <Textarea
          value={feature.independentTest}
          onChange={(event) =>
            onChange({ ...feature, independentTest: event.target.value })
          }
          className="min-h-20 bg-muted leading-7"
        />
      </label>

      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="section-anchor">Acceptance Scenarios</span>
        </div>
        <ol className="flex flex-col gap-3">
          {feature.acceptanceScenarios.map((scenario, index) => (
            <li
              key={index}
              className="grid grid-cols-[auto_1fr_auto] items-start gap-3 border border-border bg-muted p-3"
            >
              <span className="numeral-eyebrow pt-2 pl-1">
                {ROMAN[index] ?? index + 1}.
              </span>
              <Textarea
                value={scenario}
                onChange={(event) =>
                  updateAcceptance(index, event.target.value)
                }
                className="min-h-16 border-0 bg-transparent leading-7 shadow-none focus-visible:ring-0"
                aria-label={`Acceptance scenario ${index + 1}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove scenario"
                onClick={() => removeAcceptance(index)}
              >
                <Trash2Icon />
              </Button>
            </li>
          ))}
        </ol>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() =>
            onChange({
              ...feature,
              acceptanceScenarios: [
                ...feature.acceptanceScenarios,
                "Given <state>, When <action>, Then <observable outcome>.",
              ],
            })
          }
        >
          <PlusIcon data-icon="inline-start" />
          Add scenario
        </Button>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="section-anchor">Edge Cases</span>
        </div>
        <Textarea
          value={feature.edgeCases.join("\n")}
          onChange={(event) =>
            onChange({ ...feature, edgeCases: linesToList(event.target.value) })
          }
          className="min-h-24 bg-muted leading-7"
          aria-label="Edge cases, one per line"
        />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <span className="section-anchor">Functional Requirements</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onChange({
                ...feature,
                functionalRequirements: [
                  ...feature.functionalRequirements,
                  {
                    id: nextFr,
                    requirement: "System MUST <specific capability>.",
                  },
                ],
              })
            }
          >
            <PlusIcon data-icon="inline-start" />
            Add FR
          </Button>
        </div>
        <ul className="flex flex-col gap-3">
          {feature.functionalRequirements.map((requirement, index) => (
            <li
              key={index}
              className="grid grid-cols-[auto_1fr_auto] items-start gap-3 border border-border bg-muted p-3"
            >
              <Input
                value={requirement.id}
                onChange={(event) =>
                  updateRequirement(
                    index,
                    "id",
                    event.target.value.toUpperCase(),
                  )
                }
                className="id-chip mt-1 h-auto w-24 border-0 bg-card text-center shadow-none focus-visible:ring-0"
                aria-label="Requirement id"
              />
              <Textarea
                value={requirement.requirement}
                onChange={(event) =>
                  updateRequirement(index, "requirement", event.target.value)
                }
                className="min-h-16 border-0 bg-transparent leading-7 shadow-none focus-visible:ring-0"
                aria-label="Requirement text"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove requirement"
                onClick={() => removeRequirement(index)}
              >
                <Trash2Icon />
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <span className="section-anchor">Success Criteria</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onChange({
                ...feature,
                successCriteria: [
                  ...feature.successCriteria,
                  {
                    id: nextSc,
                    outcome: "Measurable, technology-agnostic outcome.",
                  },
                ],
              })
            }
          >
            <PlusIcon data-icon="inline-start" />
            Add SC
          </Button>
        </div>
        <ul className="flex flex-col gap-3">
          {feature.successCriteria.map((criterion, index) => (
            <li
              key={index}
              className="grid grid-cols-[auto_1fr_auto] items-start gap-3 border border-border bg-muted p-3"
            >
              <Input
                value={criterion.id}
                onChange={(event) =>
                  updateCriterion(index, "id", event.target.value.toUpperCase())
                }
                className="id-chip mt-1 h-auto w-24 border-0 bg-card text-center shadow-none focus-visible:ring-0"
                aria-label="Success criterion id"
              />
              <Textarea
                value={criterion.outcome}
                onChange={(event) =>
                  updateCriterion(index, "outcome", event.target.value)
                }
                className="min-h-16 border-0 bg-transparent leading-7 shadow-none focus-visible:ring-0"
                aria-label="Success criterion outcome"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove criterion"
                onClick={() => removeCriterion(index)}
              >
                <Trash2Icon />
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <span className="section-anchor">Assumptions</span>
        <Textarea
          value={feature.assumptions.join("\n")}
          onChange={(event) =>
            onChange({
              ...feature,
              assumptions: linesToList(event.target.value),
            })
          }
          className="min-h-20 bg-muted leading-7"
          aria-label="Assumptions, one per line"
        />
      </section>
    </article>
  );
}

function PrioritySelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label="Priority"
      className={cn(
        "border border-border bg-card px-3 py-1.5 text-xs font-medium uppercase tracking-[0.18em]",
        "text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <option value="P1">P1</option>
      <option value="P2">P2</option>
      <option value="P3">P3</option>
      <option value="P4">P4</option>
      <option value="P5">P5</option>
    </select>
  );
}
