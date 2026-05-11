"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import AppHeaderMenu from "@/components/AppHeaderMenu";
import AuthStatus from "@/components/AuthStatus";
import AdminDebugMenu from "@/components/AdminDebugMenu";
import AutomationExportPanel from "@/components/AutomationExportPanel";
import BugEvidencePanel, {
  EMPTY_BUG_EVIDENCE,
  appendBugEvidenceToMarkdown,
  type BugEvidenceState,
} from "@/components/BugEvidencePanel";
import BugEvidencePreview from "@/components/BugEvidencePreview";
import CoverageScorePanel from "@/components/CoverageScorePanel";
import FeatureBuilderTool from "@/components/FeatureBuilderTool";
import QAtGuideCard from "@/components/QAtGuideCard";
import JiraCreateIssueButton from "@/components/JiraCreateIssueButton";
import RiskReviewPanel from "@/components/RiskReviewPanel";
import SaveBugToCollectionButton from "@/components/SaveBugToCollectionButton";
import SaveGeneratedOutputToSourceButton from "@/components/SaveGeneratedOutputToSourceButton";
import StackedProjectJiraControls from "@/components/StackedProjectJiraControls";
import HeaderProjectSourceControls from "@/components/HeaderProjectSourceControls";
import { publishCreditBalanceUpdated } from "@/lib/credit-balance-events";
import type { ActiveProjectContext } from "@/components/ProjectContextIndicator";
import type { SafeQAProject } from "@/components/ProjectSettingsPanel";
import TestCaseAutomationReadiness from "@/components/TestCaseAutomationReadiness";
import TestCaseCostConfirmModal from "@/components/TestCaseCostConfirmModal";
import TestCaseDisplayControls from "@/components/TestCaseDisplayControls";
import TestCaseQualityBadge from "@/components/TestCaseQualityBadge";
import TestRailSyncPanel from "@/components/TestRailSyncPanel";
import ToolToolbar, { type QatalystToolOption } from "@/components/ToolToolbar";
import { calculateTestCaseQuality, getTestCaseQualityCardClass } from "@/lib/test-case-quality";
import {
  buildProjectContextPayload,
  type ProjectContextPayload,
} from "@/lib/project-context-injection";
import {
  buildAutomationCredentialPayload,
  type AutomationCredentialProfile,
} from "@/lib/automation-credentials";
import {
  normalizeAutomationProjectConfig,
  type AutomationProjectConfig,
} from "@/lib/automation-project-config";
import {
  buildGenerationFingerprint,
  buildOutputGenerationKey,
} from "@/lib/regeneration-guard";
import type { ParsedJiraTicket } from "@/lib/jira-ticket";
import {
  FTUE_KEYS,
  completeFtueStep,
  isFtueStepComplete,
  type FtueStepKey,
} from "@/lib/ftue-state";

type ToolId = "tests" | "bug" | "risk" | "improve" | "feature";
type ReportToolId = Exclude<ToolId, "feature">;

const TOOL_TEST_IDS: Record<ToolId, string> = {
  tests: "tool-tab-test-cases",
  bug: "tool-tab-bug-writer",
  risk: "tool-tab-risk-review",
  improve: "tool-tab-test-improver",
  feature: "tool-tab-feature-builder",
};

const RUN_BUTTON_TEST_IDS: Record<ToolId, string> = {
  tests: "run-test-cases-button",
  bug: "run-bug-writer-button",
  risk: "run-risk-review-button",
  improve: "run-test-improver-button",
  feature: "build-feature-brief-button",
};

const TOOL_COST_LABELS: Record<ToolId, string> = {
  tests: "5+ credits",
  bug: "2 credits",
  risk: "3 credits",
  improve: "2 credits",
  feature: "5 credits",
};

type SaveReportStatus = "idle" | "saving" | "saved" | "error";

type SaveReportResponse = {
  ok?: boolean;
  error?: string;
  report?: {
    id: string;
  };
};

type SaveReportControlProps = {
  saveReportStatus: SaveReportStatus;
  saveReportMessage: string;
  savedReportId: string;
  onSaveReport: (markdown: string) => void;
};

type CoverageScoreProps = {
  reportType: ReportToolId;
  sourceInput: string;
  testCaseGenerationKey?: string;
  automationCredentialProfiles?: ReturnType<typeof buildAutomationCredentialPayload>["profiles"];
  automationCredentialDefaultProfileKey?: string;
  automationCredentialEnvExample?: string;
  automationProjectConfig?: AutomationProjectConfig;
};

type SaveReportButtonProps = Omit<SaveReportControlProps, "onSaveReport"> & {
  onSaveReport: () => void;
};

type TestCase = {
  title?: unknown;
  type?: unknown;
  preconditions?: unknown;
  steps?: unknown;
  expectedResult?: unknown;
  priority?: unknown;
};

type RiskItem = {
  title?: unknown;
  severity?: unknown;
  area?: unknown;
  whyItMatters?: unknown;
  mitigation?: unknown;
};

type BottleneckItem = {
  title?: unknown;
  impact?: unknown;
  owner?: unknown;
  recommendation?: unknown;
};

type RiskReview = {
  overallRisk?: unknown;
  summary?: unknown;
  keyRisks?: unknown;
  bottlenecks?: unknown;
  missingAcceptanceCriteria?: unknown;
  qaFollowUpQuestions?: unknown;
  suggestedTestFocus?: unknown;
};

type BugReport = {
  title?: unknown;
  severitySuggestion?: unknown;
  prioritySuggestion?: unknown;
  summary?: unknown;
  environment?: unknown;
  stepsToReproduce?: unknown;
  expectedResult?: unknown;
  actualResult?: unknown;
  impact?: unknown;
  missingInfo?: unknown;
  followUpQuestions?: unknown;
  qaNotes?: unknown;
};

type TestImprovementReport = {
  title?: unknown;
  improvedTestCase?: unknown;
  improvementsMade?: unknown;
  addedCoverage?: unknown;
  missingInfo?: unknown;
  followUpQuestions?: unknown;
  qaNotes?: unknown;
};

type UploadedEvidenceFile = {
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
  textPreview?: string;
};

type FollowUpResolution = "Resolved" | "Still open" | "No more questions";

type AnsweredFollowUp = {
  question: string;
  answer: string;
  answerType: string;
  resolution: FollowUpResolution;
};

const tools: Array<QatalystToolOption & { button: string; placeholder: string }> = [
  {
    id: "tests",
    label: "Test Cases",
    description: "Generate release-ready QA coverage",
    tone: "green",
    button: "Run Test Cases",
    placeholder: "Paste a Jira ticket, user story, or acceptance criteria here...",
    testId: TOOL_TEST_IDS.tests,
  },
  {
    id: "bug",
    label: "Bug Writer",
    description: "Turn rough notes into a clean defect",
    tone: "yellow",
    button: "Improve Bug Report",
    placeholder: "Paste rough bug notes, repro details, or a messy bug report...",
    testId: TOOL_TEST_IDS.bug,
  },
  {
    id: "risk",
    label: "Risk Review",
    description: "Expose gaps, risks, and bottlenecks",
    tone: "red",
    button: "Analyze Risk",
    placeholder: "Paste a ticket or requirements doc to expose risks, gaps, and bottlenecks...",
    testId: TOOL_TEST_IDS.risk,
  },
  {
    id: "improve",
    label: "Test Improver",
    description: "Upgrade weak test cases/checklists",
    tone: "green",
    button: "Improve Test Case",
    placeholder: "Paste an existing test case or checklist you want improved...",
    testId: TOOL_TEST_IDS.improve,
  },
  {
    id: "feature",
    label: "Feature Builder",
    description: "Shape rough ideas into feature briefs",
    tone: "blue",
    button: "Build Feature Brief",
    placeholder: "Describe the feature you want to shape...",
    testId: TOOL_TEST_IDS.feature,
  },
];

const DEFAULT_VISIBLE_TEST_CASE_LIMIT = 10;

function humanizeKey(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeText(value: unknown): string {
  if (value === null || value === undefined) return "Not specified.";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(safeText).join(", ");
  if (isPlainObject(value)) {
    return Object.entries(value)
      .map(([key, item]) => `${humanizeKey(key)}: ${safeText(item)}`)
      .join("\n");
  }
  return String(value);
}

function getPaidActionErrorMessage(data: unknown, status?: number) {
  const payload = isPlainObject(data) ? data : {};

  if (status === 402 || payload.code === "INSUFFICIENT_CREDITS") {
    const details = isPlainObject(payload.details) ? payload.details : {};
    const required = details.required ?? details.cost;
    const balance = details.balance;

    if (required !== undefined && balance !== undefined) {
      return `Not enough credits. This action costs ${required} credits. You currently have ${balance}.`;
    }

    return "Not enough credits for this action.";
  }

  return safeText(payload.message || payload.error || "Something went wrong.");
}

function valueLines(value: unknown): string[] {
  if (value === null || value === undefined) return ["Not specified."];
  if (typeof value === "string") return [value];
  if (typeof value === "number" || typeof value === "boolean") return [String(value)];
  if (Array.isArray(value)) return value.map(safeText);
  if (isPlainObject(value)) {
    return Object.entries(value).map(([key, item]) => `${humanizeKey(key)}: ${safeText(item)}`);
  }
  return [String(value)];
}

function meaningfulLines(value: unknown): string[] {
  return valueLines(value).filter((line) => line.trim() && line !== "Not specified.");
}


function isNegativeOrNotApplicableAnswer(value: string): boolean {
  const normalized = value.trim().toLowerCase();

  if (!normalized) return false;

  return [
    "no",
    "nope",
    "none",
    "n/a",
    "na",
    "not applicable",
    "does not apply",
    "nothing",
    "no logs",
    "no workaround",
    "not reproduced elsewhere",
  ].includes(normalized);
}

function buildAnsweredFollowUps(
  questions: string[],
  answers: Record<string, string>,
  resolutions: Record<string, FollowUpResolution>
): AnsweredFollowUp[] {
  return questions
    .map((question) => {
      const answer = answers[question]?.trim();

      if (!answer) return null;

      return {
        question,
        answer,
        answerType: isNegativeOrNotApplicableAnswer(answer)
          ? "Answered negative / not applicable"
          : "Answered",
        resolution: resolutions[question] ?? "Still open",
      };
    })
    .filter((item): item is AnsweredFollowUp => item !== null);
}

function mergeAnsweredFollowUpHistory(
  history: AnsweredFollowUp[],
  latestAnswers: AnsweredFollowUp[]
): AnsweredFollowUp[] {
  const merged = [...history];

  latestAnswers.forEach((latest) => {
    const existingIndex = merged.findIndex((item) => item.question === latest.question);

    if (existingIndex >= 0) {
      merged[existingIndex] = latest;
      return;
    }

    merged.push(latest);
  });

  return merged;
}

function arrayFromUnknown<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function parseOutput(output: string): unknown {
  try {
    return JSON.parse(output);
  } catch {
    return output;
  }
}

function unwrapQaResult(parsed: unknown): unknown {
  if (isPlainObject(parsed) && "result" in parsed) {
    return parsed.result;
  }

  return parsed;
}

function getBugReportFromOutput(output: string): BugReport | null {
  const parsed = parseOutput(output);

  if (isPlainObject(parsed) && isPlainObject(parsed.bugReport)) {
    return parsed.bugReport as BugReport;
  }

  return null;
}

function getTestOutputFromOutput(output: string): Record<string, unknown> | null {
  const parsed = parseOutput(output);

  if (isPlainObject(parsed) && Array.isArray(parsed.testCases)) {
    return parsed;
  }

  return null;
}

function getRiskReviewFromOutput(output: string): RiskReview | null {
  const parsed = parseOutput(output);

  if (isPlainObject(parsed) && isPlainObject(parsed.riskReview)) {
    return parsed.riskReview as RiskReview;
  }

  return null;
}

function normalizeSteps(steps: unknown): string[] {
  if (Array.isArray(steps)) return steps.map(safeText);
  if (typeof steps === "string") {
    return steps
      .split(/\n+/)
      .map((step) => step.replace(/^\d+[.)]\s*/, "").trim())
      .filter(Boolean);
  }
  return valueLines(steps);
}

function formatValueForClipboard(value: unknown, indent = ""): string {
  const lines = valueLines(value);
  if (lines.length === 1) return `${indent}${lines[0]}`;
  return lines.map((line) => `${indent}- ${line}`).join("\n");
}

function extractMarkdownListSection(markdown: string, heading: string): string[] {
  const pattern = new RegExp(
    `^##\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`,
    "im"
  );
  const match = markdown.match(pattern);

  if (!match?.[1]) return [];

  return match[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*]\s+/, "").replace(/^\d+[.)]\s+/, "").trim())
    .filter(Boolean)
    .filter((line) => !line.toLowerCase().startsWith("no follow-up questions"));
}



function extractMarkdownSection(markdown: string, heading: string): string {
  const lines = markdown.split(/\r?\n/);
  const headingPattern = new RegExp(`^#{2,6}\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i");
  const anyHeadingPattern = /^#{2,6}\s+/;
  const startIndex = lines.findIndex((line) => headingPattern.test(line.trim()));

  if (startIndex < 0) return "";

  const bodyLines: string[] = [];

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];

    if (anyHeadingPattern.test(line.trim())) {
      break;
    }

    bodyLines.push(line);
  }

  return bodyLines.join("\n").trim();
}

function cleanMarkdownListText(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*]\s+/, "").replace(/^\d+[.)]\s+/, "").trim())
    .filter(Boolean)
    .filter((line) => !/^no .+ returned\.?$/i.test(line))
    .filter((line) => !/^not specified\.?$/i.test(line));
}

function parseTopLevelMarkdownValue(markdown: string, label: string): string | null {
  const pattern = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*(.+)$`, "im");
  const match = markdown.match(pattern);

  return match?.[1]?.trim() ?? null;
}

function parseBugReportMarkdown(markdown: string, current: BugReport): BugReport {
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  const severity = parseTopLevelMarkdownValue(markdown, "Severity");
  const priority = parseTopLevelMarkdownValue(markdown, "Priority");
  const steps = cleanMarkdownListText(extractMarkdownSection(markdown, "Steps to Reproduce"));
  const missingInfo = cleanMarkdownListText(extractMarkdownSection(markdown, "Missing Info"));
  const followUpQuestions = cleanMarkdownListText(extractMarkdownSection(markdown, "Follow-up Questions"));
  const qaNotes = cleanMarkdownListText(extractMarkdownSection(markdown, "QA Notes"));

  return {
    ...current,
    title: titleMatch?.[1]?.trim() || current.title,
    severitySuggestion: severity || current.severitySuggestion,
    prioritySuggestion: priority || current.prioritySuggestion,
    summary: extractMarkdownSection(markdown, "Summary") || current.summary,
    environment: extractMarkdownSection(markdown, "Environment") || current.environment,
    stepsToReproduce: steps.length > 0 ? steps : current.stepsToReproduce,
    expectedResult: extractMarkdownSection(markdown, "Expected Result") || current.expectedResult,
    actualResult: extractMarkdownSection(markdown, "Actual Result") || current.actualResult,
    impact: extractMarkdownSection(markdown, "Impact") || current.impact,
    missingInfo: missingInfo.length > 0 ? missingInfo : current.missingInfo,
    followUpQuestions: followUpQuestions.length > 0 ? followUpQuestions : current.followUpQuestions,
    qaNotes: qaNotes.length > 0 ? qaNotes : current.qaNotes,
  };
}

