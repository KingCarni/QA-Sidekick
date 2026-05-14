import { prisma } from "@/lib/prisma";
import {
  buildProjectContextPayload,
  type ProjectContextInput,
  type ProjectContextPayload,
} from "@/lib/project-context-injection";

type ProjectContextRequestShape = {
  projectId?: unknown;
  selectedProjectId?: unknown;
  selectedProjectSourceIds?: unknown;
  projectContextMeta?: {
    selectedSourceIds?: unknown;
  } | null;
};

function cleanId(value: unknown): string {
  return String(value ?? "").trim();
}

function cleanIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => cleanId(item))
    .filter(Boolean)
    .slice(0, 100);
}

function getRequestedProjectId(input: ProjectContextRequestShape): string {
  return cleanId(input.selectedProjectId) || cleanId(input.projectId);
}

function getRequestedSourceIds(input: ProjectContextRequestShape): string[] {
  const directIds = cleanIdList(input.selectedProjectSourceIds);

  if (directIds.length > 0) return directIds;

  return cleanIdList(input.projectContextMeta?.selectedSourceIds);
}

export async function buildAuthorizedProjectContextPayload(
  userId: string,
  input: ProjectContextRequestShape,
  options: { maxCharacters?: number } = {}
): Promise<ProjectContextPayload> {
  const requestedProjectId = getRequestedProjectId(input);

  if (!userId || !requestedProjectId) {
    return buildProjectContextPayload({ maxCharacters: options.maxCharacters });
  }

  const project = await prisma.qAProject.findFirst({
    where: {
      id: requestedProjectId,
      userId,
    },
    select: {
      id: true,
      name: true,
      description: true,
      productType: true,
      sources: {
        where: {
          isEnabled: true,
        },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          title: true,
          sourceType: true,
          body: true,
          tags: true,
          isEnabled: true,
        },
      },
    },
  });

  if (!project) {
    return buildProjectContextPayload({ maxCharacters: options.maxCharacters });
  }

  const requestedSourceIds = getRequestedSourceIds(input);
  const requestedSourceSet = new Set(requestedSourceIds);
  const authorizedSources =
    requestedSourceIds.length > 0
      ? project.sources.filter((source) => requestedSourceSet.has(source.id))
      : project.sources;

  const payloadInput: ProjectContextInput = {
    projectId: project.id,
    projectName: project.name,
    productType: project.productType,
    projectDescription: project.description ?? "",
    selectedSourceIds: authorizedSources.map((source) => source.id),
    sources: authorizedSources.map((source) => ({
      id: source.id,
      title: source.title,
      sourceType: source.sourceType,
      tags: source.tags,
      body: source.body,
      enabled: source.isEnabled,
      selected: true,
    })),
    maxCharacters: options.maxCharacters,
  };

  return buildProjectContextPayload(payloadInput);
}

export function serializeAuthorizedProjectContext(context: ProjectContextPayload) {
  return {
    projectContextUsed: context.projectContextUsed,
    selectedProjectId: context.selectedProjectId,
    selectedProjectName: context.selectedProjectName,
    selectedProjectSourceIds: context.selectedProjectSourceIds,
    projectContextSummary: context.projectContextSummary,
  };
}
