"use client";

export type AutomationFramework = "playwright" | "cypress" | "manual-review";
export type AutomationReadinessLevel = "ready" | "partial" | "manual" | "blocked";

export type AutomationReadinessCase = {
  id: string;
  title: string;
  readiness: AutomationReadinessLevel;
  score: number;
  framework: AutomationFramework;
  summary: string;
  reasons: string[];
  blockers: string[];
  missingInputs: string[];
  suggestedSetup: string[];
  sourceSnippet: string;
};

export type AutomationReadinessReport = {
  overallScore: number;
  label: "Ready" | "Good Candidate" | "Needs Detail" | "Manual Heavy" | "Blocked";
  framework: AutomationFramework;
  summary: string;
  cases: AutomationReadinessCase[];
  totals: {
    ready: number;
    partial: number;
    manual: number;
    blocked: number;
  };
  recommendations: string[];
};

type SignalRule = {
  regex: RegExp;
  points: number;
  message: string;
};

const AUTOMATION_POSITIVE_SIGNALS: SignalRule[] = [
  {
    regex: /\b(click|select|enter|type|submit|navigate|open|save|create|delete|update|upload|download|login|sign in|search|filter|sort|fetch|trigger|grant|revoke|attach|detach)\b/i,
    points: 8,
    message: "Concrete action path exists.",
  },
  {
    regex: /\b(expected result|expected|then|should|verify|assert|is displayed|is visible|appears|redirects|success message|successfully|returns|error message|download prompt|file exists)\b/i,
    points: 10,
    message: "Clear assertion or expected result exists.",
  },
  {
    regex: /\b(precondition|preconditions|given|setup|test data|seed|account|role|permission|token|config|configuration|fixture|mock)\b/i,
    points: 7,
    message: "Setup or precondition is defined.",
  },
  {
    regex: /\b(status|toast|modal|button|field|input|dropdown|checkbox|table|card|page|screen|form|link|panel|metadata|message|download|file|readme|manual-review)\b/i,
    points: 7,
    message: "Observable UI/output target exists.",
  },
  {
    regex: /\b(api|request|response|payload|database|record|state|reload|refresh|cache|session|error|network|comments|labels|priority|jira|oauth)\b/i,
    points: 7,
    message: "State/API behavior can be checked.",
  },
];

