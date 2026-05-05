export type ReportType = "tests" | "risk" | "bug" | "improve";

export type CoverageDimensionId =
  | "acceptanceCriteria"
  | "happyPath"
  | "negativePath"
  | "edgeCases"
  | "riskCoverage"
  | "dataState"
  | "authPermissions"
  | "regression"
  | "environment"
  | "evidence";

export type CoverageDimension = {
  id: CoverageDimensionId;
  label: string;
  score: number;
  weight: number;
  status: "strong" | "partial" | "weak";
  reason: string;
  recommendation: string;
};

export type RiskBreakdownItem = {
  label: string;
  score: number;
  status: "low" | "medium" | "high";
  reason: string;
};

export type RiskScoreResult = {
  score: number;
  label: "Low" | "Medium" | "High";
  summary: string;
  items: RiskBreakdownItem[];
};

export type CoverageScoreResult = {
  score: number;
  grade: "Strong" | "Good" | "Needs Work" | "Thin";
  summary: string;
  strengths: string[];
  gaps: string[];
  dimensions: CoverageDimension[];
  risk: RiskScoreResult;
};

type CoverageInput = {
  reportType: ReportType;
  sourceInput?: unknown;
  markdown?: unknown;
  structuredData?: unknown;
};

type ToolScoringProfile = {
  reportType: ReportType;
  noun: string;
  scoreLabel: string;
  dimensions: DimensionConfig[];
};

type DimensionConfig = {
  id: CoverageDimensionId;
  label: string;
  weight: number;
  strongTarget: number;
  partialTarget: number;
  positiveSignals: string[];
  structureSignals: string[];
  sourceSignals?: string[];
  reasonStrong: string;
  reasonPartial: string;
  reasonWeak: string;
  recommendation: string;
};

type RiskConfig = {
  label: string;
  exposureSignals: string[];
  mitigationSignals: string[];
  reasonHigh: string;
  reasonMedium: string;
  reasonLow: string;
};

const VAGUE_SIGNALS = [
  "not specified",
  "unknown",
  "n/a",
  "tbd",
  "no details",
  "not provided",
  "missing",
  "unclear",
  "unspecified",
  "to be determined",
];

const THIN_OUTPUT_SIGNALS = [
  "no follow-up questions returned",
  "no qa notes returned",
  "no missing info returned",
  "no evidence attached",
  "not specified.",
  "unknown.",
];

