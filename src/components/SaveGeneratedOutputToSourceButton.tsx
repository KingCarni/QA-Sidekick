"use client";

import { useMemo, useState } from "react";
import type { SafeQAProject } from "@/components/ProjectSettingsPanel";

type ToolId = "tests" | "risk" | "bug" | "improve";
type SaveMode = "library" | "source" | "both";
type SaveState = "idle" | "saving" | "saved" | "error";

type Props = {
  activeProject: SafeQAProject | null;
  reportType: ToolId;
  markdown: string;
  structuredData?: unknown;
  onSaved?: () => void;
};

type ApiResponse = {
  ok?: boolean;
  error?: string;
  errors?: string[];
  source?: { id: string; title: string };
  testCase?: { id: string; title: string };
};

type TestCaseLike = {
  title?: unknown;
  type?: unknown;
  testType?: unknown;
  priority?: unknown;
  preconditions?: unknown;
  steps?: unknown;
  expectedResult?: unknown;
  expected?: unknown;
  automationReadiness?: unknown;
  tags?: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join("\n");
  if (isObject(value)) return Object.entries(value).map(([key, item]) => `${key}: ${asText(item)}`).join("\n");
  return String(value);
}

function cleanTitle(value: string, fallback: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 100) || fallback;
}

function sourceBody(value: string) {
  return value.trim().replace(/\r\n/g, "\n").slice(0, 24000);
}

function testCasesFromStructuredData(structuredData: unknown): TestCaseLike[] {
  if (!isObject(structuredData)) return [];
  if (Array.isArray(structuredData.testCases)) return structuredData.testCases as TestCaseLike[];
  if (isObject(structuredData.result) && Array.isArray(structuredData.result.testCases)) return structuredData.result.testCases as TestCaseLike[];
  return [];
}

function stepsFrom(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(asText).map((step) => step.trim()).filter(Boolean);
  return asText(value).split(/\n+/).map((step) => step.replace(/^\d+[.)]\s*/, "").trim()).filter(Boolean);
}

function tagsFrom(value: unknown): string[] {
  const raw = Array.isArray(value) ? value.map(asText) : asText(value).split(",");
  return raw.map((tag) => tag.trim()).filter(Boolean).slice(0, 16);
}

function testTypeFrom(value: unknown) {
  const text = asText(value).trim().toLowerCase().replace(/\s+/g, "-") || "functional";
  return ["smoke", "functional", "regression", "edge-case", "accessibility", "security", "performance", "integration", "other"].includes(text) ? text : "functional";
}

function priorityFrom(value: unknown) {
  const text = asText(value).trim().toLowerCase() || "medium";
  return ["low", "medium", "high", "critical"].includes(text) ? text : "medium";
}

function defaultSourceType(reportType: ToolId) {
  if (reportType === "tests") return "test-cases";
  if (reportType === "risk") return "risk-review";
  if (reportType === "improve") return "test-improvement";
  return "qa-notes";
}

function defaultTitle(reportType: ToolId, projectName: string) {
  if (reportType === "tests") return `${projectName} Generated Test Cases`;
  if (reportType === "risk") return `${projectName} Risk Review`;
  if (reportType === "improve") return `${projectName} Improved Test Case`;
  return `${projectName} QA Output`;
}