const AUTOMATION_RISK_SIGNALS: SignalRule[] = [
  {
    regex: /\b(visual quality|looks good|appealing|pleasant|nice|properly styled|pixel perfect|subjective)\b/i,
    points: -20,
    message: "Subjective visual judgment needs manual review.",
  },
  {
    regex: /\b(captcha|2fa|mfa|sms|phone verification|email verification|one-time code|otp)\b/i,
    points: -24,
    message: "External verification or anti-automation flow.",
  },
  {
    regex: /\b(payment|credit card|stripe|paypal|bank|checkout live|real transaction)\b/i,
    points: -20,
    message: "External payment/provider behavior.",
  },
  {
    regex: /\b(push notification|mobile device|camera|gps|bluetooth|native app|app store)\b/i,
    points: -16,
    message: "May require device/native automation support.",
  },
  {
    regex: /\b(manually inspect|human review|exploratory|observe|confirm visually)\b/i,
    points: -22,
    message: "Explicitly requires manual review.",
  },
];

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function cleanLine(value: string): string {
  return value.replace(/^#+\s*/, "").replace(/^\s*[-*•]\s*/, "").replace(/^\s*\d+[.)]\s*/, "").trim();
}

function stripDocumentTitle(sourceText: string): string {
  return sourceText.replace(/^\s*#\s+Test Cases\s*$/gim, "").replace(/^\s*Generated QA Report\s*$/gim, "").trim();
}

function splitIntoCandidateCases(sourceText: string): string[] {
  const text = stripDocumentTitle(sourceText);
  if (!text) return [];

  const normalized = text.replace(/\r\n/g, "\n");
  const explicitMatches = [...normalized.matchAll(/(^|\n)\s*(?:#{1,5}\s*)?(?:test\s+case)\s*(\d+)\s*[:.-]?\s*/gi)];

  if (explicitMatches.length > 0) {
    return explicitMatches
      .map((match, index) => {
        const start = match.index ?? 0;
        const end = explicitMatches[index + 1]?.index ?? normalized.length;
        return normalized.slice(start, end).trim();
      })
      .filter((chunk) => chunk.replace(/^#+\s*Test\s+Case\s+\d+\s*:?\s*/i, "").trim().length > 20);
  }

  const numberedChunks = normalized
    .split(/\n\s*\n(?=\s*(?:\d+[.)]\s+)?(?:verify|validate|ensure|confirm|test|fetch|handle|create|update|delete)\b)/i)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 40);

  return numberedChunks.length > 1 ? numberedChunks : [normalized];
}

function extractTitle(caseText: string, index: number): string {
  const heading = caseText.match(/^\s*(?:#{1,5}\s*)?Test\s+Case\s+\d+\s*[:.-]\s*(.+)$/im)?.[1]?.trim();
  if (heading) return heading.slice(0, 110);

  const lines = caseText.split("\n").map(cleanLine).filter(Boolean);
  const titleLine = lines.find((line) => /^(title|scenario|test case)\s*[:.-]/i.test(line));
  if (titleLine) return titleLine.replace(/^(title|scenario|test case)\s*[:.-]\s*/i, "").trim().slice(0, 110);

  const actionLine = lines.find((line) => /^(verify|validate|ensure|confirm|test|fetch|handle|create|update|delete)\b/i.test(line));
  if (actionLine) return actionLine.slice(0, 110);

  return lines.find((line) => !/^(type|priority|preconditions|steps|expected result|actual result)$/i.test(line))?.slice(0, 110) || `Test Case ${index + 1}`;
}

function getSectionValue(caseText: string, heading: string): string {
  const regex = new RegExp(
    `${heading}\\s*:?\\s*\\n?([\\s\\S]*?)(?=\\n\\s*(?:Type|Priority|Preconditions|Steps|Expected Result|Actual Result|Notes|Automation|Test Case)\\s*:?\\s*\\n|$)`,
    "i"
  );
  return regex.exec(caseText)?.[1]?.trim() ?? "";
}

function getStepLines(caseText: string): string[] {
  const stepsSection = getSectionValue(caseText, "Steps");
  const source = stepsSection || caseText;

  return source
    .split(/\n+/)
    .map(cleanLine)
    .filter((line) => /^(open|click|select|enter|type|navigate|submit|fetch|trigger|verify|validate|ensure|confirm|check|locate|grant|revoke|attach|download)\b/i.test(line));
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function missingInputsFor(caseText: string): string[] {
  const missing: string[] = [];

  if (!/\b(expected result|expected|then|should|verify|assert|successfully|returns|displays|shows|error message|download prompt|file exists)\b/i.test(caseText)) {
    missing.push("Expected result/assertion");
  }

  if (getStepLines(caseText).length === 0) {
    missing.push("Concrete steps");
  }

  if (!/\b(precondition|preconditions|given|setup|test data|account|user|role|permission|token|config|configuration|fixture|mock)\b/i.test(caseText)) {
    missing.push("Test account/data setup");
  }

  if (!/\b(button|field|input|dropdown|link|page|screen|form|table|modal|toast|status|metadata|panel|message|response|download|file|readme|manual-review)\b/i.test(caseText)) {
    missing.push("Observable UI/API target");
  }

  if (!/\b(data-testid|getByRole|getByText|getByLabel|selector|aria-label|button named|link named|input named|field named)\b/i.test(caseText)) {
    missing.push("Stable selector strategy");
  }

  return missing;
}

function setupSuggestionsFor(caseText: string): string[] {
  const suggestions = new Set<string>();

  if (/\b(login|sign in|account|role|permission|admin|user|token|config|configuration)\b/i.test(caseText)) {
    suggestions.add("Confirm required user, role, token, and config before running.");
  }
  if (/\b(create|delete|update|save|record|database|state)\b/i.test(caseText)) {
    suggestions.add("Reset affected data before/after the run.");
  }
  if (/\b(jira|issue|comments|labels|priority|oauth)\b/i.test(caseText)) {
    suggestions.add("Use a stable Jira fixture issue or mock Jira API response.");
  }
  if (/\bdownload|file|readme|manual-review|markdown\b/i.test(caseText)) {
    suggestions.add("Use Playwright download handling and inspect exported file contents.");
  }
  if (suggestions.size === 0) {
    suggestions.add("Confirm base URL, auth state, and seed data.");
  }

  return [...suggestions];
}

function chooseFramework(caseText: string, score: number): AutomationFramework {
  if (score < 35 || /\b(manual|exploratory|visual quality|subjective|camera|gps|native app)\b/i.test(caseText)) {
    return "manual-review";
  }
  if (/\b(multi-tab|download|upload|browser context|auth setup|trace|network|api|storage state|cross-browser|jira|oauth|file)\b/i.test(caseText)) {
    return "playwright";
  }
  if (/\b(component|form|single page|frontend|react|modal|toast)\b/i.test(caseText)) {
    return "cypress";
  }
  return "playwright";
}

function readinessFromScore(score: number, caseText: string): AutomationReadinessLevel {
  if (/\b(captcha|manual review|manually inspect|subjective|exploratory)\b/i.test(caseText)) return "manual";
  if (score >= 82) return "ready";
  if (score >= 58) return "partial";
  if (score >= 35) return "manual";
  return "blocked";
}

function caseSummary(level: AutomationReadinessLevel): string {
  switch (level) {
    case "ready":
      return "Strong automation candidate. Confirm selectors and seed data before treating the skeleton as runnable.";
    case "partial":
      return "Automatable with cleanup. Add missing setup, assertions, selectors, or fixture details first.";
    case "manual":
      return "Manual-heavy. Keep this as tester-guided unless more deterministic signals are added.";
    case "blocked":
      return "Not automation-ready yet. Clarify steps, expected result, setup, and target behavior.";
    default:
      return "Needs review.";
  }
}

export function getAutomationReadinessTone(score: number, level?: AutomationReadinessLevel): "good" | "warn" | "bad" {
  if (level === "ready" || score >= 82) return "good";
  if (level === "partial" || score >= 58) return "warn";
  return "bad";
}

export function getAutomationReadinessCardClass(score: number, level?: AutomationReadinessLevel): string {
  return `test-case-card test-case-card-automation-${getAutomationReadinessTone(score, level)}`;
}

function scoreLengthAndSpecificity(caseText: string): number {
  const steps = getStepLines(caseText);
  const expected = getSectionValue(caseText, "Expected Result");
  let score = 0;

  if (steps.length >= 1) score += 4;
  if (steps.length >= 3) score += 5;
  if (steps.length >= 5) score += 3;
  if (wordCount(expected) >= 8) score += 5;
  if (wordCount(expected) >= 18) score += 4;

  if (/\b(specific|exact|contains|equals|matches|count|filename|download|status|error|success|created|saved|visible|not visible)\b/i.test(caseText)) {
    score += 5;
  }

  return score;
}

function scoreAutomationComplexity(caseText: string): number {
  let penalty = 0;

  if (/\boauth|external|third[- ]party|jira api|api token|credentials|permission|role\b/i.test(caseText)) penalty -= 6;
  if (/\bdownload|local machine|file system|browser download\b/i.test(caseText)) penalty -= 5;
  if (/\bprevious versions|as expected|correct content|accurate|works as expected\b/i.test(caseText)) penalty -= 7;
  if (/\bno automation cases|only manual cases|empty state|negative\b/i.test(caseText)) penalty -= 3;

  return penalty;
}

export function evaluateAutomationReadinessCase(caseText: string, index = 0): AutomationReadinessCase {
  const reasons: string[] = [];
  const blockers: string[] = [];
  let score = 30;

  for (const rule of AUTOMATION_POSITIVE_SIGNALS) {
    if (rule.regex.test(caseText)) {
      score += rule.points;
      reasons.push(rule.message);
    }
  }

  for (const rule of AUTOMATION_RISK_SIGNALS) {
    if (rule.regex.test(caseText)) {
      score += rule.points;
      blockers.push(rule.message);
    }
  }

  score += scoreLengthAndSpecificity(caseText);
  score += scoreAutomationComplexity(caseText);

  const missingInputs = missingInputsFor(caseText);
  score -= missingInputs.length * 7;

  if (missingInputs.length === 0 && score >= 92) {
    score = 88;
  }

  const finalScore = clampScore(score);
  const readiness = readinessFromScore(finalScore, caseText);

  return {
    id: `case-${index + 1}`,
    title: extractTitle(caseText, index),
    readiness,
    score: finalScore,
    framework: chooseFramework(caseText, finalScore),
    summary: caseSummary(readiness),
    reasons: reasons.length ? reasons : ["Enough structure exists for a first-pass automation review."],
    blockers,
    missingInputs,
    suggestedSetup: setupSuggestionsFor(caseText),
    sourceSnippet: caseText.slice(0, 700),
  };
}

export function getAutomationCaseTextFromObject(testCase: {
  title?: unknown;
  type?: unknown;
  preconditions?: unknown;
  steps?: unknown;
  expectedResult?: unknown;
  priority?: unknown;
}): string {
  const steps = Array.isArray(testCase.steps)
    ? testCase.steps.map((step, index) => `${index + 1}. ${String(step)}`).join("\n")
    : String(testCase.steps ?? "");

  return [
    `Title: ${String(testCase.title ?? "")}`,
    `Type: ${String(testCase.type ?? "")}`,
    `Priority: ${String(testCase.priority ?? "")}`,
    "",
    "Preconditions:",
    String(testCase.preconditions ?? ""),
    "",
    "Steps:",
    steps,
    "",
    "Expected Result:",
    String(testCase.expectedResult ?? "")].join("\n");
}

function reportLabel(score: number, totals: AutomationReadinessReport["totals"]): AutomationReadinessReport["label"] {
  if (totals.blocked > 0 && score < 40) return "Blocked";
  if (totals.manual > totals.ready + totals.partial) return "Manual Heavy";
  if (score >= 82) return "Ready";
  if (score >= 65) return "Good Candidate";
  return "Needs Detail";
}

function majorityFramework(cases: AutomationReadinessCase[]): AutomationFramework {
  const counts = cases.reduce(
    (acc, item) => {
      acc[item.framework] += 1;
      return acc;
    },
    { playwright: 0, cypress: 0, "manual-review": 0 } as Record<AutomationFramework, number>
  );

  if (counts.playwright >= counts.cypress && counts.playwright >= counts["manual-review"]) return "playwright";
  if (counts.cypress >= counts["manual-review"]) return "cypress";
  return "manual-review";
}

function buildRecommendations(cases: AutomationReadinessCase[]): string[] {
  const recommendations = new Set<string>();

  if (cases.some((item) => item.missingInputs.includes("Stable selector strategy"))) {
    recommendations.add("Add stable selectors or accessible roles before generating brittle automation.");
  }
  if (cases.some((item) => item.missingInputs.includes("Observable UI/API target"))) {
    recommendations.add("Add stable observable UI/API targets before generating brittle automation.");
  }
  if (cases.some((item) => item.missingInputs.includes("Test account/data setup"))) {
    recommendations.add("Define seeded users, roles, config, and reset data before automation.");
  }
  if (cases.some((item) => item.missingInputs.includes("Expected result/assertion"))) {
    recommendations.add("Tighten expected results so each automation case has clear assertions.");
  }
  if (cases.some((item) => item.blockers.length > 0)) {
    recommendations.add("Separate manual-only checks from E2E automation candidates.");
  }
  if (recommendations.size === 0) {
    recommendations.add("Start with the highest-scoring cases and keep generated code as skeletons until selectors are confirmed.");
  }

  return [...recommendations];
}

export function evaluateAutomationReadiness(sourceText: string): AutomationReadinessReport {
  const cases = splitIntoCandidateCases(sourceText).map(evaluateAutomationReadinessCase);

  if (cases.length === 0) {
    return {
      overallScore: 0,
      label: "Blocked",
      framework: "manual-review",
      summary: "No generated test cases found to evaluate.",
      cases: [],
      totals: { ready: 0, partial: 0, manual: 0, blocked: 0 },
      recommendations: ["Generate test cases first, then run automation readiness scoring."],
    };
  }

  const totals = cases.reduce(
    (acc, item) => {
      acc[item.readiness] += 1;
      return acc;
    },
    { ready: 0, partial: 0, manual: 0, blocked: 0 }
  );

  const overallScore = clampScore(cases.reduce((sum, item) => sum + item.score, 0) / cases.length);
  const label = reportLabel(overallScore, totals);
  const framework = majorityFramework(cases);

  return {
    overallScore,
    label,
    framework,
    summary:
      label === "Ready"
        ? "Generated cases are strong candidates for automation skeletons."
        : label === "Good Candidate"
          ? "Several cases can become automation skeletons after target/data cleanup."
          : label === "Manual Heavy"
            ? "The output contains meaningful QA coverage, but many checks need human judgment or setup."
            : label === "Blocked"
              ? "Automation should wait until the cases include clearer actions and expected results."
              : "Automation is possible, but the cases need more detail first.",
    cases,
    totals,
    recommendations: buildRecommendations(cases),
  };
}