const TEST_DIMENSIONS: DimensionConfig[] = [
  {
    id: "acceptanceCriteria",
    label: "Requirements / acceptance coverage",
    weight: 18,
    strongTarget: 5,
    partialTarget: 2,
    positiveSignals: [
      "acceptance criteria",
      "expected result",
      "definition of done",
      "requirement",
      "criteria",
      "preconditions",
      "given",
      "when",
      "then",
      "should",
      "must",
    ],
    structureSignals: ["preconditions", "steps", "expected result"],
    sourceSignals: ["acceptance criteria", "requirement", "must", "should", "expected"],
    reasonStrong: "The test plan clearly maps validation back to requirements and expected results.",
    reasonPartial: "The test plan touches requirements, but traceability could be tighter.",
    reasonWeak: "The test plan does not clearly prove the requirement or acceptance criteria are covered.",
    recommendation: "Add explicit checks for each acceptance criterion, expected result, or definition-of-done bullet.",
  },
  {
    id: "happyPath",
    label: "Primary flow coverage",
    weight: 13,
    strongTarget: 4,
    partialTarget: 2,
    positiveSignals: ["successful", "valid", "happy path", "opens", "creates", "saves", "loads", "completes", "primary flow", "main flow"],
    structureSignals: ["test case", "steps", "expected result"],
    sourceSignals: ["open", "create", "save", "load", "complete", "valid"],
    reasonStrong: "The primary success path is represented with usable validation.",
    reasonPartial: "The main flow is present, but it is not fully walked end-to-end.",
    reasonWeak: "The primary success path is missing or too vague.",
    recommendation: "Add at least one end-to-end success-path test that validates the main user outcome.",
  },
  {
    id: "negativePath",
    label: "Negative/error coverage",
    weight: 14,
    strongTarget: 5,
    partialTarget: 2,
    positiveSignals: ["negative", "invalid", "error", "failure", "fails", "blocked", "empty", "unauthorized", "permission denied", "validation", "missing required"],
    structureSignals: ["expected error", "error message", "validation message", "actual result"],
    sourceSignals: ["error", "failure", "invalid", "missing", "unauthorized", "empty", "blocked", "crash"],
    reasonStrong: "The test plan includes meaningful negative-path or error-state coverage.",
    reasonPartial: "Some failure behavior is covered, but important error states may still be thin.",
    reasonWeak: "Negative-path coverage is missing or too vague.",
    recommendation: "Add tests for invalid input, missing data, unavailable services, and expected error messaging.",
  },
  {
    id: "edgeCases",
    label: "Edge / boundary coverage",
    weight: 10,
    strongTarget: 4,
    partialTarget: 2,
    positiveSignals: ["edge case", "boundary", "large", "empty", "null", "duplicate", "multiple", "long", "special character", "timezone", "race condition"],
    structureSignals: ["edge", "boundary", "duplicate", "empty"],
    sourceSignals: ["multiple", "large", "empty", "duplicate", "edge", "boundary"],
    reasonStrong: "The test plan includes useful edge-case thinking.",
    reasonPartial: "A few edge cases are present, but coverage is not systematic yet.",
    reasonWeak: "Edge cases are not meaningfully covered.",
    recommendation: "Add boundary, empty-state, duplicate, large-data, and unusual-state scenarios where relevant.",
  },
  {
    id: "dataState",
    label: "Data/state coverage",
    weight: 11,
    strongTarget: 4,
    partialTarget: 2,
    positiveSignals: ["data", "state", "database", "persist", "saved", "reload", "refresh", "metadata", "migration", "cache", "stale"],
    structureSignals: ["reload", "saved", "state", "cleanup", "rollback"],
    sourceSignals: ["data", "state", "persist", "saved", "metadata", "model", "cache"],
    reasonStrong: "The test plan considers data, persistence, or state transitions.",
    reasonPartial: "Some data/state validation is present, but it could be more direct.",
    reasonWeak: "Data/state behavior is not clearly tested.",
    recommendation: "Add checks for saved data, reload behavior, stale state, transitions, and cleanup/rollback.",
  },
  {
    id: "authPermissions",
    label: "Auth/permission coverage",
    weight: 9,
    strongTarget: 4,
    partialTarget: 2,
    positiveSignals: ["auth", "authenticated", "unauthenticated", "permission", "role", "admin", "signed in", "signed out", "unauthorized", "access"],
    structureSignals: ["wrong user", "wrong role", "signed-in", "signed-out", "permission"],
    sourceSignals: ["auth", "permission", "role", "admin", "user", "access"],
    reasonStrong: "The test plan includes auth, role, or permission validation.",
    reasonPartial: "Auth/access behavior is mentioned, but not tested deeply.",
    reasonWeak: "Auth and permission coverage is missing.",
    recommendation: "Add signed-in, signed-out, wrong-user, and role/permission cases where applicable.",
  },
  {
    id: "regression",
    label: "Regression coverage",
    weight: 11,
    strongTarget: 4,
    partialTarget: 2,
    positiveSignals: ["regression", "existing", "still works", "does not break", "backward compatible", "unchanged", "previous", "legacy"],
    structureSignals: ["existing workflow", "still works", "does not break", "regression"],
    sourceSignals: ["existing", "regression", "unchanged", "previous", "backward"],
    reasonStrong: "The test plan includes regression awareness.",
    reasonPartial: "Regression is implied, but not specific enough.",
    reasonWeak: "Regression coverage is not called out.",
    recommendation: "Add checks that existing workflows still work after this change.",
  },
  {
    id: "riskCoverage",
    label: "Risk-based prioritization",
    weight: 14,
    strongTarget: 5,
    partialTarget: 2,
    positiveSignals: ["risk", "impact", "severity", "priority", "mitigation", "bottleneck", "dependency", "data loss", "security", "performance"],
    structureSignals: ["priority", "severity", "risk", "impact"],
    sourceSignals: ["risk", "dependency", "impact", "performance", "security"],
    reasonStrong: "The test plan calls out risk and likely failure areas.",
    reasonPartial: "Some risk thinking is present, but the riskiest areas could be more explicit.",
    reasonWeak: "Risk-based prioritization is weak or absent.",
    recommendation: "Call out likely failure areas, impact, mitigation, and what QA should prioritize first.",
  },
];

