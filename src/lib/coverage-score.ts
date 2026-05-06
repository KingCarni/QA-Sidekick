import { calculateAutomationQualityAdjustment } from "@/lib/automation-quality-adjustment";

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

type DimensionConfig = {
  id: CoverageDimensionId;
  label: string;
  weight: number;
  strongTarget: number;
  partialTarget: number;
  positiveSignals: string[];
  structureSignals: string[];
  reasonStrong: string;
  reasonPartial: string;
  reasonWeak: string;
  recommendation: string;
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
  "visually appealing",
  "evaluate the ui presentation",
  "preferred ui designs",
];

const TEST_DIMENSIONS: DimensionConfig[] = [
  {
    id: "acceptanceCriteria",
    label: "Requirements / acceptance coverage",
    weight: 15,
    strongTarget: 4,
    partialTarget: 2,
    positiveSignals: ["acceptance criteria", "expected result", "definition of done", "requirement", "criteria", "preconditions", "given", "when", "then", "should", "must"],
    structureSignals: ["preconditions", "steps", "expected result"],
    reasonStrong: "The output maps validation back to requirements and expected behavior.",
    reasonPartial: "The output touches requirements, but traceability could be tighter.",
    reasonWeak: "The output does not clearly prove the requirement or acceptance criteria are covered.",
    recommendation: "Add explicit checks for each acceptance criterion, expected result, or definition-of-done bullet.",
  },
  {
    id: "happyPath",
    label: "Primary flow coverage",
    weight: 13,
    strongTarget: 3,
    partialTarget: 2,
    positiveSignals: ["successful", "valid", "happy path", "opens", "creates", "saves", "loads", "completes", "primary flow", "main flow", "access", "review"],
    structureSignals: ["test case", "steps", "expected result"],
    reasonStrong: "The primary success path is represented with usable validation.",
    reasonPartial: "The main flow is present, but it is not fully walked end-to-end.",
    reasonWeak: "The primary success path is missing or too vague.",
    recommendation: "Add at least one end-to-end success-path test that validates the main user outcome.",
  },
  {
    id: "negativePath",
    label: "Negative/error coverage",
    weight: 12,
    strongTarget: 4,
    partialTarget: 2,
    positiveSignals: ["negative", "invalid", "error", "failure", "fails", "blocked", "empty", "unauthorized", "permission denied", "validation", "missing required", "confusion", "unclear"],
    structureSignals: ["expected error", "error message", "validation message", "actual result", "negative"],
    reasonStrong: "The output includes meaningful negative-path or error-state coverage.",
    reasonPartial: "Some failure behavior is covered, but important error states may still be thin.",
    reasonWeak: "Negative-path coverage is missing or too vague.",
    recommendation: "Add tests for invalid input, missing data, unavailable services, and expected error messaging.",
  },
  {
    id: "edgeCases",
    label: "Edge / boundary coverage",
    weight: 8,
    strongTarget: 4,
    partialTarget: 2,
    positiveSignals: ["edge case", "boundary", "large", "empty", "null", "duplicate", "multiple", "long", "special character", "timezone", "race condition"],
    structureSignals: ["edge", "boundary", "duplicate", "empty"],
    reasonStrong: "The output includes useful edge-case thinking.",
    reasonPartial: "A few edge cases are present, but coverage is not systematic yet.",
    reasonWeak: "Edge cases are not meaningfully covered.",
    recommendation: "Add boundary, empty-state, duplicate, large-data, and unusual-state scenarios where relevant.",
  },
  {
    id: "dataState",
    label: "Data/state coverage",
    weight: 9,
    strongTarget: 3,
    partialTarget: 1,
    positiveSignals: ["data", "state", "database", "persist", "saved", "reload", "refresh", "metadata", "migration", "cache", "stale", "content"],
    structureSignals: ["reload", "saved", "state", "cleanup", "rollback", "content"],
    reasonStrong: "The output considers data, persistence, or state transitions.",
    reasonPartial: "Some data/state validation is present, but it could be more direct.",
    reasonWeak: "Data/state behavior is not clearly tested.",
    recommendation: "Add checks for saved data, reload behavior, stale state, transitions, and cleanup/rollback.",
  },
  {
    id: "authPermissions",
    label: "Auth/permission coverage",
    weight: 7,
    strongTarget: 3,
    partialTarget: 1,
    positiveSignals: ["auth", "authenticated", "unauthenticated", "permission", "role", "admin", "signed in", "signed out", "unauthorized", "access"],
    structureSignals: ["wrong user", "wrong role", "signed-in", "signed-out", "permission", "access"],
    reasonStrong: "The output includes auth, role, or permission validation.",
    reasonPartial: "Auth/access behavior is mentioned, but not tested deeply.",
    reasonWeak: "Auth and permission coverage is missing.",
    recommendation: "Add signed-in, signed-out, wrong-user, and role/permission cases where applicable.",
  },
  {
    id: "regression",
    label: "Regression coverage",
    weight: 11,
    strongTarget: 3,
    partialTarget: 1,
    positiveSignals: ["regression", "existing", "still works", "does not break", "backward compatible", "unchanged", "previous", "legacy", "current ui"],
    structureSignals: ["existing workflow", "still works", "does not break", "regression", "previous version"],
    reasonStrong: "The output includes regression awareness.",
    reasonPartial: "Regression is implied, but not specific enough.",
    reasonWeak: "Regression coverage is not called out.",
    recommendation: "Add checks that existing workflows still work after this change.",
  },
  {
    id: "riskCoverage",
    label: "Risk-based prioritization",
    weight: 25,
    strongTarget: 4,
    partialTarget: 2,
    positiveSignals: ["risk", "impact", "severity", "priority", "mitigation", "bottleneck", "dependency", "data loss", "security", "performance", "confusion", "decision-making"],
    structureSignals: ["priority", "severity", "risk", "impact", "why it matters", "mitigation"],
    reasonStrong: "The output calls out risk and likely failure areas.",
    reasonPartial: "Some risk thinking is present, but the riskiest areas could be more explicit.",
    reasonWeak: "Risk-based prioritization is weak or absent.",
    recommendation: "Call out likely failure areas, impact, mitigation, and what QA should prioritize first.",
  },
];

