import type { ReportType } from "@/lib/coverage-score";

export type SourceQualityResult = {
  score: number;
  grade: "Strong" | "Good" | "Needs Work" | "Thin";
  signals: string[];
  missing: string[];
};

function stringify(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function normalize(value: unknown): string {
  return stringify(value)
    .replace(/\r\n/g, "\n")
    .replace(/\s+$/gm, "")
    .trim();
}

function lower(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/[ \t]+/g, " ").trim();
}

function has(text: string, regex: RegExp): boolean {
  return regex.test(text);
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function clamp(value: number, max = 100): number {
  return Math.max(0, Math.min(max, Math.round(value)));
}

function grade(score: number): SourceQualityResult["grade"] {
  if (score >= 80) return "Strong";
  if (score >= 65) return "Good";
  if (score >= 40) return "Needs Work";
  return "Thin";
}

function extractLineValue(text: string, field: string): string {
  const pattern = new RegExp(`(?:^|\\n)\\s*${field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*([^\\n]+)`, "i");
  return text.match(pattern)?.[1]?.trim() ?? "";
}

function extractSection(text: string, heading: string): string {
  const pattern = new RegExp(
    `(?:^|\\n)#{0,6}\\s*${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:?\\s*\\n?([\\s\\S]*?)(?=\\n#{1,6}\\s+|\\n[A-Z][A-Za-z /-]{2,}:\\s*$|$)`,
    "i"
  );

  return text.match(pattern)?.[1]?.trim() ?? "";
}

function useful(value: string): boolean {
  const normalized = lower(value);
  if (!normalized) return false;

  return ![
    "not provided",
    "not provided.",
    "unknown",
    "unknown.",
    "n/a",
    "n/a.",
    "none",
    "none.",
    "no specific environment details provided.",
    "no evidence attached or referenced.",
  ].includes(normalized);
}

function usefulLine(text: string, field: string): boolean {
  return useful(extractLineValue(text, field));
}

function usefulSection(text: string, heading: string): boolean {
  return useful(extractSection(text, heading));
}

function countListItems(text: string, heading: string): number {
  return extractSection(text, heading)
    .split(/\n+/)
    .map((line) => line.trim().replace(/^[-*•]\s+/, "").replace(/^\d+[.)]\s+/, "").trim())
    .filter(useful).length;
}