const RISK_DIMENSIONS: DimensionConfig[] = [
  {
    id: "riskCoverage",
    label: "Risk identification",
    weight: 20,
    strongTarget: 6,
    partialTarget: 3,
    positiveSignals: ["risk", "severity", "impact", "likelihood", "failure", "bottleneck", "dependency", "release", "regression", "security", "data loss"],
    structureSignals: ["key risks", "risk breakdown", "severity", "impact", "mitigation"],
    sourceSignals: ["risk", "impact", "dependency", "release", "failure"],
    reasonStrong: "The review identifies practical risks with enough detail to guide QA.",
    reasonPartial: "The review identifies some risks, but prioritization/detail could be stronger.",
    reasonWeak: "The review does not identify risks clearly enough to guide testing.",
    recommendation: "List concrete risks with severity, impact, likelihood, and why QA should care.",
  },
  {
    id: "acceptanceCriteria",
    label: "Requirement clarity analysis",
    weight: 14,
    strongTarget: 4,
    partialTarget: 2,
    positiveSignals: ["missing acceptance", "acceptance criteria", "unclear", "ambiguous", "requirement", "scope", "definition of done", "assumption"],
    structureSignals: ["missing acceptance criteria", "assumption", "clarify", "scope"],
    sourceSignals: ["acceptance", "requirement", "scope", "must", "should"],
    reasonStrong: "The review calls out requirement clarity and acceptance criteria gaps.",
    reasonPartial: "Requirement clarity is mentioned, but the gaps could be more concrete.",
    reasonWeak: "Requirement clarity is not meaningfully assessed.",
    recommendation: "Call out unclear acceptance criteria, assumptions, and release-blocking questions.",
  },
  {
    id: "regression",
    label: "Regression exposure",
    weight: 14,
    strongTarget: 4,
    partialTarget: 2,
    positiveSignals: ["regression", "existing", "previous", "legacy", "unchanged", "backward", "still works", "does not break"],
    structureSignals: ["regression", "existing workflow", "affected flows"],
    sourceSignals: ["existing", "regression", "previous", "unchanged"],
    reasonStrong: "The review identifies existing flows that could be affected.",
    reasonPartial: "Regression exposure is present but not specific enough.",
    reasonWeak: "Regression exposure is not clearly assessed.",
    recommendation: "Identify existing workflows that could break and recommend regression checks.",
  },
  {
    id: "dataState",
    label: "Data/state risk",
    weight: 13,
    strongTarget: 4,
    partialTarget: 2,
    positiveSignals: ["data", "state", "database", "persist", "saved", "reload", "metadata", "migration", "cache", "stale", "rollback"],
    structureSignals: ["data risk", "state risk", "cleanup", "rollback", "reload"],
    sourceSignals: ["data", "state", "persist", "saved", "metadata", "cache"],
    reasonStrong: "The review identifies data/state risks and likely validation needs.",
    reasonPartial: "Data/state risk is mentioned, but validation guidance could be clearer.",
    reasonWeak: "Data/state risk is not meaningfully assessed.",
    recommendation: "Identify persistence, reload, stale state, migration, and cleanup risks.",
  },
  {
    id: "authPermissions",
    label: "Auth/access risk",
    weight: 12,
    strongTarget: 4,
    partialTarget: 2,
    positiveSignals: ["auth", "permission", "role", "admin", "signed in", "signed out", "unauthorized", "access", "wrong user"],
    structureSignals: ["auth risk", "access risk", "permission", "role"],
    sourceSignals: ["auth", "permission", "role", "user", "access"],
    reasonStrong: "The review identifies auth/access risk where applicable.",
    reasonPartial: "Auth/access risk is mentioned, but not tested deeply.",
    reasonWeak: "Auth/access risk is not assessed.",
    recommendation: "Call out signed-in, signed-out, wrong-user, wrong-role, and permission-boundary risks.",
  },
  {
    id: "edgeCases",
    label: "Failure / edge risk",
    weight: 12,
    strongTarget: 5,
    partialTarget: 2,
    positiveSignals: ["failure", "invalid", "empty", "missing", "timeout", "unavailable", "crash", "edge", "boundary", "duplicate"],
    structureSignals: ["failure mode", "edge case", "negative", "error"],
    sourceSignals: ["error", "failure", "invalid", "missing", "crash"],
    reasonStrong: "The review identifies failure modes and edge risks.",
    reasonPartial: "Some failure/edge risk is present, but not complete.",
    reasonWeak: "Failure modes and edge risks are thin.",
    recommendation: "Add likely failure modes, invalid states, empty states, and unavailable dependency risks.",
  },
  {
    id: "happyPath",
    label: "QA actionability",
    weight: 15,
    strongTarget: 5,
    partialTarget: 2,
    positiveSignals: ["recommendation", "qa action", "test focus", "mitigation", "prioritize", "verify", "validate", "next", "release decision"],
    structureSignals: ["suggested test focus", "recommendation", "mitigation", "qa action"],
    sourceSignals: ["test", "qa", "release", "validate"],
    reasonStrong: "The review gives QA clear next actions.",
    reasonPartial: "The review has some QA guidance, but the next actions could be clearer.",
    reasonWeak: "The review does not give QA enough actionable next steps.",
    recommendation: "Add focused QA actions, test focus, mitigation, and release decision guidance.",
  },
];

