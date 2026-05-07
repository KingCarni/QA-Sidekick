import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type BugCollectionStatus = "new" | "triaged" | "in_progress" | "fixed" | "wont_fix" | "archived";

export type BugCollectionPayload = {
  title: string;
  status: BugCollectionStatus | string;
  severity?: string;
  priority?: string;
  summary?: string;
  environment?: string;
  steps: string[];
  expectedResult?: string;
  actualResult?: string;
  impact?: string;
  missingInfo: string[];
  followUps: string[];
  qaNotes: string[];
  sourceInput?: string;
  markdown?: string;
  structuredData?: unknown;
  jiraIssueKey?: string;
  jiraIssueUrl?: string;
  tags: string[];
};

export type SafeBugCollectionItem = {
  id: string;
  userId: string;
  projectId: string | null;
  title: string;
  status: string;
  severity: string;
  priority: string;
  summary: string;
  environment: string;
  steps: string[];
  expectedResult: string;
  actualResult: string;
  impact: string;
  missingInfo: string[];
  followUps: string[];
  qaNotes: string[];
  sourceInput: string;
  markdown: string;
  structuredData: unknown;
  jiraIssueKey: string;
  jiraIssueUrl: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

const STATUS_VALUES = new Set(["new", "triaged", "in_progress", "fixed", "wont_fix", "archived"]);

function cleanText(value: unknown, max = 24000): string {
  return String(value ?? "").trim().replace(/\r\n/g, "\n").slice(0, max);
}

function cleanShort(value: unknown, max = 120): string {
  return cleanText(value, max).replace(/\s+/g, " ");
}

function cleanArray(value: unknown, maxItems = 40): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => cleanText(item, 1000))
      .filter(Boolean)
      .slice(0, maxItems);
  }

  const text = cleanText(value, 12000);
  if (!text) return [];

  return text
    .split(/\r?\n+/)
    .map((item) => item.replace(/^[-*]\s+/, "").replace(/^\d+[.)]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function cleanTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((tag) => cleanShort(tag, 40).toLowerCase())
      .filter(Boolean)
      .slice(0, 12);
  }

  return cleanText(value, 600)
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 12);
}

function normalizeStatus(value: unknown): string {
  const status = cleanShort(value || "new", 40)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return STATUS_VALUES.has(status) ? status : "new";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textFromRecord(record: Record<string, unknown>, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" || typeof value === "boolean") return String(value);
  }

  return fallback;
}

function arrayFromRecord(record: Record<string, unknown>, keys: string[]): string[] {
  for (const key of keys) {
    const value = record[key];
    const clean = cleanArray(value);
    if (clean.length) return clean;
  }

  return [];
}

export function normalizeBugCollectionPayload(value: Record<string, unknown>): BugCollectionPayload {
  const structuredData = value.structuredData;
  const bugReport =
    isRecord(structuredData) && isRecord(structuredData.bugReport)
      ? structuredData.bugReport
      : isRecord(value.bugReport)
        ? value.bugReport
        : isRecord(value)
          ? value
          : {};

  const title =
    textFromRecord(bugReport, ["title", "bugTitle"], "") ||
    textFromRecord(value, ["title"], "") ||
    "Saved Bug Report";

  return {
    title: cleanShort(title, 160),
    status: normalizeStatus(value.status),
    severity: cleanShort(textFromRecord(bugReport, ["severitySuggestion", "severity"], textFromRecord(value, ["severity"], "")), 80),
    priority: cleanShort(textFromRecord(bugReport, ["prioritySuggestion", "priority"], textFromRecord(value, ["priority"], "")), 80),
    summary: cleanText(textFromRecord(bugReport, ["summary"], textFromRecord(value, ["summary"], "")), 4000),
    environment: cleanText(textFromRecord(bugReport, ["environment"], textFromRecord(value, ["environment"], "")), 4000),
    steps: arrayFromRecord(bugReport, ["stepsToReproduce", "steps"]),
    expectedResult: cleanText(textFromRecord(bugReport, ["expectedResult"], textFromRecord(value, ["expectedResult"], "")), 4000),
    actualResult: cleanText(textFromRecord(bugReport, ["actualResult"], textFromRecord(value, ["actualResult"], "")), 4000),
    impact: cleanText(textFromRecord(bugReport, ["impact"], textFromRecord(value, ["impact"], "")), 4000),
    missingInfo: arrayFromRecord(bugReport, ["missingInfo"]),
    followUps: arrayFromRecord(bugReport, ["followUpQuestions", "followUps"]),
    qaNotes: arrayFromRecord(bugReport, ["qaNotes"]),
    sourceInput: cleanText(value.sourceInput, 12000),
    markdown: cleanText(value.markdown, 24000),
    structuredData: structuredData ?? value.bugReport ?? null,
    jiraIssueKey: cleanShort(value.jiraIssueKey, 80),
    jiraIssueUrl: cleanText(value.jiraIssueUrl, 500),
    tags: cleanTags(value.tags || ["generated-bug", "qatalyst"]),
  };
}

export function validateBugCollectionPayload(payload: BugCollectionPayload): string[] {
  const errors: string[] = [];

  if (!payload.title) errors.push("Bug title is required.");
  if (payload.title && payload.title.length < 2) errors.push("Bug title must be at least 2 characters.");
  if (!payload.summary && !payload.markdown && payload.steps.length === 0) {
    errors.push("Bug needs at least a summary, markdown, or repro steps.");
  }

  return errors;
}

