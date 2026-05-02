"use client";

import { useMemo, useState } from "react";

type ToolId = "tests" | "risk" | "bug" | "improve";

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
  qaNotes?: unknown;
};

const tools: Array<{ id: ToolId; label: string; button: string; placeholder: string }> = [
  {
    id: "tests",
    label: "Test Cases",
    button: "Run Test Cases",
    placeholder: "Paste a Jira ticket, user story, or acceptance criteria here...",
  },
  {
    id: "risk",
    label: "Risk Review",
    button: "Analyze Risk",
    placeholder: "Paste a ticket or requirements doc to expose risks, gaps, and bottlenecks...",
  },
  {
    id: "bug",
    label: "Bug Writer",
    button: "Improve Bug Report",
    placeholder: "Paste rough bug notes, repro details, or a messy bug report...",
  },
  {
    id: "improve",
    label: "Test Improver",
    button: "Improve Test Case",
    placeholder: "Paste an existing test case or checklist you want improved...",
  },
];

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

function formatRiskReview(review: RiskReview): string {
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
  ].join("\n");
}


function formatBugReport(report: BugReport): string {
  const steps = normalizeSteps(report.stepsToReproduce);
  const missingInfo = meaningfulLines(report.missingInfo);
  const qaNotes = meaningfulLines(report.qaNotes);

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
    "## QA Notes",
    ...(qaNotes.length ? qaNotes.map((item) => `- ${item}`) : ["- No QA notes returned."]),
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

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
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

function TestCaseCards({ testCases }: { testCases: TestCase[] }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [exported, setExported] = useState(false);

  const allText = useMemo(
    () => testCases.map((testCase, index) => formatTestCase(testCase, index)).join("\n\n---\n\n"),
    [testCases]
  );

  async function handleCopy(id: string, text: string) {
    await copyText(text);
    setCopied(id);
    window.setTimeout(() => setCopied(null), 1200);
  }

  function handleExportCsv() {
    const csv = testCasesToCsv(testCases);
    const filename = `qa-sidekick-test-cases-${buildTimestampForFilename()}.csv`;

    downloadTextFile(filename, csv, "text/csv");
    setExported(true);
    window.setTimeout(() => setExported(false), 1400);
  }

  return (
    <div className="report-wrap">
      <div className="report-header">
        <div>
          <p className="report-kicker">Generated QA Report</p>
          <h2>{testCases.length} Test Cases</h2>
        </div>
        <div className="report-actions">
          <button className="copy-all-button secondary-action-button" type="button" onClick={handleExportCsv}>
            {exported ? "Exported" : "Export CSV"}
          </button>
          <button className="copy-all-button" type="button" onClick={() => handleCopy("all", allText)}>
            {copied === "all" ? "Copied" : "Copy All"}
          </button>
        </div>
      </div>

      <div className="test-card-list">
        {testCases.map((testCase, index) => {
          const copyId = `case-${index}`;
          const steps = normalizeSteps(testCase.steps);

          return (
            <article className="test-case-card" key={`${safeText(testCase.title)}-${index}`}>
              <div className="test-case-topline">
                <div className="test-case-label-row">
                  <span className="test-case-label">Test Case {index + 1}</span>
                  <button
                    className="copy-case-button"
                    type="button"
                    onClick={() => handleCopy(copyId, formatTestCase(testCase, index))}
                  >
                    {copied === copyId ? "Copied" : "Copy"}
                  </button>
                </div>
                <h3>{safeText(testCase.title)}</h3>
                <div className="badge-row">
                  <span className={badgeClass(testCase.type, "type")}>{safeText(testCase.type)}</span>
                  <span className={badgeClass(testCase.priority, "priority")}>{safeText(testCase.priority)}</span>
                </div>
              </div>

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
            </article>
          );
        })}
      </div>
    </div>
  );
}

function RiskReviewCards({ riskReview }: { riskReview: RiskReview }) {
  const [copied, setCopied] = useState(false);
  const [exported, setExported] = useState(false);
  const keyRisks = arrayFromUnknown<RiskItem>(riskReview.keyRisks);
  const bottlenecks = arrayFromUnknown<BottleneckItem>(riskReview.bottlenecks);

  async function handleCopy() {
    await copyText(formatRiskReview(riskReview));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  function handleExportCsv() {
    const csv = riskReviewToCsv(riskReview);
    const filename = `qa-sidekick-risk-review-${buildTimestampForFilename()}.csv`;

    downloadTextFile(filename, csv, "text/csv");
    setExported(true);
    window.setTimeout(() => setExported(false), 1400);
  }

  return (
    <div className="report-wrap risk-report-wrap">
      <div className="report-header">
        <div>
          <p className="report-kicker">Risk Review Report</p>
          <h2>Pre-production QA Risk Review</h2>
        </div>
        <div className="report-actions">
          <button className="copy-all-button secondary-action-button" type="button" onClick={handleExportCsv}>
            {exported ? "Exported" : "Export CSV"}
          </button>
          <button className="copy-all-button" type="button" onClick={handleCopy}>
            {copied ? "Copied" : "Copy Risk Report"}
          </button>
        </div>
      </div>

      <div className="risk-report-list">
        <section className="risk-summary-card">
          <div className="badge-row">
            <span className={badgeClass(riskReview.overallRisk, "risk")}>
              Overall Risk: {safeText(riskReview.overallRisk)}
            </span>
          </div>
          <h3>Summary</h3>
          <p className="field-text">{safeText(riskReview.summary)}</p>
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
                    <span className={badgeClass(risk.severity, "risk")}>{safeText(risk.severity)}</span>
                    <span className="badge badge-type-default">{safeText(risk.area)}</span>
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
                      <span className={badgeClass(bottleneck.impact, "risk")}>{safeText(bottleneck.impact)}</span>
                      <span className="badge badge-type-default">{safeText(bottleneck.owner)}</span>
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

        <RiskTextList title="Missing Acceptance Criteria" items={riskReview.missingAcceptanceCriteria} />
        <RiskTextList title="QA Follow-up Questions" items={riskReview.qaFollowUpQuestions} />
        <RiskTextList title="Suggested Test Focus" items={riskReview.suggestedTestFocus} />
      </div>
    </div>
  );
}


function BugReportCards({ bugReport }: { bugReport: BugReport }) {
  const [copied, setCopied] = useState(false);
  const [exported, setExported] = useState(false);
  const steps = normalizeSteps(bugReport.stepsToReproduce);

  async function handleCopy() {
    await copyText(formatBugReport(bugReport));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  function handleExportMarkdown() {
    const markdown = formatBugReport(bugReport);
    const filename = `qa-sidekick-bug-report-${buildTimestampForFilename()}.md`;

    downloadTextFile(filename, markdown, "text/markdown");
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
        <div className="report-actions">
          <button className="copy-all-button secondary-action-button" type="button" onClick={handleExportMarkdown}>
            {exported ? "Exported" : "Export Markdown"}
          </button>
          <button className="copy-all-button" type="button" onClick={handleCopy}>
            {copied ? "Copied" : "Copy Bug Report"}
          </button>
        </div>
      </div>

      <div className="bug-report-list">
        <section className="bug-summary-card">
          <div className="badge-row">
            <span className={badgeClass(bugReport.severitySuggestion, "risk")}>
              Severity: {safeText(bugReport.severitySuggestion)}
            </span>
            <span className={badgeClass(bugReport.prioritySuggestion, "priority")}>
              Priority: {safeText(bugReport.prioritySuggestion)}
            </span>
          </div>
          <h3>{safeText(bugReport.title)}</h3>
          <p className="field-text">{safeText(bugReport.summary)}</p>
        </section>

        <section className="bug-section-card">
          <h3>Environment</h3>
          <p className="field-text">{safeText(bugReport.environment)}</p>
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
            <p className="field-text">{safeText(bugReport.expectedResult)}</p>
          </article>

          <article className="bug-section-card bug-actual-card">
            <h3>Actual Result</h3>
            <p className="field-text">{safeText(bugReport.actualResult)}</p>
          </article>
        </section>

        <section className="bug-section-card">
          <h3>Impact</h3>
          <p className="field-text">{safeText(bugReport.impact)}</p>
        </section>

        <section className="bug-section-card">
          <h3>Missing Info</h3>
          <ValueBlock value={bugReport.missingInfo} />
        </section>

        <section className="bug-section-card">
          <h3>QA Notes</h3>
          <ValueBlock value={bugReport.qaNotes} />
        </section>
      </div>
    </div>
  );
}

function GenericOutput({ output }: { output: string }) {
  const parsed = parseOutput(output);

  if (isPlainObject(parsed) && Array.isArray(parsed.testCases)) {
    return <TestCaseCards testCases={parsed.testCases as TestCase[]} />;
  }

  if (isPlainObject(parsed) && isPlainObject(parsed.riskReview)) {
    return <RiskReviewCards riskReview={parsed.riskReview as RiskReview} />;
  }

  if (isPlainObject(parsed) && isPlainObject(parsed.bugReport)) {
    return <BugReportCards bugReport={parsed.bugReport as BugReport} />;
  }

  const displayText = typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2);

  return <pre className="generic-output">{displayText}</pre>;
}

export default function Home() {
  const [activeTool, setActiveTool] = useState<ToolId>("tests");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  const tool = tools.find((item) => item.id === activeTool) ?? tools[0];

  async function runTool() {
    if (!input.trim()) {
      setOutput("Paste a ticket, bug report, or test case first.");
      return;
    }

    setIsRunning(true);
    setOutput("");

    const route =
      activeTool === "tests"
        ? "/api/generate-tests"
        : activeTool === "risk"
          ? "/api/analyze-risk"
          : activeTool === "bug"
            ? "/api/improve-bug"
            : "/api/improve-test";

    try {
      const response = await fetch(route, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input }),
      });

      const data = await response.json();

      if (!response.ok) {
        setOutput(data?.error ?? "Something went wrong.");
        return;
      }

      const result =
        typeof data?.result === "string"
          ? data.result
          : JSON.stringify(data?.result ?? data, null, 2);

      setOutput(result);
    } catch (error) {
      setOutput(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <main>
      <section className="hero">
        <p className="brand">QA SIDEKICK</p>
        <h1>Review tickets like a senior QA before anything breaks.</h1>
        <p>
          Generate test cases, expose risks, improve bug reports, and turn vague tickets into
          actionable QA plans.
        </p>
      </section>

      <section className="workspace">
        <aside className="panel input-panel">
          <div className="tabs">
            {tools.map((item) => (
              <button
                key={item.id}
                className={`tab ${activeTool === item.id ? "active" : ""}`}
                type="button"
                onClick={() => {
                  setActiveTool(item.id);
                  setOutput("");
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={tool.placeholder}
          />

          <button className="run-button" type="button" disabled={isRunning} onClick={runTool}>
            {isRunning ? "Running..." : tool.button}
          </button>
        </aside>

        <section className="panel output-panel">
          {output ? (
            <GenericOutput output={output} />
          ) : (
            <div className="output-empty">Run a tool to see QA output here.</div>
          )}
        </section>
      </section>
    </main>
  );
}