const BUG_DIMENSIONS: DimensionConfig[] = [
  {
    id: "happyPath",
    label: "Bug summary clarity",
    weight: 13,
    strongTarget: 4,
    partialTarget: 2,
    positiveSignals: ["summary", "title", "crash", "fails", "error", "when", "while", "after", "cannot", "unable"],
    structureSignals: ["summary", "title"],
    sourceSignals: ["crash", "error", "fails", "cannot", "unable"],
    reasonStrong: "The bug report has a clear, concise problem statement.",
    reasonPartial: "The bug is understandable, but the summary could be more precise.",
    reasonWeak: "The bug summary is too vague to triage confidently.",
    recommendation: "Write a concise summary that states what fails, where it fails, and when it happens.",
  },
  {
    id: "acceptanceCriteria",
    label: "Expected vs actual clarity",
    weight: 18,
    strongTarget: 4,
    partialTarget: 2,
    positiveSignals: ["expected result", "actual result", "should", "instead", "observed", "expected", "actual"],
    structureSignals: ["expected result", "actual result"],
    sourceSignals: ["should", "expected", "actual", "instead"],
    reasonStrong: "Expected and actual behavior are clearly separated.",
    reasonPartial: "Expected/actual behavior is present, but could be more concrete.",
    reasonWeak: "Expected vs actual behavior is missing or unclear.",
    recommendation: "Separate expected result and actual result so developers can see the defect clearly.",
  },
  {
    id: "negativePath",
    label: "Reproduction quality",
    weight: 20,
    strongTarget: 6,
    partialTarget: 3,
    positiveSignals: ["steps to reproduce", "step", "open", "click", "enter", "select", "navigate", "repro", "reproduces", "happens when"],
    structureSignals: ["steps to reproduce", "1.", "2.", "3."],
    sourceSignals: ["open", "click", "enter", "crash", "error", "repro"],
    reasonStrong: "The bug includes practical reproduction steps.",
    reasonPartial: "Reproduction steps exist, but may be missing important setup or detail.",
    reasonWeak: "Reproduction steps are too thin to validate the issue reliably.",
    recommendation: "Add clear steps to reproduce, starting state, exact actions, and where the failure appears.",
  },
  {
    id: "environment",
    label: "Environment detail",
    weight: 13,
    strongTarget: 5,
    partialTarget: 2,
    positiveSignals: ["environment", "browser", "device", "os", "version", "build", "repro rate", "production", "staging", "platform", "ios", "android", "windows"],
    structureSignals: ["environment", "device", "os", "build", "version"],
    sourceSignals: ["browser", "device", "os", "version", "build", "environment", "platform"],
    reasonStrong: "The bug report captures useful environment context.",
    reasonPartial: "Some environment context exists, but reproduction context could be clearer.",
    reasonWeak: "Environment details are missing or too thin.",
    recommendation: "Add browser/device/OS/build/environment and repro rate where possible.",
  },
  {
    id: "evidence",
    label: "Evidence/log coverage",
    weight: 13,
    strongTarget: 5,
    partialTarget: 2,
    positiveSignals: ["evidence", "screenshot", "logs", "console", "network", "video", "attachment", "stack trace", "error message"],
    structureSignals: ["evidence", "attachments", "logs", "screenshot", "console"],
    sourceSignals: ["screenshot", "log", "console", "network", "video", "attachment", "error"],
    reasonStrong: "The bug report includes evidence or clear evidence references.",
    reasonPartial: "Evidence is mentioned, but concrete artifacts would make it stronger.",
    reasonWeak: "Evidence is missing.",
    recommendation: "Attach screenshots, logs, console/network errors, videos, or exact error messages when available.",
  },
  {
    id: "riskCoverage",
    label: "Impact / severity clarity",
    weight: 13,
    strongTarget: 4,
    partialTarget: 2,
    positiveSignals: ["impact", "severity", "priority", "blocks", "prevents", "data loss", "user cannot", "release", "critical", "high"],
    structureSignals: ["impact", "severity", "priority"],
    sourceSignals: ["blocks", "prevents", "impact", "critical", "high"],
    reasonStrong: "The bug report explains impact and triage severity.",
    reasonPartial: "Impact/severity is present, but could be more grounded.",
    reasonWeak: "Impact and severity are missing or weak.",
    recommendation: "Explain who is affected, how badly, whether there is a workaround, and suggested severity/priority.",
  },
  {
    id: "regression",
    label: "Missing info / follow-up control",
    weight: 10,
    strongTarget: 4,
    partialTarget: 2,
    positiveSignals: ["missing info", "follow-up questions", "qa notes", "unknown", "needs confirmation", "assumption", "not provided"],
    structureSignals: ["missing info", "follow-up questions", "qa notes"],
    sourceSignals: ["unknown", "missing", "not sure", "no error"],
    reasonStrong: "The report clearly separates missing info and follow-up questions from confirmed facts.",
    reasonPartial: "Some missing info is identified, but uncertainty could be cleaner.",
    reasonWeak: "The report does not make uncertainty or missing info clear.",
    recommendation: "List missing details and follow-up questions without presenting assumptions as facts.",
  },
];