function parseTestCasesMarkdown(markdown: string, current: TestCase[]): TestCase[] {
  const lines = markdown.split(/\r?\n/);
  const headingIndexes = lines
    .map((line, index) => ({ line: line.trim(), index }))
    .filter(({ line }) => /^##\s+Test Case\s+\d+:\s+.+$/i.test(line));

  if (headingIndexes.length === 0) return current;

  return headingIndexes.map(({ line, index }, caseIndex) => {
    const nextHeadingIndex =
      caseIndex + 1 < headingIndexes.length ? headingIndexes[caseIndex + 1].index : lines.length;
    const sectionMarkdown = lines.slice(index, nextHeadingIndex).join("\n");
    const bodyMarkdown = lines.slice(index + 1, nextHeadingIndex).join("\n");
    const title =
      line.replace(/^##\s+Test Case\s+\d+:\s+/i, "").trim() ||
      current[caseIndex]?.title ||
      `Test Case ${caseIndex + 1}`;
    const type = parseTopLevelMarkdownValue(bodyMarkdown, "Type") || current[caseIndex]?.type;
    const priority = parseTopLevelMarkdownValue(bodyMarkdown, "Priority") || current[caseIndex]?.priority;
    const preconditions = extractMarkdownSection(sectionMarkdown, "Preconditions");
    const expectedResult = extractMarkdownSection(sectionMarkdown, "Expected Result");
    const steps = cleanMarkdownListText(extractMarkdownSection(sectionMarkdown, "Steps"));

    return {
      ...current[caseIndex],
      title,
      type,
      priority,
      preconditions: preconditions || current[caseIndex]?.preconditions,
      steps: steps.length > 0 ? steps : current[caseIndex]?.steps,
      expectedResult: expectedResult || current[caseIndex]?.expectedResult,
    };
  });
}

function parseRiskReviewMarkdown(markdown: string, current: RiskReview): RiskReview {
  const overallRisk = parseTopLevelMarkdownValue(markdown, "Overall Risk") || current.overallRisk;
  const summaryMatch = markdown.match(/^Summary:\s*(.+)$/im);
  const keyRisksSection =
    markdown.match(/Key Risks:\s*([\s\S]*?)(?=\n\s*Bottlenecks:|\n\s*Missing Acceptance Criteria:|$)/i)?.[1] ?? "";
  const bottlenecksSection =
    markdown.match(/Bottlenecks:\s*([\s\S]*?)(?=\n\s*Missing Acceptance Criteria:|\n\s*QA Follow-up Questions:|$)/i)?.[1] ?? "";
  const keyRiskChunks = keyRisksSection
    .split(/\n(?=\d+\.\s+)/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  const bottleneckChunks = bottlenecksSection
    .split(/\n(?=\d+\.\s+)/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  const currentRisks = arrayFromUnknown<RiskItem>(current.keyRisks);
  const currentBottlenecks = arrayFromUnknown<BottleneckItem>(current.bottlenecks);

  const keyRisks = keyRiskChunks.length
    ? keyRiskChunks.map((chunk, index) => {
        const title = chunk.match(/^\d+\.\s*(.+)$/m)?.[1]?.trim();
        return {
          ...currentRisks[index],
          title: title || currentRisks[index]?.title,
          severity: chunk.match(/Severity:\s*(.+)$/im)?.[1]?.trim() || currentRisks[index]?.severity,
          area: chunk.match(/Area:\s*(.+)$/im)?.[1]?.trim() || currentRisks[index]?.area,
          whyItMatters:
            chunk.match(/Why it matters:\s*(.+)$/im)?.[1]?.trim() || currentRisks[index]?.whyItMatters,
          mitigation: chunk.match(/Mitigation:\s*(.+)$/im)?.[1]?.trim() || currentRisks[index]?.mitigation,
        };
      })
    : current.keyRisks;

  const bottlenecks = bottleneckChunks.length
    ? bottleneckChunks.map((chunk, index) => {
        const title = chunk.match(/^\d+\.\s*(.+)$/m)?.[1]?.trim();
        return {
          ...currentBottlenecks[index],
          title: title || currentBottlenecks[index]?.title,
          impact: chunk.match(/Impact:\s*(.+)$/im)?.[1]?.trim() || currentBottlenecks[index]?.impact,
          owner: chunk.match(/Owner:\s*(.+)$/im)?.[1]?.trim() || currentBottlenecks[index]?.owner,
          recommendation:
            chunk.match(/Recommendation:\s*(.+)$/im)?.[1]?.trim() ||
            currentBottlenecks[index]?.recommendation,
        };
      })
    : current.bottlenecks;

  const missingAcceptanceCriteria = cleanMarkdownListText(
    markdown.match(/Missing Acceptance Criteria:\s*([\s\S]*?)(?=\n\s*QA Follow-up Questions:|$)/i)?.[1] ?? ""
  );
  const qaFollowUpQuestions = cleanMarkdownListText(
    markdown.match(/QA Follow-up Questions:\s*([\s\S]*?)(?=\n\s*Suggested Test Focus:|$)/i)?.[1] ?? ""
  );
  const suggestedTestFocus = cleanMarkdownListText(
    markdown.match(/Suggested Test Focus:\s*([\s\S]*?)(?=\n\s*Follow-up History:|$)/i)?.[1] ?? ""
  );

  return {
    ...current,
    overallRisk,
    summary: summaryMatch?.[1]?.trim() || current.summary,
    keyRisks,
    bottlenecks,
    missingAcceptanceCriteria:
      missingAcceptanceCriteria.length > 0 ? missingAcceptanceCriteria : current.missingAcceptanceCriteria,
    qaFollowUpQuestions: qaFollowUpQuestions.length > 0 ? qaFollowUpQuestions : current.qaFollowUpQuestions,
    suggestedTestFocus: suggestedTestFocus.length > 0 ? suggestedTestFocus : current.suggestedTestFocus,
  };
}


function getTestImprovementFromOutput(output: string): TestImprovementReport | null {
  const parsed = unwrapQaResult(parseOutput(output));

  if (isPlainObject(parsed) && isPlainObject(parsed.testImprovement)) {
    return parsed.testImprovement as TestImprovementReport;
  }

  return null;
}

function buildTestImprovementMarkdown(report: TestImprovementReport): string {
  const improved = isPlainObject(report.improvedTestCase)
    ? (report.improvedTestCase as TestCase)
    : ({} as TestCase);
  const steps = normalizeSteps(improved.steps);
  const improvementsMade = meaningfulLines(report.improvementsMade);
  const addedCoverage = meaningfulLines(report.addedCoverage);
  const missingInfo = meaningfulLines(report.missingInfo);
  const followUpQuestions = meaningfulLines(report.followUpQuestions);
  const qaNotes = meaningfulLines(report.qaNotes);

  return [
    `# ${safeText(report.title)}`,
    "",
    "## Improved Test Case",
    `Title: ${safeText(improved.title)}`,
    `Type: ${safeText(improved.type)}`,
    `Priority: ${safeText(improved.priority)}`,
    "",
    "### Preconditions",
    safeText(improved.preconditions),
    "",
    "### Steps",
    ...(steps.length ? steps.map((step, index) => `${index + 1}. ${step}`) : ["1. Not specified."]),
    "",
    "### Expected Result",
    safeText(improved.expectedResult),
    "",
    "## Improvements Made",
    ...(improvementsMade.length ? improvementsMade.map((item) => `- ${item}`) : ["- No improvements listed."]),
    "",
    "## Added Coverage",
    ...(addedCoverage.length ? addedCoverage.map((item) => `- ${item}`) : ["- No added coverage listed."]),
    "",
    "## Missing Info",
    ...(missingInfo.length ? missingInfo.map((item) => `- ${item}`) : ["- No missing info returned."]),
    "",
    "## Follow-up Questions",
    ...(followUpQuestions.length ? followUpQuestions.map((item) => `- ${item}`) : ["- No follow-up questions returned."]),
    "",
    "## QA Notes",
    ...(qaNotes.length ? qaNotes.map((item) => `- ${item}`) : ["- No QA notes returned."]),
  ].join("\n");
}

function parseTestImprovementMarkdown(markdown: string, current: TestImprovementReport): TestImprovementReport {
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  const improvedSection = extractMarkdownSection(markdown, "Improved Test Case");
  const currentImproved = isPlainObject(current.improvedTestCase)
    ? (current.improvedTestCase as TestCase)
    : ({} as TestCase);
  const improvedTestCase: TestCase = {
    ...currentImproved,
    title: parseTopLevelMarkdownValue(improvedSection, "Title") || currentImproved.title,
    type: parseTopLevelMarkdownValue(improvedSection, "Type") || currentImproved.type,
    priority: parseTopLevelMarkdownValue(improvedSection, "Priority") || currentImproved.priority,
    preconditions: extractMarkdownSection(improvedSection, "Preconditions") || currentImproved.preconditions,
    steps:
      cleanMarkdownListText(extractMarkdownSection(improvedSection, "Steps")).length > 0
        ? cleanMarkdownListText(extractMarkdownSection(improvedSection, "Steps"))
        : currentImproved.steps,
    expectedResult: extractMarkdownSection(improvedSection, "Expected Result") || currentImproved.expectedResult,
  };

  return {
    ...current,
    title: titleMatch?.[1]?.trim() || current.title,
    improvedTestCase,
    improvementsMade:
      cleanMarkdownListText(extractMarkdownSection(markdown, "Improvements Made")).length > 0
        ? cleanMarkdownListText(extractMarkdownSection(markdown, "Improvements Made"))
        : current.improvementsMade,
    addedCoverage:
      cleanMarkdownListText(extractMarkdownSection(markdown, "Added Coverage")).length > 0
        ? cleanMarkdownListText(extractMarkdownSection(markdown, "Added Coverage"))
        : current.addedCoverage,
    missingInfo:
      cleanMarkdownListText(extractMarkdownSection(markdown, "Missing Info")).length > 0
        ? cleanMarkdownListText(extractMarkdownSection(markdown, "Missing Info"))
        : current.missingInfo,
    followUpQuestions:
      cleanMarkdownListText(extractMarkdownSection(markdown, "Follow-up Questions")).length > 0
        ? cleanMarkdownListText(extractMarkdownSection(markdown, "Follow-up Questions"))
        : current.followUpQuestions,
    qaNotes:
      cleanMarkdownListText(extractMarkdownSection(markdown, "QA Notes")).length > 0
        ? cleanMarkdownListText(extractMarkdownSection(markdown, "QA Notes"))
        : current.qaNotes,
  };
}

function buildTestCasesMarkdown(testCases: TestCase[], answeredFollowUps: AnsweredFollowUp[] = []): string {
  return [
    "# Test Cases",
    "",
    ...testCases.flatMap((testCase, index) => [
      `## Test Case ${index + 1}: ${safeText(testCase.title)}`,
      "",
      `Type: ${safeText(testCase.type)}`,
      `Priority: ${safeText(testCase.priority)}`,
      "",
      "### Preconditions",
      safeText(testCase.preconditions),
      "",
      "### Steps",
      ...normalizeSteps(testCase.steps).map((step, stepIndex) => `${stepIndex + 1}. ${step}`),
      "",
      "### Expected Result",
      safeText(testCase.expectedResult),
      "",
    ]),
    "## Follow-up History",
    ...(answeredFollowUps.length
      ? answeredFollowUps.flatMap((item, index) => [
          `${index + 1}. Q: ${item.question}`,
          `   A: ${item.answer}`,
          `   Type: ${item.answerType}`,
          `   Resolution: ${item.resolution}`,
        ])
      : ["- No answered test follow-up questions recorded."]),
  ].join("\n");
}

function buildRiskReviewMarkdown(review: RiskReview, answeredFollowUps: AnsweredFollowUp[] = []): string {
  return formatRiskReview(review, answeredFollowUps);
}

function formatTestCase(testCase: TestCase, index: number): string {
  const steps = normalizeSteps(testCase.steps);

  return [
    `Test Case ${index + 1}: ${safeText(testCase.title)}`,
    `Type: ${safeText(testCase.type)}`,
    `Priority: ${safeText(testCase.priority)}`,
    `Preconditions: ${safeText(testCase.preconditions)}`,
    "Steps:",
    ...steps.map((step, stepIndex) => `${stepIndex + 1}. ${step}`),
    "Expected Result:",
    formatValueForClipboard(testCase.expectedResult),
  ].join("\n");
}

function formatRiskReview(review: RiskReview, answeredFollowUps: AnsweredFollowUp[] = []): string {
  const keyRisks = arrayFromUnknown<RiskItem>(review.keyRisks);
  const bottlenecks = arrayFromUnknown<BottleneckItem>(review.bottlenecks);
  const missingCriteria = meaningfulLines(review.missingAcceptanceCriteria);
  const questions = meaningfulLines(review.qaFollowUpQuestions);
  const focus = meaningfulLines(review.suggestedTestFocus);

  return [
    "QA Risk Review",
    `Overall Risk: ${safeText(review.overallRisk)}`,
    `Summary: ${safeText(review.summary)}`,
    "",
    "Key Risks:",
    ...(keyRisks.length
      ? keyRisks.flatMap((risk, index) => [
          `${index + 1}. ${safeText(risk.title)}`,
          `   Severity: ${safeText(risk.severity)}`,
          `   Area: ${safeText(risk.area)}`,
          `   Why it matters: ${safeText(risk.whyItMatters)}`,
          `   Mitigation: ${safeText(risk.mitigation)}`,
        ])
      : ["No key risks returned."]),
    "",
    "Bottlenecks:",
    ...(bottlenecks.length
      ? bottlenecks.flatMap((bottleneck, index) => [
          `${index + 1}. ${safeText(bottleneck.title)}`,
          `   Impact: ${safeText(bottleneck.impact)}`,
          `   Owner: ${safeText(bottleneck.owner)}`,
          `   Recommendation: ${safeText(bottleneck.recommendation)}`,
        ])
      : ["No bottlenecks returned."]),
    "",
    "Missing Acceptance Criteria:",
    ...(missingCriteria.length
      ? missingCriteria.map((item, index) => `${index + 1}. ${item}`)
      : ["No missing acceptance criteria returned."]),
    "",
    "QA Follow-up Questions:",
    ...(questions.length
      ? questions.map((item, index) => `${index + 1}. ${item}`)
      : ["No QA follow-up questions returned."]),
    "",
    "Suggested Test Focus:",
    ...(focus.length
      ? focus.map((item, index) => `${index + 1}. ${item}`)
      : ["No suggested test focus returned."]),
    "",
    "Follow-up History:",
    ...(answeredFollowUps.length
      ? answeredFollowUps.flatMap((item, index) => [
          `${index + 1}. Q: ${item.question}`,
          `   A: ${item.answer}`,
          `   Type: ${item.answerType}`,
          `   Resolution: ${item.resolution}`,
        ])
      : ["No answered follow-up questions recorded."]),
  ].join("\n");
}


function formatBugReport(
  report: BugReport,
  evidenceFiles: UploadedEvidenceFile[] = [],
  evidenceLink = "",
  answeredFollowUps: AnsweredFollowUp[] = []
): string {
  const steps = normalizeSteps(report.stepsToReproduce);
  const missingInfo = meaningfulLines(report.missingInfo);
  const followUpQuestions = meaningfulLines(report.followUpQuestions);
  const qaNotes = meaningfulLines(report.qaNotes);
  const screenshotEvidence = evidenceFiles.filter((file) => file.dataUrl);
  const logEvidence = evidenceFiles.filter((file) => file.textPreview);
  const evidenceRows = [
    evidenceLink.trim() ? ["Evidence Link / Reference", evidenceLink.trim()] : [],
    screenshotEvidence.length > 0
      ? ["Screenshots", ...screenshotEvidence.map((file) => `${file.name} (${formatBytes(file.size)})`)]
      : [],
    logEvidence.length > 0
      ? ["Logs", ...logEvidence.map((file) => `${file.name} (${formatBytes(file.size)})`)]
      : [],
  ].filter((row) => row.length > 0);

  const logFindings = logEvidence.flatMap((file) => {
    const preview = file.textPreview ?? "";
    const lines = preview
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /error|exception|crash|fatal|hang|unresponsive|warn/i.test(line))
      .slice(0, 8);

    return lines.map((line) => `${file.name}: ${line}`);
  });

  return [
    `# ${safeText(report.title)}`,
    "",
    `Severity: ${safeText(report.severitySuggestion)}`,
    `Priority: ${safeText(report.prioritySuggestion)}`,
    "",
    "## Summary",
    safeText(report.summary),
    "",
    "## Environment",
    safeText(report.environment),
    "",
    "## Steps to Reproduce",
    ...(steps.length ? steps.map((step, index) => `${index + 1}. ${step}`) : ["1. Not specified."]),
    "",
    "## Expected Result",
    safeText(report.expectedResult),
    "",
    "## Actual Result",
    safeText(report.actualResult),
    "",
    "## Impact",
    safeText(report.impact),
    "",
    "## Missing Info",
    ...(missingInfo.length ? missingInfo.map((item) => `- ${item}`) : ["- No missing info returned."]),
    "",
    "## Follow-up Questions",
    ...(followUpQuestions.length
      ? followUpQuestions.map((item) => `- ${item}`)
      : ["- No follow-up questions returned."]),
    "",
    "## QA Notes",
    ...(qaNotes.length ? qaNotes.map((item) => `- ${item}`) : ["- No QA notes returned."]),
    "",
    "Follow-up History:",
    ...(answeredFollowUps.length
      ? answeredFollowUps.flatMap((item, index) => [
          `${index + 1}. Q: ${item.question}`,
          `   A: ${item.answer}`,
          `   Type: ${item.answerType}`,
          `   Resolution: ${item.resolution}`,
        ])
      : ["- No answered follow-up questions recorded."]),
    "",
    "## Evidence",
    ...(evidenceRows.length
      ? evidenceRows.flatMap(([label, ...items]) => [
          `${label}:`,
          ...items.map((item) => `- ${item}`),
          "",
        ])
      : ["- No evidence attached or referenced.", ""]),
    "Relevant Log Findings:",
    ...(logFindings.length ? logFindings.map((item) => `- ${item}`) : ["- No log findings included."]),
  ].join("\n");
}


function csvEscape(value: unknown): string {
  const text = safeText(value).replace(/\r?\n/g, " ").trim();
  return `"${text.replace(/"/g, '""')}"`;
}

function makeCsv(rows: unknown[][]): string {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function buildTimestampForFilename() {
  return new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 19);
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 250);
}


function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;

  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file."));
    reader.readAsText(file);
  });
}

function riskReviewToCsv(review: RiskReview): string {
  const keyRisks = arrayFromUnknown<RiskItem>(review.keyRisks);
  const bottlenecks = arrayFromUnknown<BottleneckItem>(review.bottlenecks);
  const missingCriteria = meaningfulLines(review.missingAcceptanceCriteria);
  const questions = meaningfulLines(review.qaFollowUpQuestions);
  const focus = meaningfulLines(review.suggestedTestFocus);

  const rows: unknown[][] = [
    ["Section", "Item #", "Title", "Severity/Impact", "Area/Owner", "Details", "Recommendation/Mitigation"],
    [
      "Summary",
      "",
      "Overall Risk",
      safeText(review.overallRisk),
      "",
      safeText(review.summary),
      "",
    ],
  ];

  keyRisks.forEach((risk, index) => {
    rows.push([
      "Key Risk",
      index + 1,
      risk.title,
      risk.severity,
      risk.area,
      risk.whyItMatters,
      risk.mitigation,
    ]);
  });

  bottlenecks.forEach((bottleneck, index) => {
    rows.push([
      "Bottleneck",
      index + 1,
      bottleneck.title,
      bottleneck.impact,
      bottleneck.owner,
      "",
      bottleneck.recommendation,
    ]);
  });

  missingCriteria.forEach((item, index) => {
    rows.push(["Missing Acceptance Criteria", index + 1, item, "", "", item, ""]);
  });

  questions.forEach((item, index) => {
    rows.push(["QA Follow-up Question", index + 1, item, "", "", item, ""]);
  });

  focus.forEach((item, index) => {
    rows.push(["Suggested Test Focus", index + 1, item, "", "", item, ""]);
  });

  return makeCsv(rows);
}


function testCasesToCsv(testCases: TestCase[]): string {
  const rows: unknown[][] = [
    ["Test Case #", "Title", "Type", "Priority", "Preconditions", "Steps", "Expected Result"],
  ];

  testCases.forEach((testCase, index) => {
    const steps = normalizeSteps(testCase.steps)
      .map((step, stepIndex) => `${stepIndex + 1}. ${step}`)
      .join("\n");

    rows.push([
      index + 1,
      testCase.title,
      testCase.type,
      testCase.priority,
      testCase.preconditions,
      steps,
      testCase.expectedResult,
    ]);
  });

  return makeCsv(rows);
}

function badgeClass(value: unknown, kind: "type" | "priority" | "risk") {
  const normalized = safeText(value).toLowerCase();

  if (kind === "priority" || kind === "risk") {
    if (normalized.includes("high")) return "badge badge-priority-high";
    if (normalized.includes("medium")) return "badge badge-priority-medium";
    if (normalized.includes("low")) return "badge badge-priority-low";
    return "badge";
  }

  if (normalized.includes("negative")) return "badge badge-type-negative";
  if (normalized.includes("edge")) return "badge badge-type-edge";
  if (normalized.includes("regression")) return "badge badge-type-regression";
  return "badge badge-type-default";
}

