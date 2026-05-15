import { prisma } from "@/lib/prisma";
import {
  buildProjectContextPayload,
  type ProjectContextInput,
  type ProjectContextPayload,
} from "@/lib/project-context-injection";
import { buildProjectRulesBlock, workflowMatchesRule, type SafeProjectRule } from "@/lib/project-rules";
import { buildProjectTerminologyBlock, type SafeProjectTerm } from "@/lib/project-terms";
import { buildProjectRiskBlock, type SafeProjectFeature, type SafeProjectRisk } from "@/lib/project-risks";
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
  selectedProjectTermIds: string[];
  projectTermCount: number;
  projectTerminologySummary: string;
  selectedProjectRiskIds: string[];
  projectRiskCount: number;
  projectRiskSummary: string;
  selectedProjectFeatureIds: string[];
  projectFeatureCount: number;
  projectFeatureSummary: string;
};

function cleanId(value: unknown): string {
  return String(value ?? "").trim();
}

function cleanIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.map((item) => cleanId(item)).filter(Boolean).slice(0, 100);
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
  return { ...rule, createdAt: rule.createdAt.toISOString(), updatedAt: rule.updatedAt.toISOString() };
}

function toSafeTerm(term: {
  id: string;
  projectId: string;
  term: string;
  definition: string;
  aliases: string[];
  preferredUsage: string | null;
  category: string;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}): SafeProjectTerm {
  return { ...term, createdAt: term.createdAt.toISOString(), updatedAt: term.updatedAt.toISOString() };
}

function toSafeRisk(risk: {
  id: string;
  projectId: string;
  title: string;
  area: string;
  riskType: string;
  severity: string;
  likelihood: string;
  description: string;
  testingGuidance: string | null;
  relatedTags: string[];
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}): SafeProjectRisk {
  return {
    ...risk,
    testingGuidance: risk.testingGuidance ?? "",
    createdAt: risk.createdAt.toISOString(),
    updatedAt: risk.updatedAt.toISOString(),
  };
}

function toSafeFeature(feature: {
  id: string;
  projectId: string;
  name: string;
  area: string;
  lifecycleState: string;
  description: string;
  dependencies: string[];
  relatedTags: string[];
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}): SafeProjectFeature {
  return { ...feature, createdAt: feature.createdAt.toISOString(), updatedAt: feature.updatedAt.toISOString() };
}