const IMPROVE_DIMENSIONS: DimensionConfig[] = [
  {
    id: "acceptanceCriteria",
    label: "Improved test completeness",
    weight: 20,
    strongTarget: 5,
    partialTarget: 2,
    positiveSignals: ["improved test case", "title", "preconditions", "steps", "expected result", "priority", "type"],
    structureSignals: ["improved test case", "preconditions", "steps", "expected result"],
    sourceSignals: ["test", "expected", "steps", "preconditions"],
    reasonStrong: "The improved test case has clear title, setup, steps, and expected result.",
    reasonPartial: "The improved case has useful structure, but at least one core section needs detail.",
    reasonWeak: "The improved test case is not complete enough to execute.",
    recommendation: "Ensure the improved test has a specific title, preconditions, executable steps, and verifiable expected result.",
  },
  {
    id: "riskCoverage",
    label: "Improvements explained",
    weight: 14,
    strongTarget: 4,
    partialTarget: 2,
    positiveSignals: ["improvements made", "clarified", "added", "strengthened", "converted", "made explicit", "tightened"],
    structureSignals: ["improvements made"],
    sourceSignals: ["improve", "clarify", "missing", "weak"],
    reasonStrong: "The output explains what was improved and why.",
    reasonPartial: "Improvements are listed, but the value could be clearer.",
    reasonWeak: "The output does not explain the improvements well.",
    recommendation: "Explain what changed, why it matters, and how it improves QA value.",
  },
  {
    id: "negativePath",
    label: "Added negative/error coverage",
    weight: 12,
    strongTarget: 4,
    partialTarget: 2,
    positiveSignals: ["negative", "invalid", "error", "failure", "missing", "empty", "unauthorized", "validation"],
    structureSignals: ["added coverage", "negative", "error"],
    sourceSignals: ["error", "invalid", "failure", "missing"],
    reasonStrong: "The improved test adds meaningful negative/error coverage.",
    reasonPartial: "Some negative coverage exists, but it could be deeper.",
    reasonWeak: "Negative/error coverage was not improved.",
    recommendation: "Add invalid input, error handling, missing data, and failure-state checks where relevant.",
  },
  {
    id: "edgeCases",
    label: "Added edge/regression coverage",
    weight: 12,
    strongTarget: 4,
    partialTarget: 2,
    positiveSignals: ["edge", "boundary", "regression", "existing", "duplicate", "large", "multiple", "reload", "still works"],
    structureSignals: ["added coverage", "edge", "regression"],
    sourceSignals: ["edge", "regression", "existing", "duplicate", "reload"],
    reasonStrong: "The improvement adds useful edge or regression coverage.",
    reasonPartial: "Some edge/regression coverage exists, but it is not systematic.",
    reasonWeak: "Edge/regression coverage was not meaningfully improved.",
    recommendation: "Add boundary, unusual-state, existing-flow, and regression checks where relevant.",
  },
  {
    id: "dataState",
    label: "Data/setup clarity",
    weight: 12,
    strongTarget: 4,
    partialTarget: 2,
    positiveSignals: ["test data", "setup", "preconditions", "state", "saved", "reload", "database", "account", "role"],
    structureSignals: ["preconditions", "test data", "setup"],
    sourceSignals: ["data", "state", "setup", "account"],
    reasonStrong: "The improved test clarifies setup, test data, or state requirements.",
    reasonPartial: "Setup/data is present, but could be clearer.",
    reasonWeak: "Setup/data requirements are still weak.",
    recommendation: "Clarify account, role, test data, starting state, and cleanup expectations.",
  },
  {
    id: "evidence",
    label: "Remaining gaps called out",
    weight: 10,
    strongTarget: 3,
    partialTarget: 1,
    positiveSignals: ["missing info", "follow-up questions", "assumption", "qa notes", "still missing", "needs confirmation"],
    structureSignals: ["missing info", "follow-up questions", "qa notes"],
    sourceSignals: ["missing", "unknown", "unclear"],
    reasonStrong: "Remaining gaps and assumptions are clearly called out.",
    reasonPartial: "Some gaps are noted, but they could be more actionable.",
    reasonWeak: "The improvement does not clearly identify remaining gaps.",
    recommendation: "List remaining missing details, assumptions, and follow-up questions.",
  },
  {
    id: "happyPath",
    label: "Executable QA clarity",
    weight: 20,
    strongTarget: 5,
    partialTarget: 2,
    positiveSignals: ["click", "open", "enter", "select", "verify", "assert", "displayed", "visible", "expected result", "step"],
    structureSignals: ["steps", "expected result", "verify"],
    sourceSignals: ["click", "open", "enter", "verify", "expected"],
    reasonStrong: "The improved test is clear enough for a tester to execute.",
    reasonPartial: "The test is mostly executable, but steps/assertions need tightening.",
    reasonWeak: "The test is still too vague to execute reliably.",
    recommendation: "Make each step concrete and each expected result observable.",
  },
];

