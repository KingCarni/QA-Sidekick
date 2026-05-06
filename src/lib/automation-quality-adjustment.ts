import type { ReportType } from "@/lib/coverage-score";
import { evaluateAutomationReadiness } from "@/lib/automation-readiness";

export type AutomationQualityAdjustment = {
  automationScore: number;
  exportableCount: number;
  totalCount: number;
  manualReviewCount: number;
  cap: number;
  penalty: number;
  reasons: string[];
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

export function calculateAutomationQualityAdjustment(
  reportType: ReportType,
  generatedOutput: unknown
): AutomationQualityAdjustment {
  if (reportType !== "tests") {
    return {
      automationScore: 0,
      exportableCount: 0,
      totalCount: 0,
      manualReviewCount: 0,
      cap: 100,
      penalty: 0,
      reasons: [],
    };
  }

  const text = stringify(generatedOutput);
  const readiness = evaluateAutomationReadiness(text);
  const totalCount = readiness.cases.length;
  const exportableCount = readiness.totals.ready + readiness.totals.partial;
  const manualReviewCount = readiness.totals.manual + readiness.totals.blocked;
  const exportableRatio = totalCount > 0 ? exportableCount / totalCount : 0;
  const reasons: string[] = [];

  let cap = 100;
  let penalty = 0;

  if (totalCount === 0) {
    cap = 42;
    penalty = 12;
    reasons.push("No test cases were found for automation readiness scoring.");
  } else if (exportableCount === 0) {
    cap = 70;
    penalty = 4;
    reasons.push("No cases are currently automation-ready; add selectors, seed data, or clearer assertions.");
  } else if (exportableRatio < 0.25) {
    cap = 80;
    penalty = 1;
    reasons.push("Only a small portion of the suite is automation-ready or partial.");
  } else if (exportableRatio < 0.5) {
    cap = 88;
    penalty = 0;
    reasons.push("Some generated cases are automation candidates, but automation readiness is limited.");
  }

  if (readiness.overallScore < 40) {
    cap = Math.min(cap, 72);
    penalty += 2;
    reasons.push("Automation readiness is low because actions, assertions, setup, or targets need cleanup.");
  }

  return {
    automationScore: readiness.overallScore,
    exportableCount,
    totalCount,
    manualReviewCount,
    cap,
    penalty,
    reasons,
  };
}
