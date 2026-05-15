"use client";

import { LoaderCircleIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

type StreamingPreviewProps = {
  partial: Record<string, unknown> | null;
};

export function StreamingPreview({ partial }: StreamingPreviewProps) {
  if (!partial) return null;

  const sections: Array<{ title: string; content: React.ReactNode }> = [];

  const appSummary = partial.appSummary;
  if (typeof appSummary === "string" && appSummary.length > 0) {
    sections.push({
      title: "App summary",
      content: <p className="text-sm leading-7">{appSummary}</p>,
    });
  }

  const targetUsers = partial.targetUsers;
  if (Array.isArray(targetUsers) && targetUsers.length > 0) {
    sections.push({
      title: "Target users",
      content: <BulletList items={targetUsers as string[]} />,
    });
  }

  const coreFeatures = partial.coreFeatures;
  if (Array.isArray(coreFeatures) && coreFeatures.length > 0) {
    sections.push({
      title: "Core features",
      content: <BulletList items={coreFeatures as string[]} />,
    });
  }

  const techStack = partial.recommendedTechStack;
  if (Array.isArray(techStack) && techStack.length > 0) {
    sections.push({
      title: "Recommended tech stack",
      content: <BulletList items={techStack as string[]} />,
    });
  }

  const pagesRoutes = partial.pagesRoutes;
  if (Array.isArray(pagesRoutes) && pagesRoutes.length > 0) {
    sections.push({
      title: "Pages & routes",
      content: (
        <ul className="flex flex-col gap-2 text-sm leading-6">
          {(pagesRoutes as Array<{ path?: string; purpose?: string }>).map(
            (route, i) =>
              route.path ? (
                <li key={`${route.path}-${i}`}>
                  <span className="id-chip mr-2 px-2 py-0.5">{route.path}</span>
                  {route.purpose}
                </li>
              ) : null,
          )}
        </ul>
      ),
    });
  }

  const dataModel = partial.dataModel as
    | { entities?: Array<{ name?: string }> }
    | undefined;
  if (dataModel?.entities && dataModel.entities.length > 0) {
    sections.push({
      title: "Data model",
      content: (
        <BulletList
          items={dataModel.entities
            .map((entity) => entity.name)
            .filter((name): name is string => Boolean(name))}
        />
      ),
    });
  }

  const buildPhases = partial.buildPhases;
  if (Array.isArray(buildPhases) && buildPhases.length > 0) {
    sections.push({
      title: "Build phases",
      content: (
        <BulletList
          items={(buildPhases as Array<{ name?: string }>)
            .map((phase) => phase.name)
            .filter((name): name is string => Boolean(name))}
        />
      ),
    });
  }

  const risks = partial.risksEdgeCases;
  if (Array.isArray(risks) && risks.length > 0) {
    sections.push({
      title: "Risks",
      content: (
        <BulletList
          items={(risks as Array<{ title?: string }>)
            .map((risk) => risk.title)
            .filter((title): title is string => Boolean(title))}
        />
      ),
    });
  }

  const featureSpecs = partial.featureSpecifications;
  if (Array.isArray(featureSpecs) && featureSpecs.length > 0) {
    sections.push({
      title: "Feature specifications",
      content: (
        <BulletList
          items={(featureSpecs as Array<{ name?: string; priority?: string }>)
            .map((feature) =>
              feature.name && feature.priority
                ? `${feature.priority} — ${feature.name}`
                : feature.name,
            )
            .filter((name): name is string => Boolean(name))}
        />
      ),
    });
  }

  return (
    <Card className="paper-card">
      <CardContent className="flex flex-col gap-6 p-8">
        <div className="flex items-center gap-3">
          <LoaderCircleIcon className="size-4 animate-spin text-muted-foreground" />
          <span className="micro-label">Generating brief…</span>
        </div>
        {sections.length === 0 ? (
          <p className="text-sm leading-6 text-muted-foreground">
            Waiting for the first section to arrive…
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {sections.map((section) => (
              <div key={section.title} className="flex flex-col gap-2">
                <span className="micro-label">{section.title}</span>
                {section.content}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-1 text-sm leading-6">
      {items.map((item, i) => (
        <li key={`${item}-${i}`}>• {item}</li>
      ))}
    </ul>
  );
}