const TOOL_PROFILES: Record<ReportType, ToolScoringProfile> = {
  tests: {
    reportType: "tests",
    noun: "test plan",
    scoreLabel: "Coverage Score",
    dimensions: TEST_DIMENSIONS,
  },
  risk: {
    reportType: "risk",
    noun: "risk review",
    scoreLabel: "Risk Review Score",
    dimensions: RISK_DIMENSIONS,
  },
  bug: {
    reportType: "bug",
    noun: "bug report",
    scoreLabel: "Bug Report Quality",
    dimensions: BUG_DIMENSIONS,
  },
  improve: {
    reportType: "improve",
    noun: "improved test",
    scoreLabel: "Improvement Score",
    dimensions: IMPROVE_DIMENSIONS,
  },
};

const RISK_CONFIGS: RiskConfig[] = [
  {
    label: "Requirements clarity risk",
    exposureSignals: ["vague", "unclear", "missing acceptance", "missing criteria", "not specified", "unknown", "ambiguous", "tbd"],
    mitigationSignals: ["acceptance criteria", "definition of done", "expected result", "clear", "specified", "clarify"],
    reasonHigh: "Requirements appear vague, missing, or ambiguous.",
    reasonMedium: "Some requirement uncertainty is present.",
    reasonLow: "Requirements appear reasonably clear.",
  },
  {
    label: "Data/state risk",
    exposureSignals: ["data", "state", "persist", "cache", "stale", "migration", "metadata", "database", "saved", "reload"],
    mitigationSignals: ["test data", "rollback", "cleanup", "reload behavior", "saved correctly", "state transition"],
    reasonHigh: "Data/state behavior has meaningful risk and needs validation.",
    reasonMedium: "Data/state behavior is involved and should be tested directly.",
    reasonLow: "Limited data/state risk detected.",
  },
  {
    label: "Regression risk",
    exposureSignals: ["existing", "regression", "previous", "legacy", "unchanged", "backward", "still works", "does not break"],
    mitigationSignals: ["regression test", "existing workflow", "still works", "backward compatible"],
    reasonHigh: "Existing flows may be impacted and regression coverage is important.",
    reasonMedium: "Some regression exposure is present.",
    reasonLow: "Limited regression exposure detected.",
  },
  {
    label: "Auth/access risk",
    exposureSignals: ["auth", "permission", "role", "admin", "user", "access", "signed in", "signed out", "unauthorized"],
    mitigationSignals: ["signed-in", "signed-out", "wrong-user", "wrong-role", "role", "permission test"],
    reasonHigh: "Auth/access behavior may affect correctness or data isolation.",
    reasonMedium: "Auth/access should be verified.",
    reasonLow: "Limited auth/access risk detected.",
  },
  {
    label: "Failure-mode risk",
    exposureSignals: ["error", "failure", "fails", "invalid", "empty", "missing", "crash", "timeout", "unavailable", "network"],
    mitigationSignals: ["error message", "validation", "graceful", "negative test", "fallback"],
    reasonHigh: "Failure modes or error states are likely and should be covered.",
    reasonMedium: "Some error-state exposure is present.",
    reasonLow: "Limited failure-mode risk detected.",
  },
];

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

