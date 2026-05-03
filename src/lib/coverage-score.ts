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
  positiveSignals: string[];
  sourceSignals?: string[];
  reasonStrong: string;
  reasonPartial: string;
  reasonWeak: string;
  recommendation: string;
};

type RiskConfig = {
  label: string;
  signals: string[];
  calmingSignals: string[];
  reasonHigh: string;
  reasonMedium: string;
  reasonLow: string;
};

const COMMON_DIMENSIONS: DimensionConfig[] = [
  {
    id: "acceptanceCriteria",
    label: "Acceptance criteria coverage",
    weight: 18,
    positiveSignals: [
      "acceptance criteria",
      "expected result",
      "preconditions",
      "definition of done",
      "given",
      "when",
      "then",
      "requirement",
      "criteria",
      "scope",
    ],
    sourceSignals: ["acceptance criteria", "definition of done", "scope", "requirement", "must", "should"],
    reasonStrong: "The output clearly maps validation back to requirements or expected results.",
    reasonPartial: "The output includes some requirement validation, but the requirement mapping could be tighter.",
    reasonWeak: "The output does not clearly prove that acceptance criteria or requirements are covered.",
    recommendation: "Add explicit checks for each acceptance criterion, expected result, or definition-of-done bullet.",
  },
  {
    id: "happyPath",
    label: "Happy path coverage",
    weight: 14,
    positiveSignals: [
      "happy path",
      "successful",
      "valid",
      "create",
      "saves",
      "loads",
      "opens",
      "completes",
      "expected result",
      "primary flow",
    ],
    sourceSignals: ["create", "save", "open", "complete", "load", "successful", "valid"],
    reasonStrong: "The main successful user flow appears covered.",
    reasonPartial: "The main flow is touched, but not fully walked end-to-end.",
    reasonWeak: "The primary success path is not clearly represented.",
    recommendation: "Add at least one end-to-end success-path test that validates the main user outcome.",
  },
  {
    id: "negativePath",
    label: "Negative/error coverage",
    weight: 14,
    positiveSignals: [
      "negative",
      "invalid",
      "error",
      "failure",
      "fails",
      "blocked",
      "missing",
      "empty",
      "unauthorized",
      "permission denied",
      "validation",
    ],
    sourceSignals: ["error", "failure", "invalid", "missing", "unauthorized", "empty", "blocked"],
    reasonStrong: "The output includes meaningful negative-path or error-state coverage.",
    reasonPartial: "Some failure behavior is covered, but important error states may still be thin.",
    reasonWeak: "Negative-path coverage is missing or too vague.",
    recommendation: "Add tests for invalid input, missing data, unavailable services, and expected error messaging.",
  },
  {
    id: "edgeCases",
    label: "Edge case coverage",
    weight: 12,
    positiveSignals: [
      "edge case",
      "boundary",
      "large",
      "empty",
      "null",
      "duplicate",
      "multiple",
      "long",
      "special character",
      "timezone",
      "race condition",
    ],
    sourceSignals: ["multiple", "large", "empty", "duplicate", "edge", "future", "rare", "boundary"],
    reasonStrong: "The output includes useful edge-case thinking.",
    reasonPartial: "A few edge cases are present, but the coverage is not systematic yet.",
    reasonWeak: "Edge cases are not meaningfully covered.",
    recommendation: "Add boundary, empty-state, duplicate, large-data, and unusual-state scenarios where relevant.",
  },
  {
    id: "riskCoverage",
    label: "Risk coverage",
    weight: 14,
    positiveSignals: [
      "risk",
      "impact",
      "severity",
      "mitigation",
      "bottleneck",
      "regression risk",
      "dependency",
      "data loss",
      "security",
      "performance",
    ],
    sourceSignals: ["risk", "dependency", "out of scope", "impact", "performance", "security"],
    reasonStrong: "The output calls out risks and likely failure areas.",
    reasonPartial: "Some risk thinking is present, but the riskiest areas could be more explicit.",
    reasonWeak: "Risk coverage is weak or absent.",
    recommendation: "Call out likely failure areas, impact, mitigation, and what QA should prioritize first.",
  },
  {
    id: "dataState",
    label: "Data/state coverage",
    weight: 10,
    positiveSignals: [
      "data",
      "state",
      "database",
      "persist",
      "saved",
      "reload",
      "refresh",
      "metadata",
      "migration",
      "cache",
      "stale",
    ],
    sourceSignals: ["data", "state", "persist", "saved", "metadata", "model", "cache"],
    reasonStrong: "The output considers data, persistence, or state transitions.",
    reasonPartial: "Some data/state validation is present, but it could be more direct.",
    reasonWeak: "Data/state behavior is not clearly tested.",
    recommendation: "Add checks for saved data, reload behavior, stale state, transitions, and cleanup/rollback.",
  },
  {
    id: "authPermissions",
    label: "Auth/permission coverage",
    weight: 8,
    positiveSignals: [
      "auth",
      "authenticated",
      "unauthenticated",
      "permission",
      "role",
      "admin",
      "signed in",
      "signed out",
      "unauthorized",
      "access",
    ],
    sourceSignals: ["auth", "permission", "role", "admin", "user", "access"],
    reasonStrong: "The output includes auth, role, or permission validation.",
    reasonPartial: "Auth/access behavior is mentioned, but not tested deeply.",
    reasonWeak: "Auth and permission coverage is missing.",
    recommendation: "Add signed-in, signed-out, wrong-user, and role/permission cases where applicable.",
  },
  {
    id: "regression",
    label: "Regression coverage",
    weight: 10,
    positiveSignals: [
      "regression",
      "existing",
      "still works",
      "does not break",
      "backward compatible",
      "unchanged",
      "previous",
      "legacy",
    ],
    sourceSignals: ["existing", "regression", "unchanged", "previous", "backward"],
    reasonStrong: "The output includes regression awareness.",
    reasonPartial: "Regression is implied, but not specific enough.",
    reasonWeak: "Regression coverage is not called out.",
    recommendation: "Add checks that existing workflows still work after this change.",
  },
];

