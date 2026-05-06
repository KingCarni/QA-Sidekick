export type AutomationFramework = "playwright" | "cypress" | "api" | "manual-review";

import {
  findCredentialProfileForText,
  type SafeAutomationCredentialProfile,
} from "@/lib/automation-credentials";

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

type AutomationReadinessOptions = {
  credentialProfiles?: SafeAutomationCredentialProfile[];
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
  if (heading) return heading.slice(0, 120);

  const lines = caseText
    .split("\n")
    .map(cleanLine)
    .filter(Boolean);

  const titleLine = lines.find((line) => /^(title|scenario|test case)\s*[:.-]/i.test(line));
  if (titleLine) return titleLine.replace(/^(title|scenario|test case)\s*[:.-]\s*/i, "").trim().slice(0, 120);

  const actionLine = lines.find((line) => /^(verify|validate|ensure|confirm|test|fetch|handle|create|update|delete|check)\b/i.test(line));
  if (actionLine) return actionLine.slice(0, 120);

  const firstUseful = lines.find((line) => !/^(type|priority|preconditions|steps|expected result|actual result)$/i.test(line));
  return firstUseful?.slice(0, 120) || `Test Case ${index + 1}`;
}

function sectionText(caseText: string, heading: string): string {
  const pattern = new RegExp(
    `${heading}\\s*:?\\s*([\\s\\S]*?)(?=\\n\\s*(?:preconditions|steps|expected result|actual result|automation readiness|test case \\d+|type|priority)\\s*:?|$)`,
    "i"
  );
  return caseText.match(pattern)?.[1]?.trim() ?? "";
}

function meaningfulTokenCount(text: string): number {
  const tokens = normalize(text)
    .split(/\s+/)
    .filter((token) => token.length >= 4)
    .filter((token) => !["test", "case", "user", "should", "result", "expected", "actual", "with", "when", "then", "from", "verify", "check"].includes(token));

  return new Set(tokens).size;
}

function titleSpecificityBucket(title: string): BucketResult {
  const normalizedTitle = normalize(title);
  const tokenCount = meaningfulTokenCount(title);
  const reasons: string[] = [];
  let score = 0;

  if (tokenCount >= 3) {
    score += 7;
    reasons.push("Specific test title.");
  }

  if (tokenCount >= 5) {
    score += 4;
    reasons.push("Title identifies a distinct behavior.");
  }

  if (/\b(jira|subtask|comment|label|priority|auth|token|credit|ledger|account|limit|api|export|download|upload|source|project|bug|risk|saved|report|tailwind|css|nextauth|next auth|database|stripe)\b/.test(normalizedTitle)) {
    score += 5;
    reasons.push("Title includes product/domain target.");
  }

  if (/^(happy path|negative path|edge case|regression test|test case|ui test)$/i.test(title.trim())) {
    score -= 8;
  }

  return { score: Math.max(0, Math.min(16, score)), reasons };
}

function stepsBucket(caseText: string): BucketResult {
  const steps = sectionText(caseText, "Steps") || caseText;
  const actionCount = countMatches(steps, /\b(click|select|deselect|toggle|untoggle|check|uncheck|choose|clear|enter|type|submit|navigate|open|save|create|delete|update|upload|download|login|log in|sign in|search|filter|sort|fetch|trigger|verify|pull|generate|export|install|configure|run|send|capture|attempt|perform|locate)\b/gi);
  const stepCount = Math.max(countMatches(steps, /^\s*\d+[.)]\s+/gm), steps.split(/\n+/).filter((line) => line.trim()).length);
  const targetCount = countMatches(steps, /\b(button|field|input|dropdown|checkbox|table|card|page|screen|form|link|panel|modal|toast|message|jira|ticket|issue|comment|subtask|file|bundle|component|css|class|folder|config|configuration|server|endpoint|api|account|credit|ledger|balance|limit|dashboard|source|sources|count|counter|selected|selection|list|row|item)\b/gi);
  const reasons: string[] = [];
  let score = 0;

  if (stepCount >= 2) {
    score += 9;
    reasons.push("Multiple executable steps.");
  }

  if (stepCount >= 3) {
    score += 5;
    reasons.push("Detailed multi-step flow.");
  }

  score += Math.min(10, actionCount * 2);
  if (actionCount > 0) reasons.push("Concrete action verbs detected.");

  score += Math.min(8, targetCount * 2);
  if (targetCount > 0) reasons.push("Steps include identifiable targets.");

  return { score: Math.min(32, score), reasons };
}

