import { z } from "zod";

import {
  featureSpecificationField,
  projectBriefSchema,
} from "@/lib/ai/planner-schema";

export const sectionSchemas = {
  appSummary: projectBriefSchema.shape.appSummary,
  targetUsers: projectBriefSchema.shape.targetUsers,
  coreFeatures: projectBriefSchema.shape.coreFeatures,
  recommendedTechStack: projectBriefSchema.shape.recommendedTechStack,
  pagesRoutes: projectBriefSchema.shape.pagesRoutes,
  dataModel: projectBriefSchema.shape.dataModel,
  buildPhases: projectBriefSchema.shape.buildPhases,
  risksEdgeCases: projectBriefSchema.shape.risksEdgeCases,
  featureSpecifications: z.array(featureSpecificationField).min(1),
} as const;

export type SectionName = keyof typeof sectionSchemas;

export const SECTION_NAMES = Object.keys(sectionSchemas) as SectionName[];

export const SECTION_LABELS: Record<SectionName, string> = {
  appSummary: "app summary",
  targetUsers: "target users",
  coreFeatures: "core features",
  recommendedTechStack: "recommended tech stack",
  pagesRoutes: "pages and routes",
  dataModel: "data model",
  buildPhases: "build phases",
  risksEdgeCases: "risks and edge cases",
  featureSpecifications: "feature specifications",
};

export function isSectionName(value: string): value is SectionName {
  return SECTION_NAMES.includes(value as SectionName);
}