const RISK_DIMENSIONS: DimensionConfig[] = [
  {
    id: "riskCoverage",
    label: "Risk identification",
    weight: 24,
    strongTarget: 4,
    partialTarget: 2,
    positiveSignals: ["risk", "severity", "impact", "likelihood", "failure", "bottleneck", "dependency", "release", "regression", "security", "data loss", "confusion", "decision-making"],
    structureSignals: ["key risks", "risk breakdown", "severity", "impact", "mitigation", "why it matters"],
    reasonStrong: "The review identifies practical risks with enough detail to guide QA.",
    reasonPartial: "The review identifies some risks, but prioritization/detail could be stronger.",
    reasonWeak: "The review does not identify risks clearly enough to guide testing.",
    recommendation: "List concrete risks with severity, impact, likelihood, and why QA should care.",
  },
  {
    id: "acceptanceCriteria",
    label: "Requirement clarity analysis",
    weight: 16,
    strongTarget: 3,
    partialTarget: 1,
    positiveSignals: ["missing acceptance", "acceptance criteria", "unclear", "ambiguous", "requirement", "scope", "definition of done", "assumption", "specific details"],
    structureSignals: ["missing acceptance criteria", "assumption", "clarify", "scope", "missing info"],
    reasonStrong: "The review calls out requirement clarity and acceptance criteria gaps.",
    reasonPartial: "Requirement clarity is mentioned, but the gaps could be more concrete.",
    reasonWeak: "Requirement clarity is not meaningfully assessed.",
    recommendation: "Call out unclear acceptance criteria, assumptions, and release-blocking questions.",
  },
  {
    id: "regression",
    label: "Regression exposure",
    weight: 14,
    strongTarget: 3,
    partialTarget: 1,
    positiveSignals: ["regression", "existing", "previous", "legacy", "unchanged", "backward", "still works", "does not break", "current ui"],
    structureSignals: ["regression", "existing workflow", "affected flows", "previous version"],
    reasonStrong: "The review identifies existing flows that could be affected.",
    reasonPartial: "Regression exposure is present but not specific enough.",
    reasonWeak: "Regression exposure is not clearly assessed.",
    recommendation: "Identify existing workflows that could break and recommend regression checks.",
  },
  {
    id: "dataState",
    label: "Data/state risk",
    weight: 10,
    strongTarget: 3,
    partialTarget: 1,
    positiveSignals: ["data", "state", "database", "persist", "saved", "reload", "metadata", "migration", "cache", "stale", "content"],
    structureSignals: ["data risk", "state risk", "cleanup", "rollback", "reload", "content"],
    reasonStrong: "The review identifies data/state risks and likely validation needs.",
    reasonPartial: "Data/state risk is mentioned, but validation guidance could be clearer.",
    reasonWeak: "Data/state risk is not meaningfully assessed.",
    recommendation: "Identify persistence, reload, stale state, migration, and cleanup risks.",
  },
  {
    id: "authPermissions",
    label: "Auth/access risk",
    weight: 8,
    strongTarget: 3,
    partialTarget: 1,
    positiveSignals: ["auth", "permission", "role", "admin", "user", "access", "signed in", "signed out", "unauthorized"],
    structureSignals: ["auth risk", "access risk", "permission", "role", "access"],
    reasonStrong: "The review identifies auth/access risk where applicable.",
    reasonPartial: "Auth/access risk is mentioned, but not tested deeply.",
    reasonWeak: "Auth/access risk is not assessed.",
    recommendation: "Call out signed-in, signed-out, wrong-user, wrong-role, and permission-boundary risks.",
  },
  {
    id: "edgeCases",
    label: "Failure / edge risk",
    weight: 12,
    strongTarget: 3,
    partialTarget: 1,
    positiveSignals: ["failure", "invalid", "empty", "missing", "timeout", "unavailable", "crash", "edge", "boundary", "duplicate", "unclear"],
    structureSignals: ["failure mode", "edge case", "negative", "error", "missing info"],
    reasonStrong: "The review identifies failure modes and edge risks.",
    reasonPartial: "Some failure/edge risk is present, but not complete.",
    reasonWeak: "Failure modes and edge risks are thin.",
    recommendation: "Add likely failure modes, invalid states, empty states, and unavailable dependency risks.",
  },
  {
    id: "happyPath",
    label: "QA actionability",
    weight: 16,
    strongTarget: 4,
    partialTarget: 2,
    positiveSignals: ["recommendation", "qa action", "test focus", "mitigation", "prioritize", "verify", "validate", "next", "release decision", "follow-up question"],
    structureSignals: ["suggested test focus", "recommendation", "mitigation", "qa action", "follow-up questions"],
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
    strongTarget: 3,
    partialTarget: 1,
    positiveSignals: ["summary", "title", "crash", "fails", "error", "when", "while", "after", "cannot", "unable", "needs improvement"],
    structureSignals: ["summary", "title", "bug summary"],
    reasonStrong: "The bug report has a clear, concise problem statement.",
    reasonPartial: "The bug is understandable, but the summary could be more precise.",
    reasonWeak: "The bug summary is too vague to triage confidently.",
    recommendation: "Write a concise summary that states what fails, where it fails, and when it happens.",
  },
  {
    id: "acceptanceCriteria",
    label: "Expected vs actual clarity",
    weight: 18,
    strongTarget: 3,
    partialTarget: 2,
    positiveSignals: ["expected result", "actual result", "should", "instead", "observed", "expected", "actual", "current"],
    structureSignals: ["expected result", "actual result"],
    reasonStrong: "Expected and actual behavior are clearly separated.",
    reasonPartial: "Expected/actual behavior is present, but could be more concrete.",
    reasonWeak: "Expected vs actual behavior is missing or unclear.",
    recommendation: "Separate expected result and actual result so developers can see the defect clearly.",
  },
  {
    id: "negativePath",
    label: "Reproduction quality",
    weight: 20,
    strongTarget: 4,
    partialTarget: 2,
    positiveSignals: ["steps to reproduce", "step", "open", "click", "enter", "select", "navigate", "repro", "reproduces", "happens when", "access", "review"],
    structureSignals: ["steps to reproduce", "1.", "2.", "3."],
    reasonStrong: "The bug includes practical reproduction steps.",
    reasonPartial: "Reproduction steps exist, but may be missing important setup or detail.",
    reasonWeak: "Reproduction steps are too thin to validate the issue reliably.",
    recommendation: "Add clear steps to reproduce, starting state, exact actions, and where the failure appears.",
  },
  {
    id: "environment",
    label: "Environment detail",
    weight: 13,
    strongTarget: 4,
    partialTarget: 2,
    positiveSignals: ["environment", "browser", "device", "os", "version", "build", "repro rate", "production", "staging", "platform", "ios", "android", "windows"],
    structureSignals: ["environment", "device", "os", "build", "version"],
    reasonStrong: "The bug report captures useful environment context.",
    reasonPartial: "Some environment context exists, but reproduction context could be clearer.",
    reasonWeak: "Environment details are missing or too thin.",
    recommendation: "Add browser/device/OS/build/environment and repro rate where possible.",
  },
  {
    id: "evidence",
    label: "Evidence/log coverage",
    weight: 13,
    strongTarget: 4,
    partialTarget: 2,
    positiveSignals: ["evidence", "screenshot", "logs", "console", "network", "video", "attachment", "stack trace", "error message"],
    structureSignals: ["evidence", "attachments", "logs", "screenshot", "console"],
    reasonStrong: "The bug report includes evidence or clear evidence references.",
    reasonPartial: "Evidence is mentioned, but concrete artifacts would make it stronger.",
    reasonWeak: "Evidence is missing.",
    recommendation: "Attach screenshots, logs, console/network errors, videos, or exact error messages when available.",
  },
  {
    id: "riskCoverage",
    label: "Impact / severity clarity",
    weight: 13,
    strongTarget: 3,
    partialTarget: 1,
    positiveSignals: ["impact", "severity", "priority", "blocks", "prevents", "data loss", "user cannot", "release", "critical", "high", "decision-making", "misunderstandings"],
    structureSignals: ["impact", "severity", "priority"],
    reasonStrong: "The bug report explains impact and triage severity.",
    reasonPartial: "Impact/severity is present, but could be more grounded.",
    reasonWeak: "Impact and severity are missing or weak.",
    recommendation: "Explain who is affected, how badly, whether there is a workaround, and suggested severity/priority.",
  },
  {
    id: "regression",
    label: "Missing info / follow-up control",
    weight: 10,
    strongTarget: 3,
    partialTarget: 1,
    positiveSignals: ["missing info", "follow-up questions", "qa notes", "unknown", "needs confirmation", "assumption", "not provided", "specific details"],
    structureSignals: ["missing info", "follow-up questions", "qa notes"],
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
    strongTarget: 4,
    partialTarget: 2,
    positiveSignals: ["improved test case", "title", "preconditions", "steps", "expected result", "priority", "type"],
    structureSignals: ["improved test case", "preconditions", "steps", "expected result"],
    reasonStrong: "The improved test case has clear title, setup, steps, and expected result.",
    reasonPartial: "The improved case has useful structure, but at least one core section needs detail.",
    reasonWeak: "The improved test case is not complete enough to execute.",
    recommendation: "Ensure the improved test has a specific title, preconditions, executable steps, and verifiable expected result.",
  },
  {
    id: "riskCoverage",
    label: "Improvements explained",
    weight: 14,
    strongTarget: 3,
    partialTarget: 1,
    positiveSignals: ["improvements made", "clarified", "added", "strengthened", "converted", "made explicit", "tightened"],
    structureSignals: ["improvements made"],
    reasonStrong: "The output explains what was improved and why.",
    reasonPartial: "Improvements are listed, but the value could be clearer.",
    reasonWeak: "The output does not explain the improvements well.",
    recommendation: "Explain what changed, why it matters, and how it improves QA value.",
  },
  {
    id: "negativePath",
    label: "Added negative/error coverage",
    weight: 12,
    strongTarget: 3,
    partialTarget: 1,
    positiveSignals: ["negative", "invalid", "error", "failure", "missing", "empty", "unauthorized", "validation"],
    structureSignals: ["added coverage", "negative", "error"],
    reasonStrong: "The improved test adds meaningful negative/error coverage.",
    reasonPartial: "Some negative coverage exists, but it could be deeper.",
    reasonWeak: "Negative/error coverage was not improved.",
    recommendation: "Add invalid input, error handling, missing data, and failure-state checks where relevant.",
  },
  {
    id: "edgeCases",
    label: "Added edge/regression coverage",
    weight: 12,
    strongTarget: 3,
    partialTarget: 1,
    positiveSignals: ["edge", "boundary", "regression", "existing", "duplicate", "large", "multiple", "reload", "still works"],
    structureSignals: ["added coverage", "edge", "regression"],
    reasonStrong: "The improvement adds useful edge or regression coverage.",
    reasonPartial: "Some edge/regression coverage exists, but it is not systematic.",
    reasonWeak: "Edge/regression coverage was not meaningfully improved.",
    recommendation: "Add boundary, unusual-state, existing-flow, and regression checks where relevant.",
  },
  {
    id: "dataState",
    label: "Data/setup clarity",
    weight: 12,
    strongTarget: 3,
    partialTarget: 1,
    positiveSignals: ["test data", "setup", "preconditions", "state", "saved", "reload", "database", "account", "role"],
    structureSignals: ["preconditions", "test data", "setup"],
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
    reasonStrong: "Remaining gaps and assumptions are clearly called out.",
    reasonPartial: "Some gaps are noted, but they could be more actionable.",
    reasonWeak: "The improvement does not clearly identify remaining gaps.",
    recommendation: "List remaining missing details, assumptions, and follow-up questions.",
  },
  {
    id: "happyPath",
    label: "Executable QA clarity",
    weight: 20,
    strongTarget: 4,
    partialTarget: 2,
    positiveSignals: ["click", "open", "enter", "select", "verify", "assert", "displayed", "visible", "expected result", "step"],
    structureSignals: ["steps", "expected result", "verify"],
    reasonStrong: "The improved test is clear enough for a tester to execute.",
    reasonPartial: "The test is mostly executable, but steps/assertions need tightening.",
    reasonWeak: "The test is still too vague to execute reliably.",
    recommendation: "Make each step concrete and each expected result observable.",
  },
];

