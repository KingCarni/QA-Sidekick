"use client";

export type QAToolName = "tests" | "risk" | "bug" | "improve" | string;

export type GenerationFingerprintInput = {
  activeTool: QAToolName;
  sourceText: string;
  jiraKey?: string | null;
  jiraUrl?: string | null;
  additionalContext?: string | null;
  answeredFollowUps?: unknown;
};

/**
 * Stable stringify for small UI state objects.
 * Avoid JSON.stringify directly because object key order can drift.
 */
export function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value !== "object") return String(value);

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${key}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

export function normalizeForFingerprint(value: unknown): string {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Tiny deterministic hash for browser state keys.
 * This is not security-sensitive. It is only for detecting input changes.
 */
export function hashFingerprint(value: string): string {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

export function buildGenerationFingerprint(input: GenerationFingerprintInput): string {
  const normalized = [
    `tool=${normalizeForFingerprint(input.activeTool)}`,
    `source=${normalizeForFingerprint(input.sourceText)}`,
    `jiraKey=${normalizeForFingerprint(input.jiraKey)}`,
    `jiraUrl=${normalizeForFingerprint(input.jiraUrl)}`,
    `context=${normalizeForFingerprint(input.additionalContext)}`,
    `followUps=${stableStringify(input.answeredFollowUps)}`,
  ].join("\n---\n");

  return hashFingerprint(normalized);
}

export function shouldReuseGeneratedTestCases(options: {
  activeTool: QAToolName;
  currentFingerprint: string;
  lastGeneratedFingerprint: string;
  existingTestCaseCount: number;
  forceFreshGeneration?: boolean;
}): boolean {
  if (options.activeTool !== "tests") return false;
  if (options.forceFreshGeneration) return false;
  if (options.existingTestCaseCount <= 0) return false;

  return options.currentFingerprint === options.lastGeneratedFingerprint;
}

export function buildOutputGenerationKey(options: {
  activeTool: QAToolName;
  inputFingerprint: string;
  outputText: string;
  testCaseCount: number;
}): string {
  return [
    options.activeTool,
    options.inputFingerprint,
    options.testCaseCount,
    hashFingerprint(normalizeForFingerprint(options.outputText).slice(0, 5000)),
  ].join(":");
}
