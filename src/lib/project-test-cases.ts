import { prisma } from "@/lib/prisma";

export const TEST_CASE_TYPES = ["smoke", "functional", "regression", "edge-case", "accessibility", "security", "performance", "integration", "other"] as const;
export const TEST_CASE_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export const TEST_CASE_STATUSES = ["draft", "ready", "needs-review", "deprecated"] as const;
export const TEST_CASE_SYNC_STATUSES = ["not_synced", "synced", "sync_failed", "stale"] as const;

const TYPE_SET = new Set<string>(TEST_CASE_TYPES);
const PRIORITY_SET = new Set<string>(TEST_CASE_PRIORITIES);
const STATUS_SET = new Set<string>(TEST_CASE_STATUSES);
const SYNC_STATUS_SET = new Set<string>(TEST_CASE_SYNC_STATUSES);

export type ProjectTestCasePayload = {
  title: string;
  testType: string;
  priority: string;
  status: string;
  sourceType: string;
  sourceReportId: string | null;
  sourceJiraKey: string;
  preconditions: string;
  steps: string[];
  expectedResult: string;
  automationReadiness: string;
  qualityScore: number | null;
  tags: string[];
  notes: string;
  structuredData: unknown | null;
  testRailCaseId: number | null;
  testRailProjectId: number | null;
  testRailSuiteId: number | null;
  testRailSectionId: number | null;
  syncStatus: string;
};

export type SafeProjectTestCase = ProjectTestCasePayload & {
  id: string;
  userId: string;
  projectId: string;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  createdAt: string;
  updatedAt: string;
};