const severityOptions = ["Critical", "High", "Medium", "Low"];
const priorityOptions = ["High", "Medium", "Low"];
const riskOptions = ["High", "Medium", "Low"];
const areaOptions = [
  "Requirements",
  "Data",
  "Product",
  "Dev",
  "QA",
  "Integration",
  "UX",
  "Accessibility",
  "Security",
  "Performance",
];
const testTypeOptions = [
  "Functional",
  "Negative",
  "Edge",
  "Regression",
  "Accessibility",
  "Data Integrity",
  "AI Safety",
  "Auth",
  "Credits",
];

function optionValue(value: unknown, fallback: string, options: string[]) {
  const current = safeText(value);
  return options.includes(current) ? current : fallback;
}

function EditableBadgeSelect({
  label,
  value,
  options,
  kind,
  onChange,
}: {
  label?: string;
  value: unknown;
  options: string[];
  kind: "type" | "priority" | "risk";
  onChange: (value: string) => void;
}) {
  const currentValue = optionValue(value, options[0] ?? "", options);

  return (
    <label className="editable-badge-select-wrap" title="Click to change this value">
      <span className="sr-only">{label ?? "Editable badge"}</span>
      <select
        className={`editable-badge-select ${badgeClass(currentValue, kind)}`}
        value={currentValue}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {label ? `${label}: ${option}` : option}
          </option>
        ))}
      </select>
    </label>
  );
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

