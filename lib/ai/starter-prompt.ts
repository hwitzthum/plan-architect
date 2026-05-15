import type { ProjectBrief } from "@/lib/ai/planner-schema";

function list(items: string[]) {
  return items.map((item) => `- ${item}`).join("\n");
}

export function buildStarterPromptFromBrief(brief: ProjectBrief) {
  const featureSpecs = (brief.featureSpecifications ?? [])
    .map((feature, index) => {
      const scenarios = feature.acceptanceScenarios
        .map((scenario, scenarioIndex) => `${scenarioIndex + 1}. ${scenario}`)
        .join("\n");
      const requirements = feature.functionalRequirements
        .map(
          (requirement) =>
            `- **${requirement.id}**: ${requirement.requirement}`,
        )
        .join("\n");
      const criteria = feature.successCriteria
        .map((criterion) => `- **${criterion.id}**: ${criterion.outcome}`)
        .join("\n");

      return `### User Story ${index + 1} - ${feature.name} (Priority: ${feature.priority})

${feature.userStory}

**Why this priority**: ${feature.whyPriority}

**Independent Test**: ${feature.independentTest}

**Acceptance Scenarios**:
${scenarios}

**Edge Cases**:
${list(feature.edgeCases)}

**Functional Requirements**:
${requirements}

**Success Criteria**:
${criteria}

**Assumptions**:
${list(feature.assumptions)}`;
    })
    .join("\n\n---\n\n");

  const routes = brief.pagesRoutes
    .map((route) => `- ${route.path}: ${route.purpose}`)
    .join("\n");
  const entities = brief.dataModel.entities
    .map(
      (entity) =>
        `- ${entity.name} (${entity.id}): ${entity.description}; fields: ${entity.fields.join(", ")}`,
    )
    .join("\n");
  const relationships = brief.dataModel.relationships
    .map(
      (relationship) =>
        `- ${relationship.sourceEntityId} ${relationship.label} ${relationship.targetEntityId}`,
    )
    .join("\n");
  const phases = brief.buildPhases
    .map((phase) => `- ${phase.name}: ${phase.goals.join("; ")}`)
    .join("\n");

  const featureSpecSection = featureSpecs
    ? `\n# Feature Specifications\n${featureSpecs}\n`
    : "";

  return `Build this application from the specification below. Use the recommended tech stack as your guide; choose libraries that genuinely fit each requirement.

# Project Summary
${brief.appSummary}

# Target Users
${list(brief.targetUsers)}

# Core Features
${list(brief.coreFeatures)}
${featureSpecSection}
# Recommended Tech Stack
${list(brief.recommendedTechStack)}

# Pages & Routes
${routes}

# Data Model
## Entities
${entities}

## Relationships
${relationships}

# Build Phases
${phases}

# Risks & Edge Cases
${brief.risksEdgeCases.map((risk) => `- ${risk.title}: ${risk.mitigation}`).join("\n")}

Deliver each prioritised user story as an independently testable slice.`;
}
