import { prisma } from "@/lib/prisma";
import { buildProjectContextSummary, type SafeQAProject } from "@/lib/qa-projects";
import { buildProjectSourceContextBlock, type SafeProjectSource } from "@/lib/project-sources";

export type ProjectContextPayload = {
  project: SafeQAProject | null;
  sources: SafeProjectSource[];
  enabledSourceCount: number;
  totalSourceCount: number;
  enabledRuleCount: number;
  totalRuleCount: number;
  enabledTermCount: number;
  totalTermCount: number;
  enabledRiskCount: number;
  totalRiskCount: number;
  enabledFeatureCount: number;
  totalFeatureCount: number;
  contextBlock: string;
  contextPreview: string;
};

function emptyPayload(): ProjectContextPayload {
  return {
    project: null,
    sources: [],
    enabledSourceCount: 0,
    totalSourceCount: 0,
    enabledRuleCount: 0,
    totalRuleCount: 0,
    enabledTermCount: 0,
    totalTermCount: 0,
    enabledRiskCount: 0,
    totalRiskCount: 0,
    enabledFeatureCount: 0,
    totalFeatureCount: 0,
    contextBlock: "",
    contextPreview: "",
  };
}

function toSafeProject(project: {
  id: string;
  name: string;
  description: string | null;
  productType?: string | null;
  createdAt: Date;
  updatedAt: Date;
}): SafeQAProject {
  return {
    id: project.id,
    name: project.name,
    description: project.description ?? "",
    productType: project.productType ?? "other",
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

function toSafeSource(source: {
  id: string;
  projectId: string;
  title: string;
  sourceType: string;
  body: string;
  tags: string[];
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}): SafeProjectSource {
  return {
    id: source.id,
    projectId: source.projectId,
    title: source.title,
    sourceType: source.sourceType,
    body: source.body,
    tags: source.tags,
    isEnabled: source.isEnabled,
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
  };
}

export async function getProjectContextPayload(
  userId: string,
  projectId: string,
  maxCharacters = 14000
): Promise<ProjectContextPayload> {
  if (!userId || !projectId) {
    return emptyPayload();
  }

  const project = await prisma.qAProject.findFirst({
    where: {
      id: projectId,
      userId,
    },
    include: {
      sources: {
        orderBy: [{ isEnabled: "desc" }, { updatedAt: "desc" }],
      },
      rules: {
        select: { id: true, isEnabled: true },
      },
      terms: {
        select: { id: true, isEnabled: true },
      },
      risks: {
        select: { id: true, isEnabled: true },
      },
      features: {
        select: { id: true, isEnabled: true },
      },
    },
  });

  if (!project) {
    return emptyPayload();
  }

  const safeProject = toSafeProject(project);
  const safeSources = project.sources.map(toSafeSource);
  const enabledSources = safeSources.filter((source) => source.isEnabled);
  const projectSummary = buildProjectContextSummary(safeProject);
  const sourceContext = buildProjectSourceContextBlock(enabledSources, maxCharacters);
  const enabledRuleCount = project.rules.filter((item) => item.isEnabled).length;
  const enabledTermCount = project.terms.filter((item) => item.isEnabled).length;
  const enabledRiskCount = project.risks.filter((item) => item.isEnabled).length;
  const enabledFeatureCount = project.features.filter((item) => item.isEnabled).length;

  const contextBlock = [
    "PROJECT CONTEXT MEMORY",
    "",
    projectSummary,
    sourceContext ? "\nENABLED PROJECT SOURCES\n" : "",
    sourceContext,
    "",
    "PROJECT BRAIN INVENTORY",
    `- Enabled sources: ${enabledSources.length}/${safeSources.length}`,
    `- Enabled QA rules: ${enabledRuleCount}/${project.rules.length}`,
    `- Enabled terminology entries: ${enabledTermCount}/${project.terms.length}`,
    `- Enabled risks/hotspots: ${enabledRiskCount}/${project.risks.length}`,
    `- Enabled feature registry entries: ${enabledFeatureCount}/${project.features.length}`,
    "",
    "PROJECT CONTEXT RULES",
    "- Use this project context to understand terminology, platform rules, known risks, and QA standards.",
    "- Treat the current ticket/source input as the primary task.",
    "- Do not invent product behavior that is not present in the current input or enabled project sources.",
    "- If project context conflicts with the current input, call out the conflict instead of silently choosing one.",
    "- If project context fills in useful background, use it, but keep assumptions visible.",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, maxCharacters);

  return {
    project: safeProject,
    sources: safeSources,
    enabledSourceCount: enabledSources.length,
    totalSourceCount: safeSources.length,
    enabledRuleCount,
    totalRuleCount: project.rules.length,
    enabledTermCount,
    totalTermCount: project.terms.length,
    enabledRiskCount,
    totalRiskCount: project.risks.length,
    enabledFeatureCount,
    totalFeatureCount: project.features.length,
    contextBlock,
    contextPreview: contextBlock.slice(0, 2500),
  };
}