function normalizeText(value: unknown): string {
  return stringify(value)
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueSignalCount(text: string, signals: string[]): number {
  return signals.reduce((count, signal) => {
    return text.includes(signal.toLowerCase()) ? count + 1 : count;
  }, 0);
}

function regexCount(text: string, regex: RegExp): number {
  return (text.match(regex) ?? []).length;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function dimensionStatus(score: number): CoverageDimension["status"] {
  if (score >= 75) return "strong";
  if (score >= 45) return "partial";
  return "weak";
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function listDensityScore(text: string): number {
  const numbered = regexCount(text, /\b\d+[.)]\s+/g);
  const bullets = regexCount(text, /(^|\n)\s*[-*•]\s+/g);
  const headings = regexCount(text, /\b(preconditions|steps|expected result|actual result|summary|impact|risk|mitigation|missing info|qa notes)\b/g);

  return Math.min(18, numbered * 2 + bullets * 1.5 + headings * 2);
}

function detailScore(text: string): number {
  const words = wordCount(text);
  let score = 0;

  if (words >= 80) score += 4;
  if (words >= 180) score += 5;
  if (words >= 350) score += 5;
  if (words >= 600) score += 4;

  return score + listDensityScore(text);
}

function missingPenalty(text: string): number {
  const vagueCount = VAGUE_SIGNALS.reduce((sum, signal) => sum + regexCount(text, new RegExp(`\\b${signal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g")), 0);
  const thinCount = THIN_OUTPUT_SIGNALS.reduce((sum, signal) => sum + (text.includes(signal) ? 1 : 0), 0);

  return Math.min(28, vagueCount * 3 + thinCount * 4);
}

function sourceRequirementPenalty(config: DimensionConfig, reportSignalCount: number, sourceText: string): number {
  const sourceSignalCount = uniqueSignalCount(sourceText, config.sourceSignals ?? config.positiveSignals);

  if (sourceSignalCount === 0) return 0;
  if (reportSignalCount >= config.partialTarget) return 0;

  return Math.min(16, 8 + sourceSignalCount * 2);
}

function scoreDimension(config: DimensionConfig, reportText: string, sourceText: string): CoverageDimension {
  const reportSignalCount = uniqueSignalCount(reportText, config.positiveSignals);
  const structureSignalCount = uniqueSignalCount(reportText, config.structureSignals);
  const signalRatio = Math.min(1, reportSignalCount / Math.max(1, config.strongTarget));
  const structureRatio = Math.min(1, structureSignalCount / Math.max(1, config.partialTarget));
  const reportWords = wordCount(reportText);

  let score = 18;
  score += signalRatio * 42;
  score += structureRatio * 24;
  score += Math.min(16, detailScore(reportText));
  score -= missingPenalty(reportText);
  score -= sourceRequirementPenalty(config, reportSignalCount, sourceText);

  if (reportWords < 70) score -= 18;
  if (reportSignalCount === 0 && structureSignalCount === 0) score -= 18;
  if (reportSignalCount >= config.strongTarget && structureSignalCount >= config.partialTarget) score += 8;

  const finalScore = clampScore(score);
  const status = dimensionStatus(finalScore);

  return {
    id: config.id,
    label: config.label,
    score: finalScore,
    weight: config.weight,
    status,
    reason:
      status === "strong"
        ? config.reasonStrong
        : status === "partial"
          ? config.reasonPartial
          : config.reasonWeak,
    recommendation: config.recommendation,
  };
}

function gradeFromScore(score: number): CoverageScoreResult["grade"] {
  if (score >= 85) return "Strong";
  if (score >= 70) return "Good";
  if (score >= 50) return "Needs Work";
  return "Thin";
}

function summaryFromScore(score: number, profile: ToolScoringProfile): string {
  if (score >= 85) return `This ${profile.noun} is strong, specific, and ready for practical QA use.`;
  if (score >= 70) return `This ${profile.noun} is usable, with a few gaps worth tightening before handoff.`;
  if (score >= 50) return `This ${profile.noun} has a workable foundation, but important QA detail is still missing.`;
  return `This ${profile.noun} is thin. Add concrete steps, assertions, context, and risk detail before relying on it.`;
}

function riskStatus(score: number): RiskBreakdownItem["status"] {
  if (score >= 67) return "high";
  if (score >= 34) return "medium";
  return "low";
}

function riskLabel(score: number): RiskScoreResult["label"] {
  if (score >= 67) return "High";
  if (score >= 34) return "Medium";
  return "Low";
}

function calculateRisk(input: CoverageInput, reportText: string, sourceText: string, dimensions: CoverageDimension[]): RiskScoreResult {
  const combinedText = `${sourceText} ${reportText}`;
  const weakCoveragePenalty = dimensions.filter((item) => item.status === "weak").length * 4;
  const partialCoveragePenalty = dimensions.filter((item) => item.status === "partial").length * 2;

  const items = RISK_CONFIGS.map((config) => {
    const exposure = uniqueSignalCount(combinedText, config.exposureSignals);
    const mitigation = uniqueSignalCount(reportText, config.mitigationSignals);
    const outputIsThin = wordCount(reportText) < 120;
    let score = exposure * 18 - mitigation * 8;

    if (input.reportType === "risk" && exposure > 0) score += 8;
    if (outputIsThin && exposure > 0) score += 10;
    if (exposure === 0) score = Math.max(0, score - 6);

    const finalScore = clampScore(score);
    const status = riskStatus(finalScore);

    return {
      label: config.label,
      score: finalScore,
      status,
      reason:
        status === "high"
          ? config.reasonHigh
          : status === "medium"
            ? config.reasonMedium
            : config.reasonLow,
    };
  });

  const averageRisk =
    items.reduce((sum, item) => sum + item.score, 0) / Math.max(1, items.length) +
    weakCoveragePenalty +
    partialCoveragePenalty;

  const score = clampScore(averageRisk);
  const label = riskLabel(score);

  return {
    score,
    label,
    summary:
      label === "High"
        ? "High delivery risk detected. Prioritize the riskiest areas before release."
        : label === "Medium"
          ? "Medium delivery risk detected. A focused QA pass should reduce exposure."
          : "Low delivery risk detected from the available ticket and report context.",
    items,
  };
}

function adjustToolScore(reportType: ReportType, score: number, dimensions: CoverageDimension[], reportText: string): number {
  let adjusted = score;

  if (reportType === "bug") {
    const repro = dimensions.find((item) => item.label === "Reproduction quality")?.score ?? 0;
    const expectedActual = dimensions.find((item) => item.label === "Expected vs actual clarity")?.score ?? 0;

    if (repro < 45) adjusted -= 10;
    if (expectedActual < 45) adjusted -= 10;
    if (reportText.includes("no evidence attached") || reportText.includes("no logs")) adjusted -= 3;
  }

  if (reportType === "risk") {
    const riskIdentification = dimensions.find((item) => item.label === "Risk identification")?.score ?? 0;
    const actionability = dimensions.find((item) => item.label === "QA actionability")?.score ?? 0;

    if (riskIdentification < 50) adjusted -= 10;
    if (actionability < 50) adjusted -= 8;
  }

  if (reportType === "tests") {
    const stepsSignals = regexCount(reportText, /\bsteps\b|^\s*\d+[.)]\s+/g);
    const expectedSignals = regexCount(reportText, /\bexpected result\b|\bshould\b|\bverify\b/g);

    if (stepsSignals < 2) adjusted -= 10;
    if (expectedSignals < 2) adjusted -= 10;
  }

  if (reportType === "improve") {
    if (!reportText.includes("improvements made")) adjusted -= 8;
    if (!reportText.includes("improved test case")) adjusted -= 8;
  }

  return clampScore(adjusted);
}

export function calculateCoverageScore(input: CoverageInput): CoverageScoreResult {
  const profile = TOOL_PROFILES[input.reportType];
  const reportText = normalizeText(`${stringify(input.markdown)}\n${stringify(input.structuredData)}`);
  const sourceText = normalizeText(input.sourceInput);
  const dimensions = profile.dimensions.map((config) => scoreDimension(config, reportText, sourceText));
  const totalWeight = dimensions.reduce((sum, item) => sum + item.weight, 0) || 1;
  const weightedScore = dimensions.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight;
  const score = adjustToolScore(input.reportType, clampScore(weightedScore), dimensions, reportText);
  const grade = gradeFromScore(score);

  const strengths = dimensions
    .filter((item) => item.status === "strong")
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => item.label);

  const gaps = dimensions
    .filter((item) => item.status !== "strong")
    .sort((a, b) => a.score - b.score)
    .slice(0, 4)
    .map((item) => item.recommendation);

  return {
    score,
    grade,
    summary: summaryFromScore(score, profile),
    strengths: strengths.length > 0 ? strengths : ["The output has enough structure to evaluate, but no standout strength yet."],
    gaps: gaps.length > 0 ? gaps : ["No major scoring gaps detected by this scoring pass."],
    dimensions,
    risk: calculateRisk(input, reportText, sourceText, dimensions),
  };
}

export function coverageScoreTone(score: number) {
  if (score >= 85) return "strong";
  if (score >= 70) return "good";
  if (score >= 50) return "warn";
  return "weak";
}

export function riskScoreTone(score: number) {
  if (score >= 67) return "high";
  if (score >= 34) return "medium";
  return "low";
}

export function scoreLabelForReportType(reportType: ReportType): string {
  return TOOL_PROFILES[reportType].scoreLabel;
}

export function scoreMethodForReportType(reportType: ReportType): string {
  switch (reportType) {
    case "tests":
      return "Weighted score across requirements, primary flow, negative paths, edge cases, data/state, auth, regression, and risk-based prioritization.";
    case "risk":
      return "Weighted score across risk identification, requirement clarity, regression exposure, data/state risk, auth/access risk, failure modes, and QA actionability.";
    case "bug":
      return "Weighted score across summary clarity, expected vs actual behavior, reproduction quality, environment detail, evidence/logs, impact, and missing-info control.";
    case "improve":
      return "Weighted score across improved test completeness, improvement explanation, added coverage, setup clarity, remaining gaps, and executability.";
    default:
      return "Weighted QA scoring based on structure, specificity, missing information, and practical actionability.";
  }
}