type RawTestCase = {
  id: string;
  userId: string;
  projectId: string;
  title: string;
  testType: string;
  priority: string;
  status: string;
  sourceType: string;
  sourceReportId: string | null;
  sourceJiraKey: string | null;
  preconditions: string | null;
  steps: string[];
  expectedResult: string | null;
  automationReadiness: string | null;
  qualityScore: number | null;
  tags: string[];
  notes: string | null;
  structuredData: unknown | null;
  testRailCaseId: number | null;
  testRailProjectId: number | null;
  testRailSuiteId: number | null;
  testRailSectionId: number | null;
  syncStatus: string;
  lastSyncedAt: Date | null;
  lastSyncError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function cleanText(value: unknown, max = 3000): string {
  return String(value ?? "").trim().replace(/\r\n/g, "\n").slice(0, max);
}

function cleanSlug(value: unknown, fallback: string): string {
  return String(value ?? fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || fallback;
}

function cleanList(value: unknown, maxItems = 40): string[] {
  const raw = Array.isArray(value) ? value : String(value ?? "").split(/\n|,/);
  return Array.from(new Set(raw.map((item) => cleanText(item, 220).replace(/\s+/g, " ")).filter(Boolean))).slice(0, maxItems);
}

function cleanNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const next = Number(value);
  return Number.isFinite(next) ? Math.trunc(next) : null;
}

async function userOwnsProject(userId: string, projectId: string): Promise<boolean> {
  if (!userId || !projectId) return false;
  const project = await prisma.qAProject.findFirst({ where: { id: projectId, userId }, select: { id: true } });
  return Boolean(project);
}

function toSafeTestCase(testCase: RawTestCase): SafeProjectTestCase {
  return {
    id: testCase.id,
    userId: testCase.userId,
    projectId: testCase.projectId,
    title: testCase.title,
    testType: testCase.testType,
    priority: testCase.priority,
    status: testCase.status,
    sourceType: testCase.sourceType,
    sourceReportId: testCase.sourceReportId,
    sourceJiraKey: testCase.sourceJiraKey ?? "",
    preconditions: testCase.preconditions ?? "",
    steps: testCase.steps,
    expectedResult: testCase.expectedResult ?? "",
    automationReadiness: testCase.automationReadiness ?? "",
    qualityScore: testCase.qualityScore,
    tags: testCase.tags,
    notes: testCase.notes ?? "",
    structuredData: testCase.structuredData,
    testRailCaseId: testCase.testRailCaseId,
    testRailProjectId: testCase.testRailProjectId,
    testRailSuiteId: testCase.testRailSuiteId,
    testRailSectionId: testCase.testRailSectionId,
    syncStatus: testCase.syncStatus,
    lastSyncedAt: testCase.lastSyncedAt ? testCase.lastSyncedAt.toISOString() : null,
    lastSyncError: testCase.lastSyncError,
    createdAt: testCase.createdAt.toISOString(),
    updatedAt: testCase.updatedAt.toISOString(),
  };
}

export function normalizeProjectTestCasePayload(value: Record<string, unknown>): ProjectTestCasePayload {
  const testType = cleanSlug(value.testType, "functional");
  const priority = cleanSlug(value.priority, "medium");
  const status = cleanSlug(value.status, "draft");
  const syncStatus = cleanSlug(value.syncStatus, "not_synced");

  return {
    title: cleanText(value.title, 180).replace(/\s+/g, " "),
    testType: TYPE_SET.has(testType) ? testType : "other",
    priority: PRIORITY_SET.has(priority) ? priority : "medium",
    status: STATUS_SET.has(status) ? status : "draft",
    sourceType: cleanSlug(value.sourceType, "manual"),
    sourceReportId: cleanText(value.sourceReportId, 120) || null,
    sourceJiraKey: cleanText(value.sourceJiraKey, 80).toUpperCase(),
    preconditions: cleanText(value.preconditions, 2000),
    steps: cleanList(value.steps, 60),
    expectedResult: cleanText(value.expectedResult, 2500),
    automationReadiness: cleanText(value.automationReadiness, 1600),
    qualityScore: cleanNumber(value.qualityScore),
    tags: cleanList(value.tags, 18),
    notes: cleanText(value.notes, 2500),
    structuredData: typeof value.structuredData === "object" ? value.structuredData ?? null : null,
    testRailCaseId: cleanNumber(value.testRailCaseId),
    testRailProjectId: cleanNumber(value.testRailProjectId),
    testRailSuiteId: cleanNumber(value.testRailSuiteId),
    testRailSectionId: cleanNumber(value.testRailSectionId),
    syncStatus: SYNC_STATUS_SET.has(syncStatus) ? syncStatus : "not_synced",
  };
}

function validateTestCase(payload: ProjectTestCasePayload): string[] {
  const errors: string[] = [];
  if (!payload.title) errors.push("Test case title is required.");
  if (payload.steps.length === 0) errors.push("Add at least one test step.");
  if (!payload.expectedResult || payload.expectedResult.length < 3) errors.push("Expected result is required.");
  return errors;
}

export async function listProjectTestCases(userId: string, projectId: string): Promise<SafeProjectTestCase[]> {
  if (!(await userOwnsProject(userId, projectId))) return [];

  const testCases = await prisma.qATestCase.findMany({
    where: { userId, projectId },
    orderBy: [{ status: "asc" }, { priority: "desc" }, { updatedAt: "desc" }],
  });

  return testCases.map((testCase) => toSafeTestCase(testCase as RawTestCase));
}

export async function saveProjectTestCase(
  userId: string,
  projectId: string,
  testCaseId: string | null,
  payload: ProjectTestCasePayload
) {
  const errors = validateTestCase(payload);

  if (!(await userOwnsProject(userId, projectId))) errors.push("Project not found.");

  if (payload.sourceReportId) {
    const report = await prisma.qAReport.findFirst({ where: { id: payload.sourceReportId, userId, projectId }, select: { id: true } });
    if (!report) errors.push("Source report not found for this project.");
  }

  if (errors.length) return { ok: false as const, errors, testCase: null };

  const data = {
    title: payload.title,
    testType: payload.testType,
    priority: payload.priority,
    status: payload.status,
    sourceType: payload.sourceType,
    sourceReportId: payload.sourceReportId,
    sourceJiraKey: payload.sourceJiraKey || null,
    preconditions: payload.preconditions || null,
    steps: payload.steps,
    expectedResult: payload.expectedResult || null,
    automationReadiness: payload.automationReadiness || null,
    qualityScore: payload.qualityScore,
    tags: payload.tags,
    notes: payload.notes || null,
    structuredData: payload.structuredData as any,
    testRailCaseId: payload.testRailCaseId,
    testRailProjectId: payload.testRailProjectId,
    testRailSuiteId: payload.testRailSuiteId,
    testRailSectionId: payload.testRailSectionId,
    syncStatus: payload.syncStatus,
  };

  if (testCaseId) {
    const existing = await prisma.qATestCase.findFirst({ where: { id: testCaseId, userId, projectId }, select: { id: true } });
    if (!existing) return { ok: false as const, errors: ["Test case not found."], testCase: null };

    const updated = await prisma.qATestCase.update({ where: { id: testCaseId }, data });
    return { ok: true as const, errors: [], testCase: toSafeTestCase(updated as RawTestCase) };
  }

  const created = await prisma.qATestCase.create({ data: { userId, projectId, ...data } });
  return { ok: true as const, errors: [], testCase: toSafeTestCase(created as RawTestCase) };
}

export async function deleteProjectTestCase(userId: string, testCaseId: string) {
  const existing = await prisma.qATestCase.findFirst({ where: { id: testCaseId, userId }, select: { id: true } });
  if (!existing) return { ok: false as const, error: "Test case not found." };
  await prisma.qATestCase.delete({ where: { id: testCaseId } });
  return { ok: true as const };
}

export async function setProjectTestCaseStatus(userId: string, testCaseId: string, status: string) {
  const nextStatus = cleanSlug(status, "draft");
  if (!STATUS_SET.has(nextStatus)) return { ok: false as const, error: "Invalid status.", testCase: null };

  const existing = await prisma.qATestCase.findFirst({ where: { id: testCaseId, userId }, select: { id: true } });
  if (!existing) return { ok: false as const, error: "Test case not found.", testCase: null };

  const updated = await prisma.qATestCase.update({ where: { id: testCaseId }, data: { status: nextStatus } });
  return { ok: true as const, error: "", testCase: toSafeTestCase(updated as RawTestCase) };
}