export default function SaveGeneratedOutputToSourceButton({ activeProject, reportType, markdown, structuredData, onSaved }: Props) {
  const [saveMode, setSaveMode] = useState<SaveMode>("library");
  const [state, setState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("");

  const testCases = useMemo(() => testCasesFromStructuredData(structuredData), [structuredData]);
  const canSaveCases = reportType === "tests" && testCases.length > 0;
  const canSave = Boolean(activeProject?.id) && Boolean(markdown.trim()) && reportType !== "bug" && state !== "saving";
  const effectiveMode: SaveMode = canSaveCases ? saveMode : "source";

  async function saveSource() {
    if (!activeProject?.id) throw new Error("Select a project before saving.");
    const projectName = activeProject.name || "Project";
    const response = await fetch(`/api/projects/${encodeURIComponent(activeProject.id)}/sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: cleanTitle(defaultTitle(reportType, projectName), "Generated QA Output"),
        sourceType: defaultSourceType(reportType),
        tags: ["generated-output", reportType, "qatalyst"],
        body: sourceBody(markdown),
        isEnabled: true,
      }),
    });
    const payload = (await response.json().catch(() => null)) as ApiResponse | null;
    if (!response.ok || payload?.ok === false || !payload?.source) throw new Error(payload?.error || "Could not save Source Vault item.");
    return payload.source;
  }

  async function saveTestCase(testCase: TestCaseLike, index: number) {
    if (!activeProject?.id) throw new Error("Select a project before saving.");
    const response = await fetch(`/api/projects/${encodeURIComponent(activeProject.id)}/test-cases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: cleanTitle(asText(testCase.title), `Test Case ${index + 1}`),
        testType: testTypeFrom(testCase.testType ?? testCase.type),
        priority: priorityFrom(testCase.priority),
        status: "draft",
        sourceType: "generated-tests",
        preconditions: asText(testCase.preconditions),
        steps: stepsFrom(testCase.steps),
        expectedResult: asText(testCase.expectedResult) || asText(testCase.expected),
        automationReadiness: asText(testCase.automationReadiness),
        tags: ["generated-output", "test-case", ...tagsFrom(testCase.tags)],
        structuredData: testCase,
        syncStatus: "not_synced",
      }),
    });
    const payload = (await response.json().catch(() => null)) as ApiResponse | null;
    if (!response.ok || payload?.ok === false || !payload?.testCase) throw new Error(payload?.error || payload?.errors?.[0] || "Could not save test case.");
    return payload.testCase;
  }

  async function handleSave() {
    if (!activeProject) {
      setState("error");
      setMessage("Select a project before saving.");
      return;
    }
    if (reportType === "bug") {
      setState("error");
      setMessage("Bug output uses Bug Collection.");
      return;
    }
    setState("saving");
    setMessage("");
    try {
      const savedCases = [] as Array<{ id: string; title: string }>;
      const savedSources = [] as Array<{ id: string; title: string }>;
      if (effectiveMode === "source" || effectiveMode === "both") savedSources.push(await saveSource());
      if ((effectiveMode === "library" || effectiveMode === "both") && canSaveCases) {
        for (let index = 0; index < testCases.length; index += 1) savedCases.push(await saveTestCase(testCases[index], index));
      }
      setState("saved");
      if (savedCases.length && savedSources.length) setMessage(`Saved ${savedCases.length} test case${savedCases.length === 1 ? "" : "s"} and ${savedSources.length} source bundle.`);
      else if (savedCases.length) setMessage(`Saved ${savedCases.length} test case${savedCases.length === 1 ? "" : "s"} to Test Case Library.`);
      else setMessage(`Saved ${savedSources.length} source${savedSources.length === 1 ? "" : "s"} to Project Source Vault.`);
      onSaved?.();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not save generated output.");
    }
  }

  if (!markdown.trim()) return null;

  return (
    <section className="save-generated-source-control" data-testid="save-generated-source-control">
      <style>{`
        .save-report-row {
          display: none !important;
        }
        .save-generated-source-control option {
          color: #111827;
          background: #ffffff;
        }
      `}</style>

      <div>
        <p className="report-kicker">{reportType === "tests" ? "Test Case Library" : "Project Source Vault"}</p>
        <strong>{reportType === "tests" ? "Save generated coverage as reusable test cases" : "Save generated output as reusable source memory"}</strong>
        <span>{reportType === "tests" ? "Generated test cases belong in the Test Case Library. Save a Source Vault bundle only when you want the full output reused as context." : "Saved sources are enabled by default and can be selected from the Sources dropdown on future runs."}</span>
      </div>

      {canSaveCases ? (
        <label className="save-generated-source-mode">
          Save mode
          <select value={saveMode} onChange={(event) => setSaveMode(event.target.value as SaveMode)}>
            <option value="library">Save test cases to library</option>
            <option value="source">Save output as Source Vault memory</option>
            <option value="both">Save both</option>
          </select>
        </label>
      ) : null}

      <div className="save-generated-source-actions">
        <button className="save-generated-source-button" disabled={!canSave} onClick={handleSave} type="button">
          {state === "saving" ? "Saving..." : reportType === "tests" && canSaveCases ? "Save Generated Tests" : "Save to Project Source Vault"}
        </button>
      </div>

      {message ? <p className={state === "error" ? "save-generated-source-message save-generated-source-message-error" : "save-generated-source-message"}>{message}</p> : null}
      {!activeProject ? <p className="save-generated-source-message save-generated-source-message-error">Select or create a project before saving generated output.</p> : null}
    </section>
  );
}
