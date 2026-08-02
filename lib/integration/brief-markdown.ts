// The project brief as the file that ships (dashboard F2.5).
//
// Markdown, and nothing but assembly: every section below already exists on the
// brief as structured data, so this arranges it rather than rewriting it. The
// dashboard's viewer renders markdown inline, which is what makes the delivered
// brief readable without downloading anything.
//
// Pure function — no model calls, no I/O.

import type { ProjectBrief } from "@/lib/ai/planner-schema";

type Brief = ProjectBrief & { starterPrompt?: string; mode?: string };

export function briefToMarkdown(brief: Brief, idea: string): string {
  const parts: string[] = [];

  parts.push(`# ${idea.trim()}`);
  parts.push(
    `*Rautaki Plan Architect · ${brief.mode === "specKit" ? "spec-kit" : "plain"}*`,
  );

  parts.push(`## Zusammenfassung\n\n${brief.appSummary.trim()}`);

  parts.push(
    `## Zielgruppen\n\n${brief.targetUsers.map((user) => `- ${user}`).join("\n")}`,
  );

  parts.push(
    `## Kernfunktionen\n\n${brief.coreFeatures.map((feature) => `- ${feature}`).join("\n")}`,
  );

  // Only present in spec-kit mode, and the reason someone chose it.
  if (brief.featureSpecifications?.length) {
    const specs = brief.featureSpecifications.map((spec, index) => {
      const lines = [
        `### ${index + 1}. ${spec.name} — ${spec.priority}`,
        "",
        `**Nutzergeschichte:** ${spec.userStory}`,
        "",
        `**Warum diese Priorität:** ${spec.whyPriority}`,
        "",
        `**Unabhängig testbar:** ${spec.independentTest}`,
      ];

      if (spec.acceptanceScenarios?.length) {
        lines.push(
          "",
          "**Akzeptanzkriterien**",
          "",
          ...spec.acceptanceScenarios.map((scenario) => `- ${scenario}`),
        );
      }
      if (spec.functionalRequirements?.length) {
        // Each carries its own FR-00n id, which is how the rest of the brief
        // and any agent working from it refer back to the requirement.
        lines.push(
          "",
          "**Anforderungen**",
          "",
          ...spec.functionalRequirements.map(
            (requirement) => `- ${requirement.id} — ${requirement.requirement}`,
          ),
        );
      }
      if (spec.edgeCases?.length) {
        lines.push(
          "",
          "**Grenzfälle**",
          "",
          ...spec.edgeCases.map((c) => `- ${c}`),
        );
      }
      if (spec.successCriteria?.length) {
        lines.push(
          "",
          "**Erfolgskriterien**",
          "",
          ...spec.successCriteria.map(
            (criterion) => `- ${criterion.id} — ${criterion.outcome}`,
          ),
        );
      }
      if (spec.assumptions?.length) {
        lines.push(
          "",
          "**Annahmen**",
          "",
          ...spec.assumptions.map((assumption) => `- ${assumption}`),
        );
      }

      return lines.join("\n");
    });

    parts.push(`## Feature-Spezifikationen\n\n${specs.join("\n\n")}`);
  }

  parts.push(
    `## Technischer Stack\n\n${brief.recommendedTechStack.map((item) => `- ${item}`).join("\n")}`,
  );

  parts.push(
    `## Seiten und Routen\n\n${brief.pagesRoutes
      .map((route) => `- \`${route.path}\` — ${route.purpose}`)
      .join("\n")}`,
  );

  const entities = brief.dataModel.entities
    .map(
      (entity) =>
        `### ${entity.name}\n\n${entity.description}\n\n${entity.fields
          .map((field) => `- ${field}`)
          .join("\n")}`,
    )
    .join("\n\n");

  const names = new Map(
    brief.dataModel.entities.map((entity) => [entity.id, entity.name]),
  );
  // Relationships read as ids in the data and as names to a person.
  const relationships = brief.dataModel.relationships.length
    ? `\n\n### Beziehungen\n\n${brief.dataModel.relationships
        .map(
          (relationship) =>
            `- ${names.get(relationship.sourceEntityId) ?? relationship.sourceEntityId} → ${
              names.get(relationship.targetEntityId) ??
              relationship.targetEntityId
            } · ${relationship.label}`,
        )
        .join("\n")}`
    : "";

  parts.push(`## Datenmodell\n\n${entities}${relationships}`);

  parts.push(
    `## Bauphasen\n\n${brief.buildPhases
      .map(
        (phase, index) =>
          `### ${index + 1}. ${phase.name}\n\n${phase.goals.map((goal) => `- ${goal}`).join("\n")}`,
      )
      .join("\n\n")}`,
  );

  parts.push(
    `## Risiken und Grenzfälle\n\n${brief.risksEdgeCases
      .map((risk) => `- **${risk.title}** — ${risk.mitigation}`)
      .join("\n")}`,
  );

  // Last, and fenced: it is meant to be copied whole into an agent, and a
  // reader scrolling the brief should not mistake it for more prose.
  if (brief.starterPrompt) {
    parts.push(
      `## Startprompt\n\n\`\`\`\n${brief.starterPrompt.trim()}\n\`\`\``,
    );
  }

  return `${parts.join("\n\n")}\n`;
}