function assertionBucket(caseText: string): BucketResult {
  const expected = sectionText(caseText, "Expected Result") || caseText;
  const reasons: string[] = [];
  let score = 0;

  if (/\b(expected result|should|verify|assert|must|displays|shows|returns|creates|saves|blocks|prevents|excludes|includes|downloads|opens|appears|visible|hidden|error message|success|redirected|reduced|deducted|balance|logged entry|limit exceeded|insufficient credits|authenticated|selected|deselected|checked|unchecked|count|counter|increments|decrements|updates|selection state|selected source count)\b/i.test(expected)) {
    score += 11;
    reasons.push("Expected behavior is stated.");
  }

  if (/\b(no |not |without |only |exact|specific|does not|should not|must not|excluded|included|selected|deselected|checked|unchecked|count|counter|increments|decrements|updates|selection state|selected source count|status|message|url|file|record|issue|ticket|styles|css|class|component|configuration|balance|credit|ledger|dashboard|api|json)\b/i.test(expected)) {
    score += 9;
    reasons.push("Expected result contains a concrete assertion.");
  }

  if (meaningfulTokenCount(expected) >= 5) {
    score += 5;
    reasons.push("Assertion has useful detail.");
  }

  if (/\b(successfully|correctly|properly|as expected)\.?$/i.test(expected.trim()) && meaningfulTokenCount(expected) < 6) {
    score -= 5;
  }

  return { score: Math.max(0, Math.min(25, score)), reasons };
}

function setupBucket(caseText: string): BucketResult {
  const setup = sectionText(caseText, "Preconditions") || caseText;
  const reasons: string[] = [];
  let score = 0;

  if (/\b(precondition|preconditions|logged in|log in|access|account|role|permission|token|config|configuration|project|fixture|test data|seed|jira|nextauth|next auth|api|credit|ledger|balance|limit|dashboard|login page)\b/i.test(setup)) {
    score += 8;
    reasons.push("Setup/preconditions are defined.");
  }

  if (/\b(valid|invalid|specific|existing|non-epic|admin|signed in|signed out|api token|configured|enabled|disabled|installed|created|zero credits|sufficient credits|insufficient credits|defined limit)\b/i.test(setup)) {
    score += 6;
    reasons.push("Setup includes state or data constraints.");
  }

  if (meaningfulTokenCount(setup) >= 8) {
    score += 2;
    reasons.push("Preconditions have enough detail to prepare a run.");
  }

  return { score: Math.min(16, score), reasons };
}

function targetBucket(caseText: string): BucketResult {
  const text = normalize(caseText);
  const reasons: string[] = [];
  let score = 0;

  const uiTargets = countMatches(text, /\b(button|field|input|dropdown|checkbox|table|card|page|screen|form|link|panel|modal|toast|message|textarea|component|style|styles|css|class|dashboard|account page|login page|credit balance|source|sources|selected source|selected sources|count|counter|selection state|list item)\b/g);
  const apiTargets = countMatches(text, /\b(api|request|response|payload|database|record|state|network|endpoint|route|jira|issue|ticket|comment|label|priority|subtask|attachment|file|folder|bundle|config|configuration|server|credit ledger|ledger|credit deduction|usage entry|limit)\b/g);

  score += Math.min(8, uiTargets * 2);
  score += Math.min(8, apiTargets * 2);

  if (uiTargets > 0) reasons.push("Observable UI target detected.");
  if (apiTargets > 0) reasons.push("Observable API/data target detected.");

  return { score: Math.min(16, score), reasons };
}

