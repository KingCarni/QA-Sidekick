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
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function has(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function count(text: string, terms: string[]) {
  return terms.reduce((total, term) => total + (text.includes(term) ? 1 : 0), 0);
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
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

function jiraSignals(text: string) {
  return {
    key: /\b[A-Z][A-Z0-9]+-\d+\b/i.test(text),
    url: text.includes("/browse/") || text.includes("atlassian.net"),
    issueType: has(text, ["issue type:", "issuetype", "bug", "task", "story", "subtask", "epic"]),
    summary: has(text, ["summary:", "title:", "user story", "need to", "should"]),
    status: has(text, ["status:", "to do", "in progress", "done"]),
    priority: has(text, ["priority:", "high", "medium", "low", "critical"]),
    labels: has(text, ["labels:", "label"]),
    acceptanceCriteria: has(text, ["acceptance criteria", "criteria:", "given", "when", "then", "must", "should"]),
    description: has(text, ["description:", "details:", "steps", "expected", "actual", "impact"]),
    reporter: has(text, ["reporter:", "assignee:"]),
  };
}

function bugSignals(text: string) {
  return {
    expectedActual: has(text, ["expected result", "actual result", "expected:", "actual:", "instead"]),
    repro: has(text, ["steps to reproduce", "repro", "open", "click", "navigate", "enter", "when"]),
    environment: has(text, ["environment", "browser", "device", "os", "version", "build", "platform"]),
    impact: has(text, ["impact", "blocks", "prevents", "unable", "cannot", "severity", "priority"]),
    evidence: has(text, ["screenshot", "logs", "console", "network", "attachment", "video", "error message"]),
  };
}

function testSignals(text: string) {
  return {
    steps: has(text, ["steps", "step 1", "1.", "open", "click", "navigate", "enter", "select"]),
    expected: has(text, ["expected result", "should", "verify", "assert", "must"]),
    setup: has(text, ["precondition", "given", "setup", "test data", "account", "role", "config"]),
    coverage: has(text, ["negative", "edge", "regression", "auth", "permission", "data", "state"]),
  };
}

export function calculateSourceQualityScore(reportType: ReportType, sourceInput: unknown): SourceQualityResult {
  const text = normalize(sourceInput);
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

  if (words >= 20) score += 8;
  if (words >= 60) score += 8;
  if (words >= 140) score += 8;

  const jira = jiraSignals(text);
  const jiraCount = Object.values(jira).filter(Boolean).length;

  if (jira.key) {
    score += 8;
    signals.push("Jira key detected.");
  }

  if (jira.url) {
    score += 6;
    signals.push("Jira URL detected.");
  }

  if (jira.issueType) {
    score += 8;
    signals.push("Issue type detected.");
  }

  if (jira.summary) {
    score += 12;
    signals.push("Summary/title detected.");
  } else {
    missing.push("Missing clear summary/title.");
  }

  if (jira.status) score += 5;
  if (jira.priority) score += 5;
  if (jira.labels) score += 3;
  if (jira.reporter) score += 3;

  if (jira.acceptanceCriteria) {
    score += 14;
    signals.push("Acceptance criteria or requirement language detected.");
  } else {
    missing.push("Missing acceptance criteria or requirement detail.");
  }

  if (jira.description) {
    score += 10;
    signals.push("Description/detail detected.");
  } else {
    missing.push("Missing detailed description.");
  }

  if (jiraCount >= 5) {
    score += 8;
    signals.push("Structured Jira metadata detected.");
  }

  if (reportType === "bug" || text.includes("issue type: bug") || /\bbug\b/.test(text)) {
    const bug = bugSignals(text);

    if (bug.expectedActual) {
      score += 10;
      signals.push("Expected/actual behavior detected.");
    } else {
      missing.push("Missing expected vs actual behavior.");
    }

    if (bug.repro) {
      score += 10;
      signals.push("Reproduction/action detail detected.");
    } else {
      missing.push("Missing reproduction steps.");
    }

    if (bug.environment) {
      score += 7;
      signals.push("Environment detail detected.");
    } else {
      missing.push("Missing environment details.");
    }

    if (bug.impact) score += 6;
    if (bug.evidence) score += 6;
  }

  if (reportType === "tests" || reportType === "risk" || reportType === "improve") {
    const test = testSignals(text);

    if (test.steps) score += 8;
    if (test.expected) score += 8;
    if (test.setup) score += 5;
    if (test.coverage) score += 6;
  }

  if (has(text, ["unknown", "not provided", "tbd", "unclear", "missing"])) {
    score -= Math.min(18, count(text, ["unknown", "not provided", "tbd", "unclear", "missing"]) * 4);
  }

  const finalScore = clamp(score);

  return {
    score: finalScore,
    grade: grade(finalScore),
    signals: signals.length > 0 ? signals : ["Some source text was provided."],
    missing: Array.from(new Set(missing)).slice(0, 6),
  };
}