function signalsFor(text: string) {
  const normalized = lower(text);
  const acceptanceItems =
    countListItems(text, "Acceptance Criteria") +
    countListItems(text, "Acceptance") +
    countListItems(text, "Criteria");

  const testCaseCount = (text.match(/(?:^|\n)\s*(?:#{1,5}\s*)?test\s+case\s+\d+/gi) ?? []).length;
  const numberedSteps = (text.match(/(?:^|\n)\s*\d+[.)]\s+/g) ?? []).length;

  return {
    words: wordCount(text),
    jiraKey: has(text, /\b[A-Z][A-Z0-9]+-\d+\b/i),
    jiraUrl: has(text, /https?:\/\/[^\s]+\/browse\/[A-Z][A-Z0-9]+-\d+/i) || normalized.includes("atlassian.net"),
    issueType: usefulLine(text, "Issue Type") || /\bissue type\b/i.test(text),
    bugType: /issue type:\s*bug/i.test(text) || /\bbug\b/i.test(text),
    summary: usefulLine(text, "Summary") || usefulLine(text, "Title") || /\b(need to|should|user story)\b/i.test(text),
    status: usefulLine(text, "Status"),
    priority: usefulLine(text, "Priority"),
    description: usefulSection(text, "Description") || usefulSection(text, "Bug Summary") || usefulSection(text, "Summary"),
    acceptanceItems,
    hasAcceptance: acceptanceItems > 0 || /\b(given|when|then|must|should|verify|ensure)\b/i.test(text),
    testCaseCount,
    numberedSteps,
    hasTestCaseShape: testCaseCount > 0 && /preconditions/i.test(text) && /expected result/i.test(text),
    reproSteps: countListItems(text, "Steps to Reproduce"),
    expectedActual:
      (usefulSection(text, "Expected Result") || usefulLine(text, "Expected Result")) &&
      (usefulSection(text, "Actual Result") || usefulLine(text, "Actual Result")),
    environment: usefulSection(text, "Environment") || usefulLine(text, "Environment"),
    evidence:
      usefulSection(text, "Evidence") ||
      usefulSection(text, "Evidence / Attachments") ||
      usefulLine(text, "Evidence"),
    impact: usefulSection(text, "Impact") || usefulLine(text, "Impact"),
    riskLanguage: /\b(risk|impact|severity|mitigation|regression|data|state|auth|permission|failure|release)\b/i.test(text),
    generatedByQAtalyst: /created from qatalyst/i.test(text) || /qa note:\s*review the generated report/i.test(text),
    vague:
      /visually appealing|evaluate the ui presentation|preferred designs|user experiences confusion|not provided|unknown|tbd|unclear/i.test(text),
  };
}

/**
 * This scores the ORIGINAL SOURCE for the SELECTED TOOL.
 *
 * Important distinction:
 * - For Test Cases, a Jira bug is not already a test plan. It should not score 58+ just
 *   because it has Jira metadata.
 * - For Bug Writer, a structured bug source can score higher because it is already close
 *   to the desired output.
 * - For Risk Review, a bug ticket can be useful risk input, but metadata alone is not a
 *   complete risk review.
 */
export function calculateSourceQualityScore(reportType: ReportType, sourceInput: unknown): SourceQualityResult {
  const text = normalize(sourceInput);
  const s = signalsFor(text);
  const signals: string[] = [];
  const missing: string[] = [];

  if (!text) {
    return {
      score: 0,
      grade: "Thin",
      signals: [],
      missing: ["No original source was provided."],
    };
  }

  if (s.jiraKey) signals.push("Jira key detected.");
  if (s.jiraUrl) signals.push("Jira URL detected.");
  if (s.issueType) signals.push("Issue type detected.");
  if (s.summary) signals.push("Summary/title detected.");
  if (s.description) signals.push("Description/detail detected.");
  if (s.hasAcceptance) signals.push("Requirement/acceptance language detected.");
  if (s.reproSteps >= 2) signals.push("Reproduction steps detected.");
  if (s.expectedActual) signals.push("Expected/actual behavior detected.");
  if (s.hasTestCaseShape) signals.push("Existing test-case structure detected.");

  if (!s.summary) missing.push("Missing clear summary/title.");
  if (!s.description && !s.expectedActual) missing.push("Missing detailed behavior description.");
  if (!s.hasAcceptance) missing.push("Missing explicit acceptance criteria.");

  let score = 0;
  let cap = 100;

  if (reportType === "tests") {
    // A bug/requirement source is INPUT for test generation, not a finished test plan.
    if (s.hasTestCaseShape) {
      score += 35 + Math.min(30, s.testCaseCount * 6) + Math.min(15, s.numberedSteps);
      cap = 85;
    } else {
      score += s.jiraKey ? 4 : 0;
      score += s.jiraUrl ? 3 : 0;
      score += s.issueType ? 4 : 0;
      score += s.summary ? 8 : 0;
      score += s.description ? 8 : 0;
      score += s.hasAcceptance ? 8 : 0;
      score += s.reproSteps >= 2 ? 7 : 0;
      score += s.expectedActual ? 8 : 0;
      score += s.environment ? 3 : 0;
      score += s.evidence ? 3 : 0;
      cap = s.hasAcceptance || s.expectedActual || s.reproSteps >= 2 ? 42 : 28;
    }
  } else if (reportType === "risk") {
    // A source ticket can be useful risk input, but it is not itself a risk review.
    score += s.jiraKey ? 4 : 0;
    score += s.jiraUrl ? 3 : 0;
    score += s.issueType ? 4 : 0;
    score += s.summary ? 8 : 0;
    score += s.description ? 9 : 0;
    score += s.hasAcceptance ? 8 : 0;
    score += s.expectedActual ? 6 : 0;
    score += s.impact ? 6 : 0;
    score += s.riskLanguage ? 6 : 0;
    cap = s.description || s.hasAcceptance || s.impact || s.expectedActual ? 55 : 34;
  } else if (reportType === "bug") {
    // A bug-like source can be near the desired artifact if it already has repro + expected/actual.
    score += s.jiraKey ? 4 : 0;
    score += s.jiraUrl ? 3 : 0;
    score += s.issueType ? 5 : 0;
    score += s.summary ? 10 : 0;
    score += s.description ? 10 : 0;
    score += s.reproSteps >= 2 ? 14 : 0;
    score += s.expectedActual ? 16 : 0;
    score += s.environment ? 7 : 0;
    score += s.impact ? 7 : 0;
    score += s.evidence ? 8 : 0;
    cap = s.reproSteps >= 2 && s.expectedActual ? 82 : s.description ? 58 : 38;
  } else {
    // Test Improver: only an existing test should score well as source for improvement.
    if (s.hasTestCaseShape) {
      score += 35 + Math.min(30, s.testCaseCount * 6) + Math.min(15, s.numberedSteps);
      cap = 85;
    } else {
      score += s.summary ? 8 : 0;
      score += s.description ? 8 : 0;
      score += s.hasAcceptance ? 8 : 0;
      cap = 30;
    }
  }

  if (s.words >= 60) score += 3;
  if (s.words >= 160) score += 3;
  if (s.generatedByQAtalyst) score -= 8;
  if (s.vague) score -= 8;

  const finalScore = clamp(score, cap);

  return {
    score: finalScore,
    grade: grade(finalScore),
    signals: signals.length > 0 ? Array.from(new Set(signals)).slice(0, 5) : ["Some source text was provided."],
    missing: Array.from(new Set(missing)).slice(0, 6),
  };
}
