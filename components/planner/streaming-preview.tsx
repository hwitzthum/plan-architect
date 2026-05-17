"use client";

import type { ReactNode } from "react";

import { BriefSectionCard } from "./brief-section-card";

type StreamingPreviewProps = {
  partial: Record<string, unknown> | null;
};

type Section = {
  numeral: string;
  anchor: string;
  title: string;
  description: string;
  content: ReactNode | null;
};

export function StreamingPreview({ partial }: StreamingPreviewProps) {
  if (!partial) return null;

  const appSummary =
    typeof partial.appSummary === "string" ? partial.appSummary : "";
  const targetUsers = asStringArray(partial.targetUsers);
  const coreFeatures = asStringArray(partial.coreFeatures);
  const techStack = asStringArray(partial.recommendedTechStack);
  const pagesRoutes = asArray<{ path?: string; purpose?: string }>(
    partial.pagesRoutes,
  );
  const dataModel = partial.dataModel as
    | { entities?: Array<{ name?: string }> }
    | undefined;
  const buildPhases = asArray<{ name?: string }>(partial.buildPhases);
  const risks = asArray<{ title?: string }>(partial.risksEdgeCases);
  const featureSpecs = asArray<{ name?: string; priority?: string }>(
    partial.featureSpecifications,
  );

  const sections: Section[] = [
    {
      numeral: "I",
      anchor: "Brief",
      title: "Project Summary",
      description: "The single-paragraph framing of the idea.",
      content: appSummary ? (
        <p className="text-sm leading-7 text-foreground">{appSummary}</p>
      ) : null,
    },
    {
      numeral: "II",
      anchor: "Users · Features",
      title: "Target Users & Core Features",
      description: "Who the app is for and the must-have first slice.",
      content:
        targetUsers.length === 0 && coreFeatures.length === 0 ? null : (
          <div className="grid gap-6 md:grid-cols-2">
            <LabelledRows label="Target users" items={targetUsers} />
            <LabelledRows label="Core features" items={coreFeatures} />
          </div>
        ),
    },
    ...(featureSpecs.length > 0
      ? [
          {
            numeral: "III",
            anchor: "Specifications",
            title: "Feature Specifications",
            description:
              "Independently testable user stories, in priority order.",
            content: (
              <DividedList
                items={featureSpecs.map((feature, idx) =>
                  feature.name && feature.priority
                    ? `${feature.priority} — ${feature.name}`
                    : (feature.name ?? `Feature ${idx + 1}`),
                )}
              />
            ),
          },
        ]
      : []),
    {
      numeral: featureSpecs.length > 0 ? "IV" : "III",
      anchor: "Stack",
      title: "Recommended Tech Stack",
      description: "Pragmatic choices that fit the idea.",
      content: techStack.length > 0 ? <DividedList items={techStack} /> : null,
    },
    {
      numeral: featureSpecs.length > 0 ? "V" : "IV",
      anchor: "Routes",
      title: "Pages & Routes",
      description: "Surface map for the first build.",
      content:
        pagesRoutes.length > 0 ? (
          <ul className="flex flex-col divide-y divide-border text-sm leading-7">
            {pagesRoutes.map((route, i) =>
              route.path ? (
                <li
                  key={`${route.path}-${i}`}
                  className="flex flex-wrap items-baseline gap-3 py-2"
                >
                  <span className="id-chip">{route.path}</span>
                  <span className="text-foreground/85">{route.purpose}</span>
                </li>
              ) : null,
            )}
          </ul>
        ) : null,
    },
    {
      numeral: featureSpecs.length > 0 ? "VI" : "V",
      anchor: "Data",
      title: "Data Model",
      description: "Entities and their relationships.",
      content:
        dataModel?.entities && dataModel.entities.length > 0 ? (
          <DividedList
            items={dataModel.entities
              .map((entity) => entity.name)
              .filter((name): name is string => Boolean(name))}
          />
        ) : null,
    },
    {
      numeral: featureSpecs.length > 0 ? "VII" : "VI",
      anchor: "Phases",
      title: "Build Phases",
      description: "Sequenced increments of value.",
      content:
        buildPhases.length > 0 ? (
          <DividedList
            items={buildPhases
              .map((phase) => phase.name)
              .filter((name): name is string => Boolean(name))}
          />
        ) : null,
    },
    {
      numeral: featureSpecs.length > 0 ? "VIII" : "VII",
      anchor: "Risks",
      title: "Risks & Edge Cases",
      description: "What might bite during the build.",
      content:
        risks.length > 0 ? (
          <DividedList
            items={risks
              .map((risk) => risk.title)
              .filter((title): title is string => Boolean(title))}
          />
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-10">
      {sections.map((section) => (
        <BriefSectionCard
          key={section.numeral}
          numeral={section.numeral}
          anchor={section.anchor}
          title={section.title}
          description={section.description}
        >
          {section.content ?? <DraftingPlaceholder />}
        </BriefSectionCard>
      ))}
    </div>
  );
}

function DraftingPlaceholder() {
  return (
    <p className="font-display text-base italic leading-7 text-muted-foreground">
      Drafting<span className="animate-pulse">…</span>
    </p>
  );
}

function LabelledRows({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="flex flex-col gap-3">
      <span className="micro-label">{label}</span>
      {items.length === 0 ? (
        <DraftingPlaceholder />
      ) : (
        <DividedList items={items} />
      )}
    </div>
  );
}

function DividedList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col divide-y divide-border text-sm leading-7">
      {items.map((item, i) => (
        <li
          key={`${item}-${i}`}
          className="flex items-baseline gap-3 py-2 text-foreground/85"
        >
          <span className="numeral-eyebrow shrink-0 w-6 text-right">
            {String(i + 1).padStart(2, "0")}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}