function toSafeBug(item: {
  id: string;
  userId: string;
  projectId: string | null;
  title: string;
  status: string;
  severity: string | null;
  priority: string | null;
  summary: string | null;
  environment: string | null;
  steps: string[];
  expectedResult: string | null;
  actualResult: string | null;
  impact: string | null;
  missingInfo: string[];
  followUps: string[];
  qaNotes: string[];
  sourceInput: string | null;
  markdown: string | null;
  structuredData: unknown;
  jiraIssueKey: string | null;
  jiraIssueUrl: string | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}): SafeBugCollectionItem {
  return {
    id: item.id,
    userId: item.userId,
    projectId: item.projectId,
    title: item.title,
    status: item.status,
    severity: item.severity ?? "",
    priority: item.priority ?? "",
    summary: item.summary ?? "",
    environment: item.environment ?? "",
    steps: item.steps,
    expectedResult: item.expectedResult ?? "",
    actualResult: item.actualResult ?? "",
    impact: item.impact ?? "",
    missingInfo: item.missingInfo,
    followUps: item.followUps,
    qaNotes: item.qaNotes,
    sourceInput: item.sourceInput ?? "",
    markdown: item.markdown ?? "",
    structuredData: item.structuredData,
    jiraIssueKey: item.jiraIssueKey ?? "",
    jiraIssueUrl: item.jiraIssueUrl ?? "",
    tags: item.tags,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

async function userOwnsProject(userId: string, projectId: string): Promise<boolean> {
  if (!userId || !projectId) return false;

  const project = await prisma.qAProject.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });

  return Boolean(project);
}

export async function listBugCollectionItems(userId: string, projectId?: string | null) {
  if (!userId) return [];

  const where =
    projectId && projectId !== "all"
      ? { userId, projectId }
      : { userId };

  const items = await prisma.bugCollectionItem.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  return items.map(toSafeBug);
}

export async function saveBugCollectionItem(
  userId: string,
  projectId: string | null,
  bugId: string | null,
  payload: BugCollectionPayload
) {
  const errors = validateBugCollectionPayload(payload);

  if (!userId) errors.push("User is required.");

  if (projectId && !(await userOwnsProject(userId, projectId))) {
    errors.push("Project not found.");
  }

  if (errors.length > 0) {
    return { ok: false as const, errors, bug: null };
  }

  const data = {
    projectId,
    title: payload.title,
    status: normalizeStatus(payload.status),
    severity: payload.severity || null,
    priority: payload.priority || null,
    summary: payload.summary || null,
    environment: payload.environment || null,
    steps: payload.steps,
    expectedResult: payload.expectedResult || null,
    actualResult: payload.actualResult || null,
    impact: payload.impact || null,
    missingInfo: payload.missingInfo,
    followUps: payload.followUps,
    qaNotes: payload.qaNotes,
    sourceInput: payload.sourceInput || null,
    markdown: payload.markdown || null,
    structuredData:
      payload.structuredData === undefined
        ? undefined
        : payload.structuredData === null
          ? Prisma.JsonNull
          : (payload.structuredData as Prisma.InputJsonValue),
    jiraIssueKey: payload.jiraIssueKey || null,
    jiraIssueUrl: payload.jiraIssueUrl || null,
    tags: payload.tags,
  };

  if (bugId) {
    const existing = await prisma.bugCollectionItem.findFirst({
      where: { id: bugId, userId },
      select: { id: true },
    });

    if (!existing) {
      return { ok: false as const, errors: ["Bug collection item not found."], bug: null };
    }

    const updated = await prisma.bugCollectionItem.update({
      where: { id: bugId },
      data,
    });

    return { ok: true as const, errors: [], bug: toSafeBug(updated) };
  }

  const created = await prisma.bugCollectionItem.create({
    data: { userId, ...data },
  });

  return { ok: true as const, errors: [], bug: toSafeBug(created) };
}

export async function deleteBugCollectionItem(userId: string, bugId: string) {
  if (!userId) return { ok: false as const, error: "User is required." };
  if (!bugId) return { ok: false as const, error: "Bug collection item is required." };

  const existing = await prisma.bugCollectionItem.findFirst({
    where: { id: bugId, userId },
    select: { id: true },
  });

  if (!existing) return { ok: false as const, error: "Bug collection item not found." };

  await prisma.bugCollectionItem.delete({ where: { id: bugId } });
  return { ok: true as const };
}

export async function updateBugCollectionStatus(userId: string, bugId: string, status: unknown) {
  if (!userId) return { ok: false as const, error: "User is required.", bug: null };
  if (!bugId) return { ok: false as const, error: "Bug collection item is required.", bug: null };

  const existing = await prisma.bugCollectionItem.findFirst({
    where: { id: bugId, userId },
    select: { id: true },
  });

  if (!existing) return { ok: false as const, error: "Bug collection item not found.", bug: null };

  const updated = await prisma.bugCollectionItem.update({
    where: { id: bugId },
    data: { status: normalizeStatus(status) },
  });

  return { ok: true as const, error: "", bug: toSafeBug(updated) };
}