const BUG_EXTRA_DIMENSIONS: DimensionConfig[] = [
  {
    id: "environment",
    label: "Environment coverage",
    weight: 10,
    positiveSignals: [
      "environment",
      "browser",
      "device",
      "os",
      "version",
      "build",
      "repro rate",
      "production",
      "staging",
      "platform",
    ],
    sourceSignals: ["browser", "device", "os", "version", "build", "environment", "platform"],
    reasonStrong: "The bug report captures useful environment context.",
    reasonPartial: "Some environment context exists, but reproduction context could be clearer.",
    reasonWeak: "Environment details are missing or too thin.",
    recommendation: "Add browser/device/OS/build/environment and repro rate where possible.",
  },
  {
    id: "evidence",
    label: "Evidence coverage",
    weight: 10,
    positiveSignals: [
      "evidence",
      "screenshot",
      "logs",
      "console",
      "network",
      "video",
      "attachment",
      "stack trace",
      "error message",
    ],
    sourceSignals: ["screenshot", "log", "console", "network", "video", "attachment", "error"],
    reasonStrong: "The bug report includes evidence or clear evidence placeholders.",
    reasonPartial: "Evidence is mentioned, but the report could be stronger with concrete artifacts.",
    reasonWeak: "Evidence is missing.",
    recommendation: "Attach screenshots, logs, console/network errors, videos, or exact error messages when available.",
  },
];

