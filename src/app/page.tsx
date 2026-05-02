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

function badgeClass(value: unknown, kind: "type" | "priority") {
  const normalized = safeText(value).toLowerCase();

  if (kind === "priority") {
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

function TestCaseCards({ testCases }: { testCases: TestCase[] }) {
  const [copied, setCopied] = useState<string | null>(null);

  const allText = useMemo(
    () => testCases.map((testCase, index) => formatTestCase(testCase, index)).join("\n\n---\n\n"),
    [testCases]
  );

  async function handleCopy(id: string, text: string) {
    await copyText(text);
    setCopied(id);
    window.setTimeout(() => setCopied(null), 1200);
  }

  return (
    <div className="report-wrap">
      <div className="report-header">
        <div>
          <p className="report-kicker">Generated QA Report</p>
          <h2>{testCases.length} Test Cases</h2>
        </div>
        <button className="copy-all-button" type="button" onClick={() => handleCopy("all", allText)}>
          {copied === "all" ? "Copied" : "Copy All"}
        </button>
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

function GenericOutput({ output }: { output: string }) {
  const parsed = parseOutput(output);

  if (isPlainObject(parsed) && Array.isArray(parsed.testCases)) {
    return <TestCaseCards testCases={parsed.testCases as TestCase[]} />;
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
          {output ? <GenericOutput output={output} /> : <div className="output-empty">Run a tool to see QA output here.</div>}
        </section>
      </section>
    </main>
  );
}