const TOOL_DIMENSIONS: Record<ReportType, DimensionConfig[]> = {
  tests: TEST_DIMENSIONS,
  risk: RISK_DIMENSIONS,
  bug: BUG_DIMENSIONS,
  improve: IMPROVE_DIMENSIONS,
};

const TOOL_NOUN: Record<ReportType, string> = {
  tests: "test plan",
  risk: "risk review",
  bug: "bug report",
  improve: "improved test",
};

const RISK_CONFIGS = [
  {
    label: "Requirements clarity risk",
    exposureSignals: ["vague", "unclear", "missing acceptance", "missing criteria", "not specified", "unknown", "ambiguous", "tbd", "specific details"],
    mitigationSignals: ["acceptance criteria", "definition of done", "expected result", "clear", "specified", "clarify", "follow-up"],
    reasonHigh: "Requirements appear vague, missing, or ambiguous.",
    reasonMedium: "Some requirement uncertainty is present.",
    reasonLow: "Requirements appear reasonably clear.",
  },
  {
    label: "Data/state risk",
    exposureSignals: ["data", "state", "persist", "cache", "stale", "migration", "metadata", "database", "saved", "reload", "content"],
    mitigationSignals: ["test data", "rollback", "cleanup", "reload behavior", "saved correctly", "state transition"],
    reasonHigh: "Data/state behavior has meaningful risk and needs validation.",
    reasonMedium: "Data/state behavior is involved and should be tested directly.",
    reasonLow: "Limited data/state risk detected.",
  },
  {
    label: "Regression risk",
    exposureSignals: ["existing", "regression", "previous", "legacy", "unchanged", "backward", "still works", "does not break", "current ui"],
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
    exposureSignals: ["error", "failure", "fails", "invalid", "empty", "missing", "crash", "timeout", "unavailable", "network", "confusion", "misunderstanding"],
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
  return stringify(value).toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
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
  if (score >= 72) return "strong";
  if (score >= 42) return "partial";
  return "weak";
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function detailScore(text: string): number {
  const words = wordCount(text);
  const numbered = regexCount(text, /\b\d+[.)]\s+/g);
  const bullets = regexCount(text, /(^|\n)\s*[-*•]\s+/g);
  const headings = regexCount(text, /\b(preconditions|steps|expected result|actual result|summary|impact|risk|mitigation|missing info|qa notes)\b/g);

  let score = 0;
  if (words >= 60) score += 4;
  if (words >= 140) score += 5;
  if (words >= 280) score += 5;
  score += Math.min(14, numbered * 2 + bullets * 1.5 + headings * 2);

  return score;
}

function missingPenalty(text: string): number {
  const vagueCount = VAGUE_SIGNALS.reduce((sum, signal) => sum + (text.includes(signal) ? 1 : 0), 0);
  return Math.min(24, vagueCount * 4);
}

function scoreDimension(config: DimensionConfig, reportText: string): CoverageDimension {
  const reportSignalCount = uniqueSignalCount(reportText, config.positiveSignals);
  const structureSignalCount = uniqueSignalCount(reportText, config.structureSignals);
  const signalRatio = Math.min(1, reportSignalCount / Math.max(1, config.strongTarget));
  const structureRatio = Math.min(1, structureSignalCount / Math.max(1, config.partialTarget));
  const reportWords = wordCount(reportText);

  let score = 20;
  score += signalRatio * 42;
  score += structureRatio * 22;
  score += Math.min(16, detailScore(reportText));
  score -= missingPenalty(reportText);

  if (reportWords < 70) score -= 14;
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
    reason: status === "strong" ? config.reasonStrong : status === "partial" ? config.reasonPartial : config.reasonWeak,
    recommendation: config.recommendation,
  };
}

