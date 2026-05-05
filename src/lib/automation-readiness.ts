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

type BucketResult = {
  score: number;
  reasons: string[];
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function countMatches(text: string, regex: RegExp): number {
  return (text.match(regex) ?? []).length;
}

function cleanLine(value: string): string {
  return value
    .replace(/^#+\s*/, "")
    .replace(/^\s*[-*•]\s*/, "")
    .replace(/^\s*\d+[.)]\s*/, "")
    .trim();
}

function stripDocumentTitle(sourceText: string): string {
  return sourceText
    .replace(/^\s*#\s+Test Cases\s*$/gim, "")
    .replace(/^\s*Generated QA Report\s*$/gim, "")
    .trim();
}

function splitIntoCandidateCases(sourceText: string): string[] {
  const text = stripDocumentTitle(sourceText);

  if (!text) return [];

  const normalized = text.replace(/\r\n/g, "\n");
  const explicitMatches = [
    ...normalized.matchAll(
      /(^|\n)\s*(?:#{1,5}\s*)?(?:test\s+case)\s*(\d+)\s*[:.-]?\s*/gi
    ),
  ];

  if (explicitMatches.length > 0) {
    return explicitMatches
      .map((match, index) => {
        const start = match.index ?? 0;
        const end = explicitMatches[index + 1]?.index ?? normalized.length;
        return normalized.slice(start, end).trim();
      })
      .filter((chunk) => chunk.length > 20);
  }

  return [normalized];
}

function extractTitle(caseText: string, index: number): string {
  const heading = caseText.match(/^\s*(?:#{1,5}\s*)?Test\s+Case\s+\d+\s*[:.-]\s*(.+)$/im)?.[1]?.trim();
  if (heading) return heading.slice(0, 110);

  const lines = caseText
    .split("\n")
    .map(cleanLine)
    .filter(Boolean);

  const titleLine = lines.find((line) => /^(title|scenario|test case)\s*[:.-]/i.test(line));
  if (titleLine) return titleLine.replace(/^(title|scenario|test case)\s*[:.-]\s*/i, "").trim().slice(0, 110);

  const actionLine = lines.find((line) => /^(verify|validate|ensure|confirm|test|fetch|handle|create|update|delete)\b/i.test(line));
  if (actionLine) return actionLine.slice(0, 110);

  const firstUseful = lines.find((line) => !/^(type|priority|preconditions|steps|expected result|actual result)$/i.test(line));

  return firstUseful?.slice(0, 110) || `Test Case ${index + 1}`;
}

function sectionText(caseText: string, heading: string): string {
  const pattern = new RegExp(`${heading}\\s*:?\\s*([\\s\\S]*?)(?=\\n\\s*(?:preconditions|steps|expected result|actual result|automation readiness|test case \\d+)\\s*:?|$)`, "i");
  return caseText.match(pattern)?.[1]?.trim() ?? "";
}

function meaningfulTokenCount(text: string): number {
  const tokens = normalize(text)
    .split(/\s+/)
    .filter((token) => token.length >= 4)
    .filter((token) => !["test", "case", "user", "should", "result", "expected", "actual", "with", "when", "then", "from"].includes(token));

  return new Set(tokens).size;
}

function titleSpecificityBucket(title: string): BucketResult {
  const normalizedTitle = normalize(title);
  const tokenCount = meaningfulTokenCount(title);
  const reasons: string[] = [];
  let score = 0;

  if (tokenCount >= 3) {
    score += 6;
    reasons.push("Specific test title.");
  }

  if (tokenCount >= 6) {
    score += 4;
    reasons.push("Title identifies a distinct behavior.");
  }

  if (/\b(jira|subtask|comment|label|priority|auth|token|export|download|upload|source|project|bug|risk|saved|report|tailwind|css|nextjs|next\.js|folder|structure|config)\b/.test(normalizedTitle)) {
    score += 4;
    reasons.push("Title includes product/domain target.");
  }

  if (/^(happy path|negative path|edge case|regression test|test case)$/i.test(title.trim())) {
    score -= 6;
  }

  return { score: Math.max(0, Math.min(14, score)), reasons };
}

function stepsBucket(caseText: string): BucketResult {
  const steps = sectionText(caseText, "Steps") || caseText;
  const actionCount = countMatches(steps, /\b(click|select|enter|type|submit|navigate|open|save|create|delete|update|upload|download|login|sign in|search|filter|sort|fetch|trigger|verify|check|pull|generate|export|install|configure|run)\b/gi);
  const stepCount = Math.max(countMatches(steps, /^\s*\d+[.)]\s+/gm), countMatches(steps, /\n/g) + 1);
  const targetCount = countMatches(steps, /\b(button|field|input|dropdown|checkbox|table|card|page|screen|form|link|panel|modal|toast|message|jira|ticket|issue|comment|subtask|file|bundle|component|css|class|folder|config|configuration|server)\b/gi);
  const reasons: string[] = [];
  let score = 0;

  if (stepCount >= 2) {
    score += 8;
    reasons.push("Multiple executable steps.");
  }

  if (stepCount >= 4) {
    score += 4;
    reasons.push("Detailed multi-step flow.");
  }

  score += Math.min(9, actionCount * 2);
  if (actionCount > 0) reasons.push("Concrete action verbs detected.");

  score += Math.min(7, targetCount * 2);
  if (targetCount > 0) reasons.push("Steps include identifiable targets.");

  return { score: Math.min(28, score), reasons };
}

function assertionBucket(caseText: string): BucketResult {
  const expected = sectionText(caseText, "Expected Result") || caseText;
  const reasons: string[] = [];
  let score = 0;

  if (/\b(expected result|should|verify|assert|must|displays|shows|returns|creates|saves|blocks|prevents|excludes|includes|downloads|opens|appears|visible|hidden|error message|success)\b/i.test(expected)) {
    score += 9;
    reasons.push("Expected behavior is stated.");
  }

  if (/\b(no |not |without |only |exact|specific|does not|should not|must not|excluded|included|count|status|message|url|file|record|issue|ticket|styles|css|class|component|configuration)\b/i.test(expected)) {
    score += 8;
    reasons.push("Expected result contains a concrete assertion.");
  }

  if (meaningfulTokenCount(expected) >= 5) {
    score += 5;
    reasons.push("Assertion has useful detail.");
  }

  if (/\b(successfully|correctly|properly|as expected)\.?$/i.test(expected.trim()) && meaningfulTokenCount(expected) < 6) {
    score -= 5;
  }

  return { score: Math.max(0, Math.min(24, score)), reasons };
}

function setupBucket(caseText: string): BucketResult {
  const setup = sectionText(caseText, "Preconditions") || caseText;
  const reasons: string[] = [];
  let score = 0;

  if (/\b(precondition|preconditions|logged in|access|account|role|permission|token|config|configuration|project|fixture|test data|seed|jira|nextjs|next\.js|typescript|setup)\b/i.test(setup)) {
    score += 8;
    reasons.push("Setup/preconditions are defined.");
  }

  if (/\b(valid|invalid|specific|existing|non-epic|admin|signed in|signed out|api token|configured|enabled|disabled|installed|created)\b/i.test(setup)) {
    score += 5;
    reasons.push("Setup includes state or data constraints.");
  }

  if (meaningfulTokenCount(setup) >= 8) {
    score += 2;
    reasons.push("Preconditions have enough detail to prepare a run.");
  }

  return { score: Math.min(15, score), reasons };
}

function targetBucket(caseText: string): BucketResult {
  const text = normalize(caseText);
  const reasons: string[] = [];
  let score = 0;

  const uiTargets = countMatches(text, /\b(button|field|input|dropdown|checkbox|table|card|page|screen|form|link|panel|modal|toast|message|textarea|component|style|styles|css|class)\b/g);
  const apiTargets = countMatches(text, /\b(api|request|response|payload|database|record|state|network|endpoint|route|jira|issue|ticket|comment|label|priority|subtask|attachment|file|folder|bundle|config|configuration|server)\b/g);

  score += Math.min(8, uiTargets * 2);
  score += Math.min(7, apiTargets * 2);

  if (uiTargets > 0) reasons.push("Observable UI target detected.");
  if (apiTargets > 0) reasons.push("Observable API/data target detected.");

  return { score: Math.min(15, score), reasons };
}

function determinismBucket(caseText: string, title: string): BucketResult {
  const text = normalize(`${title}\n${caseText}`);
  const reasons: string[] = [];
  let score = 0;

  if (/\b(exact|specific|valid|invalid|required|selected|created|updated|deleted|saved|loaded|visible|hidden|excluded|included|matching|non-epic|without|with no|configured|installed|applied)\b/.test(text)) {
    score += 5;
    reasons.push("Behavior is deterministic enough to assert.");
  }

  if (/\b(id|key|url|route|endpoint|fixture|mock|seed|known|qas-\d+|config|configuration|file|folder)\b/i.test(caseText)) {
    score += 5;
    reasons.push("Stable key/route/fixture signal detected.");
  }

  return { score: Math.min(10, score), reasons };
}

function penaltySignals(caseText: string): { penalty: number; blockers: string[] } {
  const blockers: string[] = [];
  let penalty = 0;

  const rules: Array<{ regex: RegExp; points: number; message: string }> = [
    { regex: /\b(visual quality|looks good|appealing|pleasant|nice|pixel perfect|subjective)\b/i, points: 16, message: "Subjective visual judgment needs manual review." },
    { regex: /\b(captcha|2fa|mfa|sms|phone verification|email verification|one-time code|otp)\b/i, points: 24, message: "External verification or anti-automation flow." },
    { regex: /\b(payment|credit card|stripe|paypal|bank|checkout live|real transaction)\b/i, points: 18, message: "External payment/provider behavior." },
    { regex: /\b(push notification|mobile device|camera|gps|bluetooth|native app|app store)\b/i, points: 14, message: "May require device/native automation support." },
    { regex: /\b(manually inspect|human review|exploratory|observe|confirm visually)\b/i, points: 20, message: "Explicitly requires manual review." },
    { regex: /\b(not specified|unknown|tbd|unclear|not provided)\b/i, points: 8, message: "Important details are still unspecified." },
  ];

  for (const rule of rules) {
    if (rule.regex.test(caseText)) {
      penalty += rule.points;
      blockers.push(rule.message);
    }
  }

  return { penalty, blockers };
}

function missingInputsFor(scores: {
  steps: number;
  assertion: number;
  setup: number;
  target: number;
}): string[] {
  const missing: string[] = [];

  if (scores.steps < 13) missing.push("Concrete steps/actions");
  if (scores.assertion < 12) missing.push("Expected result/assertion");
  if (scores.setup < 7) missing.push("Test account/data setup");
  if (scores.target < 6) missing.push("Observable UI/API target");

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

  if (/\b(jira|issue|comments|labels|priority|subtask)\b/i.test(caseText)) {
    suggestions.add("Use a stable Jira fixture issue or mock Jira API response.");
  }

  if (suggestions.size === 0) {
    suggestions.add("Confirm base URL, auth state, and seed data.");
  }

  return [...suggestions];
}

function chooseFramework(caseText: string, score: number): AutomationFramework {
  if (score < 40 || /\b(manual|exploratory|visual quality|subjective|camera|gps|native app)\b/i.test(caseText)) {
    return "manual-review";
  }

  if (/\b(multi-tab|download|upload|browser context|auth setup|trace|network|api|storage state|cross-browser|jira|file)\b/i.test(caseText)) {
    return "playwright";
  }

  if (/\b(component|form|single page|frontend|react|modal|toast|css|tailwind)\b/i.test(caseText)) {
    return "cypress";
  }

  return "playwright";
}

function readinessFromScore(score: number, missingInputs: string[], caseText: string): AutomationReadinessLevel {
  if (/\b(captcha|manual review|manually inspect|subjective|exploratory)\b/i.test(caseText)) return "manual";
  if (missingInputs.includes("Concrete steps/actions") || missingInputs.includes("Expected result/assertion")) return score >= 55 ? "partial" : "blocked";
  if (score >= 82 && missingInputs.length === 0) return "ready";
  if (score >= 60) return "partial";
  if (score >= 40) return "manual";
  return "blocked";
}

function caseSummary(level: AutomationReadinessLevel): string {
  switch (level) {
    case "ready":
      return "Strong automation candidate. Steps, assertions, setup, and targets are clear enough for a skeleton.";
    case "partial":
      return "Automatable with cleanup. Add missing setup, selectors, assertions, or stable data first.";
    case "manual":
      return "Manual-heavy. Keep this tester-guided unless more deterministic signals are added.";
    case "blocked":
      return "Not automation-ready yet. Clarify steps, expected result, setup, and target behavior.";
    default:
      return "Needs review.";
  }
}

export function getAutomationReadinessTone(score: number, level?: AutomationReadinessLevel) {
  if (level === "ready" || score >= 82) return "good";
  if (level === "partial" || score >= 60) return "warn";
  return "bad";
}

export function getAutomationReadinessCardClass(score: number, level?: AutomationReadinessLevel) {
  return `test-case-card test-case-card-automation-${getAutomationReadinessTone(score, level)}`;
}

export function evaluateAutomationReadinessCase(caseText: string, index = 0): AutomationReadinessCase {
  const title = extractTitle(caseText, index);
  const titleScore = titleSpecificityBucket(title);
  const steps = stepsBucket(caseText);
  const assertion = assertionBucket(caseText);
  const setup = setupBucket(caseText);
  const target = targetBucket(caseText);
  const deterministic = determinismBucket(caseText, title);
  const penalties = penaltySignals(caseText);
  const missingInputs = missingInputsFor({
    steps: steps.score,
    assertion: assertion.score,
    setup: setup.score,
    target: target.score,
  });

  const rawScore =
    titleScore.score +
    steps.score +
    assertion.score +
    setup.score +
    target.score +
    deterministic.score -
    penalties.penalty -
    missingInputs.length * 3;

  const finalScore = clampScore(rawScore);
  const readiness = readinessFromScore(finalScore, missingInputs, caseText);
  const framework = chooseFramework(caseText, finalScore);

  const reasons = [
    ...titleScore.reasons,
    ...steps.reasons,
    ...assertion.reasons,
    ...setup.reasons,
    ...target.reasons,
    ...deterministic.reasons,
  ];

  return {
    id: `case-${index + 1}`,
    title,
    readiness,
    score: finalScore,
    framework,
    summary: caseSummary(readiness),
    reasons: reasons.length ? reasons : ["Not enough concrete automation signals were detected."],
    blockers: penalties.blockers,
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
}) {
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
    String(testCase.expectedResult ?? ""),
  ].join("\n");
}

function reportLabel(score: number, totals: AutomationReadinessReport["totals"]): AutomationReadinessReport["label"] {
  if (totals.blocked > 0 && score < 45) return "Blocked";
  if (totals.manual > totals.ready + totals.partial) return "Manual Heavy";
  if (score >= 82 && totals.ready >= totals.partial + totals.manual + totals.blocked) return "Ready";
  if (score >= 66) return "Good Candidate";
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

  if (cases.some((item) => item.missingInputs.includes("Observable UI/API target"))) {
    recommendations.add("Add stable observable UI/API targets before generating brittle automation.");
  }

  if (cases.some((item) => item.missingInputs.includes("Test account/data setup"))) {
    recommendations.add("Define seeded users, roles, config, and reset data before automation.");
  }

  if (cases.some((item) => item.missingInputs.includes("Expected result/assertion"))) {
    recommendations.add("Tighten expected results so each automation case has clear assertions.");
  }

  if (cases.some((item) => item.missingInputs.includes("Concrete steps/actions"))) {
    recommendations.add("Break vague scenarios into concrete actions before automation.");
  }

  if (cases.some((item) => item.blockers.length > 0)) {
    recommendations.add("Separate manual-only checks from E2E automation candidates.");
  }

  if (recommendations.size === 0) {
    recommendations.add("Start with the highest-scoring cases and keep generated code as skeletons until targets are confirmed.");
  }

  return [...recommendations];
}

export function evaluateAutomationReadiness(sourceText: string): AutomationReadinessReport {
  const candidateCases = splitIntoCandidateCases(sourceText);
  const cases = candidateCases.map(evaluateAutomationReadinessCase);

  if (cases.length === 0) {
    return {
      overallScore: 0,
      label: "Blocked",
      framework: "manual-review",
      summary: "No generated test cases found to evaluate.",
      cases: [],
      totals: {
        ready: 0,
        partial: 0,
        manual: 0,
        blocked: 0,
      },
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