function buildEmptyAuthorizedPayload(payload: ProjectContextPayload): AuthorizedProjectContextPayload {
  return {
    ...payload,
    selectedProjectRuleIds: [],
    projectRuleCount: 0,
    projectRulesSummary: "No project rules used.",
    selectedProjectTermIds: [],
    projectTermCount: 0,
    projectTerminologySummary: "No project terminology used.",
    selectedProjectRiskIds: [],
    projectRiskCount: 0,
    projectRiskSummary: "No project risks used.",
    selectedProjectFeatureIds: [],
    projectFeatureCount: 0,
    projectFeatureSummary: "No project features used.",
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

  if (!userId || !requestedProjectId) return buildEmptyAuthorizedPayload(emptyPayload);

  const project = await prisma.qAProject.findFirst({
    where: { id: requestedProjectId, userId },
    select: {
      id: true,
      name: true,
      description: true,
      productType: true,
      sources: {
        where: { isEnabled: true },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        select: { id: true, title: true, sourceType: true, body: true, tags: true, isEnabled: true },
      },
      rules: {
        where: { isEnabled: true },
        orderBy: [{ severity: "desc" }, { updatedAt: "desc" }, { createdAt: "desc" }],
        select: { id: true, projectId: true, title: true, category: true, severity: true, appliesTo: true, body: true, isEnabled: true, createdAt: true, updatedAt: true },
      },
      terms: {
        where: { isEnabled: true },
        orderBy: [{ category: "asc" }, { term: "asc" }, { updatedAt: "desc" }],
        select: { id: true, projectId: true, term: true, definition: true, aliases: true, preferredUsage: true, category: true, isEnabled: true, createdAt: true, updatedAt: true },
      },
      risks: {
        where: { isEnabled: true },
        orderBy: [{ severity: "desc" }, { likelihood: "desc" }, { updatedAt: "desc" }],
        select: { id: true, projectId: true, title: true, area: true, riskType: true, severity: true, likelihood: true, description: true, testingGuidance: true, relatedTags: true, isEnabled: true, createdAt: true, updatedAt: true },
      },
      features: {
        where: { isEnabled: true },
        orderBy: [{ lifecycleState: "asc" }, { updatedAt: "desc" }],
        select: { id: true, projectId: true, name: true, area: true, lifecycleState: true, description: true, dependencies: true, relatedTags: true, isEnabled: true, createdAt: true, updatedAt: true },
      },
    },
  });

  if (!project) {
    await recordSecurityAuditEvent({
      userId,
      type: SECURITY_EVENTS.AI_PROJECT_CONTEXT_BLOCKED,
      meta: { route: options.route ?? "unknown", requestedProjectId, requestedSourceCount: requestedSourceIds.length, reason: "project_not_owned_or_missing" },
    });
    return buildEmptyAuthorizedPayload(emptyPayload);
  }

  const requestedSourceSet = new Set(requestedSourceIds);
  const authorizedSources = requestedSourceIds.length > 0 ? project.sources.filter((source) => requestedSourceSet.has(source.id)) : project.sources;
  const blockedSourceIds = requestedSourceIds.filter((sourceId) => !authorizedSources.some((source) => source.id === sourceId));

  if (blockedSourceIds.length > 0) {
    await recordSecurityAuditEvent({
      userId,
      type: SECURITY_EVENTS.AI_PROJECT_CONTEXT_BLOCKED,
      meta: { route: options.route ?? "unknown", requestedProjectId, blockedSourceCount: blockedSourceIds.length, reason: "source_not_authorized_or_missing" },
    });
  }

  const workflow = options.workflow ?? "all";
  const safeRules = project.rules.map(toSafeRule);
  const applicableRules = safeRules.filter((rule) => workflowMatchesRule(rule, workflow));
  const rulesBlock = buildProjectRulesBlock(applicableRules, workflow);
  const safeTerms = project.terms.map(toSafeTerm);
  const terminologyBlock = buildProjectTerminologyBlock(safeTerms);
  const safeRisks = project.risks.map(toSafeRisk);
  const safeFeatures = project.features.map(toSafeFeature);
  const riskBlock = buildProjectRiskBlock(safeRisks, safeFeatures);

  const payloadInput: ProjectContextInput = {
    projectId: project.id,
    projectName: project.name,
    productType: project.productType,
    projectDescription: project.description ?? "",
    selectedSourceIds: authorizedSources.map((source) => source.id),
    sources: authorizedSources.map((source) => ({ id: source.id, title: source.title, sourceType: source.sourceType, tags: source.tags, body: source.body, enabled: source.isEnabled, selected: true })),
    maxCharacters: options.maxCharacters,
  };

  const payload = buildProjectContextPayload(payloadInput);
  const projectContextBlock = [payload.projectContextBlock, rulesBlock, terminologyBlock, riskBlock].filter(Boolean).join("\n\n");
  const projectContextUsed = payload.projectContextUsed || Boolean(rulesBlock) || Boolean(terminologyBlock) || Boolean(riskBlock);
  const projectRulesSummary = applicableRules.length ? `${applicableRules.length} active rule${applicableRules.length === 1 ? "" : "s"} used` : "No project rules used.";
  const projectTerminologySummary = safeTerms.length ? `${safeTerms.length} active term${safeTerms.length === 1 ? "" : "s"} used` : "No project terminology used.";
  const projectRiskSummary = safeRisks.length ? `${safeRisks.length} active risk${safeRisks.length === 1 ? "" : "s"} used` : "No project risks used.";
  const projectFeatureSummary = safeFeatures.length ? `${safeFeatures.length} active feature${safeFeatures.length === 1 ? "" : "s"} used` : "No project features used.";

  await recordSecurityAuditEvent({
    userId,
    type: SECURITY_EVENTS.AI_PROJECT_CONTEXT_USED,
    meta: { route: options.route ?? "unknown", projectId: project.id, projectContextUsed, sourceCount: authorizedSources.length, requestedSourceCount: requestedSourceIds.length, ruleCount: applicableRules.length, termCount: safeTerms.length, riskCount: safeRisks.length, featureCount: safeFeatures.length, workflow },
  });

  return {
    ...payload,
    projectContextUsed,
    projectContextBlock,
    projectContextSummary: [payload.projectContextSummary, projectRulesSummary, projectTerminologySummary, projectRiskSummary, projectFeatureSummary].filter(Boolean).join(" · "),
    selectedProjectRuleIds: applicableRules.map((rule) => rule.id),
    projectRuleCount: applicableRules.length,
    projectRulesSummary,
    selectedProjectTermIds: safeTerms.map((term) => term.id),
    projectTermCount: safeTerms.length,
    projectTerminologySummary,
    selectedProjectRiskIds: safeRisks.map((risk) => risk.id),
    projectRiskCount: safeRisks.length,
    projectRiskSummary,
    selectedProjectFeatureIds: safeFeatures.map((feature) => feature.id),
    projectFeatureCount: safeFeatures.length,
    projectFeatureSummary,
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
    selectedProjectTermIds: context.selectedProjectTermIds,
    projectTermCount: context.projectTermCount,
    projectTerminologySummary: context.projectTerminologySummary,
    selectedProjectRiskIds: context.selectedProjectRiskIds,
    projectRiskCount: context.projectRiskCount,
    projectRiskSummary: context.projectRiskSummary,
    selectedProjectFeatureIds: context.selectedProjectFeatureIds,
    projectFeatureCount: context.projectFeatureCount,
    projectFeatureSummary: context.projectFeatureSummary,
    projectContextSummary: context.projectContextSummary,
  };
}
