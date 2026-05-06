export type TestCaseQualityTone = "strong" | "good" | "warn" | "weak";

export type TestCaseQualityResult = {
  score: number;
  tone: TestCaseQualityTone;
  label: "Strong" | "Good" | "Needs Work" | "Thin";
  reasons: string[];
  gaps: string[];
};

type TestCaseLike = {
  title?: unknown;
  type?: unknown;
  priority?: unknown;
  preconditions?: unknown;
  steps?: unknown;
  expectedResult?: unknown;
};

function stringify(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(stringify).join("\n");

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function normalize(value: unknown): string {
  return stringify(value).toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function countMatches(text: string, regex: RegExp): number {
  return (text.match(regex) ?? []).length;
}

function meaningfulTokens(value: unknown): string[] {
  return normalize(value)
    .split(/\s+/)
    .filter((token) => token.length >= 4)
    .filter(
      (token) =>
        ![
          "test",
          "case",
          "user",
          "should",
          "result",
          "expected",
          "actual",
          "with",
          "when",
          "then",
          "from",
          "verify",
          "check",
          "ensure",
          "valid",
          "page",
          "button",
        ].includes(token)
    );
}

function itemCount(value: unknown): number {
  if (Array.isArray(value)) return value.filter((item) => stringify(item).trim()).length;
  const text = stringify(value);
  if (!text.trim()) return 0;

  const numbered = countMatches(text, /^\s*\d+[.)]\s+/gm);
  if (numbered > 0) return numbered;

  return text.split(/\n+/).filter((line) => line.trim()).length;
}

function qualityLabel(score: number): TestCaseQualityResult["label"] {
  if (score >= 85) return "Strong";
  if (score >= 72) return "Good";
  if (score >= 58) return "Needs Work";
  return "Thin";
}

export function testCaseQualityTone(score: number): TestCaseQualityTone {
  if (score >= 85) return "strong";
  if (score >= 72) return "good";
  if (score >= 58) return "warn";
  return "weak";
}

export function getTestCaseQualityCardClass(score: number): string {
  return `test-case-card test-case-card-quality-${testCaseQualityTone(score)}`;
}

function titleScore(title: unknown) {
  const text = normalize(title);
  const tokenCount = new Set(meaningfulTokens(title)).size;
  const reasons: string[] = [];
  const gaps: string[] = [];
  let score = 0;

  if (tokenCount >= 3) {
    score += 12;
    reasons.push("Specific behavior-focused title.");
  } else {
    gaps.push("Make the title name the exact behavior under test.");
  }

  if (tokenCount >= 5) score += 4;

  if (
    /\b(jira|source|project|context|risk|bug|report|export|download|save|credit|auth|login|permission|api|ui|score|panel|subtask|comment|label|priority|account|dashboard|ledger|file|upload|regeneration|stale|nextauth|balance|redirect|deduction|credentials)\b/.test(
      text
    )
  ) {
    score += 6;
    reasons.push("Title includes product/domain target.");
  }

  if (/^(happy path|negative path|edge case|regression test|test case|ui test)$/i.test(stringify(title).trim())) {
    score -= 8;
    gaps.push("Avoid generic test titles.");
  }

  return { score: Math.max(0, Math.min(22, score)), reasons, gaps };
}

function preconditionScore(preconditions: unknown) {
  const text = normalize(preconditions);
  const reasons: string[] = [];
  const gaps: string[] = [];
  let score = 0;

  if (text.length > 0) {
    score += 8;
    reasons.push("Preconditions are present.");
  } else {
    gaps.push("Add setup/preconditions.");
  }

  if (
    /\b(logged in|logged out|signed in|signed out|project|source|jira|ticket|api token|role|permission|account|config|fixture|test data|existing|enabled|disabled|selected|created|saved|credit|balance|ledger|database|credentials|login page|sufficient|insufficient|limited)\b/.test(
      text
    )
  ) {
    score += 9;
    reasons.push("Preconditions include useful state/data constraints.");
  } else if (text.length > 0) {
    gaps.push("Clarify user, project, data, auth, or configuration state.");
  }

  if (meaningfulTokens(preconditions).length >= 5) score += 2;

  return { score: Math.min(19, score), reasons, gaps };
}

function stepScore(steps: unknown) {
  const text = normalize(steps);
  const stepCount = itemCount(steps);
  const reasons: string[] = [];
  const gaps: string[] = [];
  let score = 0;

  if (stepCount >= 2) {
    score += 9;
    reasons.push("Multiple executable steps.");
  } else {
    gaps.push("Add at least two concrete test actions when possible.");
  }

  if (stepCount >= 3) score += 4;

  const actionCount = countMatches(
    text,
    /\b(open|navigate|click|select|enter|type|submit|save|create|delete|update|upload|download|fetch|generate|export|copy|switch|reload|refresh|answer|verify|inspect|observe|attempt|trigger|run|make|perform|check)\b/g
  );

  if (actionCount > 0) {
    score += Math.min(9, actionCount * 2);
    reasons.push("Steps contain concrete action verbs.");
  } else {
    gaps.push("Use concrete actions instead of vague review language.");
  }

  const targetCount = countMatches(
    text,
    /\b(button|input|field|dropdown|panel|card|modal|page|tab|form|link|message|toast|report|ticket|source|project|score|export|file|api|endpoint|database|ledger|balance|dashboard|account|login|credit)\b/g
  );

  if (targetCount > 0) {
    score += Math.min(7, targetCount * 2);
    reasons.push("Steps include observable targets.");
  } else {
    gaps.push("Add observable UI/API targets.");
  }

  if (/\b(evaluate|review|look at|check if it looks|visually appealing|preferred design)\b/.test(text) && actionCount < 2) {
    score -= 7;
    gaps.push("Reduce subjective review wording.");
  }

  return { score: Math.max(0, Math.min(29, score)), reasons, gaps };
}

function expectedScore(expectedResult: unknown) {
  const text = normalize(expectedResult);
  const reasons: string[] = [];
  const gaps: string[] = [];
  let score = 0;

  if (text.length > 0) {
    score += 9;
    reasons.push("Expected result is present.");
  } else {
    gaps.push("Add expected result.");
  }

  if (
    /\b(displays|shows|appears|visible|hidden|redirected|returns|creates|saves|updates|deducts|reduces|blocks|prevents|includes|excludes|matches|count|message|status|error|success|download|file|record|entry|balance|url|score|risk|source|project|report|logged in|login page|dashboard|invalid|insufficient|correct amount)\b/.test(
      text
    )
  ) {
    score += 13;
    reasons.push("Expected result contains observable assertions.");
  } else if (text.length > 0) {
    gaps.push("Make the expected result more observable/assertable.");
  }

  if (meaningfulTokens(expectedResult).length >= 7) score += 3;

  if (/\b(correctly|properly|as expected|visually appealing|easy to understand)\b/.test(text) && meaningfulTokens(expectedResult).length < 10) {
    score -= 4;
    gaps.push("Avoid vague success wording.");
  }

  return { score: Math.max(0, Math.min(25, score)), reasons, gaps };
}

function coverageScore(testCase: TestCaseLike) {
  const text = normalize(testCase);
  const reasons: string[] = [];
  const gaps: string[] = [];
  let score = 0;

  const type = normalize(testCase.type);
  if (type) score += 3;

  if (/\b(negative|error|invalid|empty|missing|unauthorized|permission|edge|boundary|regression|data|state|accessibility|auth|credits|api safety|ai safety|insufficient|logged out|limit)\b/.test(text)) {
    score += 8;
    reasons.push("Adds meaningful non-happy-path or risk coverage.");
  }

  if (/\b(functional|regression|negative|edge|accessibility|data integrity|auth|credits|ai safety|api|manual|exploratory)\b/.test(type)) {
    score += 4;
    reasons.push("Test type is categorized.");
  }

  if (/\b(high|medium|low)\b/.test(normalize(testCase.priority))) {
    score += 3;
    reasons.push("Priority is set.");
  }

  if (!/\b(negative|error|invalid|empty|missing|unauthorized|permission|edge|boundary|regression|data|state|accessibility|auth|credits|api safety|ai safety|insufficient|logged out|limit)\b/.test(text)) {
    gaps.push("Consider whether this case needs negative, edge, regression, data/state, or auth coverage.");
  }

  return { score: Math.min(15, score), reasons, gaps };
}

export function calculateTestCaseQuality(testCase: TestCaseLike): TestCaseQualityResult {
  const title = titleScore(testCase.title);
  const preconditions = preconditionScore(testCase.preconditions);
  const steps = stepScore(testCase.steps);
  const expected = expectedScore(testCase.expectedResult);
  const coverage = coverageScore(testCase);

  let score = title.score + preconditions.score + steps.score + expected.score + coverage.score;

  const combined = normalize(testCase);

  // Useful simple smoke cases should not be punished like incomplete cases.
  const hasSimpleExecutableFlow =
    itemCount(testCase.steps) >= 1 &&
    normalize(testCase.preconditions).length > 0 &&
    normalize(testCase.expectedResult).length > 0 &&
    /\b(navigate|click|enter|make|perform|attempt|check|verify)\b/.test(normalize(testCase.steps)) &&
    /\b(displays|shows|redirected|returns|error|message|balance|logged in|dashboard|deduct|reduced|prevents)\b/.test(
      normalize(testCase.expectedResult)
    );

  if (hasSimpleExecutableFlow) {
    score = Math.max(score, 72);
  }

  if (/visually appealing|user experiences confusion|preferred designs|evaluate the ui presentation/.test(combined)) {
    score -= 12;
  }

  const finalScore = clamp(score);

  return {
    score: finalScore,
    tone: testCaseQualityTone(finalScore),
    label: qualityLabel(finalScore),
    reasons: Array.from(new Set([...title.reasons, ...preconditions.reasons, ...steps.reasons, ...expected.reasons, ...coverage.reasons])).slice(0, 6),
    gaps: Array.from(new Set([...title.gaps, ...preconditions.gaps, ...steps.gaps, ...expected.gaps, ...coverage.gaps])).slice(0, 6),
  };
}