function determinismBucket(caseText: string, title: string): BucketResult {
  const text = normalize(`${title}\n${caseText}`);
  const reasons: string[] = [];
  let score = 0;
  const redirectOrMessageSignal =
    /\b(redirected|redirect|login page|log in|logged out|logged in|message indicating|error message|success message|displays|shown|visible|appears)\b/i.test(caseText);
  const singleActionClearExpected =
    /\b(navigate|open|click|attempt|enter|fetch|make an api call|perform)\b/i.test(caseText) &&
    /\b(redirected|displays|returns|shows|error|message|balance|deducted|reduced|logged|prevents)\b/i.test(caseText);
  const selectionStateSignal =
    /\b(select|deselect|toggle|untoggle|check|uncheck|choose)\b/i.test(caseText) &&
    /\b(selected|deselected|checked|unchecked|count|counter|updates|selection state|source count)\b/i.test(caseText);

  if (/\b(exact|specific|valid|invalid|required|selected|created|updated|deleted|saved|loaded|visible|hidden|excluded|included|matching|non-epic|without|with no|configured|installed|applied|zero credits|sufficient credits|insufficient credits|defined limit|reduced|deducted|redirected|displayed)\b/.test(text)) {
    score += 6;
    reasons.push("Behavior is deterministic enough to assert.");
  }

  if (/\b(id|key|url|route|endpoint|fixture|mock|seed|known|qas-\d+|config|configuration|file|folder|api|account|credit|ledger|balance|limit)\b/i.test(caseText)) {
    score += 5;
    reasons.push("Stable key/route/fixture signal detected.");
  }

  if (redirectOrMessageSignal) {
    score += 7;
    reasons.push("Redirect/message assertion is automatable.");
  }

  if (singleActionClearExpected) {
    score += 6;
    reasons.push("Simple action with clear expected outcome.");
  }

  if (selectionStateSignal) {
    score += 10;
    reasons.push("Selection/count state is deterministic enough to automate.");
  }

  return { score: Math.min(11, score), reasons };
}

function penaltySignals(caseText: string): { penalty: number; blockers: string[]; manualOnly: boolean } {
  const blockers: string[] = [];
  let penalty = 0;
  let manualOnly = false;

  const hardManualRules: Array<{ regex: RegExp; points: number; message: string }> = [
    { regex: /\b(visual quality|looks good|appealing|pleasant|nice|pixel perfect|subjective)\b/i, points: 18, message: "Subjective visual judgment needs manual review." },
    { regex: /\b(captcha|2fa|mfa|sms|phone verification|email verification|one-time code|otp)\b/i, points: 24, message: "External verification or anti-automation flow." },
    { regex: /\b(manually inspect|human review|exploratory|observe|confirm visually)\b/i, points: 20, message: "Explicitly requires manual review." },
  ];

  for (const rule of hardManualRules) {
    if (rule.regex.test(caseText)) {
      penalty += rule.points;
      blockers.push(rule.message);
      manualOnly = true;
    }
  }

  const cleanupRules: Array<{ regex: RegExp; points: number; message: string }> = [
    { regex: /\b(payment|credit card|stripe|paypal|bank|checkout live|real transaction)\b/i, points: 10, message: "External payment/provider behavior needs careful mocking or sandbox setup." },
    { regex: /\b(push notification|mobile device|camera|gps|bluetooth|native app|app store)\b/i, points: 12, message: "May require device/native automation support." },
    { regex: /\b(not specified|unknown|tbd|unclear|not provided)\b/i, points: 5, message: "Important details are still unspecified." },
  ];

  for (const rule of cleanupRules) {
    if (rule.regex.test(caseText)) {
      penalty += rule.points;
      blockers.push(rule.message);
    }
  }

  return { penalty, blockers, manualOnly };
}

function missingInputsFor(scores: {
  steps: number;
  assertion: number;
  setup: number;
  target: number;
}, caseText: string): string[] {
  const missing: string[] = [];
  const hasSoftTarget =
    /\b(account page|login page|dashboard|credit balance|api call|credit ledger|jira ticket|report|button|input|page|message|error|redirect)\b/i.test(caseText);
  const hasSelectionSoftTarget =
    /\b(source|sources|checkbox|selected source|selected sources|count|counter|selection state|choose sources)\b/i.test(caseText);

  if (scores.steps < 12) missing.push("Concrete steps/actions");
  if (scores.assertion < 11) missing.push("Expected result/assertion");
  if (scores.setup < 6) missing.push("Test account/data setup");
  if (scores.target < 5 && !hasSoftTarget && !hasSelectionSoftTarget) missing.push("Observable UI/API target");

  return missing;
}

