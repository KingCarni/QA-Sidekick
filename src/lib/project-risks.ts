import { prisma } from "@/lib/prisma";

export type ProjectRiskPayload = {
  title: string;
  area: string;
  riskType: string;
  severity: string;
  likelihood: string;
  description: string;
  testingGuidance: string;
  relatedTags: string[];
  isEnabled: boolean;
};

export type SafeProjectRisk = ProjectRiskPayload & {
  id: string;
  projectId: string;
  testingGuidance: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectFeaturePayload = {
  name: string;
  area: string;
  lifecycleState: string;
  description: string;
  dependencies: string[];
  relatedTags: string[];
  isEnabled: boolean;
};

export type SafeProjectFeature = ProjectFeaturePayload & {
  id: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
};

export const RISK_TYPES = ["regression", "integration", "data", "permissions", "ux", "performance", "accessibility", "security", "release", "other"] as const;
export const RISK_LEVELS = ["low", "medium", "high", "critical"] as const;
export const FEATURE_STATES = ["planned", "in-progress", "implemented", "deprecated"] as const;

const RISK_TYPE_SET = new Set<string>(RISK_TYPES);
const RISK_LEVEL_SET = new Set<string>(RISK_LEVELS);
const FEATURE_STATE_SET = new Set<string>(FEATURE_STATES);

function cleanText(value: unknown, max = 3000): string {
  return String(value ?? "").trim().replace(/\r\n/g, "\n").slice(0, max);
}

function cleanSlug(value: unknown, fallback: string): string {
  return String(value ?? fallback).trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || fallback;
}

function cleanList(value: unknown, maxItems = 14): string[] {
  const raw = Array.isArray(value) ? value : String(value ?? "").split(",");
  return Array.from(new Set(raw.map((item) => cleanText(item, 80).replace(/\s+/g, " ")).filter(Boolean))).slice(0, maxItems);
}

async function userOwnsProject(userId: string, projectId: string): Promise<boolean> {
  if (!userId || !projectId) return false;
  const project = await prisma.qAProject.findFirst({ where: { id: projectId, userId }, select: { id: true } });
  return Boolean(project);
}

export function normalizeProjectRiskPayload(value: Record<string, unknown>): ProjectRiskPayload {
  const riskType = cleanSlug(value.riskType, "regression");
  const severity = cleanSlug(value.severity, "medium");
  const likelihood = cleanSlug(value.likelihood, "medium");
  return {
    title: cleanText(value.title, 140).replace(/\s+/g, " "),
    area: cleanText(value.area, 120).replace(/\s+/g, " ") || "general",
    riskType: RISK_TYPE_SET.has(riskType) ? riskType : "other",
    severity: RISK_LEVEL_SET.has(severity) ? severity : "medium",
    likelihood: RISK_LEVEL_SET.has(likelihood) ? likelihood : "medium",
    description: cleanText(value.description, 3000),
    testingGuidance: cleanText(value.testingGuidance, 2000),
    relatedTags: cleanList(value.relatedTags),
    isEnabled: typeof value.isEnabled === "boolean" ? value.isEnabled : true,
  };
}

export function normalizeProjectFeaturePayload(value: Record<string, unknown>): ProjectFeaturePayload {
  const lifecycleState = cleanSlug(value.lifecycleState, "planned");
  return {
    name: cleanText(value.name, 140).replace(/\s+/g, " "),
    area: cleanText(value.area, 120).replace(/\s+/g, " ") || "general",
    lifecycleState: FEATURE_STATE_SET.has(lifecycleState) ? lifecycleState : "planned",
    description: cleanText(value.description, 3000),
    dependencies: cleanList(value.dependencies),
    relatedTags: cleanList(value.relatedTags),
    isEnabled: typeof value.isEnabled === "boolean" ? value.isEnabled : true,
  };
}

function validateRisk(payload: ProjectRiskPayload): string[] {
  const errors: string[] = [];
  if (!payload.title) errors.push("Risk title is required.");
  if (!payload.description || payload.description.length < 8) errors.push("Risk description should be at least 8 characters.");
  return errors;
}

function validateFeature(payload: ProjectFeaturePayload): string[] {
  const errors: string[] = [];
  if (!payload.name) errors.push("Feature name is required.");
  if (!payload.description || payload.description.length < 8) errors.push("Feature description should be at least 8 characters.");
  return errors;
}

function toSafeRisk(risk: any): SafeProjectRisk {
  return { ...risk, createdAt: risk.createdAt.toISOString(), updatedAt: risk.updatedAt.toISOString() };
}

function toSafeFeature(feature: any): SafeProjectFeature {
  return { ...feature, createdAt: feature.createdAt.toISOString(), updatedAt: feature.updatedAt.toISOString() };
}

export async function listProjectRisks(userId: string, projectId: string): Promise<SafeProjectRisk[]> {
  if (!(await userOwnsProject(userId, projectId))) return [];
  const risks = await prisma.qAProjectRisk.findMany({ where: { projectId }, orderBy: [{ isEnabled: "desc" }, { severity: "desc" }, { updatedAt: "desc" }] });
  return risks.map(toSafeRisk);
}

export async function saveProjectRisk(userId: string, projectId: string, riskId: string | null, payload: ProjectRiskPayload) {
  const errors = validateRisk(payload);
  if (!(await userOwnsProject(userId, projectId))) errors.push("Project not found.");
  if (errors.length) return { ok: false as const, errors, risk: null };
  const data = { ...payload, testingGuidance: payload.testingGuidance || null };
  if (riskId) {
    const existing = await prisma.qAProjectRisk.findFirst({ where: { id: riskId, projectId, project: { userId } }, select: { id: true } });
    if (!existing) return { ok: false as const, errors: ["Risk not found."], risk: null };
    return { ok: true as const, errors: [], risk: toSafeRisk(await prisma.qAProjectRisk.update({ where: { id: riskId }, data })) };
  }
  return { ok: true as const, errors: [], risk: toSafeRisk(await prisma.qAProjectRisk.create({ data: { projectId, ...data } })) };
}

export async function setProjectRiskEnabled(userId: string, riskId: string, isEnabled: boolean) {
  const existing = await prisma.qAProjectRisk.findFirst({ where: { id: riskId, project: { userId } }, select: { id: true } });
  if (!existing) return { ok: false as const, error: "Risk not found.", risk: null };
  return { ok: true as const, error: "", risk: toSafeRisk(await prisma.qAProjectRisk.update({ where: { id: riskId }, data: { isEnabled } })) };
}

export async function deleteProjectRisk(userId: string, riskId: string) {
  const existing = await prisma.qAProjectRisk.findFirst({ where: { id: riskId, project: { userId } }, select: { id: true } });
  if (!existing) return { ok: false as const, error: "Risk not found." };
  await prisma.qAProjectRisk.delete({ where: { id: riskId } });
  return { ok: true as const };
}

export async function listProjectFeatures(userId: string, projectId: string): Promise<SafeProjectFeature[]> {
  if (!(await userOwnsProject(userId, projectId))) return [];
  const features = await prisma.qAProjectFeature.findMany({ where: { projectId }, orderBy: [{ isEnabled: "desc" }, { lifecycleState: "asc" }, { updatedAt: "desc" }] });
  return features.map(toSafeFeature);
}

export async function saveProjectFeature(userId: string, projectId: string, featureId: string | null, payload: ProjectFeaturePayload) {
  const errors = validateFeature(payload);
  if (!(await userOwnsProject(userId, projectId))) errors.push("Project not found.");
  if (errors.length) return { ok: false as const, errors, feature: null };
  if (featureId) {
    const existing = await prisma.qAProjectFeature.findFirst({ where: { id: featureId, projectId, project: { userId } }, select: { id: true } });
    if (!existing) return { ok: false as const, errors: ["Feature not found."], feature: null };
    return { ok: true as const, errors: [], feature: toSafeFeature(await prisma.qAProjectFeature.update({ where: { id: featureId }, data: payload })) };
  }
  return { ok: true as const, errors: [], feature: toSafeFeature(await prisma.qAProjectFeature.create({ data: { projectId, ...payload } })) };
}

export async function setProjectFeatureEnabled(userId: string, featureId: string, isEnabled: boolean) {
  const existing = await prisma.qAProjectFeature.findFirst({ where: { id: featureId, project: { userId } }, select: { id: true } });
  if (!existing) return { ok: false as const, error: "Feature not found.", feature: null };
  return { ok: true as const, error: "", feature: toSafeFeature(await prisma.qAProjectFeature.update({ where: { id: featureId }, data: { isEnabled } })) };
}

export async function deleteProjectFeature(userId: string, featureId: string) {
  const existing = await prisma.qAProjectFeature.findFirst({ where: { id: featureId, project: { userId } }, select: { id: true } });
  if (!existing) return { ok: false as const, error: "Feature not found." };
  await prisma.qAProjectFeature.delete({ where: { id: featureId } });
  return { ok: true as const };
}

export function buildProjectRiskBlock(risks: SafeProjectRisk[], features: SafeProjectFeature[], maxCharacters = 10000): string {
  const blocks: string[] = [];
  let used = 0;
  const add = (block: string) => {
    if (used + block.length > maxCharacters) return;
    blocks.push(block);
    used += block.length;
  };
  risks.filter((risk) => risk.isEnabled).forEach((risk) => add([
    `Risk: ${risk.title}`,
    `Area: ${risk.area}`,
    `Type: ${risk.riskType}`,
    `Severity: ${risk.severity}`,
    `Likelihood: ${risk.likelihood}`,
    risk.relatedTags.length ? `Tags: ${risk.relatedTags.join(", ")}` : "",
    "Description:", risk.description,
    risk.testingGuidance ? `Testing guidance:\n${risk.testingGuidance}` : "",
  ].filter(Boolean).join("\n")));
  features.filter((feature) => feature.isEnabled).forEach((feature) => add([
    `Feature: ${feature.name}`,
    `Area: ${feature.area}`,
    `Lifecycle state: ${feature.lifecycleState}`,
    feature.dependencies.length ? `Dependencies: ${feature.dependencies.join(", ")}` : "",
    feature.relatedTags.length ? `Tags: ${feature.relatedTags.join(", ")}` : "",
    "Description:", feature.description,
  ].filter(Boolean).join("\n")));
  if (!blocks.length) return "";
  return [
    "## PROJECT RISKS, HOTSPOTS, AND FEATURE REGISTRY",
    "",
    "RISK MEMORY RULES:",
    "- Use these as historical/project context, not as proof of a current bug unless the source input supports it.",
    "- Prioritize relevant known hotspots when proposing risks, tests, and follow-up questions.",
    "- Mention uncertainty when a risk might apply but the source input is incomplete.",
    "",
    ...blocks,
    "",
    "## END PROJECT RISKS, HOTSPOTS, AND FEATURE REGISTRY",
  ].join("\n");
}