function gradeFromScore(score: number): CoverageScoreResult["grade"] {
  if (score >= 84) return "Strong";
  if (score >= 72) return "Good";
  if (score >= 58) return "Needs Work";
  return "Thin";
}

function summaryFromScore(score: number, reportType: ReportType): string {
  const noun = TOOL_NOUN[reportType];

  if (score >= 82) return `This ${noun} is strong, specific, and ready for practical QA use.`;
  if (score >= 68) return `This ${noun} is usable, with a few gaps worth tightening before handoff.`;
  if (score >= 48) return `This ${noun} has a workable foundation, but important QA detail is still missing.`;
  return `This ${noun} is thin. Add concrete steps, assertions, context, and risk detail before relying on it.`;
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
  const weakCoveragePenalty = dimensions.filter((item) => item.status === "weak").length * 3;
  const partialCoveragePenalty = dimensions.filter((item) => item.status === "partial").length * 1.5;

  const items = RISK_CONFIGS.map((config) => {
    const exposure = uniqueSignalCount(combinedText, config.exposureSignals);
    const mitigation = uniqueSignalCount(reportText, config.mitigationSignals);
    const outputIsThin = wordCount(reportText) < 120;
    let score = exposure * 15 - mitigation * 8;

    if (input.reportType === "risk" && exposure > 0) score += 6;
    if (outputIsThin && exposure > 0) score += 8;
    if (exposure === 0) score = Math.max(0, score - 6);

    const finalScore = clampScore(score);
    const status = riskStatus(finalScore);

    return {
      label: config.label,
      score: finalScore,
      status,
      reason: status === "high" ? config.reasonHigh : status === "medium" ? config.reasonMedium : config.reasonLow,
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

    if (repro < 42) adjusted -= 8;
    if (expectedActual < 42) adjusted -= 8;
    if (reportText.includes("no evidence attached") || reportText.includes("no logs")) adjusted -= 3;
  }

  if (reportType === "risk") {
    const riskIdentification = dimensions.find((item) => item.label === "Risk identification")?.score ?? 0;
    const actionability = dimensions.find((item) => item.label === "QA actionability")?.score ?? 0;

    if (riskIdentification < 42) adjusted -= 8;
    if (actionability < 42) adjusted -= 6;
  }

  if (reportType === "tests") {
    const stepsSignals = regexCount(reportText, /\bsteps\b|^\s*\d+[.)]\s+/g);
    const expectedSignals = regexCount(reportText, /\bexpected result\b|\bshould\b|\bverify\b/g);

    if (stepsSignals < 2) adjusted -= 8;
    if (expectedSignals < 2) adjusted -= 8;
  }

  if (reportType === "improve") {
    if (!reportText.includes("improvements made")) adjusted -= 8;
    if (!reportText.includes("improved test case")) adjusted -= 8;
  }

  return clampScore(adjusted);
}

function calibrateUserFacingScore(
  reportType: ReportType,
  baseScore: number,
  dimensions: CoverageDimension[],
  reportText: string,
  automationAdjustment?: {
    exportableCount: number;
    totalCount: number;
    manualReviewCount: number;
    cap: number;
    penalty: number;
  }
): number {
  let score = baseScore;

  const strongCount = dimensions.filter((item) => item.status === "strong").length;
  const partialCount = dimensions.filter((item) => item.status === "partial").length;
  const weakCount = dimensions.filter((item) => item.status === "weak").length;
  const hasUsefulStructure =
    reportText.includes("preconditions") &&
    reportText.includes("steps") &&
    reportText.includes("expected result");
  const hasVagueFailure =
    /visually appealing|user experiences confusion|evaluate the ui presentation|preferred designs/i.test(reportText);

  if (reportType === "tests") {
    const total = automationAdjustment?.totalCount ?? 0;
    const exportable = automationAdjustment?.exportableCount ?? 0;
    const exportableRatio = total > 0 ? exportable / total : 0;

    if (hasUsefulStructure && total >= 4 && exportable >= 1 && !hasVagueFailure) {
      score = Math.max(score, 68);
    }

    if (hasUsefulStructure && total >= 5 && exportableRatio >= 0.4 && !hasVagueFailure) {
      score = Math.max(score, 74);
    }

    if (hasUsefulStructure && total >= 5 && exportableRatio >= 0.6 && strongCount + partialCount >= weakCount) {
      score = Math.max(score, 78);
    }

    if (hasVagueFailure) {
      score = Math.min(score, 64);
    }

    if (total > 0 && exportable === 0) {
      score = Math.min(score, 68);
    }
  }

  if (reportType === "risk") {
    if (strongCount >= 2 && partialCount >= 2) score = Math.max(score, 72);
    if (weakCount >= 4) score = Math.min(score, 66);
  }

  if (reportType === "bug") {
    if (hasUsefulStructure && strongCount >= 2) score = Math.max(score, 72);
    if (weakCount >= 4) score = Math.min(score, 66);
  }

  if (reportType === "improve") {
    if (hasUsefulStructure && strongCount >= 2) score = Math.max(score, 72);
    if (weakCount >= 4) score = Math.min(score, 66);
  }

  return clampScore(Math.min(score, automationAdjustment?.cap ?? 100));
}

export function calculateCoverageScore(input: CoverageInput): CoverageScoreResult {
  const dimensionsConfig = TOOL_DIMENSIONS[input.reportType];
  const reportText = normalizeText(`${stringify(input.markdown)}\n${stringify(input.structuredData)}`);
  const sourceText = normalizeText(input.sourceInput);
  const dimensions = dimensionsConfig.map((config) => scoreDimension(config, reportText));
  const totalWeight = dimensions.reduce((sum, item) => sum + item.weight, 0) || 1;
  const weightedScore = dimensions.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight;
  const automationAdjustment = calculateAutomationQualityAdjustment(
    input.reportType,
    `${stringify(input.markdown)}\n${stringify(input.structuredData)}`
  );
  const adjustedBaseScore = adjustToolScore(input.reportType, clampScore(weightedScore), dimensions, reportText);
  const diagnosticScore = clampScore(
    Math.min(adjustedBaseScore - automationAdjustment.penalty, automationAdjustment.cap)
  );
  const score = calibrateUserFacingScore(
    input.reportType,
    diagnosticScore,
    dimensions,
    reportText,
    automationAdjustment
  );
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
  const automationGaps =
    input.reportType === "tests" && automationAdjustment.reasons.length > 0
      ? automationAdjustment.reasons
      : [];

  return {
    score,
    grade,
    summary: summaryFromScore(score, input.reportType),
    strengths: strengths.length > 0 ? strengths : ["The output has enough structure to evaluate, but no standout strength yet."],
    gaps:
      [...automationGaps, ...gaps].length > 0
        ? [...automationGaps, ...gaps].slice(0, 5)
        : ["No major scoring gaps detected by this scoring pass."],
    dimensions,
    risk: calculateRisk(input, reportText, sourceText, dimensions),
  };
}

export function coverageScoreTone(score: number) {
  if (score >= 82) return "strong";
  if (score >= 68) return "good";
  if (score >= 48) return "warn";
  return "weak";
}

export function riskScoreTone(score: number) {
  if (score >= 67) return "high";
  if (score >= 34) return "medium";
  return "low";
}

export function scoreLabelForReportType(reportType: ReportType): string {
  switch (reportType) {
    case "tests":
      return "Test Plan Quality";
    case "risk":
      return "Risk Review Score";
    case "bug":
      return "Bug Report Quality";
    case "improve":
      return "Improvement Score";
    default:
      return "QA Score";
  }
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
