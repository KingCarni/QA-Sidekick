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

function has(text: string, terms: string[]) {
  const normalized = lower(text);
  return terms.some((term) => normalized.includes(term));
}

function count(text: string, terms: string[]) {
  const normalized = lower(text);
  return terms.reduce((total, term) => total + (normalized.includes(term) ? 1 : 0), 0);
}

function clamp(value: number, max = 100) {
  return Math.max(0, Math.min(max, Math.round(value)));
}

function grade(score: number): SourceQualityResult["grade"] {
  if (score >= 80) return "Strong";
  if (score >= 65) return "Good";
  if (score >= 40) return "Needs Work";
  return "Thin";
}

function wordCount(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

function extractSection(text: string, heading: string): string {
  const pattern = new RegExp(
    `(?:^|\\n)#{0,6}\\s*${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:?\\s*\\n?([\\s\\S]*?)(?=\\n#{1,6}\\s+|\\n[A-Z][A-Za-z /-]{2,}:\\s*$|$)`,
    "i"
  );

  return text.match(pattern)?.[1]?.trim() ?? "";
}

function extractLineValue(text: string, field: string): string {
  const pattern = new RegExp(`(?:^|\\n)\\s*${field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*([^\\n]+)`, "i");
  return text.match(pattern)?.[1]?.trim() ?? "";
}

function isUsefulValue(value: string): boolean {
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

function hasUsefulLineField(text: string, field: string) {
  return isUsefulValue(extractLineValue(text, field));
}

function hasUsefulSection(text: string, heading: string) {
  return isUsefulValue(extractSection(text, heading));
}

function listItemsInSection(text: string, heading: string): string[] {
  return extractSection(text, heading)
    .split(/\n+/)
    .map((line) => line.trim())
    .map((line) => line.replace(/^[-*•]\s+/, "").replace(/^\d+[.)]\s+/, "").trim())
    .filter(isUsefulValue);
}

function sourceLooksGeneratedByQAtalyst(text: string) {
  return /created from qatalyst/i.test(text) || /qa note:\s*review the generated report/i.test(text);
}

function originalSourceInput(text: string): string {
  const match = text.match(/(?:^|\n)#{1,6}\s*Original Source Input\s*\n([\s\S]*?)(?=\n---|\n#{1,6}\s+|$)/i);
  return match?.[1]?.trim() ?? "";
}

function jiraSignals(text: string) {
  return {
    key: /\b[A-Z][A-Z0-9]+-\d+\b/i.test(text),
    url: /https?:\/\/[^\s]+\/browse\/[A-Z][A-Z0-9]+-\d+/i.test(text) || /atlassian\.net/i.test(text),
    issueType: hasUsefulLineField(text, "Issue Type") || /\b(issue type|bug|task|story|subtask|epic)\b/i.test(text),
    summary: hasUsefulLineField(text, "Summary") || hasUsefulLineField(text, "Title") || /\b(need to|should|user story)\b/i.test(text),
    status: hasUsefulLineField(text, "Status"),
    priority: hasUsefulLineField(text, "Priority"),
    labels: hasUsefulLineField(text, "Labels") || hasUsefulLineField(text, "Label"),
    reporter: hasUsefulLineField(text, "Reporter") || hasUsefulLineField(text, "Assignee"),
  };
}

function requirementSignals(text: string) {
  const acceptanceItems = [
    ...listItemsInSection(text, "Acceptance Criteria"),
    ...listItemsInSection(text, "Acceptance"),
    ...listItemsInSection(text, "Criteria"),
  ];

  return {
    acceptanceItems,
    hasAcceptanceSection: acceptanceItems.length > 0,
    hasGherkin: /\b(given|when|then)\b/i.test(text),
    hasRequirementLanguage: /\b(must|should|user can|system should|verify|ensure)\b/i.test(text),
  };
}

function bugSignals(text: string) {
  const steps = listItemsInSection(text, "Steps to Reproduce");
  const expected = extractSection(text, "Expected Result") || extractLineValue(text, "Expected Result");
  const actual = extractSection(text, "Actual Result") || extractLineValue(text, "Actual Result");
  const environment = extractSection(text, "Environment") || extractLineValue(text, "Environment");
  const impact = extractSection(text, "Impact") || extractLineValue(text, "Impact");
  const evidence = extractSection(text, "Evidence / Attachments") || extractSection(text, "Evidence") || extractLineValue(text, "Evidence");

  return {
    steps,
    expected,
    actual,
    environment,
    impact,
    evidence,
    hasExpectedActual: isUsefulValue(expected) && isUsefulValue(actual),
    hasRepro: steps.length >= 2,
    hasEnvironment: isUsefulValue(environment) && !/no specific environment/i.test(environment),
    hasImpact: isUsefulValue(impact),
    hasEvidence: isUsefulValue(evidence) && !/no evidence/i.test(evidence),
  };
}

function testSignals(text: string) {
  const steps = listItemsInSection(text, "Steps");
  const expected = extractSection(text, "Expected Result") || extractLineValue(text, "Expected Result");
  const preconditions = extractSection(text, "Preconditions") || extractLineValue(text, "Preconditions");

  return {
    steps,
    expected,
    preconditions,
    hasSteps: steps.length >= 2 || /\b(open|click|navigate|enter|select|save|fetch|generate|export)\b/i.test(text),
    hasExpected: isUsefulValue(expected) || /\b(expected result|should|verify|assert|must)\b/i.test(text),
    hasSetup: isUsefulValue(preconditions) || /\b(precondition|setup|test data|account|role|config)\b/i.test(text),
  };
}

function negativeQualityPenalty(text: string, reportType: ReportType): number {
  let penalty = 0;

  if (/no specific environment details provided/i.test(text)) penalty += 8;
  if (/no evidence attached or referenced/i.test(text)) penalty += 8;
  if (/missing info/i.test(text)) penalty += 4;
  if (/follow-up questions/i.test(text)) penalty += 3;
  if (/visually appealing|preferred ui designs|evaluate the ui presentation|user experiences confusion/i.test(text)) {
    penalty += reportType === "tests" ? 18 : 8;
  }
  if (/not provided|unknown|tbd|unclear/i.test(text)) {
    penalty += Math.min(14, count(text, ["not provided", "unknown", "tbd", "unclear"]) * 3);
  }

  return penalty;
}

function calculateCap(text: string, reportType: ReportType) {
  const jira = jiraSignals(text);
  const req = requirementSignals(text);
  const bug = bugSignals(text);
  const test = testSignals(text);
  const isGenerated = sourceLooksGeneratedByQAtalyst(text);
  const original = originalSourceInput(text);

  const metadataOnly =
    jira.key &&
    jira.issueType &&
    jira.summary &&
    jira.status &&
    jira.priority &&
    !req.hasAcceptanceSection &&
    !bug.hasExpectedActual &&
    !bug.hasRepro &&
    !test.hasSteps;

  if (metadataOnly) return 38;

  if (isGenerated && original && wordCount(original) < 20) {
    return 48;
  }

  if (isGenerated && /no specific environment details provided/i.test(text) && /no evidence attached/i.test(text)) {
    return 58;
  }

  if (reportType === "risk" && !req.hasAcceptanceSection && !bug.hasExpectedActual && !bug.hasRepro) {
    return 50;
  }

  if (reportType === "tests" && (!test.hasSteps || !test.hasExpected)) {
    return 52;
  }

  if (bug.hasExpectedActual && bug.hasRepro && (bug.hasEnvironment || bug.hasImpact || bug.hasEvidence)) {
    return isGenerated ? 72 : 78;
  }

  if (req.hasAcceptanceSection && (bug.hasRepro || test.hasSteps)) {
    return 82;
  }

  return 68;
}

export function calculateSourceQualityScore(reportType: ReportType, sourceInput: unknown): SourceQualityResult {
  const rawText = normalize(sourceInput);
  const text = rawText;
  const words = wordCount(text);
  const signals: string[] = [];
  const missing: string[] = [];
  let score = 0;

  if (!text) {
    return {
      score: 0,
      grade: "Thin",
      signals: [],
      missing: ["No original source was provided."],
    };
  }

  const jira = jiraSignals(text);
  const req = requirementSignals(text);
  const bug = bugSignals(text);
  const test = testSignals(text);
  const isGenerated = sourceLooksGeneratedByQAtalyst(text);

  if (words >= 20) score += 5;
  if (words >= 70) score += 5;
  if (words >= 160) score += 5;

  if (jira.key) {
    score += 4;
    signals.push("Jira key detected.");
  }
  if (jira.url) {
    score += 3;
    signals.push("Jira URL detected.");
  }
  if (jira.issueType) {
    score += 5;
    signals.push("Issue type detected.");
  }
  if (jira.summary) {
    score += 8;
    signals.push("Summary/title detected.");
  } else {
    missing.push("Missing clear summary/title.");
  }
  if (jira.status) score += 2;
  if (jira.priority) score += 2;
  if (jira.labels) score += 1;
  if (jira.reporter) score += 1;

  if (hasUsefulSection(text, "Description") || hasUsefulSection(text, "Bug Summary") || hasUsefulSection(text, "Summary")) {
    score += 9;
    signals.push("Description/detail detected.");
  } else {
    missing.push("Missing detailed description.");
  }

  if (req.hasAcceptanceSection) {
    score += Math.min(14, 6 + req.acceptanceItems.length * 2);
    signals.push("Explicit acceptance criteria detected.");
  } else if (req.hasGherkin || req.hasRequirementLanguage) {
    score += 5;
    signals.push("Requirement language detected.");
    missing.push("Missing explicit acceptance criteria.");
  } else {
    missing.push("Missing acceptance criteria.");
  }

  if (bug.hasExpectedActual) {
    score += 10;
    signals.push("Expected/actual behavior detected.");
  } else if (reportType === "bug" || lower(text).includes("issue type: bug")) {
    missing.push("Missing expected vs actual behavior.");
  }

  if (bug.hasRepro) {
    score += Math.min(12, 4 + bug.steps.length * 2);
    signals.push("Reproduction/action detail detected.");
  } else if (reportType === "bug" || lower(text).includes("issue type: bug")) {
    missing.push("Missing reproduction steps.");
  }

  if (bug.hasEnvironment) {
    score += 5;
    signals.push("Environment detail detected.");
  } else if (reportType === "bug") {
    missing.push("Missing environment details.");
  }

  if (bug.hasImpact) score += 4;
  if (bug.hasEvidence) score += 5;

  if (test.hasSteps) score += 5;
  if (test.hasExpected) score += 5;
  if (test.hasSetup) score += 3;

  if (isGenerated) {
    score -= 8;
    signals.push("Generated QAtalyst source detected; quality is capped unless concrete details are present.");
  }

  score -= negativeQualityPenalty(text, reportType);

  const cap = calculateCap(text, reportType);
  const finalScore = clamp(score, cap);

  return {
    score: finalScore,
    grade: grade(finalScore),
    signals: signals.length > 0 ? Array.from(new Set(signals)) : ["Some source text was provided."],
    missing: Array.from(new Set(missing)).slice(0, 6),
  };
}