function setupSuggestionsFor(caseText: string): string[] {
  const suggestions = new Set<string>();

  if (/\b(login|sign in|account|role|permission|admin|user|token|auth|nextauth|next auth)\b/i.test(caseText)) {
    suggestions.add("Confirm required user, role, token, and auth state before running.");
  }

  if (/\b(credit|ledger|balance|limit|deduct|usage|api call)\b/i.test(caseText)) {
    suggestions.add("Seed credit balance and ledger records before the run; reset them after the run.");
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

function chooseFramework(caseText: string, score: number, manualOnly: boolean): AutomationFramework {
  if (manualOnly) return "manual-review";

  if (/\b(api|endpoint|request|response|payload|database|ledger|credit deduction|usage entry|limit enforcement)\b/i.test(caseText)) {
    return "api";
  }

  if (score < 35) return "manual-review";

  if (/\b(multi-tab|download|upload|browser context|auth setup|trace|network|storage state|cross-browser|jira|file|login|account|dashboard|credit)\b/i.test(caseText)) {
    return "playwright";
  }

  if (/\b(component|form|single page|frontend|react|modal|toast|css|tailwind)\b/i.test(caseText)) {
    return "cypress";
  }

  return "playwright";
}

function readinessFromScore(
  score: number,
  missingInputs: string[],
  caseText: string,
  manualOnly: boolean
): AutomationReadinessLevel {
  if (manualOnly) return "manual";

  const hasCoreFlow =
    /\b(click|navigate|open|enter|login|log in|perform|attempt|send|fetch|verify|check|locate|select|deselect|toggle|untoggle|choose)\b/i.test(caseText) &&
    /\b(expected result|should|displays|returns|redirected|reduced|deducted|error|message|balance|entry|authenticated|selected|deselected|checked|unchecked|count|counter|updates|selection state)\b/i.test(caseText);
  const isSelectionFlow =
    /\b(select|deselect|toggle|untoggle|check|uncheck|choose)\b/i.test(caseText) &&
    /\b(source|sources|checkbox|selected|selection state|count|counter)\b/i.test(caseText);

  // Missing selectors, seed data, auth state, and exact routes are normal TODOs for skeleton generation.
  // They should usually be Partial, not Blocked, if the behavior itself is deterministic.
  if (score >= 70 && missingInputs.length <= 1) return "ready";
  if (score >= 62 && hasCoreFlow && !missingInputs.includes("Expected result/assertion")) return "ready";
  if (score >= 48 && hasCoreFlow) return "partial";
  if (score >= 40 && hasCoreFlow && !missingInputs.includes("Expected result/assertion")) return "partial";
  if (isSelectionFlow && hasCoreFlow && !missingInputs.includes("Expected result/assertion")) return "partial";
  if (score >= 40) return "manual";
  return "blocked";
}

function caseSummary(level: AutomationReadinessLevel): string {
  switch (level) {
    case "ready":
      return "Strong automation candidate. This case has clear actions, targets, setup, and assertions.";
    case "partial":
      return "Automation candidate with setup cleanup. Add selectors, seed data, mocks, route details, or final assertions before treating it as runnable.";
    case "manual":
      return "Useful manual QA case. Keep tester-guided unless the behavior can be made deterministic.";
    case "blocked":
      return "Not automation-ready yet. Clarify actions, target behavior, setup, and expected result.";
    default:
      return "Needs review.";
  }
}

function needsAuthSetup(text: string): boolean {
  return /\b(login|log in|logged in|signed in|auth|authenticated|credentials|account|role|permission|admin|user has access)\b/i.test(text);
}

export function getAutomationReadinessTone(score: number, level?: AutomationReadinessLevel) {
  if (level === "ready" || score >= 72) return "good";
  if (level === "partial" || score >= 52) return "warn";
  return "bad";
}

export function getAutomationReadinessCardClass(score: number, level?: AutomationReadinessLevel) {
  return `test-case-card test-case-card-automation-${getAutomationReadinessTone(score, level)}`;
}

export function evaluateAutomationReadinessCase(
  caseText: string,
  index = 0,
  options?: AutomationReadinessOptions
): AutomationReadinessCase {
  const title = extractTitle(caseText, index);
  const titleScore = titleSpecificityBucket(title);
  const steps = stepsBucket(caseText);
  const assertion = assertionBucket(caseText);
  const setup = setupBucket(caseText);
  const target = targetBucket(caseText);
  const deterministic = determinismBucket(caseText, title);
  const penalties = penaltySignals(caseText);
  const credentialProfile = findCredentialProfileForText(caseText, options?.credentialProfiles ?? []);
  const authSetupNeeded = needsAuthSetup(caseText);
  const hasCredentialProfile = Boolean(credentialProfile);
  const missingInputs = missingInputsFor(
    {
      steps: steps.score,
      assertion: assertion.score,
      setup: setup.score,
      target: target.score,
    },
    caseText
  );
  const effectiveMissingInputPenalty = missingInputs.reduce((sum, missing) => {
    if (missing === "Test account/data setup" && authSetupNeeded && hasCredentialProfile) {
      return sum;
    }

    return sum + 2;
  }, 0);
  const credentialBonus = authSetupNeeded && hasCredentialProfile ? 8 : 0;

  const rawScore =
    titleScore.score +
    steps.score +
    assertion.score +
    setup.score +
    target.score +
    deterministic.score -
    penalties.penalty -
    // Missing automation implementation details are a cleanup cost, not an automatic block.
    effectiveMissingInputPenalty +
    credentialBonus;

  const finalScore = clampScore(rawScore);
  const readiness = readinessFromScore(finalScore, missingInputs, caseText, penalties.manualOnly);
  const framework = chooseFramework(caseText, finalScore, penalties.manualOnly);

  const reasons = [
    ...titleScore.reasons,
    ...steps.reasons,
    ...assertion.reasons,
    ...setup.reasons,
    ...target.reasons,
    ...deterministic.reasons,
    ...(authSetupNeeded && credentialProfile ? [`Credential profile available: ${credentialProfile.name}.`] : []),
  ];

  return {
    id: `case-${index + 1}`,
    title,
    readiness,
    score: finalScore,
    framework,
    summary: caseSummary(readiness),
    reasons: reasons.length ? reasons : ["Not enough concrete automation signals were detected."],
    blockers:
      readiness === "blocked" || readiness === "manual"
        ? penalties.blockers
        : penalties.blockers.filter((item) => /External|Subjective|manual/i.test(item)),
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
  if (totals.blocked > 0 && score < 40) return "Blocked";
  if (totals.manual > totals.ready + totals.partial) return "Manual Heavy";
  if (score >= 72 && totals.ready + totals.partial >= totals.manual + totals.blocked) return "Ready";
  if (score >= 56) return "Good Candidate";
  return "Needs Detail";
}

function majorityFramework(cases: AutomationReadinessCase[]): AutomationFramework {
  const counts = cases.reduce(
    (acc, item) => {
      acc[item.framework] += 1;
      return acc;
    },
    { playwright: 0, cypress: 0, api: 0, "manual-review": 0 } as Record<AutomationFramework, number>
  );

  if (counts.playwright >= counts.cypress && counts.playwright >= counts.api && counts.playwright >= counts["manual-review"]) return "playwright";
  if (counts.api >= counts.cypress && counts.api >= counts["manual-review"]) return "api";
  if (counts.cypress >= counts["manual-review"]) return "cypress";
  return "manual-review";
}

function buildRecommendations(cases: AutomationReadinessCase[]): string[] {
  const recommendations = new Set<string>();

  if (cases.some((item) => item.missingInputs.includes("Observable UI/API target"))) {
    recommendations.add("Add stable observable UI/API targets or selector hints before final automation.");
  }

  if (cases.some((item) => item.missingInputs.includes("Test account/data setup"))) {
    recommendations.add("Define seeded users, roles, credit states, config, and reset data before automation.");
  }

  if (cases.some((item) => item.missingInputs.includes("Expected result/assertion"))) {
    recommendations.add("Tighten expected results so each automation case has clear assertions.");
  }

  if (cases.some((item) => item.missingInputs.includes("Concrete steps/actions"))) {
    recommendations.add("Break vague scenarios into concrete actions before automation.");
  }

  if (recommendations.size === 0) {
    recommendations.add("Start with ready/partial cases and keep generated code as skeletons until targets are confirmed.");
  }

  return [...recommendations];
}

export function evaluateAutomationReadiness(sourceText: string): AutomationReadinessReport {
  const candidateCases = splitIntoCandidateCases(sourceText);
  const cases = candidateCases.map((caseText, index) => evaluateAutomationReadinessCase(caseText, index));

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
        ? "Generated cases are good candidates for automation skeletons."
        : label === "Good Candidate"
          ? "Several cases can become automation skeletons after selector/data/auth cleanup."
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