const RISK_CONFIGS: RiskConfig[] = [
  {
    label: "Requirements clarity risk",
    signals: ["vague", "unclear", "missing acceptance", "missing criteria", "not specified", "unknown", "ambiguous", "tbd"],
    calmingSignals: ["acceptance criteria", "definition of done", "expected result", "clear", "specified"],
    reasonHigh: "Requirements appear vague, missing, or ambiguous.",
    reasonMedium: "Some requirement uncertainty is present.",
    reasonLow: "Requirements appear reasonably clear.",
  },
  {
    label: "Data/state risk",
    signals: ["data", "state", "persist", "cache", "stale", "migration", "metadata", "database", "saved", "reload"],
    calmingSignals: ["test data", "rollback", "cleanup", "reload behavior", "saved correctly", "state transition"],
    reasonHigh: "Data/state behavior has meaningful risk and needs validation.",
    reasonMedium: "Data/state behavior is involved and should be tested directly.",
    reasonLow: "Limited data/state risk detected.",
  },
  {
    label: "Regression risk",
    signals: ["existing", "regression", "previous", "legacy", "unchanged", "backward", "still works", "does not break"],
    calmingSignals: ["regression test", "existing workflow", "still works", "backward compatible"],
    reasonHigh: "Existing flows may be impacted and regression coverage is important.",
    reasonMedium: "Some regression exposure is present.",
    reasonLow: "Limited regression exposure detected.",
  },
  {
    label: "Auth/access risk",
    signals: ["auth", "permission", "role", "admin", "user", "access", "signed in", "signed out", "unauthorized"],
    calmingSignals: ["signed-in", "signed-out", "wrong-user", "role", "permission test"],
    reasonHigh: "Auth/access behavior may affect correctness or data isolation.",
    reasonMedium: "Auth/access should be verified.",
    reasonLow: "Limited auth/access risk detected.",
  },
  {
    label: "Failure-mode risk",
    signals: ["error", "failure", "fails", "invalid", "empty", "missing", "crash", "timeout", "unavailable", "network"],
    calmingSignals: ["error message", "validation", "graceful", "negative test", "fallback"],
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

function countSignals(text: string, signals: string[]) {
  return signals.reduce((count, signal) => {
    return text.includes(signal.toLowerCase()) ? count + 1 : count;
  }, 0);
}

function countRegex(text: string, regex: RegExp) {
  return (text.match(regex) ?? []).length;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function dimensionStatus(score: number): CoverageDimension["status"] {
  if (score >= 75) return "strong";
  if (score >= 45) return "partial";
  return "weak";
}

function hasThinOutputPenalty(reportText: string) {
  const notSpecifiedCount = countRegex(reportText, /\bnot specified\b/g);
  const unknownCount = countRegex(reportText, /\bunknown\b/g);
  const noDetailsCount = countRegex(reportText, /\bno .+ returned\b/g);
  const shortReport = reportText.length < 700;

  return shortReport || notSpecifiedCount >= 2 || unknownCount >= 2 || noDetailsCount >= 2;
}

function getReportDetailBonus(reportText: string) {
  const wordCount = reportText.split(/\s+/).filter(Boolean).length;
  const concreteMarkerCount = countRegex(reportText, /\b(expected|actual|preconditions|steps|priority|severity|risk|impact|mitigation|environment|evidence|regression|edge|negative|validation)\b/g);

  let bonus = 0;

  if (wordCount >= 250) bonus += 4;
  if (wordCount >= 500) bonus += 4;
  if (concreteMarkerCount >= 8) bonus += 4;
  if (concreteMarkerCount >= 16) bonus += 4;

  return bonus;
}

function scoreDimension(config: DimensionConfig, reportText: string, sourceText: string): CoverageDimension {
  const reportSignalCount = countSignals(reportText, config.positiveSignals);
  const sourceSignalCount = countSignals(sourceText, config.sourceSignals ?? config.positiveSignals);
  const detailBonus = getReportDetailBonus(reportText);
  const thinPenalty = hasThinOutputPenalty(reportText) ? 10 : 0;
  const sourceRequiresThisArea = sourceSignalCount > 0;

  let score = 0;

  if (reportSignalCount >= 4) score = 88;
  else if (reportSignalCount === 3) score = 76;
  else if (reportSignalCount === 2) score = 62;
  else if (reportSignalCount === 1) score = 44;
  else score = sourceRequiresThisArea ? 22 : 32;

  score += detailBonus;

  if (sourceRequiresThisArea && reportSignalCount === 0) {
    score -= 10;
  }

  score -= thinPenalty;

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

function getDimensionConfigs(reportType: ReportType): DimensionConfig[] {
  if (reportType === "bug") {
    return [
      COMMON_DIMENSIONS[0],
      COMMON_DIMENSIONS[2],
      COMMON_DIMENSIONS[4],
      COMMON_DIMENSIONS[5],
      COMMON_DIMENSIONS[6],
      ...BUG_EXTRA_DIMENSIONS,
      COMMON_DIMENSIONS[7],
    ];
  }

  if (reportType === "risk") {
    return [
      COMMON_DIMENSIONS[4],
      COMMON_DIMENSIONS[0],
      COMMON_DIMENSIONS[2],
      COMMON_DIMENSIONS[3],
      COMMON_DIMENSIONS[5],
      COMMON_DIMENSIONS[6],
      COMMON_DIMENSIONS[7],
    ];
  }

  return COMMON_DIMENSIONS;
}

function gradeFromScore(score: number): CoverageScoreResult["grade"] {
  if (score >= 85) return "Strong";
  if (score >= 70) return "Good";
  if (score >= 50) return "Needs Work";
  return "Thin";
}

function summaryFromScore(score: number, reportType: ReportType) {
  const noun =
    reportType === "bug"
      ? "bug report"
      : reportType === "risk"
        ? "risk review"
        : reportType === "improve"
          ? "improved test"
          : "test plan";

  if (score >= 85) return `This ${noun} has strong practical coverage and should be useful for release planning.`;
  if (score >= 70) return `This ${noun} is usable, with a few coverage gaps worth tightening before handoff.`;
  if (score >= 50) return `This ${noun} has a workable foundation, but several important QA angles need more detail.`;
  return `This ${noun} is thin. Add more concrete validation, risks, and edge cases before relying on it.`;
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
  const weakCoveragePenalty = dimensions.filter((item) => item.status === "weak").length * 5;
  const partialCoveragePenalty = dimensions.filter((item) => item.status === "partial").length * 2;

  const items = RISK_CONFIGS.map((config) => {
    const rawSignals = countSignals(combinedText, config.signals);
    const calmingSignals = countSignals(reportText, config.calmingSignals);

    let score = rawSignals * 22 - calmingSignals * 10;

    if (input.reportType === "risk" && rawSignals > 0) score += 10;
    if (hasThinOutputPenalty(reportText)) score += 10;

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

export function calculateCoverageScore(input: CoverageInput): CoverageScoreResult {
  const reportText = normalizeText(`${stringify(input.markdown)}\n${stringify(input.structuredData)}`);
  const sourceText = normalizeText(input.sourceInput);
  const configs = getDimensionConfigs(input.reportType);

  const dimensions = configs.map((config) => scoreDimension(config, reportText, sourceText));
  const totalWeight = dimensions.reduce((sum, item) => sum + item.weight, 0) || 1;
  const weightedScore = dimensions.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight;

  const score = clampScore(weightedScore);
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
    summary: summaryFromScore(score, input.reportType),
    strengths: strengths.length > 0 ? strengths : ["The report has enough structure to evaluate, but no standout coverage area yet."],
    gaps: gaps.length > 0 ? gaps : ["No major coverage gaps detected by the heuristic scoring pass."],
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