function SaveReportControl({
  saveReportStatus,
  saveReportMessage,
  savedReportId,
  onSaveReport,
}: SaveReportButtonProps) {
  return (
    <div className="save-report-row">
      {saveReportStatus !== "saved" ? (
        <button
          className="secondary-action-button save-report-button"
          data-testid="save-report-button"
          disabled={saveReportStatus === "saving"}
          onClick={onSaveReport}
          type="button"
        >
          {saveReportStatus === "saving" ? "Saving..." : "Save Report"}
        </button>
      ) : null}

      {saveReportMessage ? (
        <div
          className={
            saveReportStatus === "error"
              ? "save-report-status-card save-report-status-card-error"
              : "save-report-status-card"
          }
        >
          <span>{saveReportMessage}</span>
          {saveReportStatus === "saved" ? (
            <Link href={savedReportId ? `/reports/${savedReportId}` : "/reports"}>View report</Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ValueBlock({ value }: { value: unknown }) {
  const lines = valueLines(value);

  if (lines.length === 1) {
    return <p className="field-text">{lines[0]}</p>;
  }

  return (
    <ul className="value-list">
      {lines.map((line, index) => (
        <li key={`${line}-${index}`}>{line}</li>
      ))}
    </ul>
  );
}

function RiskTextList({ title, items }: { title: string; items: unknown }) {
  const lines = meaningfulLines(items);

  return (
    <section className="risk-section-card">
      <h3>{title}</h3>
      {lines.length > 0 ? (
        <ul className="risk-section-list">
          {lines.map((line, index) => (
            <li key={`${title}-${line}-${index}`}>{line}</li>
          ))}
        </ul>
      ) : (
        <p className="field-text">No items returned.</p>
      )}
    </section>
  );
}

function TestCaseCards({
  testCases,
  answeredFollowUps = [],
  reportType,
  sourceInput,
  testCaseGenerationKey = "",
  automationCredentialProfiles = [],
  automationCredentialDefaultProfileKey = "",
  automationCredentialEnvExample = "",
  automationProjectConfig,
  saveReportStatus,
  saveReportMessage,
  savedReportId,
  activeProject,
  onSaveReport,
}: {
  testCases: TestCase[];
  answeredFollowUps?: AnsweredFollowUp[];
  activeProject: SafeQAProject | null;
} & CoverageScoreProps & SaveReportControlProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [exported, setExported] = useState(false);
  const [markdownExported, setMarkdownExported] = useState(false);
  const [isEditingMarkdown, setIsEditingMarkdown] = useState(false);
  const [editedMarkdown, setEditedMarkdown] = useState("");
  const [savedMarkdown, setSavedMarkdown] = useState("");
  const [editableTestCases, setEditableTestCases] = useState<TestCase[]>(testCases);
  const [editingTestCaseIndex, setEditingTestCaseIndex] = useState<number | null>(null);
  const [testCasePageIndex, setTestCasePageIndex] = useState(0);

  useEffect(() => {
    setEditableTestCases(testCases);
    setSavedMarkdown("");
    setEditedMarkdown("");
    setEditingTestCaseIndex(null);
  }, [testCaseGenerationKey, testCases]);

  useEffect(() => {
    setTestCasePageIndex(0);
  }, [testCaseGenerationKey]);

  const generatedMarkdown = useMemo(
    () => buildTestCasesMarkdown(editableTestCases, answeredFollowUps),
    [editableTestCases, answeredFollowUps]
  );

  const allText = useMemo(
    () => savedMarkdown || editableTestCases.map((testCase, index) => formatTestCase(testCase, index)).join("\n\n---\n\n"),
    [savedMarkdown, editableTestCases]
  );
  const renderedTestCases = editableTestCases.length ? editableTestCases : testCases;
  const totalTestCasePages = Math.max(
    1,
    Math.ceil(renderedTestCases.length / DEFAULT_VISIBLE_TEST_CASE_LIMIT)
  );
  const safeTestCasePageIndex = Math.min(testCasePageIndex, totalTestCasePages - 1);
  const visibleTestCaseStartIndex = safeTestCasePageIndex * DEFAULT_VISIBLE_TEST_CASE_LIMIT;
  const visibleTestCases = renderedTestCases.slice(
    visibleTestCaseStartIndex,
    visibleTestCaseStartIndex + DEFAULT_VISIBLE_TEST_CASE_LIMIT
  );

  function updateTestCaseBadge(index: number, field: "type" | "priority", value: string) {
    updateEditableTestCase(index, { [field]: value });
  }

  function updateEditableTestCase(index: number, patch: Partial<TestCase>) {
    setEditableTestCases((current) =>
      current.map((testCase, testCaseIndex) =>
        testCaseIndex === index ? { ...testCase, ...patch } : testCase
      )
    );
    setSavedMarkdown("");
  }

  async function handleCopy(id: string, text: string) {
    await copyText(text);
    setCopied(id);
    window.setTimeout(() => setCopied(null), 1200);
  }

  function handleExportCsv() {
    const csv = testCasesToCsv(editableTestCases);
    const filename = `qa-sidekick-test-cases-${buildTimestampForFilename()}.csv`;

    downloadTextFile(filename, csv, "text/csv");
    setExported(true);
    window.setTimeout(() => setExported(false), 1400);
  }

  function handleExportMarkdown() {
    const filename = `qa-sidekick-test-cases-${buildTimestampForFilename()}.md`;

    downloadTextFile(filename, savedMarkdown || generatedMarkdown, "text/markdown");
    setMarkdownExported(true);
    window.setTimeout(() => setMarkdownExported(false), 1400);
  }

  function handleToggleEditMarkdown() {
    if (!isEditingMarkdown) {
      setEditedMarkdown(savedMarkdown || generatedMarkdown);
      setIsEditingMarkdown(true);
      return;
    }

    setIsEditingMarkdown(false);
  }

  function handleLiveMarkdownEdit(nextMarkdown: string) {
    setEditedMarkdown(nextMarkdown);
    setEditableTestCases((current) => parseTestCasesMarkdown(nextMarkdown, current));
    setSavedMarkdown("");
  }

  function handleSaveMarkdownEdits() {
    const parsedTestCases = parseTestCasesMarkdown(editedMarkdown, editableTestCases);
    setEditableTestCases(parsedTestCases);
    setSavedMarkdown(buildTestCasesMarkdown(parsedTestCases, answeredFollowUps));
    setEditedMarkdown(buildTestCasesMarkdown(parsedTestCases, answeredFollowUps));
    setIsEditingMarkdown(false);
  }

  return (
    <div className="report-wrap">
      <div className="report-header">
        <div>
          <p className="report-kicker">Generated QA Report</p>
          <h2>{editableTestCases.length} Test Cases</h2>
        </div>
        <div className="report-action-stack">
          <div className="report-actions compact-report-actions report-action-row">
            <button className="copy-all-button" data-testid="copy-report-button" type="button" onClick={() => handleCopy("all", allText)}>
              {copied === "all" ? "Copied" : "Copy All"}
            </button>
            <button className="copy-all-button secondary-action-button" data-testid="export-markdown-button" type="button" onClick={handleExportMarkdown}>
              {markdownExported ? "Exported" : "Export Markdown"}
            </button>
            <button className="copy-all-button secondary-action-button" data-testid="export-csv-button" type="button" onClick={handleExportCsv}>
              {exported ? "Exported" : "Export CSV"}
            </button>
            <button className="copy-all-button edit-report-button" type="button" onClick={handleToggleEditMarkdown}>
              {isEditingMarkdown ? "Close Editor" : "Edit Report"}
            </button>
          </div>
          <SaveReportControl
            saveReportStatus={saveReportStatus}
            saveReportMessage={saveReportMessage}
            savedReportId={savedReportId}
            onSaveReport={() => onSaveReport(savedMarkdown || generatedMarkdown)}
          />
        </div>
      </div>

      <SaveGeneratedOutputToSourceButton
        activeProject={activeProject}
        reportType={reportType}
        markdown={savedMarkdown || generatedMarkdown}
        structuredData={{ testCases: editableTestCases }}
      />

      {savedMarkdown && !isEditingMarkdown ? (
        <div className="saved-edit-notice">
          Saved edits are active. Copy/export will use the finalized edited version.
        </div>
      ) : null}

      {isEditingMarkdown ? (
        <section className="report-markdown-editor-card">
          <div className="report-markdown-editor-header">
            <div>
              <p>Edit before export</p>
              <h3>Test Case Markdown</h3>
              <span>Save Edits updates Copy All and Export Markdown. Cards below have been updated from your saved edits.</span>
            </div>
            <button className="copy-all-button save-edit-button" type="button" onClick={handleSaveMarkdownEdits}>
              Save Edits
            </button>
          </div>

          <textarea
            value={editedMarkdown}
            onChange={(event) => handleLiveMarkdownEdit(event.target.value)}
            spellCheck={false}
          />
        </section>
      ) : null}

      {answeredFollowUps.length > 0 ? (
        <section className="test-followup-history-card">
          <h3>Follow-up History</h3>
          <div className="followup-history-list">
            {answeredFollowUps.map((item, index) => (
              <article className="followup-history-item" key={`${item.question}-${index}`}>
                <span>Question {index + 1}</span>
                <strong>{item.question}</strong>
                <p>{item.answer}</p>
                <small>{item.answerType} · {item.resolution}</small>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div className="test-card-list">
        {visibleTestCases.map((testCase, visibleIndex) => {
          const index = visibleTestCaseStartIndex + visibleIndex;
          const copyId = `case-${index}`;
          const steps = normalizeSteps(testCase.steps);
          const safeTitle = safeText(testCase.title);
          const displayTitle = safeTitle !== "Not specified." ? safeTitle : `Test Case ${index + 1}`;
          const testCaseQuality = calculateTestCaseQuality(testCase);
          const stableKey = `test-case-${index}`;

          return (
            <article
              className={getTestCaseQualityCardClass(testCaseQuality.score)}
              data-testid={`test-case-card-${index + 1}`}
              key={stableKey}
            >
              <div className="test-case-card-header">
                <div className="test-case-card-title-block test-case-title-meta">
                  <p className="report-kicker">Test Case {index + 1}</p>
                  <h3>{displayTitle}</h3>
                  <div className="test-case-title-meta-row">
                    <EditableBadgeSelect
                      label="Type"
                      value={testCase.type}
                      options={testTypeOptions}
                      kind="type"
                      onChange={(value) => updateTestCaseBadge(index, "type", value)}
                    />
                    <EditableBadgeSelect
                      label="Priority"
                      value={testCase.priority}
                      options={priorityOptions}
                      kind="priority"
                      onChange={(value) => updateTestCaseBadge(index, "priority", value)}
                    />
                  </div>
                </div>

                <TestCaseQualityBadge index={index} testCase={testCase} />

                <div className="test-case-fixed-action-stack">
                  <button
                    className="test-case-edit-button"
                    type="button"
                    onClick={() => setEditingTestCaseIndex(index)}
                  >
                    Edit
                  </button>
                  <button
                    className="copy-case-button"
                    type="button"
                    onClick={() => handleCopy(copyId, formatTestCase(testCase, index))}
                  >
                    {copied === copyId ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>

              {editingTestCaseIndex === index ? (
                <div className="test-case-inline-editor">
                  <label>
                    Title
                    <input
                      value={safeTitle === "Not specified." ? "" : safeTitle}
                      onChange={(event) => updateEditableTestCase(index, { title: event.target.value })}
                    />
                  </label>

                  <label>
                    Type
                    <input
                      value={safeText(testCase.type) === "Not specified." ? "" : safeText(testCase.type)}
                      onChange={(event) => updateEditableTestCase(index, { type: event.target.value })}
                    />
                  </label>

                  <label>
                    Priority
                    <input
                      value={safeText(testCase.priority) === "Not specified." ? "" : safeText(testCase.priority)}
                      onChange={(event) => updateEditableTestCase(index, { priority: event.target.value })}
                    />
                  </label>

                  <label>
                    Preconditions
                    <textarea
                      value={safeText(testCase.preconditions)}
                      onChange={(event) => updateEditableTestCase(index, { preconditions: event.target.value })}
                    />
                  </label>

                  <label>
                    Steps
                    <textarea
                      value={steps.join("\n")}
                      onChange={(event) => {
                        updateEditableTestCase(index, {
                          steps: event.target.value
                            .split(/\n+/)
                            .map((item) => item.trim())
                            .filter(Boolean),
                        });
                      }}
                    />
                  </label>

                  <label>
                    Expected Result
                    <textarea
                      value={safeText(testCase.expectedResult)}
                      onChange={(event) => updateEditableTestCase(index, { expectedResult: event.target.value })}
                    />
                  </label>

                  <div className="test-case-inline-editor-actions">
                    <button
                      className="secondary-action-button"
                      type="button"
                      onClick={() => setEditingTestCaseIndex(null)}
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="test-case-section">
                <h4>Preconditions</h4>
                <ValueBlock value={testCase.preconditions} />
              </div>

              <div className="test-case-section">
                <h4>Steps</h4>
                <ol className="step-list">
                  {steps.map((step, stepIndex) => (
                    <li key={`${step}-${stepIndex}`}>{step}</li>
                  ))}
                </ol>
              </div>

              <div className="test-case-section expected-section">
                <h4>Expected Result</h4>
                <ValueBlock value={testCase.expectedResult} />
              </div>

              <TestCaseAutomationReadiness testCase={testCase} index={index} />
            </article>
          );
        })}
      </div>

      <TestCaseDisplayControls
        totalCount={renderedTestCases.length}
        pageIndex={safeTestCasePageIndex}
        pageSize={DEFAULT_VISIBLE_TEST_CASE_LIMIT}
        onFirstPage={() => setTestCasePageIndex(0)}
        onPreviousPage={() => setTestCasePageIndex((value) => Math.max(0, value - 1))}
        onNextPage={() =>
          setTestCasePageIndex((value) => Math.min(totalTestCasePages - 1, value + 1))
        }
        onLastPage={() => setTestCasePageIndex(totalTestCasePages - 1)}
      />

      {reportType === "tests" && editableTestCases.length > 0 ? (
        <AutomationExportPanel
          key={`automation-export-${testCaseGenerationKey}`}
          generationKey={testCaseGenerationKey}
          testCases={renderedTestCases}
          bundleName="QAtalyst automation export"
          credentialProfiles={automationCredentialProfiles}
          defaultCredentialProfileKey={automationCredentialDefaultProfileKey}
          envExample={automationCredentialEnvExample}
          projectConfig={automationProjectConfig}
          exportMode="user-project"
        />
      ) : null}

      {reportType === "tests" && testCases.length ? (
        <TestRailSyncPanel reportId={savedReportId || undefined} testCases={testCases} />
      ) : null}

      <CoverageScorePanel
        reportType={reportType}
        sourceInput={sourceInput}
        markdown={savedMarkdown || generatedMarkdown}
        structuredData={{ testCases: editableTestCases }}
      />

    </div>
  );
}

function RiskReviewCards({
  riskReview,
  answeredFollowUps = [],
  reportType,
  sourceInput,
  saveReportStatus,
  saveReportMessage,
  savedReportId,
  activeProject,
  onSaveReport,
}: {
  riskReview: RiskReview;
  answeredFollowUps?: AnsweredFollowUp[];
  activeProject: SafeQAProject | null;
} & CoverageScoreProps & SaveReportControlProps) {
  const [copied, setCopied] = useState(false);
  const [exported, setExported] = useState(false);
  const [markdownExported, setMarkdownExported] = useState(false);
  const [isEditingMarkdown, setIsEditingMarkdown] = useState(false);
  const [editedMarkdown, setEditedMarkdown] = useState("");
  const [savedMarkdown, setSavedMarkdown] = useState("");
  const [editableRiskReview, setEditableRiskReview] = useState<RiskReview>(riskReview);
  const keyRisks = arrayFromUnknown<RiskItem>(editableRiskReview.keyRisks);
  const bottlenecks = arrayFromUnknown<BottleneckItem>(editableRiskReview.bottlenecks);

  useEffect(() => {
    setEditableRiskReview(riskReview);
    setSavedMarkdown("");
    setEditedMarkdown("");
  }, [riskReview]);

  function updateRiskReviewField(field: "overallRisk", value: string) {
    setEditableRiskReview((current) => ({
      ...current,
      [field]: value,
    }));
    setSavedMarkdown("");
  }

  function updateRiskItemBadge(index: number, field: "severity" | "area", value: string) {
    setEditableRiskReview((current) => {
      const currentRisks = arrayFromUnknown<RiskItem>(current.keyRisks);
      const nextRisks = currentRisks.map((risk, riskIndex) =>
        riskIndex === index ? { ...risk, [field]: value } : risk
      );

      return {
        ...current,
        keyRisks: nextRisks,
      };
    });
    setSavedMarkdown("");
  }

  function updateBottleneckBadge(index: number, field: "impact" | "owner", value: string) {
    setEditableRiskReview((current) => {
      const currentBottlenecks = arrayFromUnknown<BottleneckItem>(current.bottlenecks);
      const nextBottlenecks = currentBottlenecks.map((bottleneck, bottleneckIndex) =>
        bottleneckIndex === index ? { ...bottleneck, [field]: value } : bottleneck
      );

      return {
        ...current,
        bottlenecks: nextBottlenecks,
      };
    });
    setSavedMarkdown("");
  }

  async function handleCopy() {
    await copyText(savedMarkdown || buildRiskReviewMarkdown(editableRiskReview, answeredFollowUps));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  function handleExportCsv() {
    const csv = riskReviewToCsv(editableRiskReview);
    const filename = `qa-sidekick-risk-review-${buildTimestampForFilename()}.csv`;

    downloadTextFile(filename, csv, "text/csv");
    setExported(true);
    window.setTimeout(() => setExported(false), 1400);
  }

  function handleExportMarkdown() {
    const filename = `qa-sidekick-risk-review-${buildTimestampForFilename()}.md`;

    downloadTextFile(filename, savedMarkdown || buildRiskReviewMarkdown(editableRiskReview, answeredFollowUps), "text/markdown");
    setMarkdownExported(true);
    window.setTimeout(() => setMarkdownExported(false), 1400);
  }

  function handleToggleEditMarkdown() {
    if (!isEditingMarkdown) {
      setEditedMarkdown(savedMarkdown || buildRiskReviewMarkdown(editableRiskReview, answeredFollowUps));
      setIsEditingMarkdown(true);
      return;
    }

    setIsEditingMarkdown(false);
  }

  function handleLiveMarkdownEdit(nextMarkdown: string) {
    setEditedMarkdown(nextMarkdown);
    setEditableRiskReview((current) => parseRiskReviewMarkdown(nextMarkdown, current));
    setSavedMarkdown("");
  }

  function handleSaveMarkdownEdits() {
    const parsedRiskReview = parseRiskReviewMarkdown(editedMarkdown, editableRiskReview);
    setEditableRiskReview(parsedRiskReview);
    setSavedMarkdown(buildRiskReviewMarkdown(parsedRiskReview, answeredFollowUps));
    setIsEditingMarkdown(false);
  }

  return (
    <div className="report-wrap risk-report-wrap">
      <div className="report-header">
        <div>
          <p className="report-kicker">Risk Review Report</p>
          <h2>Pre-production QA Risk Review</h2>
        </div>
        <div className="report-action-stack">
          <div className="report-actions compact-report-actions report-action-row">
            <button className="copy-all-button" type="button" onClick={handleCopy}>
              {copied ? "Copied" : "Copy Risk Report"}
            </button>
            <button className="copy-all-button secondary-action-button" type="button" onClick={handleExportMarkdown}>
              {markdownExported ? "Exported" : "Export Markdown"}
            </button>
            <button className="copy-all-button edit-report-button" type="button" onClick={handleToggleEditMarkdown}>
              {isEditingMarkdown ? "Close Editor" : "Edit Report"}
            </button>
          </div>
          <SaveReportControl
            saveReportStatus={saveReportStatus}
            saveReportMessage={saveReportMessage}
            savedReportId={savedReportId}
            onSaveReport={() => onSaveReport(savedMarkdown || buildRiskReviewMarkdown(editableRiskReview, answeredFollowUps))}
          />
        </div>
      </div>

      <SaveGeneratedOutputToSourceButton
        activeProject={activeProject}
        reportType={reportType}
        markdown={savedMarkdown || buildRiskReviewMarkdown(editableRiskReview, answeredFollowUps)}
        structuredData={{ riskReview: editableRiskReview }}
      />

      {savedMarkdown && !isEditingMarkdown ? (
        <div className="saved-edit-notice">
          Saved edits are active. Copy/export will use the finalized edited version.
        </div>
      ) : null}

      {isEditingMarkdown ? (
        <section className="report-markdown-editor-card">
          <div className="report-markdown-editor-header">
            <div>
              <p>Edit before export</p>
              <h3>Risk Review Markdown</h3>
              <span>Save Edits updates Copy Risk Report and Export Markdown. Cards below have been updated from your saved edits.</span>
            </div>
            <button className="copy-all-button save-edit-button" type="button" onClick={handleSaveMarkdownEdits}>
              Save Edits
            </button>
          </div>

          <textarea
            value={editedMarkdown}
            onChange={(event) => handleLiveMarkdownEdit(event.target.value)}
            spellCheck={false}
          />
        </section>
      ) : null}

      {editableRiskReview ? <RiskReviewPanel review={editableRiskReview} /> : null}

      <div className="risk-report-list risk-report-list-retired">
        <section className="risk-summary-card">
          <div className="badge-row">
            <EditableBadgeSelect
              label="Overall Risk"
              value={editableRiskReview.overallRisk}
              options={riskOptions}
              kind="risk"
              onChange={(value) => updateRiskReviewField("overallRisk", value)}
            />
          </div>
          <h3>Summary</h3>
          <p className="field-text">{safeText(editableRiskReview.summary)}</p>
        </section>

        {keyRisks.length > 0 ? (
          <div className="risk-card-list">
            {keyRisks.map((risk, index) => (
              <article className="risk-card" key={`${safeText(risk.title)}-${index}`}>
                <div className="test-case-topline">
                  <div className="test-case-label-row">
                    <span className="test-case-label">Risk {index + 1}</span>
                  </div>
                  <h3>{safeText(risk.title)}</h3>
                  <div className="badge-row">
                    <EditableBadgeSelect
                      label="Severity"
                      value={risk.severity}
                      options={severityOptions}
                      kind="risk"
                      onChange={(value) => updateRiskItemBadge(index, "severity", value)}
                    />
                    <EditableBadgeSelect
                      label="Area"
                      value={risk.area}
                      options={areaOptions}
                      kind="type"
                      onChange={(value) => updateRiskItemBadge(index, "area", value)}
                    />
                  </div>
                </div>

                <div className="test-case-section">
                  <h4>Why It Matters</h4>
                  <p className="field-text">{safeText(risk.whyItMatters)}</p>
                </div>

                <div className="test-case-section expected-section">
                  <h4>Mitigation</h4>
                  <p className="field-text">{safeText(risk.mitigation)}</p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <section className="risk-section-card">
            <h3>Key Risks</h3>
            <p className="field-text">No key risks returned.</p>
          </section>
        )}

        <section className="risk-section-card">
          <h3>Bottlenecks</h3>
          {bottlenecks.length > 0 ? (
            <div className="bottleneck-list">
              {bottlenecks.map((bottleneck, index) => (
                <div className="bottleneck-item" key={`${safeText(bottleneck.title)}-${index}`}>
                  <div className="test-case-label-row bottleneck-heading">
                    <h4>{safeText(bottleneck.title)}</h4>
                    <div className="badge-row">
                      <EditableBadgeSelect
                        label="Impact"
                        value={bottleneck.impact}
                        options={riskOptions}
                        kind="risk"
                        onChange={(value) => updateBottleneckBadge(index, "impact", value)}
                      />
                      <EditableBadgeSelect
                        label="Owner"
                        value={bottleneck.owner}
                        options={areaOptions}
                        kind="type"
                        onChange={(value) => updateBottleneckBadge(index, "owner", value)}
                      />
                    </div>
                  </div>
                  <p className="field-text">{safeText(bottleneck.recommendation)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="field-text">No bottlenecks returned.</p>
          )}
        </section>

        <RiskTextList title="Missing Acceptance Criteria" items={editableRiskReview.missingAcceptanceCriteria} />
        <RiskTextList title="QA Follow-up Questions" items={editableRiskReview.qaFollowUpQuestions} />
        <RiskTextList title="Suggested Test Focus" items={editableRiskReview.suggestedTestFocus} />

        {answeredFollowUps.length > 0 ? (
          <section className="risk-section-card followup-history-card">
            <h3>Follow-up History</h3>
            <div className="followup-history-list">
              {answeredFollowUps.map((item, index) => (
                <article className="followup-history-item" key={`${item.question}-${index}`}>
                  <span>Question {index + 1}</span>
                  <strong>{item.question}</strong>
                  <p>{item.answer}</p>
                  <small>{item.answerType} · {item.resolution}</small>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <CoverageScorePanel
        reportType={reportType}
        sourceInput={sourceInput}
        markdown={savedMarkdown || buildRiskReviewMarkdown(editableRiskReview, answeredFollowUps)}
        structuredData={editableRiskReview}
      />
    </div>
  );
}


function BugReportCards({
  bugReport,
  evidenceFiles = [],
  evidenceLink = "",
  answeredFollowUps = [],
  riskAnsweredFollowUps = [],
  onSaveBugMarkdown,
  savedEditedMarkdown = "",
  bugEvidence,
  reportType,
  sourceInput,
  testCaseGenerationKey,
  automationCredentialProfiles = [],
  automationCredentialDefaultProfileKey = "",
  automationCredentialEnvExample = "",
  automationProjectConfig,
  saveReportStatus,
  saveReportMessage,
  savedReportId,
  activeProject,
  onSaveReport,
}: {
  bugReport: BugReport;
  evidenceFiles?: UploadedEvidenceFile[];
  evidenceLink?: string;
  answeredFollowUps?: AnsweredFollowUp[];
  riskAnsweredFollowUps?: AnsweredFollowUp[];
  onSaveBugMarkdown?: (markdown: string) => void;
  savedEditedMarkdown?: string;
  bugEvidence: BugEvidenceState;
  activeProject: SafeQAProject | null;
} & CoverageScoreProps & SaveReportControlProps) {
  const [copied, setCopied] = useState(false);
  const [exported, setExported] = useState(false);
  const [isEditingMarkdown, setIsEditingMarkdown] = useState(false);
  const [editedMarkdown, setEditedMarkdown] = useState("");
  const [editableBugReport, setEditableBugReport] = useState<BugReport>(bugReport);

  useEffect(() => {
    setEditableBugReport(bugReport);
    setEditedMarkdown("");
  }, [bugReport]);

  function updateBugReportBadge(field: "severitySuggestion" | "prioritySuggestion", value: string) {
    setEditableBugReport((current) => ({
      ...current,
      [field]: value,
    }));
  }

  const steps = normalizeSteps(editableBugReport.stepsToReproduce);
  const screenshotEvidence = evidenceFiles.filter((file) => file.dataUrl);
  const logEvidence = evidenceFiles.filter((file) => file.textPreview);
  const generatedMarkdown = formatBugReport(editableBugReport, evidenceFiles, evidenceLink, answeredFollowUps);
  const exportMarkdown = isEditingMarkdown ? editedMarkdown : savedEditedMarkdown || generatedMarkdown;
  const evidenceAwareBugMarkdown = appendBugEvidenceToMarkdown(exportMarkdown, bugEvidence);

  function handleToggleEditMarkdown() {
    if (!isEditingMarkdown) {
      setEditedMarkdown(editedMarkdown || savedEditedMarkdown || generatedMarkdown);
      setIsEditingMarkdown(true);
      return;
    }

    setIsEditingMarkdown(false);
  }

  function handleLiveMarkdownEdit(nextMarkdown: string) {
    setEditedMarkdown(nextMarkdown);
    setEditableBugReport((current) => parseBugReportMarkdown(nextMarkdown, current));
  }

  function handleSaveMarkdownEdits() {
    const parsedBugReport = parseBugReportMarkdown(editedMarkdown, editableBugReport);
    setEditableBugReport(parsedBugReport);
    onSaveBugMarkdown?.(formatBugReport(parsedBugReport, evidenceFiles, evidenceLink, answeredFollowUps));
    setIsEditingMarkdown(false);
  }

  async function handleCopy() {
    await copyText(evidenceAwareBugMarkdown);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  function handleExportMarkdown() {
    const filename = `qa-sidekick-bug-report-${buildTimestampForFilename()}.md`;

    downloadTextFile(filename, evidenceAwareBugMarkdown, "text/markdown");
    setExported(true);
    window.setTimeout(() => setExported(false), 1400);
  }

  return (
    <div className="report-wrap bug-report-wrap">
      <div className="report-header">
        <div>
          <p className="report-kicker">Bug Writer Report</p>
          <h2>Structured Bug Report</h2>
        </div>
        <div className="report-action-stack">
          <div className="report-actions compact-report-actions bug-report-actions report-action-row">
            <button className="copy-all-button" type="button" onClick={handleCopy}>
              {copied ? "Copied" : "Copy Bug Report"}
            </button>
            <button className="copy-all-button secondary-action-button" type="button" onClick={handleExportMarkdown}>
              {exported ? "Exported" : "Export Markdown"}
            </button>
            <button className="copy-all-button edit-report-button" type="button" onClick={handleToggleEditMarkdown}>
              {isEditingMarkdown ? "Close Editor" : "Edit Report"}
            </button>
          </div>
          <div className="bug-secondary-action-row">
            <SaveReportControl
              saveReportStatus={saveReportStatus}
              saveReportMessage={saveReportMessage}
              savedReportId={savedReportId}
              onSaveReport={() => onSaveReport(evidenceAwareBugMarkdown)}
            />
            <SaveBugToCollectionButton
              activeProject={activeProject}
              markdown={evidenceAwareBugMarkdown}
              structuredData={{ bugReport: editableBugReport }}
              sourceInput={sourceInput}
            />
            <JiraCreateIssueButton
              reportType="bug"
              markdown={evidenceAwareBugMarkdown}
              sourceInput={sourceInput}
              structuredData={editableBugReport}
              evidenceFiles={bugEvidence.files}
              logText={bugEvidence.logText}
            />
          </div>
        </div>
      </div>

      {savedEditedMarkdown && !isEditingMarkdown ? (
        <div className="saved-edit-notice">
          Saved edits are active. Copy/export will use the finalized edited version.
        </div>
      ) : null}

      <section className="bug-readiness-card">
        <p className="report-kicker">Bug Report Readiness</p>
        <h3>Ready for triage</h3>
        <p>
          This bug report has enough structure to create a Jira issue. Add screenshots, logs, device details,
          build/version, and repro rate when available.
        </p>
      </section>

      {isEditingMarkdown ? (
        <section className="bug-markdown-editor-card">
          <div className="bug-markdown-editor-header">
            <div>
              <p>Edit before export</p>
              <h3>Markdown Report</h3>
              <span>Cards update live as you type. Save Edits finalizes copy/export and syncs edited Follow-up Questions back to the left panel.</span>
            </div>
            <button className="copy-all-button save-edit-button" type="button" onClick={handleSaveMarkdownEdits}>
              Save Edits
            </button>
          </div>

          <textarea
            value={editedMarkdown}
            onChange={(event) => handleLiveMarkdownEdit(event.target.value)}
            spellCheck={false}
          />
        </section>
      ) : null}

      <div className="bug-report-list">
        <section className="bug-summary-card">
          <div className="badge-row">
            <EditableBadgeSelect
              label="Severity"
              value={editableBugReport.severitySuggestion}
              options={severityOptions}
              kind="risk"
              onChange={(value) => updateBugReportBadge("severitySuggestion", value)}
            />
            <EditableBadgeSelect
              label="Priority"
              value={editableBugReport.prioritySuggestion}
              options={priorityOptions}
              kind="priority"
              onChange={(value) => updateBugReportBadge("prioritySuggestion", value)}
            />
          </div>
          <h3>{safeText(editableBugReport.title)}</h3>
          <p className="field-text">{safeText(editableBugReport.summary)}</p>
        </section>

        <section className="bug-section-card">
          <h3>Environment</h3>
          <p className="field-text">{safeText(editableBugReport.environment)}</p>
        </section>

        <section className="bug-section-card">
          <h3>Steps to Reproduce</h3>
          <ol className="step-list">
            {steps.map((step, index) => (
              <li key={`${step}-${index}`}>{step}</li>
            ))}
          </ol>
        </section>

        <section className="bug-two-column-grid">
          <article className="bug-section-card">
            <h3>Expected Result</h3>
            <p className="field-text">{safeText(editableBugReport.expectedResult)}</p>
          </article>

          <article className="bug-section-card bug-actual-card">
            <h3>Actual Result</h3>
            <p className="field-text">{safeText(editableBugReport.actualResult)}</p>
          </article>
        </section>

        <section className="bug-section-card">
          <h3>Impact</h3>
          <p className="field-text">{safeText(editableBugReport.impact)}</p>
        </section>

        <section className="bug-section-card">
          <h3>Missing Info</h3>
          <ValueBlock value={editableBugReport.missingInfo} />
        </section>

        <section className="bug-section-card">
          <h3>Follow-up Questions</h3>
          <ValueBlock value={editableBugReport.followUpQuestions} />
        </section>

        <section className="bug-section-card">
          <h3>QA Notes</h3>
          <ValueBlock value={editableBugReport.qaNotes} />
        </section>

        {answeredFollowUps.length > 0 ? (
          <section className="bug-section-card followup-history-card">
            <h3>Follow-up History</h3>
            <div className="followup-history-list">
              {answeredFollowUps.map((item, index) => (
                <article className="followup-history-item" key={`${item.question}-${index}`}>
                  <span>Question {index + 1}</span>
                  <strong>{item.question}</strong>
                  <p>{item.answer}</p>
                  <small>{item.answerType} · {item.resolution}</small>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {screenshotEvidence.length > 0 || logEvidence.length > 0 ? (
          <section className="bug-section-card bug-evidence-report-card">
            <h3>Evidence</h3>

            {screenshotEvidence.length > 0 ? (
              <div className="bug-evidence-group">
                <h4>Screenshots</h4>
                <div className="bug-evidence-screenshot-grid">
                  {screenshotEvidence.map((file) => (
                    <article className="bug-evidence-screenshot-card" key={file.name}>
                      <img src={file.dataUrl} alt={`Evidence screenshot: ${file.name}`} />
                      <div>
                        <span>{file.name}</span>
                        <small>{formatBytes(file.size)}</small>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            {logEvidence.length > 0 ? (
              <div className="bug-evidence-group">
                <h4>Logs</h4>
                <div className="bug-evidence-log-list">
                  {logEvidence.map((file) => (
                    <div className="bug-evidence-log-row" key={file.name}>
                      <span>{file.name}</span>
                      <small>{formatBytes(file.size)}</small>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {reportType === "bug" ? (
          <BugEvidencePreview evidence={bugEvidence} />
        ) : null}
      </div>

      <CoverageScorePanel
        reportType={reportType}
        sourceInput={sourceInput}
        markdown={evidenceAwareBugMarkdown}
        structuredData={editableBugReport}
      />
    </div>
  );
}


function TestImprovementCards({
  report,
  reportType,
  sourceInput,
  saveReportStatus,
  saveReportMessage,
  savedReportId,
  activeProject,
  onSaveReport,
}: { report: TestImprovementReport; activeProject: SafeQAProject | null } & CoverageScoreProps & SaveReportControlProps) {
  const [copied, setCopied] = useState(false);
  const [exported, setExported] = useState(false);
  const [isEditingMarkdown, setIsEditingMarkdown] = useState(false);
  const [editedMarkdown, setEditedMarkdown] = useState("");
  const [savedMarkdown, setSavedMarkdown] = useState("");
  const [editableReport, setEditableReport] = useState<TestImprovementReport>(report);

  useEffect(() => {
    setEditableReport(report);
    setEditedMarkdown("");
    setSavedMarkdown("");
  }, [report]);

  const improved = isPlainObject(editableReport.improvedTestCase)
    ? (editableReport.improvedTestCase as TestCase)
    : ({} as TestCase);
  const generatedMarkdown = buildTestImprovementMarkdown(editableReport);
  const exportMarkdown = savedMarkdown || generatedMarkdown;
  const steps = normalizeSteps(improved.steps);
  const improvementsMade = meaningfulLines(editableReport.improvementsMade);
  const addedCoverage = meaningfulLines(editableReport.addedCoverage);
  const missingInfo = meaningfulLines(editableReport.missingInfo);
  const followUpQuestions = meaningfulLines(editableReport.followUpQuestions);
  const qaNotes = meaningfulLines(editableReport.qaNotes);

  function updateImprovedTestCaseBadge(field: "type" | "priority", value: string) {
    setEditableReport((current) => {
      const currentImproved = isPlainObject(current.improvedTestCase)
        ? (current.improvedTestCase as TestCase)
        : ({} as TestCase);

      return {
        ...current,
        improvedTestCase: {
          ...currentImproved,
          [field]: value,
        },
      };
    });
    setSavedMarkdown("");
  }

  function handleToggleEditMarkdown() {
    if (!isEditingMarkdown) {
      setEditedMarkdown(savedMarkdown || generatedMarkdown);
      setIsEditingMarkdown(true);
      return;
    }

    setIsEditingMarkdown(false);
  }

  function handleLiveMarkdownEdit(nextMarkdown: string) {
    setEditedMarkdown(nextMarkdown);
    setEditableReport((current) => parseTestImprovementMarkdown(nextMarkdown, current));
    setSavedMarkdown("");
  }

  function handleSaveMarkdownEdits() {
    const parsedReport = parseTestImprovementMarkdown(editedMarkdown, editableReport);
    const normalizedMarkdown = buildTestImprovementMarkdown(parsedReport);

    setEditableReport(parsedReport);
    setSavedMarkdown(normalizedMarkdown);
    setEditedMarkdown(normalizedMarkdown);
    setIsEditingMarkdown(false);
  }

  async function handleCopy() {
    await copyText(exportMarkdown);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  function handleExportMarkdown() {
    const filename = `qa-sidekick-improved-test-${buildTimestampForFilename()}.md`;

    downloadTextFile(filename, exportMarkdown, "text/markdown");
    setExported(true);
    window.setTimeout(() => setExported(false), 1400);
  }

  return (
    <div className="report-wrap test-improvement-wrap">
      <div className="report-header">
        <div>
          <p className="report-kicker">Test Improver Report</p>
          <h2>{safeText(editableReport.title)}</h2>
        </div>
        <div className="report-action-stack">
          <div className="report-actions compact-report-actions report-action-row">
            <button className="copy-all-button" type="button" onClick={handleCopy}>
              {copied ? "Copied" : "Copy Improved Test"}
            </button>
            <button className="copy-all-button secondary-action-button" type="button" onClick={handleExportMarkdown}>
              {exported ? "Exported" : "Export Markdown"}
            </button>
            <button className="copy-all-button edit-report-button" type="button" onClick={handleToggleEditMarkdown}>
              {isEditingMarkdown ? "Close Editor" : "Edit Report"}
            </button>
          </div>
          <SaveReportControl
            saveReportStatus={saveReportStatus}
            saveReportMessage={saveReportMessage}
            savedReportId={savedReportId}
            onSaveReport={() => onSaveReport(exportMarkdown)}
          />
        </div>
      </div>

      <SaveGeneratedOutputToSourceButton
        activeProject={activeProject}
        reportType={reportType}
        markdown={exportMarkdown}
        structuredData={{ testImprovement: editableReport }}
      />

      {savedMarkdown && !isEditingMarkdown ? (
        <div className="saved-edit-notice">
          Saved edits are active. Copy/export will use the finalized edited version.
        </div>
      ) : null}

      {isEditingMarkdown ? (
        <section className="report-markdown-editor-card">
          <div className="report-markdown-editor-header">
            <div>
              <p>Edit before export</p>
              <h3>Improved Test Markdown</h3>
              <span>Cards update live as you type. Save Edits finalizes the edited version for copy/export.</span>
            </div>
            <button className="copy-all-button save-edit-button" type="button" onClick={handleSaveMarkdownEdits}>
              Save Edits
            </button>
          </div>

          <textarea
            value={editedMarkdown}
            onChange={(event) => handleLiveMarkdownEdit(event.target.value)}
            spellCheck={false}
          />
        </section>
      ) : null}

      <div className="test-improvement-grid">
        <section className="test-case-card improved-test-card">
          <div className="test-case-topline">
            <div className="test-case-label-row">
              <span className="test-case-label">Improved Test Case</span>
            </div>
            <h3>{safeText(improved.title)}</h3>
            <div className="badge-row">
              <EditableBadgeSelect
                label="Type"
                value={improved.type}
                options={testTypeOptions}
                kind="type"
                onChange={(value) => updateImprovedTestCaseBadge("type", value)}
              />
              <EditableBadgeSelect
                label="Priority"
                value={improved.priority}
                options={priorityOptions}
                kind="priority"
                onChange={(value) => updateImprovedTestCaseBadge("priority", value)}
              />
            </div>
          </div>

          <div className="test-case-section">
            <h4>Preconditions</h4>
            <ValueBlock value={improved.preconditions} />
          </div>

          <div className="test-case-section">
            <h4>Steps</h4>
            {steps.length > 0 ? (
              <ol>
                {steps.map((step, index) => (
                  <li key={`${step}-${index}`}>{step}</li>
                ))}
              </ol>
            ) : (
              <p className="field-text">No steps returned.</p>
            )}
          </div>

          <div className="test-case-section">
            <h4>Expected Result</h4>
            <ValueBlock value={improved.expectedResult} />
          </div>
        </section>

        <section className="risk-section-card">
          <h3>Improvements Made</h3>
          {improvementsMade.length > 0 ? (
            <ul className="risk-section-list">
              {improvementsMade.map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="field-text">No improvements listed.</p>
          )}
        </section>

        <section className="risk-section-card">
          <h3>Added Coverage</h3>
          {addedCoverage.length > 0 ? (
            <ul className="risk-section-list">
              {addedCoverage.map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="field-text">No added coverage listed.</p>
          )}
        </section>

        <RiskTextList title="Missing Info" items={missingInfo} />
        <RiskTextList title="Follow-up Questions" items={followUpQuestions} />
        <RiskTextList title="QA Notes" items={qaNotes} />
      </div>

      <CoverageScorePanel
        reportType={reportType}
        sourceInput={sourceInput}
        markdown={exportMarkdown}
        structuredData={editableReport}
      />
    </div>
  );
}

function GenericOutput({
  output,
  evidenceFiles = [],
  evidenceLink = "",
  answeredFollowUps = [],
  riskAnsweredFollowUps = [],
  testAnsweredFollowUps = [],
  onSaveBugMarkdown,
  bugEvidence,
  reportType,
  sourceInput,
  testCaseGenerationKey,
  automationCredentialProfiles = [],
  automationCredentialDefaultProfileKey = "",
  automationCredentialEnvExample = "",
  automationProjectConfig,
  saveReportStatus,
  saveReportMessage,
  savedReportId,
  activeProject,
  onSaveReport,
}: {
  output: string;
  evidenceFiles?: UploadedEvidenceFile[];
  evidenceLink?: string;
  answeredFollowUps?: AnsweredFollowUp[];
  riskAnsweredFollowUps?: AnsweredFollowUp[];
  testAnsweredFollowUps?: AnsweredFollowUp[];
  onSaveBugMarkdown?: (markdown: string) => void;
  bugEvidence: BugEvidenceState;
  activeProject: SafeQAProject | null;
} & CoverageScoreProps & SaveReportControlProps) {
  const parsed = unwrapQaResult(parseOutput(output));

  if (isPlainObject(parsed) && Array.isArray(parsed.testCases)) {
    return (
      <TestCaseCards
        testCases={parsed.testCases as TestCase[]}
        answeredFollowUps={testAnsweredFollowUps}
        reportType={reportType}
        sourceInput={sourceInput}
        testCaseGenerationKey={testCaseGenerationKey}
        automationCredentialProfiles={automationCredentialProfiles}
        automationCredentialDefaultProfileKey={automationCredentialDefaultProfileKey}
        automationCredentialEnvExample={automationCredentialEnvExample}
        automationProjectConfig={automationProjectConfig}
        saveReportStatus={saveReportStatus}
        saveReportMessage={saveReportMessage}
        savedReportId={savedReportId}
        activeProject={activeProject}
        onSaveReport={onSaveReport}
      />
    );
  }

  if (isPlainObject(parsed) && isPlainObject(parsed.riskReview)) {
    return (
      <RiskReviewCards
        riskReview={parsed.riskReview as RiskReview}
        answeredFollowUps={riskAnsweredFollowUps}
        reportType={reportType}
        sourceInput={sourceInput}
        saveReportStatus={saveReportStatus}
        saveReportMessage={saveReportMessage}
        savedReportId={savedReportId}
        activeProject={activeProject}
        onSaveReport={onSaveReport}
      />
    );
  }

  if (isPlainObject(parsed) && isPlainObject(parsed.bugReport)) {
    return (
      <BugReportCards
        bugReport={parsed.bugReport as BugReport}
        evidenceFiles={evidenceFiles}
        evidenceLink={evidenceLink}
        answeredFollowUps={answeredFollowUps}
        onSaveBugMarkdown={onSaveBugMarkdown}
        savedEditedMarkdown={typeof parsed.editedMarkdown === "string" ? parsed.editedMarkdown : ""}
        bugEvidence={bugEvidence}
        reportType={reportType}
        sourceInput={sourceInput}
        saveReportStatus={saveReportStatus}
        saveReportMessage={saveReportMessage}
        savedReportId={savedReportId}
        activeProject={activeProject}
        onSaveReport={onSaveReport}
      />
    );
  }

  if (isPlainObject(parsed) && isPlainObject(parsed.testImprovement)) {
    return (
      <TestImprovementCards
        report={parsed.testImprovement as TestImprovementReport}
        reportType={reportType}
        sourceInput={sourceInput}
        saveReportStatus={saveReportStatus}
        saveReportMessage={saveReportMessage}
        savedReportId={savedReportId}
        activeProject={activeProject}
        onSaveReport={onSaveReport}
      />
    );
  }

  const displayText = typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2);

  return <pre className="generic-output">{displayText}</pre>;
}

export default function Home() {
  const { data: session } = useSession();
  const [activeTool, setActiveTool] = useState<ToolId>("tests");
  const [input, setInput] = useState("");
  const [bugDeviceType, setBugDeviceType] = useState("");
  const [bugOperatingSystem, setBugOperatingSystem] = useState("");
  const [bugAppVersion, setBugAppVersion] = useState("");
  const [bugBuildNumber, setBugBuildNumber] = useState("");
  const [bugPlatform, setBugPlatform] = useState("");
  const [bugAccountRole, setBugAccountRole] = useState("");
  const [bugReproRate, setBugReproRate] = useState("Unknown");
  const [bugReproNotes, setBugReproNotes] = useState("");
  const [bugEvidenceLinks, setBugEvidenceLinks] = useState("");
  const [bugEvidenceNotes, setBugEvidenceNotes] = useState("");
  const [bugScreenshotFiles, setBugScreenshotFiles] = useState<UploadedEvidenceFile[]>([]);
  const [bugLogFiles, setBugLogFiles] = useState<UploadedEvidenceFile[]>([]);
  const [bugEvidence, setBugEvidence] = useState<BugEvidenceState>(EMPTY_BUG_EVIDENCE);
  const [bugQuestionAnswers, setBugQuestionAnswers] = useState<Record<string, string>>({});
  const [bugQuestionResolutions, setBugQuestionResolutions] = useState<Record<string, FollowUpResolution>>({});
  const [bugAnsweredFollowUpHistory, setBugAnsweredFollowUpHistory] = useState<AnsweredFollowUp[]>([]);
  const [followUpLoopClosed, setFollowUpLoopClosed] = useState(false);
  const [bugContextAnswers, setBugContextAnswers] = useState("");
  const [riskQuestionAnswers, setRiskQuestionAnswers] = useState<Record<string, string>>({});
  const [riskQuestionResolutions, setRiskQuestionResolutions] = useState<Record<string, FollowUpResolution>>({});
  const [riskAnsweredFollowUpHistory, setRiskAnsweredFollowUpHistory] = useState<AnsweredFollowUp[]>([]);
  const [riskFollowUpLoopClosed, setRiskFollowUpLoopClosed] = useState(false);
  const [riskAdditionalContext, setRiskAdditionalContext] = useState("");
  const [testQuestionAnswers, setTestQuestionAnswers] = useState<Record<string, string>>({});
  const [testQuestionResolutions, setTestQuestionResolutions] = useState<Record<string, FollowUpResolution>>({});
  const [testAnsweredFollowUpHistory, setTestAnsweredFollowUpHistory] = useState<AnsweredFollowUp[]>([]);
  const [testFollowUpLoopClosed, setTestFollowUpLoopClosed] = useState(false);
  const [testAdditionalContext, setTestAdditionalContext] = useState("");
  const [improveQuestionAnswers, setImproveQuestionAnswers] = useState<Record<string, string>>({});
  const [improveQuestionResolutions, setImproveQuestionResolutions] = useState<Record<string, FollowUpResolution>>({});
  const [improveAnsweredFollowUpHistory, setImproveAnsweredFollowUpHistory] = useState<AnsweredFollowUp[]>([]);
  const [improveFollowUpLoopClosed, setImproveFollowUpLoopClosed] = useState(false);
  const [improveAdditionalContext, setImproveAdditionalContext] = useState("");
  const [output, setOutput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [importedJiraTicket, setImportedJiraTicket] = useState<ParsedJiraTicket | null>(null);
  const [saveReportStatus, setSaveReportStatus] = useState<SaveReportStatus>("idle");
  const [saveReportMessage, setSaveReportMessage] = useState("");
  const [savedReportId, setSavedReportId] = useState("");
  const [lastTestGenerationFingerprint, setLastTestGenerationFingerprint] = useState("");
  const [testCaseRefreshNonce, setTestCaseRefreshNonce] = useState(0);
  const [testGenerationNotice, setTestGenerationNotice] = useState("");
  const [testCaseCostConfirmation, setTestCaseCostConfirmation] = useState<{
    open: boolean;
    testCaseCount: number;
    cost: number;
  }>({ open: false, testCaseCount: 0, cost: 0 });
  const [activeProject, setActiveProject] = useState<SafeQAProject | null>(null);
  const [activeProjectContext, setActiveProjectContext] = useState<ActiveProjectContext | null>(null);
  const [isProjectContextLoading, setIsProjectContextLoading] = useState(false);
  const [projectContextError, setProjectContextError] = useState("");
  const [selectedProjectSourceIds, setSelectedProjectSourceIds] = useState<string[]>([]);
  const [selectedProjectContextBlock, setSelectedProjectContextBlock] = useState("");
  const [automationCredentialProfiles, setAutomationCredentialProfiles] = useState<AutomationCredentialProfile[]>([]);
  const [automationProjectConfig, setAutomationProjectConfig] = useState<AutomationProjectConfig>(() =>
    normalizeAutomationProjectConfig(null)
  );

  const projectContextPayload = useMemo<ProjectContextPayload>(() => {
    return buildProjectContextPayload({
      projectId: activeProject?.id,
      projectName: activeProject?.name,
      productType: activeProject?.productType,
      projectDescription: activeProject?.description,
      sources: (activeProjectContext?.sources ?? []).map((source) => ({
        ...source,
        enabled: source.isEnabled,
      })),
      selectedSourceIds: selectedProjectSourceIds,
      maxCharacters: 12000,
    });
  }, [
    activeProject?.id,
    activeProject?.name,
    activeProject?.productType,
    activeProject?.description,
    activeProjectContext?.sources,
    selectedProjectSourceIds,
  ]);
  const automationCredentialPayload = useMemo(() => {
    return buildAutomationCredentialPayload(automationCredentialProfiles);
  }, [automationCredentialProfiles]);

  const tool = tools.find((item) => item.id === activeTool) ?? tools[0];
  const activeReportTool: ReportToolId = activeTool === "feature" ? "tests" : activeTool;
  const currentBugReport = activeTool === "bug" ? getBugReportFromOutput(output) : null;
  const rawBugFollowUpQuestions = currentBugReport ? meaningfulLines(currentBugReport.followUpQuestions) : [];
  const bugFollowUpQuestions = rawBugFollowUpQuestions.filter(
    (question) =>
      !followUpLoopClosed &&
      (bugQuestionResolutions[question] ?? "Still open") !== "Resolved" &&
      (bugQuestionResolutions[question] ?? "Still open") !== "No more questions"
  );
  const currentAnsweredFollowUps = buildAnsweredFollowUps(
    rawBugFollowUpQuestions,
    bugQuestionAnswers,
    bugQuestionResolutions
  );
  const bugAnsweredFollowUps = mergeAnsweredFollowUpHistory(
    bugAnsweredFollowUpHistory,
    currentAnsweredFollowUps
  );
  const currentRiskReview = activeTool === "risk" ? getRiskReviewFromOutput(output) : null;
  const riskFollowUpQuestions = currentRiskReview
    ? meaningfulLines(currentRiskReview.qaFollowUpQuestions).filter(
        (question) =>
          !riskFollowUpLoopClosed &&
          (riskQuestionResolutions[question] ?? "Still open") !== "Resolved" &&
          (riskQuestionResolutions[question] ?? "Still open") !== "No more questions"
      )
    : [];
  const currentRiskAnsweredFollowUps = buildAnsweredFollowUps(
    currentRiskReview ? meaningfulLines(currentRiskReview.qaFollowUpQuestions) : [],
    riskQuestionAnswers,
    riskQuestionResolutions
  );
  const riskAnsweredFollowUps = mergeAnsweredFollowUpHistory(
    riskAnsweredFollowUpHistory,
    currentRiskAnsweredFollowUps
  );
  const currentTestOutput = activeTool === "tests" ? getTestOutputFromOutput(output) : null;
  const rawTestFollowUpQuestions = currentTestOutput
    ? meaningfulLines(currentTestOutput.qaFollowUpQuestions)
    : [];
  const testFollowUpQuestions = rawTestFollowUpQuestions.filter(
    (question) =>
      !testFollowUpLoopClosed &&
      (testQuestionResolutions[question] ?? "Still open") !== "Resolved" &&
      (testQuestionResolutions[question] ?? "Still open") !== "No more questions"
  );
  const currentTestAnsweredFollowUps = buildAnsweredFollowUps(
    rawTestFollowUpQuestions,
    testQuestionAnswers,
    testQuestionResolutions
  );
  const testAnsweredFollowUps = mergeAnsweredFollowUpHistory(
    testAnsweredFollowUpHistory,
    currentTestAnsweredFollowUps
  );
  const currentTestImprovement = activeTool === "improve" ? getTestImprovementFromOutput(output) : null;

  const TOOL_FTUE_KEYS: Record<ToolId, FtueStepKey> = {
    tests: FTUE_KEYS.testsIntro,
    bug: FTUE_KEYS.bugIntro,
    risk: FTUE_KEYS.riskIntro,
    improve: FTUE_KEYS.improveIntro,
    feature: FTUE_KEYS.featureIntro,
  };
  const ftueToolKey = TOOL_FTUE_KEYS[activeTool];
  const [showWelcomeFtue, setShowWelcomeFtue] = useState(false);
  const [showBrainFtue, setShowBrainFtue] = useState(false);
  const [showIntegrationsFtue, setShowIntegrationsFtue] = useState(false);
  const [showToolFtue, setShowToolFtue] = useState(false);

  const toolFtueCopy: Record<ToolId, { title: string; body: string }> = {
    tests: {
      title: "QAt can build test coverage from rough source work.",
      body: "Paste a Jira ticket, user story, or acceptance criteria. QAtalyst will generate reviewable test cases and call out follow-up questions when the source is thin.",
    },
    bug: {
      title: "QAt can turn messy bug notes into a clean defect.",
      body: "Add repro notes, environment details, screenshots, logs, or tester notes. QAtalyst will structure the report so it is easier for developers to triage.",
    },
    risk: {
      title: "QAt can spot release risks before QA starts.",
      body: "Paste a ticket or requirements note. QAtalyst will look for unclear acceptance criteria, bottlenecks, fragile areas, and follow-up questions.",
    },
    improve: {
      title: "QAt can strengthen weak test cases.",
      body: "Paste an existing test case or checklist. QAtalyst will improve structure, coverage, clarity, and missing validation points.",
    },
    feature: {
      title: "QAt can shape rough feature ideas into QA-ready briefs.",
      body: "Start messy. Feature Builder helps turn early ideas into structured scope, risks, follow-up questions, and QA-ready direction.",
    },
  };

  function syncFtueVisibilityFromStorage() {
  setShowWelcomeFtue(!isFtueStepComplete(FTUE_KEYS.welcome));
  setShowBrainFtue(!isFtueStepComplete(FTUE_KEYS.brainIntro));
  setShowIntegrationsFtue(!isFtueStepComplete(FTUE_KEYS.integrationsIntro));
  setShowToolFtue(!isFtueStepComplete(ftueToolKey));
}

useEffect(() => {
  syncFtueVisibilityFromStorage();

  function handlePageShow() {
    syncFtueVisibilityFromStorage();
  }

  function handleVisibilityChange() {
    if (document.visibilityState === "visible") {
      syncFtueVisibilityFromStorage();
    }
  }

  window.addEventListener("pageshow", handlePageShow);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("focus", handlePageShow);

  return () => {
    window.removeEventListener("pageshow", handlePageShow);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("focus", handlePageShow);
  };
}, [ftueToolKey]);

  useEffect(() => {
    setShowToolFtue(!isFtueStepComplete(ftueToolKey));
  }, [ftueToolKey]);

  function dismissFtueStep(key: FtueStepKey) {
    completeFtueStep(key);

    if (key === FTUE_KEYS.welcome) setShowWelcomeFtue(false);
    if (key === FTUE_KEYS.brainIntro) setShowBrainFtue(false);
    if (key === FTUE_KEYS.integrationsIntro) setShowIntegrationsFtue(false);
    if (key === ftueToolKey) setShowToolFtue(false);
  }

  function handleToolChange(toolId: ToolId) {
    setActiveTool(toolId);
    setOutput("");
    if (toolId !== "risk") {
      setRiskQuestionAnswers({});
      setRiskQuestionResolutions({});
      setRiskAnsweredFollowUpHistory([]);
      setRiskFollowUpLoopClosed(false);
      setRiskAdditionalContext("");
    }
    if (toolId !== "tests") {
      setTestQuestionAnswers({});
      setTestQuestionResolutions({});
      setTestAnsweredFollowUpHistory([]);
      setTestFollowUpLoopClosed(false);
      setTestAdditionalContext("");
    }
    if (toolId !== "improve") {
      setImproveQuestionAnswers({});
      setImproveQuestionResolutions({});
      setImproveAnsweredFollowUpHistory([]);
      setImproveFollowUpLoopClosed(false);
      setImproveAdditionalContext("");
    }
    if (toolId !== "bug") {
      setBugDeviceType("");
      setBugOperatingSystem("");
      setBugAppVersion("");
      setBugBuildNumber("");
      setBugPlatform("");
      setBugAccountRole("");
      setBugReproRate("Unknown");
      setBugReproNotes("");
      setBugEvidenceLinks("");
      setBugEvidenceNotes("");
      setBugScreenshotFiles([]);
      setBugLogFiles([]);
      setBugQuestionAnswers({});
      setBugQuestionResolutions({});
      setBugAnsweredFollowUpHistory([]);
      setFollowUpLoopClosed(false);
      setBugContextAnswers("");
    }
  }

  function handleUseFeatureBriefForTool(args: { tool: "tests" | "risk"; markdown: string }) {
    handleToolChange(args.tool);
    setInput(args.markdown);
    setOutput("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  const rawImproveFollowUpQuestions = currentTestImprovement
    ? meaningfulLines(currentTestImprovement.followUpQuestions)
    : [];
  const improveFollowUpQuestions = rawImproveFollowUpQuestions.filter(
    (question) =>
      !improveFollowUpLoopClosed &&
      (improveQuestionResolutions[question] ?? "Still open") !== "Resolved" &&
      (improveQuestionResolutions[question] ?? "Still open") !== "No more questions"
  );
  const currentImproveAnsweredFollowUps = buildAnsweredFollowUps(
    rawImproveFollowUpQuestions,
    improveQuestionAnswers,
    improveQuestionResolutions
  );
  const improveAnsweredFollowUps = mergeAnsweredFollowUpHistory(
    improveAnsweredFollowUpHistory,
    currentImproveAnsweredFollowUps
  );
  const currentTestFingerprint = buildGenerationFingerprint({
    activeTool,
    sourceText: input,
    jiraKey: importedJiraTicket?.key,
    additionalContext: [
      testAdditionalContext,
      projectContextPayload.selectedProjectId,
      projectContextPayload.selectedProjectSourceIds.join(","),
      projectContextPayload.projectContextSummary,
      selectedProjectContextBlock || activeProjectContext?.contextBlock || "",
      selectedProjectSourceIds.join(","),
    ].join("\n"),
    answeredFollowUps: testAnsweredFollowUps,
  });
  const testCaseGenerationKey = useMemo(() => {
    const currentTestCaseCount = Array.isArray(currentTestOutput?.testCases)
      ? currentTestOutput.testCases.length
      : 0;

    return buildOutputGenerationKey({
      activeTool,
      inputFingerprint: `${currentTestFingerprint}:${testCaseRefreshNonce}`,
      outputText: output,
      testCaseCount: currentTestCaseCount,
    });
  }, [activeTool, currentTestFingerprint, currentTestOutput, output, testCaseRefreshNonce]);

  useEffect(() => {
    setSaveReportStatus("idle");
    setSaveReportMessage("");
    setSavedReportId("");
  }, [activeTool, input, output]);

  useEffect(() => {
    let ignore = false;

    async function loadProjectContext(projectId: string) {
      setIsProjectContextLoading(true);
      setProjectContextError("");

      try {
        const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/context`);
        const payload = await response.json().catch(() => null);

        if (!response.ok || payload?.ok === false || !payload?.projectContext) {
          throw new Error(payload?.error || "Could not load project context.");
        }

        if (!ignore) {
          setActiveProjectContext(payload.projectContext);
        }
      } catch (error) {
        if (!ignore) {
          setActiveProjectContext(null);
          setProjectContextError(error instanceof Error ? error.message : "Could not load project context.");
        }
      } finally {
        if (!ignore) {
          setIsProjectContextLoading(false);
        }
      }
    }

    if (!activeProject?.id) {
      setActiveProjectContext(null);
      setProjectContextError("");
      setIsProjectContextLoading(false);
      return;
    }

    void loadProjectContext(activeProject.id);

    return () => {
      ignore = true;
    };
  }, [activeProject?.id]);

  useEffect(() => {
    if (!activeProjectContext) {
      setSelectedProjectSourceIds([]);
      setSelectedProjectContextBlock("");
      return;
    }

    const enabledSources = activeProjectContext.sources.filter((source) => source.isEnabled);
    const defaultSourceIds = enabledSources.slice(0, 4).map((source) => source.id);

    setSelectedProjectSourceIds(defaultSourceIds);
    setSelectedProjectContextBlock(defaultSourceIds.length > 0 ? activeProjectContext.contextBlock : "");
  }, [activeProjectContext]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storageKey = activeProject?.id
      ? `qatalyst.automationCredentialProfiles.${activeProject.id}`
      : "qatalyst.automationCredentialProfiles.global";
    const stored = window.localStorage.getItem(storageKey);

    if (!stored) {
      setAutomationCredentialProfiles([]);
      return;
    }

    try {
      const parsed = JSON.parse(stored);
      setAutomationCredentialProfiles(Array.isArray(parsed) ? parsed : []);
    } catch {
      setAutomationCredentialProfiles([]);
    }
  }, [activeProject?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storageKey = activeProject?.id
      ? `qatalyst.automationCredentialProfiles.${activeProject.id}`
      : "qatalyst.automationCredentialProfiles.global";
    window.localStorage.setItem(storageKey, JSON.stringify(automationCredentialProfiles));
  }, [activeProject?.id, automationCredentialProfiles]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storageKey = activeProject?.id
      ? `qatalyst.automationExportConfig.${activeProject.id}`
      : "qatalyst.automationExportConfig.global";
    const stored = window.localStorage.getItem(storageKey);

    if (!stored) {
      setAutomationProjectConfig(normalizeAutomationProjectConfig(null));
      return;
    }

    try {
      setAutomationProjectConfig(normalizeAutomationProjectConfig(JSON.parse(stored)));
    } catch {
      setAutomationProjectConfig(normalizeAutomationProjectConfig(null));
    }
  }, [activeProject?.id]);

  function updateBugQuestionAnswer(question: string, answer: string) {
    setBugQuestionAnswers((current) => ({
      ...current,
      [question]: answer,
    }));

    setBugQuestionResolutions((current) => ({
      ...current,
      [question]: current[question] ?? "Still open",
    }));
  }

  function updateBugQuestionResolution(question: string, resolution: FollowUpResolution) {
    setBugQuestionResolutions((current) => ({
      ...current,
      [question]: resolution,
    }));

    if (resolution === "No more questions") {
      setFollowUpLoopClosed(true);
    }
  }


  function updateRiskQuestionAnswer(question: string, answer: string) {
    setRiskQuestionAnswers((current) => ({
      ...current,
      [question]: answer,
    }));

    setRiskQuestionResolutions((current) => ({
      ...current,
      [question]: current[question] ?? "Still open",
    }));
  }

  function updateRiskQuestionResolution(question: string, resolution: FollowUpResolution) {
    setRiskQuestionResolutions((current) => ({
      ...current,
      [question]: resolution,
    }));

    if (resolution === "No more questions") {
      setRiskFollowUpLoopClosed(true);
    }
  }

  function updateTestQuestionAnswer(question: string, answer: string) {
    setTestQuestionAnswers((current) => ({
      ...current,
      [question]: answer,
    }));

    setTestQuestionResolutions((current) => ({
      ...current,
      [question]: current[question] ?? "Still open",
    }));
  }

  function updateTestQuestionResolution(question: string, resolution: FollowUpResolution) {
    setTestQuestionResolutions((current) => ({
      ...current,
      [question]: resolution,
    }));

    if (resolution === "No more questions") {
      setTestFollowUpLoopClosed(true);
    }
  }

  function updateImproveQuestionAnswer(question: string, answer: string) {
    setImproveQuestionAnswers((current) => ({
      ...current,
      [question]: answer,
    }));

    setImproveQuestionResolutions((current) => ({
      ...current,
      [question]: current[question] ?? "Still open",
    }));
  }

  function updateImproveQuestionResolution(question: string, resolution: FollowUpResolution) {
    setImproveQuestionResolutions((current) => ({
      ...current,
      [question]: resolution,
    }));

    if (resolution === "No more questions") {
      setImproveFollowUpLoopClosed(true);
    }
  }

  function handleSaveBugMarkdown(markdown: string) {
    const parsed = parseOutput(output);

    if (!isPlainObject(parsed) || !isPlainObject(parsed.bugReport)) {
      return;
    }

    const nextBugReport = parseBugReportMarkdown(markdown, parsed.bugReport as BugReport);
    const editedFollowUps = meaningfulLines(nextBugReport.followUpQuestions);

    setOutput(
      JSON.stringify(
        {
          ...parsed,
          bugReport: nextBugReport,
          editedMarkdown: markdown,
        },
        null,
        2
      )
    );

    if (editedFollowUps.length > 0) {
      setBugQuestionAnswers({});
      setBugQuestionResolutions({});
    }
  }

  function handleJiraTicketImport(normalizedText: string, ticket: ParsedJiraTicket) {
    setInput(normalizedText);
    setImportedJiraTicket(ticket.key ? ticket : null);
  }

  function handleClearJiraTicket() {
    setImportedJiraTicket(null);
    setInput("");
  }

  function getCurrentStructuredReport() {
    if (!output.trim()) return null;

    try {
      return JSON.parse(output);
    } catch {
      return { rawOutput: output };
    }
  }

  function getCurrentReportTitle(markdown: string) {
    const explicitTitle = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
    if (explicitTitle) return explicitTitle.slice(0, 140);

    if (activeTool === "tests") return "Test Cases";
    if (activeTool === "risk") return "Risk Review";
    if (activeTool === "bug") return "Bug Report";
    if (activeTool === "improve") return "Test Improvement";

    return "QA Report";
  }

  async function handleSaveReport(markdown: string) {
    const reportMarkdown = markdown.trim();

    if (!reportMarkdown) {
      setSaveReportStatus("error");
      setSaveReportMessage("Generate or edit a report before saving.");
      return;
    }

    setSaveReportStatus("saving");
    setSaveReportMessage("");
    setSavedReportId("");

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: activeTool,
          title: getCurrentReportTitle(reportMarkdown),
          markdown: reportMarkdown,
          structuredData: {
            ...getCurrentStructuredReport(),
            projectContextMeta: projectContextPayload.projectContextUsed
              ? {
                  projectId: projectContextPayload.selectedProjectId,
                  projectName: projectContextPayload.selectedProjectName,
                  projectSourceIds: projectContextPayload.selectedProjectSourceIds,
                  projectContextSummary: projectContextPayload.projectContextSummary,
                  projectContextUsed: projectContextPayload.projectContextUsed,
                  automationCredentialsUsed: automationCredentialPayload.credentialsUsed,
                  automationCredentialProfiles: automationCredentialPayload.profiles,
                }
              : null,
          },
          sourceInput: input,
          projectId: projectContextPayload.selectedProjectId || null,
          projectName: projectContextPayload.selectedProjectName || null,
          projectSourceIds: projectContextPayload.selectedProjectSourceIds,
          projectContextSummary: projectContextPayload.projectContextSummary,
          projectContextUsed: projectContextPayload.projectContextUsed,
        }),
      });

      const payload = (await response.json().catch(() => null)) as SaveReportResponse | null;

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || "Could not save report.");
      }

      setSaveReportStatus("saved");
      setSaveReportMessage(activeProject ? `Saved report to ${activeProject.name}.` : "Saved report.");
      setSavedReportId(payload?.report?.id ?? "");
    } catch (error) {
      setSaveReportStatus("error");
      setSaveReportMessage(error instanceof Error ? error.message : "Could not save report.");
    }
  }

  async function handleScreenshotFiles(files: FileList | null) {
    if (!files?.length) return;

    const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
    const loadedFiles = await Promise.all(
      imageFiles.map(async (file) => ({
        name: file.name,
        type: file.type || "image",
        size: file.size,
        dataUrl: await readFileAsDataUrl(file),
      }))
    );

    setBugScreenshotFiles((current) => [...current, ...loadedFiles].slice(0, 3));
  }

  async function handleLogFiles(files: FileList | null) {
    if (!files?.length) return;

    const loadedFiles = await Promise.all(
      Array.from(files).map(async (file) => {
        let textPreview = "";

        try {
          textPreview = (await readFileAsText(file)).slice(0, 12000);
        } catch {
          textPreview = "Could not read this log file as text.";
        }

        return {
          name: file.name,
          type: file.type || "text/log",
          size: file.size,
          textPreview,
        };
      })
    );

    setBugLogFiles((current) => [...current, ...loadedFiles].slice(0, 5));
  }

  function removeScreenshotFile(name: string) {
    setBugScreenshotFiles((current) => current.filter((file) => file.name !== name));
  }

  function removeLogFile(name: string) {
    setBugLogFiles((current) => current.filter((file) => file.name !== name));
  }

  function handleRefreshCurrentTestCases(): void {
    setTestCaseRefreshNonce((value) => value + 1);
    setTestGenerationNotice(
      "No source changes detected. Refreshed scoring and export from the current generated test cases."
    );
  }

  async function runTool(options?: { forceFreshGeneration?: boolean; requestedCount?: number; confirmedCost?: number }) {
    const forceFreshGeneration = options?.forceFreshGeneration ?? false;

    if (!input.trim()) {
      setOutput("Paste a ticket, bug report, or test case first.");
      return;
    }

    if (
      activeTool === "tests" &&
      !forceFreshGeneration &&
      (Array.isArray(currentTestOutput?.testCases) ? currentTestOutput.testCases.length : 0) > 0 &&
      currentTestFingerprint === lastTestGenerationFingerprint
    ) {
      handleRefreshCurrentTestCases();
      return;
    }

    setIsRunning(true);

    const route =
      activeTool === "tests"
        ? "/api/generate-tests"
        : activeTool === "risk"
          ? "/api/analyze-risk"
          : activeTool === "bug"
            ? "/api/improve-bug"
            : "/api/improve-test";

    const bugEnvironmentContext = [
      bugDeviceType.trim() ? `Device type: ${bugDeviceType.trim()}` : "",
      bugOperatingSystem.trim() ? `Operating system: ${bugOperatingSystem.trim()}` : "",
      bugAppVersion.trim() ? `App/game version: ${bugAppVersion.trim()}` : "",
      bugBuildNumber.trim() ? `Build number: ${bugBuildNumber.trim()}` : "",
      bugPlatform.trim() ? `Browser/platform: ${bugPlatform.trim()}` : "",
      bugAccountRole.trim() ? `Account/user role: ${bugAccountRole.trim()}` : "",
      bugReproRate ? `Repro rate: ${bugReproRate}` : "",
      bugReproNotes.trim() ? `Repro notes: ${bugReproNotes.trim()}` : "",
    ].filter(Boolean);

    const mergedAnsweredFollowUps = mergeAnsweredFollowUpHistory(
      bugAnsweredFollowUpHistory,
      currentAnsweredFollowUps
    );

    const answeredFollowUps = mergedAnsweredFollowUps.map(
      (item) =>
        `Q: ${item.question}\nA: ${item.answer}\nAnswer type: ${item.answerType}\nResolution: ${item.resolution}`
    );

    const uploadedScreenshotContext = bugEvidence.files
      .filter((file) => file.type.startsWith("image/"))
      .map(
      (file, index) =>
        `Screenshot ${index + 1}: ${file.name} (${file.type}, ${formatBytes(file.size)})`
    );

    const uploadedLogContext = bugEvidence.logText.trim()
      ? [
          [
            "Pasted log output:",
            bugEvidence.logText.trim().slice(0, 12000),
          ].join("\n"),
        ]
      : [];
    const uploadedFileContext = bugEvidence.files
      .filter((file) => !file.type.startsWith("image/"))
      .map((file, index) =>
      [
        `Evidence file ${index + 1}: ${file.name} (${file.type || "unknown"}, ${formatBytes(file.size)})`,
      ].join("\n")
    );

    const bugEvidenceContext = [
      bugEvidence.evidenceReference.trim() ? `Evidence links or file references: ${bugEvidence.evidenceReference.trim()}` : "",
      uploadedScreenshotContext.length > 0
        ? uploadedScreenshotContext.join("\n")
        : "",
      uploadedFileContext.length > 0 ? uploadedFileContext.join("\n\n") : "",
      uploadedLogContext.length > 0 ? uploadedLogContext.join("\n\n") : "",
      bugEvidence.evidenceNotes.trim() ? `Evidence notes: ${bugEvidence.evidenceNotes.trim()}` : "",
    ].filter(Boolean);

    const testerNotes = bugEvidence.testerNotes.trim();
    const testerNotesContext = testerNotes
      ? [
          "Tester notes interpretation rules:",
          "- Treat tester notes as direct QA-provided facts or suspects.",
          "- If tester notes identify an item, trigger, account, condition, workaround, or recent change, use it in the report.",
          "- Do not ask follow-up questions that are already answered by tester notes.",
          "- Do not list tester-note details as missing info.",
        ].join("\n")
      : "";

    const hasBugRefinementContext =
      activeTool === "bug" &&
      (bugEnvironmentContext.length > 0 ||
        answeredFollowUps.length > 0 ||
        bugEvidenceContext.length > 0 ||
        testerNotes);

    const mergedRiskAnsweredFollowUps = mergeAnsweredFollowUpHistory(
      riskAnsweredFollowUpHistory,
      currentRiskAnsweredFollowUps
    );

    const answeredRiskFollowUps = mergedRiskAnsweredFollowUps.map(
      (item) =>
        `Q: ${item.question}\nA: ${item.answer}\nAnswer type: ${item.answerType}\nResolution: ${item.resolution}`
    );

    const hasRiskReassessmentContext =
      activeTool === "risk" &&
      (answeredRiskFollowUps.length > 0 || riskAdditionalContext.trim() || riskFollowUpLoopClosed);

    const mergedTestAnsweredFollowUps = mergeAnsweredFollowUpHistory(
      testAnsweredFollowUpHistory,
      currentTestAnsweredFollowUps
    );

    const answeredTestFollowUps = mergedTestAnsweredFollowUps.map(
      (item) =>
        `Q: ${item.question}\nA: ${item.answer}\nAnswer type: ${item.answerType}\nResolution: ${item.resolution}`
    );

    const hasTestRegenerationContext =
      activeTool === "tests" &&
      (answeredTestFollowUps.length > 0 || testAdditionalContext.trim() || testFollowUpLoopClosed);

    const mergedImproveAnsweredFollowUps = mergeAnsweredFollowUpHistory(
      improveAnsweredFollowUpHistory,
      currentImproveAnsweredFollowUps
    );

    const answeredImproveFollowUps = mergedImproveAnsweredFollowUps.map(
      (item) =>
        `Q: ${item.question}\nA: ${item.answer}\nAnswer type: ${item.answerType}\nResolution: ${item.resolution}`
    );

    const hasImproveFollowUpContext =
      activeTool === "improve" &&
      (answeredImproveFollowUps.length > 0 || improveAdditionalContext.trim() || improveFollowUpLoopClosed);

    if (activeTool === "bug" && mergedAnsweredFollowUps.length > bugAnsweredFollowUpHistory.length) {
      setBugAnsweredFollowUpHistory(mergedAnsweredFollowUps);
    }

    if (activeTool === "risk" && mergedRiskAnsweredFollowUps.length > riskAnsweredFollowUpHistory.length) {
      setRiskAnsweredFollowUpHistory(mergedRiskAnsweredFollowUps);
    }

    if (activeTool === "tests" && mergedTestAnsweredFollowUps.length > testAnsweredFollowUpHistory.length) {
      setTestAnsweredFollowUpHistory(mergedTestAnsweredFollowUps);
    }

    if (activeTool === "improve" && mergedImproveAnsweredFollowUps.length > improveAnsweredFollowUpHistory.length) {
      setImproveAnsweredFollowUpHistory(mergedImproveAnsweredFollowUps);
    }

    const requestInput = hasImproveFollowUpContext
      ? [
          "Original test case or checklist:",
          input.trim(),
          "",
          "Previous Test Improvement JSON:",
          currentTestImprovement
            ? JSON.stringify({ testImprovement: currentTestImprovement }, null, 2)
            : "No previous test improvement available.",
          "",
          "Answered Test Improver follow-up questions:",
          answeredImproveFollowUps.length > 0
            ? answeredImproveFollowUps.join("\n\n")
            : "No answered Test Improver follow-up questions supplied.",
          "",
          "Test Improver follow-up loop status:",
          improveFollowUpLoopClosed
            ? "No more Test Improver follow-up questions requested by QA. Do not generate additional follow-up questions unless there is a critical blocker."
            : "Test Improver follow-up loop is still open.",
          "",
          "Additional Test Improver context:",
          improveAdditionalContext.trim() || "No additional Test Improver context supplied.",
          "",
          "Re-improvement instructions:",
          "- Rebuild the improved test case using the original test plus answered follow-up context.",
          "- Preserve useful resolved answers in preconditions, steps, expected results, improvements made, added coverage, missing info, or QA notes.",
          "- Do not repeat follow-up questions that QA marked Resolved.",
          "- If QA selected No more questions, return an empty followUpQuestions array unless a critical blocker remains.",
          "- Keep follow-up questions low-noise and only ask questions that materially improve the test.",
        ].join("\n")
      : hasTestRegenerationContext
      ? [
          "Original ticket or requirements text:",
          input.trim(),
          "",
          "Previous Test Cases JSON:",
          currentTestOutput ? JSON.stringify(currentTestOutput, null, 2) : "No previous test cases available.",
          "",
          "Answered test follow-up questions:",
          answeredTestFollowUps.length > 0
            ? answeredTestFollowUps.join("\n\n")
            : "No answered test follow-up questions supplied.",
          "",
          "Test follow-up loop status:",
          testFollowUpLoopClosed
            ? "No more test follow-up questions requested by QA. Do not generate additional test follow-up questions unless there is a critical blocker."
            : "Test follow-up loop is still open.",
          "",
          "Additional test generation context:",
          testAdditionalContext.trim() || "No additional test context supplied.",
          "",
          "Regeneration instructions:",
          "- Rebuild the test cases using the original ticket plus answered follow-up context.",
          "- Preserve useful resolved answers in preconditions, steps, expected results, or test coverage.",
          "- Do not repeat follow-up questions that QA marked Resolved.",
          "- If QA selected No more questions, return an empty qaFollowUpQuestions array unless a critical blocker remains.",
          "- Keep follow-up questions low-noise and only ask questions that materially change test coverage.",
          "- Each test case title must be specific and useful, not generic.",
        ].join("\n")
      : hasRiskReassessmentContext
      ? [
          "Original ticket or requirements text:",
          input.trim(),
          "",
          "Previous Risk Review JSON:",
          currentRiskReview ? JSON.stringify(currentRiskReview, null, 2) : "No previous risk review available.",
          "",
          "Answered risk follow-up questions:",
          answeredRiskFollowUps.length > 0
            ? answeredRiskFollowUps.join("\n\n")
            : "No answered risk follow-up questions supplied.",
          "",
          "Risk follow-up loop status:",
          riskFollowUpLoopClosed
            ? "No more risk follow-up questions requested by QA. Do not generate additional risk follow-up questions unless there is a critical blocker."
            : "Risk follow-up loop is still open.",
          "",
          "Additional risk reassessment context:",
          riskAdditionalContext.trim() || "No additional risk context supplied.",
          "",
          "Re-assessment instructions:",
          "- Rebuild the risk review using the original ticket plus answered follow-up context.",
          "- Preserve useful resolved answers in the summary, mitigations, missing acceptance criteria, or suggested test focus.",
          "- Do not repeat follow-up questions that QA marked Resolved.",
          "- If QA selected No more questions, return an empty qaFollowUpQuestions array unless a critical blocker remains.",
          "- Keep follow-up questions low-noise and only ask questions that materially change testing or implementation risk.",
        ].join("\n")
      : hasBugRefinementContext
      ? [
          "Original rough bug notes:",
          input.trim(),
          "",
          "STRUCTURED ENVIRONMENT AND REPRO FIELDS - treat these as already answered:",
          bugEnvironmentContext.length > 0
            ? bugEnvironmentContext.join("\n")
            : "No structured environment/context fields supplied.",
          "",
          "Structured field interpretation rules:",
          "- If Device type is supplied, do not ask what device was used.",
          "- If Operating system is supplied, do not ask what OS was used.",
          "- If App/game version or Build number is supplied, do not ask for that same version/build again.",
          "- If Repro rate is supplied and is not Unknown, do not ask whether the issue reproduces consistently.",
          "- If Repro notes are supplied, use them to refine impact, priority, and follow-up questions.",
          "",
          "Evidence attachments, screenshots, logs, or links:",
          bugEvidenceContext.length > 0
            ? bugEvidenceContext.join("\n\n")
            : "No evidence links, uploads, or notes supplied.",
          "",
          "Answered follow-up questions:",
          answeredFollowUps.length > 0
            ? answeredFollowUps.join("\n\n")
            : "No specific follow-up question answers supplied.",
          "",
          "Follow-up loop status:",
          followUpLoopClosed
            ? "No more questions requested by QA. Do not generate additional follow-up questions unless there is a critical missing blocker."
            : "Follow-up loop is still open.",
          "",
          "CRITICAL TESTER NOTES - treat as direct answers/context, not optional background:",
          testerNotes || "No critical tester notes supplied.",
          "",
          testerNotesContext,
        ].join("\n")
      : input;

    try {
      if (activeTool === "tests" && options?.confirmedCost == null) {
        const estimate = await estimateTestCaseCost(requestInput);

        if (estimate.requiresConfirmation) {
          setTestCaseCostConfirmation({
            open: true,
            testCaseCount: estimate.testCaseCount,
            cost: estimate.cost,
          });
          return;
        }
      }

      setOutput("");
      const response = await fetch(route, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: requestInput,
          requestedCount: options?.requestedCount,
          confirmedCost: options?.confirmedCost,
          screenshots: [],
          projectId: projectContextPayload.selectedProjectId || null,
          projectContextBlock: projectContextPayload.projectContextBlock,
          projectContextSummary: projectContextPayload.projectContextSummary,
          projectContextUsed: projectContextPayload.projectContextUsed,
          selectedProjectId: projectContextPayload.selectedProjectId,
          selectedProjectName: projectContextPayload.selectedProjectName,
          selectedProjectSourceIds: projectContextPayload.selectedProjectSourceIds,
          projectContext:
            projectContextPayload.projectContextBlock ||
            selectedProjectContextBlock ||
            activeProjectContext?.contextBlock ||
            "",
          projectContextMeta: projectContextPayload.projectContextUsed
            ? {
                projectName: projectContextPayload.selectedProjectName,
                projectId: projectContextPayload.selectedProjectId,
                enabledSourceCount: activeProjectContext?.enabledSourceCount ?? 0,
                totalSourceCount: activeProjectContext?.totalSourceCount ?? 0,
                selectedSourceCount: projectContextPayload.selectedProjectSourceIds.length,
                selectedSourceIds: projectContextPayload.selectedProjectSourceIds,
              }
            : null,
          automationCredentialsUsed: automationCredentialPayload.credentialsUsed,
          automationCredentialProfiles: automationCredentialPayload.profiles,
          automationCredentialProfileSummary: automationCredentialPayload.profiles
            .map((profile) => `${profile.name} (${profile.role})`)
            .join(", "),
          automationCredentialPromptBlock: automationCredentialPayload.promptBlock,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setOutput(getPaidActionErrorMessage(data, response.status));
        return;
      }

      if (typeof data?.credits?.balanceAfter === "number") {
        publishCreditBalanceUpdated(data.credits.balanceAfter);
      }

      const result =
        typeof data?.result === "string"
          ? data.result
          : JSON.stringify(data?.result ?? data, null, 2);

      setOutput(result);
      if (activeTool === "tests") {
        setLastTestGenerationFingerprint(currentTestFingerprint);
        setTestGenerationNotice("");
      }
    } catch (error) {
      setOutput(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setIsRunning(false);
    }
  }

  async function estimateTestCaseCost(prompt: string) {
    const response = await fetch("/api/test-cases/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const estimate = await response.json().catch(() => null);

    if (!response.ok || estimate?.ok === false) {
      throw new Error(estimate?.error || "Could not estimate test case cost.");
    }

    return estimate as { requiresConfirmation?: boolean; testCaseCount: number; cost: number };
  }

  return (
    <main className="qatalyst-app-shell qatalyst-app-shell-v2 qatalyst-app-shell-v3 qatalyst-app-shell-v4 qatalyst-app-shell-v5 qatalyst-app-shell-v6 qatalyst-app-shell-v7 qatalyst-app-shell-v8 qatalyst-app-shell-v9" data-testid="qa-tool">
      <section className="hero hero-split app-workspace-hero" aria-label="QAtalyst workspace command center">
        <div className="hero-copy app-hero-copy">
          <p className="app-command-eyebrow">QA workflow cockpit · Project-aware outputs · Reviewable guardrails</p>
          <h1>Turn rough tickets into release-ready QA plans.</h1>
          <p>
            Bring in Jira tickets, scratch notes, project context, and reusable sources. QAtalyst helps you triage gaps,
            shape follow-up questions, and generate QA artifacts your team can review before they ship.
          </p>

          <div className="app-hero-status-grid" aria-label="Current workspace status">
            <div>
              <span>Active workflow</span>
              <strong>{tool.label}</strong>
            </div>
            <div>
              <span>Visible cost</span>
              <strong>{TOOL_COST_LABELS[activeTool]}</strong>
            </div>
            <div>
              <span>Context state</span>
              <strong>{projectContextPayload.projectContextUsed ? "Project context active" : "Ready for source"}</strong>
            </div>
          </div>

          <section className="app-context-card" aria-label="Project context and Source Vault controls">
            <div className="app-context-card-copy">
              <p className="app-section-kicker">Project Context / Source Vault</p>
              <h2>Reuse the right product knowledge before each QA run.</h2>
              <span>
                Select a project and choose reusable sources to keep generated QA output grounded in your actual product context.
              </span>
            </div>

            <HeaderProjectSourceControls
              activeProject={activeProject}
              activeContext={activeProjectContext}
              sourceInput={input}
              toolId={activeTool}
              selectedSourceIds={selectedProjectSourceIds}
              onActiveProjectChange={setActiveProject}
              onSelectedSourceIdsChange={setSelectedProjectSourceIds}
              onSelectedContextBlockChange={setSelectedProjectContextBlock}
            />
          </section>
        </div>

        <aside className="hero-brand-account app-account-rail" aria-label="Account and workspace actions">
          <div className="app-brand-panel" aria-label="QAtalyst brand mark">
            <img src="/qatalyst-header.png" alt="QAtalyst" className="brand-logo hero-brand-logo" />
          </div>

          <AuthStatus />
        </aside>
      </section>

      {showWelcomeFtue ? (
        <QAtGuideCard
          className="qat-ftue-card"
          eyebrow="First-time setup"
          title="Hi, I’m QAt. Let’s get your QA workspace grounded."
          body="QAtalyst works best when it knows which project you’re testing and what context matters. Start with Project Brain, then come back here to generate test cases, bug reports, risk reviews, improved tests, and feature briefs."
          primaryAction={{
            label: "Open Project Brain",
            onClick: () => {
              dismissFtueStep(FTUE_KEYS.welcome);
              window.location.href = "/brain";
            },
          }}
          secondaryAction={{
            label: "Stay in toolbelt",
            onClick: () => dismissFtueStep(FTUE_KEYS.welcome),
          }}
        />
      ) : null}

      {showBrainFtue ? (
        <QAtGuideCard
          className="qat-ftue-card"
          eyebrow="Project Brain"
          title="Project Brain is where QAtalyst stores reusable product memory."
          body="Use Brain for projects, Source Vault, saved reports, bug collections, team QA rules, terminology, risks, features, and integrations. The more useful context you add there, the less generic your generated QA work becomes."
          primaryAction={{
            label: "Set up Project Brain",
            onClick: () => {
              dismissFtueStep(FTUE_KEYS.brainIntro);
              window.location.href = "/brain";
            },
          }}
          secondaryAction={{
            label: "Got it",
            onClick: () => dismissFtueStep(FTUE_KEYS.brainIntro),
          }}
        />
      ) : null}

      {showIntegrationsFtue ? (
        <QAtGuideCard
          className="qat-ftue-card"
          eyebrow="Integrations"
          title="Connect Jira and TestRail when you’re ready for handoff."
          body="Integrations are now part of the Brain workflow. Jira helps pull tickets and create structured QA work; TestRail keeps generated test coverage closer to your test management process."
          primaryAction={{
            label: "Open integrations",
            onClick: () => {
              dismissFtueStep(FTUE_KEYS.integrationsIntro);
              window.location.href = "/brain?tab=integrations";
            },
          }}
          secondaryAction={{
            label: "Skip integrations",
            onClick: () => dismissFtueStep(FTUE_KEYS.integrationsIntro),
          }}
        />
      ) : null}

      <div className="app-toolbelt-shell">
        <ToolToolbar tools={tools} activeTool={activeTool} onToolChange={handleToolChange} />
      </div>

      {showToolFtue ? (
        <QAtGuideCard
          className="qat-ftue-card qat-tool-ftue-card"
          eyebrow={`${tool.label} tutorial`}
          title={toolFtueCopy[activeTool].title}
          body={toolFtueCopy[activeTool].body}
          compact
          primaryAction={{
            label: "Got it",
            onClick: () => dismissFtueStep(ftueToolKey),
          }}
          secondaryAction={{
            label: "Hide this tip",
            onClick: () => dismissFtueStep(ftueToolKey),
          }}
        />
      ) : null}

      {activeTool === "feature" ? (
        <section className="feature-workspace-shell" aria-label="Feature Builder workspace">
          <FeatureBuilderTool activeProject={activeProject} onUseForTool={handleUseFeatureBriefForTool} />
        </section>
      ) : (
      <section className="workspace app-workspace-grid">
        <aside className="panel input-panel qa-cockpit-panel">
          <div className="workspace-panel-header compact-input-header">
            <div>
              <h2>{tool.label}</h2>
              <span>{tool.description}</span>
            </div>
          </div>

          <div className="jira-source-shell">
            <StackedProjectJiraControls onJiraImport={handleJiraTicketImport} />
          </div>

          <label className="source-textarea-shell">
            <span>Manual source / notes</span>
            <textarea
              data-testid="qa-source-input"
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              setImportedJiraTicket(null);
            }}
              placeholder={tool.placeholder}
            />
          </label>

          {activeTool === "tests" && currentTestOutput ? (
            <section className={`follow-up-answer-box test-follow-up-box ${testFollowUpQuestions.length > 0 ? "has-active-followups" : ""}`}>
              <div className="follow-up-answer-header">
                <p>Test case follow-up questions</p>
                <span>{testFollowUpLoopClosed ? "Closed" : `${testFollowUpQuestions.length} active`}</span>
              </div>

              {testFollowUpLoopClosed ? (
                <p className="follow-up-loop-closed">
                  Test follow-up loop marked complete. Regenerate will avoid asking more questions unless there is a critical blocker.
                </p>
              ) : null}

              {testFollowUpQuestions.length > 0 ? (
                <div className="follow-up-question-list">
                  {testFollowUpQuestions.map((question, index) => {
                    const resolution = testQuestionResolutions[question] ?? "Still open";

                    return (
                      <div className="follow-up-question-card" key={`${question}-${index}`}>
                        <span>Question {index + 1}</span>
                        <strong>{question}</strong>
                        <textarea
                          value={testQuestionAnswers[question] ?? ""}
                          onChange={(event) => updateTestQuestionAnswer(question, event.target.value)}
                          placeholder="Answer this test case question..."
                        />

                        <div className="follow-up-resolution-block">
                          <p>Did this answer resolve the follow-up?</p>
                          <div className="follow-up-resolution-actions">
                            {(["Resolved", "Still open", "No more questions"] as FollowUpResolution[]).map(
                              (option) => (
                                <button
                                  className={resolution === option ? "active" : ""}
                                  key={option}
                                  type="button"
                                  onClick={() => updateTestQuestionResolution(question, option)}
                                >
                                  {option}
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="follow-up-answer-empty">
                  No active test case follow-up questions. You can add extra context below and regenerate if needed.
                </p>
              )}

              <div className="bug-refine-section">
                <h4>Additional test context</h4>
                <p className="bug-refine-help-text">
                  Add product answers, coverage constraints, platform scope, roles, data setup, or edge cases before regenerating.
                </p>
                <textarea
                  className="follow-up-answer-textarea compact"
                  value={testAdditionalContext}
                  onChange={(event) => setTestAdditionalContext(event.target.value)}
                  placeholder="Example: Import supports PDF and pasted Jira URLs only. Admin users are out of scope for MVP..."
                />
              </div>
            </section>
          ) : null}
              <AdminDebugMenu
                userEmail={session?.user?.email}
                activeTool={activeTool}
                activeProjectId={activeProject?.id}
                activeProjectName={activeProject?.name}
              />
          {activeTool === "improve" && currentTestImprovement ? (
            <section className={`follow-up-answer-box test-follow-up-box ${improveFollowUpQuestions.length > 0 ? "has-active-followups" : ""}`}>
              <div className="follow-up-answer-header">
                <p>Test Improver follow-up questions</p>
                <span>{improveFollowUpLoopClosed ? "Closed" : `${improveFollowUpQuestions.length} active`}</span>
              </div>

              {improveFollowUpLoopClosed ? (
                <p className="follow-up-loop-closed">
                  Test Improver follow-up loop marked complete. Re-improve will avoid asking more questions unless there is a critical blocker.
                </p>
              ) : null}

              {improveFollowUpQuestions.length > 0 ? (
                <div className="follow-up-question-card-list">
                  {improveFollowUpQuestions.map((question, index) => {
                    const resolution = improveQuestionResolutions[question] ?? "Still open";

                    return (
                      <div className="follow-up-question-card" key={`${question}-${index}`}>
                        <span>Question {index + 1}</span>
                        <strong>{question}</strong>
                        <textarea
                          value={improveQuestionAnswers[question] ?? ""}
                          onChange={(event) => updateImproveQuestionAnswer(question, event.target.value)}
                          placeholder="Answer this Test Improver question..."
                        />

                        <div className="follow-up-resolution-block">
                          <p>Did this answer resolve the follow-up?</p>
                          <div className="follow-up-resolution-actions">
                            {(["Resolved", "Still open", "No more questions"] as FollowUpResolution[]).map(
                              (option) => (
                                <button
                                  className={`${resolution === option ? "active" : ""} resolution-${option.toLowerCase().replace(/\s+/g, "-")}`}
                                  key={option}
                                  type="button"
                                  onClick={() => updateImproveQuestionResolution(question, option)}
                                >
                                  {option}
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="follow-up-answer-empty">
                  No active Test Improver follow-up questions. You can add extra context below and re-improve if needed.
                </p>
              )}

              <div className="bug-refine-section">
                <h4>Additional Test Improver context</h4>
                <p className="bug-refine-help-text">
                  Add product answers, scope notes, validation rules, edge cases, roles, data setup, or expected behavior before re-improving.
                </p>
                <textarea
                  className="follow-up-answer-textarea compact"
                  value={improveAdditionalContext}
                  onChange={(event) => setImproveAdditionalContext(event.target.value)}
                  placeholder="Example: Valid stage data requires a unique stage ID, enemy group reference, reward table, and unlock condition..."
                />
              </div>
            </section>
          ) : null}

          {activeTool === "risk" && currentRiskReview ? (
            <section className={`follow-up-answer-box risk-follow-up-box ${riskFollowUpQuestions.length > 0 ? "has-active-followups" : ""}`}>
              <div className="follow-up-answer-header">
                <p>Risk follow-up questions</p>
                <span>{riskFollowUpLoopClosed ? "Closed" : `${riskFollowUpQuestions.length} active`}</span>
              </div>

              {riskFollowUpLoopClosed ? (
                <p className="follow-up-loop-closed">
                  Risk follow-up loop marked complete. Re-assess will avoid asking more questions unless there is a critical blocker.
                </p>
              ) : null}

              {riskFollowUpQuestions.length > 0 ? (
                <div className="follow-up-question-card-list">
                  {riskFollowUpQuestions.map((question, index) => {
                    const resolution = riskQuestionResolutions[question] ?? "Still open";

                    return (
                      <div className="follow-up-question-card" key={`${question}-${index}`}>
                        <span>Question {index + 1}</span>
                        <strong>{question}</strong>
                        <textarea
                          value={riskQuestionAnswers[question] ?? ""}
                          onChange={(event) => updateRiskQuestionAnswer(question, event.target.value)}
                          placeholder="Answer this risk question..."
                        />

                        <div className="follow-up-resolution-block">
                          <p>Did this answer resolve the follow-up?</p>
                          <div className="follow-up-resolution-actions">
                            {(["Resolved", "Still open", "No more questions"] as FollowUpResolution[]).map(
                              (option) => (
                                <button
                                  className={resolution === option ? "active" : ""}
                                  key={option}
                                  type="button"
                                  onClick={() => updateRiskQuestionResolution(question, option)}
                                >
                                  {option}
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="follow-up-answer-empty">
                  No active risk follow-ups. You can still add reassessment context below and run Re-assess Risk.
                </p>
              )}

              <div className="bug-refine-section risk-context-section">
                <h4>Additional risk context</h4>
                <p className="bug-refine-help-text">
                  Add product answers, assumptions, constraints, or decisions before re-assessing the risk review.
                </p>
                <textarea
                  className="follow-up-answer-textarea compact-risk-context"
                  value={riskAdditionalContext}
                  onChange={(event) => setRiskAdditionalContext(event.target.value)}
                  placeholder="Example: Import only supports Jira story and bug issue types for MVP..."
                />
              </div>
            </section>
          ) : null}

          {activeTool === "bug" ? (
            <section className="follow-up-answer-box">
              <div className="follow-up-answer-header">
                <p>Refine bug context</p>
                <span>{currentBugReport ? `${bugFollowUpQuestions.length} questions` : "Optional before first run"}</span>
              </div>

              {followUpLoopClosed ? (
                <p className="follow-up-loop-closed">
                  Follow-up loop marked complete. Re-improve will avoid asking more questions unless there is a critical blocker.
                </p>
              ) : null}

              <div className="bug-refine-section">
                <h4>Environment</h4>
                <div className="bug-context-grid">
                  <label>
                    Device type
                    <input
                      value={bugDeviceType}
                      onChange={(event) => setBugDeviceType(event.target.value)}
                      placeholder="Pixel 7, iPhone 15, PC..."
                    />
                  </label>

                  <label>
                    Operating system
                    <input
                      value={bugOperatingSystem}
                      onChange={(event) => setBugOperatingSystem(event.target.value)}
                      placeholder="Android 14, iOS 17..."
                    />
                  </label>

                  <label>
                    App/game version
                    <input
                      value={bugAppVersion}
                      onChange={(event) => setBugAppVersion(event.target.value)}
                      placeholder="0.1.3, 1.0.0-beta..."
                    />
                  </label>

                  <label>
                    Build number
                    <input
                      value={bugBuildNumber}
                      onChange={(event) => setBugBuildNumber(event.target.value)}
                      placeholder="1234, qa-2026.05.02..."
                    />
                  </label>

                  <label>
                    Browser/platform
                    <input
                      value={bugPlatform}
                      onChange={(event) => setBugPlatform(event.target.value)}
                      placeholder="Chrome, Android app..."
                    />
                  </label>

                  <label>
                    Account/user role
                    <input
                      value={bugAccountRole}
                      onChange={(event) => setBugAccountRole(event.target.value)}
                      placeholder="Player, teacher, admin..."
                    />
                  </label>

                  <label>
                    Repro rate
                    <select
                      value={bugReproRate}
                      onChange={(event) => setBugReproRate(event.target.value)}
                    >
                      <option value="Unknown">Unknown</option>
                      <option value="Always">Always</option>
                      <option value="Intermittent">Intermittent</option>
                      <option value="Once">Once</option>
                      <option value="Unable to reproduce">Unable to reproduce</option>
                    </select>
                  </label>

                  <label>
                    Repro notes
                    <input
                      value={bugReproNotes}
                      onChange={(event) => setBugReproNotes(event.target.value)}
                      placeholder="Example: 5/5 attempts on Xbox build 1..."
                    />
                  </label>
                </div>
              </div>

              <BugEvidencePanel value={bugEvidence} onChange={setBugEvidence} />

              {currentBugReport && (bugFollowUpQuestions.length > 0 || bugAnsweredFollowUps.length > 0) ? (
                <div className={`bug-refine-section bug-followup-section ${bugFollowUpQuestions.length > 0 ? "has-active-followups" : ""}`}>
                  <h4>Answer follow-up questions</h4>
                  {bugFollowUpQuestions.length > 0 ? (
                    <div className="follow-up-question-card-list">
                      {bugFollowUpQuestions.map((question, index) => {
                        const resolution = bugQuestionResolutions[question] ?? "Still open";

                        return (
                          <div className="follow-up-question-card" key={`${question}-${index}`}>
                            <span>Question {index + 1}</span>
                            <strong>{question}</strong>
                            <textarea
                              value={bugQuestionAnswers[question] ?? ""}
                              onChange={(event) => updateBugQuestionAnswer(question, event.target.value)}
                              placeholder="Answer this question..."
                            />

                            <div className="follow-up-resolution-block">
                              <p>Did this answer resolve the follow-up?</p>
                              <div className="follow-up-resolution-actions">
                                {(["Resolved", "Still open", "No more questions"] as FollowUpResolution[]).map(
                                  (option) => (
                                    <button
                                      className={`${resolution === option ? "active" : ""} resolution-${option.toLowerCase().replace(/\s+/g, "-")}`}
                                      key={option}
                                      type="button"
                                      onClick={() => updateBugQuestionResolution(question, option)}
                                    >
                                      {option}
                                    </button>
                                  )
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="follow-up-answer-empty">
                      No active follow-up questions. Resolved answers are preserved in Follow-up History.
                    </p>
                  )}
                </div>
              ) : null}

            </section>
          ) : null}

          <button className="run-button" data-testid={RUN_BUTTON_TEST_IDS[activeTool]} type="button" disabled={isRunning} onClick={() => runTool()}>
            {isRunning
              ? "Running..."
              : activeTool === "bug" && currentBugReport
                ? `Re-improve Bug Report - ${TOOL_COST_LABELS.bug}`
                : activeTool === "risk" && currentRiskReview
                  ? `Re-assess Risk - ${TOOL_COST_LABELS.risk}`
                  : activeTool === "tests" && currentTestOutput
                    ? "Refresh Scores/Export - free"
                    : activeTool === "improve" && currentTestImprovement
                      ? `Re-improve Test Case - ${TOOL_COST_LABELS.improve}`
                      : `${tool.button} - ${TOOL_COST_LABELS[activeTool]}`}
          </button>
          {activeTool === "tests" && currentTestOutput ? (
            <p className="credit-action-cost-line">
              Refreshing current scores/export is <strong>free</strong>. Generate fresh test cases to spend credits.
            </p>
          ) : (
            <p className="credit-action-cost-line">
              Costs <strong>{TOOL_COST_LABELS[activeTool]}</strong>. Credits are only charged after a successful run.
            </p>
          )}

          {testGenerationNotice ? (
            <p className="generation-consistency-note">{testGenerationNotice}</p>
          ) : null}

        </aside>

        <section className="panel output-panel qa-output-cockpit" data-testid="qa-output">
          <div className="workspace-panel-header output-panel-header">
            <div>
              <p className="app-section-kicker">Generated artifact</p>
              <h2>{output ? "Review QA output" : "Output will appear here"}</h2>
              <span>{output ? "Scan, refine, save, sync, or export the generated QA artifact." : "Choose a workflow, bring context, then run QAtalyst."}</span>
            </div>
            <strong>{output ? "Ready" : "Waiting"}</strong>
          </div>

          {output ? (
            <>
              {projectContextPayload.projectContextUsed ? (
                <p className="qa-context-used-line">
                  Used project context: {projectContextPayload.projectContextSummary}
                </p>
              ) : null}
              {automationCredentialPayload.credentialsUsed ? (
                <span className="qa-context-used-pill">
                  Automation credentials: {automationCredentialPayload.profiles.length} profiles
                </span>
              ) : null}
              <GenericOutput
                output={output}
                evidenceFiles={[]}
                evidenceLink=""
                answeredFollowUps={bugAnsweredFollowUps}
                riskAnsweredFollowUps={riskAnsweredFollowUps}
                testAnsweredFollowUps={testAnsweredFollowUps}
                onSaveBugMarkdown={handleSaveBugMarkdown}
                bugEvidence={bugEvidence}
                reportType={activeReportTool}
                sourceInput={input}
                testCaseGenerationKey={testCaseGenerationKey}
                automationCredentialProfiles={automationCredentialPayload.profiles}
                automationCredentialDefaultProfileKey={automationCredentialPayload.defaultProfileKey}
                automationCredentialEnvExample={automationCredentialPayload.envExample}
                automationProjectConfig={automationProjectConfig}
                saveReportStatus={saveReportStatus}
                saveReportMessage={saveReportMessage}
                savedReportId={savedReportId}
                activeProject={activeProject}
                onSaveReport={handleSaveReport}
              />
            </>
          ) : (
            <div className="output-empty"><strong>No generated artifact yet.</strong><span>Choose a workflow, paste or fetch one source, select Project Sources when useful, then run QAtalyst.</span></div>
          )}
        </section>
      </section>
      )}
      <TestCaseCostConfirmModal
        open={testCaseCostConfirmation.open}
        testCaseCount={testCaseCostConfirmation.testCaseCount}
        cost={testCaseCostConfirmation.cost}
        loading={isRunning}
        onCancel={() => setTestCaseCostConfirmation({ open: false, testCaseCount: 0, cost: 0 })}
        onConfirm={() => {
          const confirmation = testCaseCostConfirmation;
          setTestCaseCostConfirmation({ open: false, testCaseCount: 0, cost: 0 });
          void runTool({
            requestedCount: confirmation.testCaseCount,
            confirmedCost: confirmation.cost,
          });
        }}
      />
    </main>
  );
}
