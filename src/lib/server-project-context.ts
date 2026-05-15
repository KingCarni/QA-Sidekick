import { prisma } from "@/lib/prisma";
import {
  buildProjectContextPayload,
  type ProjectContextInput,
  type ProjectContextPayload,
} from "@/lib/project-context-injection";
import { buildProjectRulesBlock, workflowMatchesRule, type SafeProjectRule } from "@/lib/project-rules";
import { recordSecurityAuditEvent, SECURITY_EVENTS } from "@/lib/security-audit";

type ProjectContextRequestShape = {
  projectId?: unknown;
  selectedProjectId?: unknown;
  selectedProjectSourceIds?: unknown;
  projectContextMeta?: {
    selectedSourceIds?: unknown;
  } | null;
};

export type AuthorizedProjectContextPayload = ProjectContextPayload & {
  selectedProjectRuleIds: string[];
  projectRuleCount: number;
  projectRulesSummary: string;
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

function toSafeRule(rule: {
  id: string;
  projectId: string;
  title: string;
  category: string;
  severity: string;
  appliesTo: string[];
  body: string;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}): SafeProjectRule {
  return {
    id: rule.id,
    projectId: rule.projectId,
    title: rule.title,
    category: rule.category,
    severity: rule.severity,
    appliesTo: rule.appliesTo,
    body: rule.body,
    isEnabled: rule.isEnabled,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  };
}

export async function buildAuthorizedProjectContextPayload(
  userId: string,
  input: ProjectContextRequestShape,
  options: { maxCharacters?: number; route?: string; workflow?: string } = {}
): Promise<AuthorizedProjectContextPayload> {
  const requestedProjectId = getRequestedProjectId(input);
  const requestedSourceIds = getRequestedSourceIds(input);
  const emptyPayload = buildProjectContextPayload({ maxCharacters: options.maxCharacters });

  if (!userId || !requestedProjectId) {
    return {
      ...emptyPayload,
      selectedProjectRuleIds: [],
      projectRuleCount: 0,
      projectRulesSummary: "No project rules used.",
    };
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
      rules: {
        where: {
          isEnabled: true,
        },
        orderBy: [{ severity: "desc" }, { updatedAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          projectId: true,
          title: true,
          category: true,
          severity: true,
          appliesTo: true,
          body: true,
          isEnabled: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!project) {
    await recordSecurityAuditEvent({
      userId,
      type: SECURITY_EVENTS.AI_PROJECT_CONTEXT_BLOCKED,
      meta: {
        route: options.route ?? "unknown",
        requestedProjectId,
        requestedSourceCount: requestedSourceIds.length,
        reason: "project_not_owned_or_missing",
      },
    });

    return {
      ...emptyPayload,
      selectedProjectRuleIds: [],
      projectRuleCount: 0,
      projectRulesSummary: "No project rules used.",
    };
  }

  const requestedSourceSet = new Set(requestedSourceIds);
  const authorizedSources =
    requestedSourceIds.length > 0
      ? project.sources.filter((source) => requestedSourceSet.has(source.id))
      : project.sources;
  const blockedSourceIds = requestedSourceIds.filter(
    (sourceId) => !authorizedSources.some((source) => source.id === sourceId)
  );

  if (blockedSourceIds.length > 0) {
    await recordSecurityAuditEvent({
      userId,
      type: SECURITY_EVENTS.AI_PROJECT_CONTEXT_BLOCKED,
      meta: {
        route: options.route ?? "unknown",
        requestedProjectId,
        blockedSourceCount: blockedSourceIds.length,
        reason: "source_not_authorized_or_missing",
      },
    });
  }

  const safeRules = project.rules.map(toSafeRule);
  const workflow = options.workflow ?? "all";
  const applicableRules = safeRules.filter((rule) => workflowMatchesRule(rule, workflow));
  const rulesBlock = buildProjectRulesBlock(applicableRules, workflow);

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

  const payload = buildProjectContextPayload(payloadInput);
  const projectContextBlock = [payload.projectContextBlock, rulesBlock].filter(Boolean).join("\n\n");
  const projectContextUsed = payload.projectContextUsed || Boolean(rulesBlock);
  const projectRulesSummary = applicableRules.length
    ? `${applicableRules.length} active rule${applicableRules.length === 1 ? "" : "s"} used`
    : "No project rules used.";

  await recordSecurityAuditEvent({
    userId,
    type: SECURITY_EVENTS.AI_PROJECT_CONTEXT_USED,
    meta: {
      route: options.route ?? "unknown",
      projectId: project.id,
      projectContextUsed,
      sourceCount: authorizedSources.length,
      requestedSourceCount: requestedSourceIds.length,
      ruleCount: applicableRules.length,
      workflow,
    },
  });

  return {
    ...payload,
    projectContextUsed,
    projectContextBlock,
    projectContextSummary: [payload.projectContextSummary, projectRulesSummary].filter(Boolean).join(" · "),
    selectedProjectRuleIds: applicableRules.map((rule) => rule.id),
    projectRuleCount: applicableRules.length,
    projectRulesSummary,
  };
}

export function serializeAuthorizedProjectContext(context: AuthorizedProjectContextPayload) {
  return {
    projectContextUsed: context.projectContextUsed,
    selectedProjectId: context.selectedProjectId,
    selectedProjectName: context.selectedProjectName,
    selectedProjectSourceIds: context.selectedProjectSourceIds,
    selectedProjectRuleIds: context.selectedProjectRuleIds,
    projectRuleCount: context.projectRuleCount,
    projectRulesSummary: context.projectRulesSummary,
    projectContextSummary: context.projectContextSummary,
  };
}
