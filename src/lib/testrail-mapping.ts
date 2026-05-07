import type { SafeTestRailConfig } from "@/lib/testrail-config";
import { buildTestRailContentHash } from "@/lib/testrail-sync-hash";
import type { TestRailCasePayload } from "@/lib/testrail-client";

export type GeneratedQATestCase = {
  title?: unknown;
  type?: unknown;
  priority?: unknown;
  preconditions?: unknown;
  steps?: unknown;
  expectedResult?: unknown;
  automationFit?: unknown;
  automationReadiness?: unknown;
};

export type TestRailSyncSource = {
  reportId?: string | null;
  sourceJiraKey?: string | null;
  sourceJiraUrl?: string | null;
};

export type TestRailSyncPreviewCase = {
  index: number;
  title: string;
  sectionId: number;
  type: string;
  priority: string;
  preconditions: string;
  steps: string[];
  expectedResult: string;
  refs?: string;
  automationNote: string;
  automationId: string;
  contentHash: string;
  existingTestRailCaseId?: number | null;
  status: "ready" | "stale" | "synced" | "not_synced";
  payload: TestRailCasePayload;
};

function safeText(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value.trim() || fallback;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((item) => safeText(item)).filter(Boolean).join("\n");
  return fallback;
}

function normalizeSteps(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => safeText(item)).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/\r?\n+/)
      .map((step) => step.replace(/^\d+[.)]\s*/, "").trim())
      .filter(Boolean);
  }
  return [];
}

function optionId(mapping: Record<string, unknown>, key: string, label: string): number | undefined {
  const normalizedLabel = label.trim().toLowerCase();
  const value = mapping[key];

  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;

  const id = Number((value as Record<string, unknown>)[normalizedLabel] ?? (value as Record<string, unknown>)[label]);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

function customFieldName(mapping: Record<string, unknown>, key: string, fallback: string) {
  const value = String(mapping[key] ?? "").trim();
  return value || fallback;
}

function buildAutomationId(contentHash: string, index: number) {
  return `QATALYST-${index + 1}-${contentHash.slice(0, 10).toUpperCase()}`;
}

export function extractTestCasesFromStructuredData(value: unknown): GeneratedQATestCase[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];

  const record = value as Record<string, unknown>;
  if (Array.isArray(record.testCases)) return record.testCases as GeneratedQATestCase[];

  const result = record.result;
  if (result && typeof result === "object" && !Array.isArray(result)) {
    const resultRecord = result as Record<string, unknown>;
    if (Array.isArray(resultRecord.testCases)) return resultRecord.testCases as GeneratedQATestCase[];
  }

  return [];
}

export function buildTestRailSyncPreviewCase(
  testCase: GeneratedQATestCase,
  index: number,
  config: SafeTestRailConfig,
  source: TestRailSyncSource,
  existing?: { testRailCaseId: number; contentHash: string } | null
): TestRailSyncPreviewCase {
  const title = safeText(testCase.title, `Generated Test Case ${index + 1}`);
  const type = safeText(testCase.type, "Functional");
  const priority = safeText(testCase.priority, "Medium");
  const preconditions = safeText(testCase.preconditions, "");
  const steps = normalizeSteps(testCase.steps);
  const expectedResult = safeText(testCase.expectedResult, "");
  const refs = [source.sourceJiraKey, source.sourceJiraUrl].filter(Boolean).join(" ") || undefined;
  const automationNote = safeText(testCase.automationFit || testCase.automationReadiness, "Automation readiness not scored.");
  const fieldMapping = config.fieldMapping ?? {};
  const contentHash = buildTestRailContentHash({
    title,
    preconditions,
    steps,
    expectedResult,
    priority,
    type,
    sourceJiraKey: source.sourceJiraKey ?? undefined,
  });
  const automationId = buildAutomationId(contentHash, index);

  const preconditionsField = customFieldName(fieldMapping, "preconditionsField", "custom_preconds");
  const expectedField = customFieldName(fieldMapping, "expectedField", "custom_expected");
  const stepsField = customFieldName(fieldMapping, "stepsField", "custom_steps_separated");
  const automationField = customFieldName(fieldMapping, "automationNoteField", "custom_automation_readiness");
  const automationIdField = customFieldName(fieldMapping, "automationIdField", "custom_case_automation_id");

  const payload: TestRailCasePayload = {
    title,
    refs,
    type_id: optionId(fieldMapping, "typeIds", type),
    priority_id: optionId(fieldMapping, "priorityIds", priority),
    milestone_id: config.milestoneId ?? undefined,
    [preconditionsField]: preconditions,
    [expectedField]: expectedResult,
    [automationField]: automationNote,
    [automationIdField]: automationId,
  };

  if (stepsField === "custom_steps_separated") {
    payload.custom_steps_separated = steps.map((step) => ({ content: step, expected: expectedResult }));
  } else {
    payload[stepsField] = steps.map((step, stepIndex) => `${stepIndex + 1}. ${step}`).join("\n");
  }

  return {
    index,
    title,
    sectionId: config.defaultSectionId,
    type,
    priority,
    preconditions,
    steps,
    expectedResult,
    refs,
    automationNote,
    automationId,
    contentHash,
    existingTestRailCaseId: existing?.testRailCaseId ?? null,
    status: existing ? (existing.contentHash === contentHash ? "synced" : "stale") : "not_synced",
    payload,
  };
}
