"use client";

import { useMemo, useState } from "react";
import type { SafeQAProject } from "@/components/ProjectSettingsPanel";

type ToolId = "tests" | "risk" | "bug" | "improve";

type SaveGeneratedOutputToSourceButtonProps = {
  activeProject: SafeQAProject | null;
  reportType: ToolId;
  markdown: string;
  structuredData?: unknown;
  onSaved?: () => void;
};

type SaveMode = "bundle" | "individual" | "both";
type SaveState = "idle" | "saving" | "saved" | "error";

type SourceApiResponse = {
  ok?: boolean;
  error?: string;
  source?: {
    id: string;
    title: string;
  };
};

type TestCaseLike = {
  title?: unknown;
  type?: unknown;
  priority?: unknown;
  preconditions?: unknown;
  steps?: unknown;
  expectedResult?: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join("\n");
  if (isObject(value)) {
    return Object.entries(value)
      .map(([key, item]) => `${key}: ${asText(item)}`)
      .join("\n");
  }
  return String(value);
}

function normalizeTitle(value: string, fallback: string) {
  const clean = value.trim().replace(/\s+/g, " ").slice(0, 100);
  return clean || fallback;
}

function normalizeSourceBody(value: string) {
  return value.trim().replace(/\r\n/g, "\n").slice(0, 24000);
}

function testCasesFromStructuredData(structuredData: unknown): TestCaseLike[] {
  if (!isObject(structuredData)) return [];

  const direct = structuredData.testCases;
  if (Array.isArray(direct)) return direct as TestCaseLike[];

  const result = structuredData.result;
  if (isObject(result) && Array.isArray(result.testCases)) {
    return result.testCases as TestCaseLike[];
  }

  return [];
}

function formatTestCaseSource(testCase: TestCaseLike, index: number): string {
  const title = asText(testCase.title) || `Test Case ${index + 1}`;
  const steps = Array.isArray(testCase.steps)
    ? testCase.steps.map(asText).filter(Boolean)
    : asText(testCase.steps)
        .split(/\n+/)
        .map((step) => step.replace(/^\d+[.)]\s*/, "").trim())
        .filter(Boolean);

  return [
    `# ${title}`,
    "",
    `Type: ${asText(testCase.type) || "Functional"}`,
    `Priority: ${asText(testCase.priority) || "Medium"}`,
    "",
    "## Preconditions",
    asText(testCase.preconditions) || "Not specified.",
    "",
    "## Steps",
    ...(steps.length ? steps.map((step, stepIndex) => `${stepIndex + 1}. ${step}`) : ["1. Not specified."]),
    "",
    "## Expected Result",
    asText(testCase.expectedResult) || "Not specified.",
  ].join("\n");
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

function saveModeLabel(mode: SaveMode) {
  if (mode === "bundle") return "Save output as one source";
  if (mode === "individual") return "Save test cases individually";
  return "Save both";
}

export default function SaveGeneratedOutputToSourceButton({
  activeProject,
  reportType,
  markdown,
  structuredData,
  onSaved,
}: SaveGeneratedOutputToSourceButtonProps) {
  const [saveMode, setSaveMode] = useState<SaveMode>("bundle");
  const [state, setState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("");

  const testCases = useMemo(() => testCasesFromStructuredData(structuredData), [structuredData]);
  const canUseIndividualTestCases = reportType === "tests" && testCases.length > 0;
  const canSave = Boolean(activeProject?.id) && Boolean(markdown.trim()) && reportType !== "bug" && state !== "saving";

  const effectiveMode: SaveMode =
    reportType === "tests" && canUseIndividualTestCases ? saveMode : "bundle";

  async function saveOneSource(input: {
    title: string;
    sourceType: string;
    body: string;
    tags: string[];
  }) {
    if (!activeProject?.id) {
      throw new Error("Select a project before saving to the Project Source Vault.");
    }

    const response = await fetch(`/api/projects/${encodeURIComponent(activeProject.id)}/sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: normalizeTitle(input.title, "Generated QA Output"),
        sourceType: input.sourceType,
        tags: input.tags,
        body: normalizeSourceBody(input.body),
        isEnabled: true,
      }),
    });

    const payload = (await response.json().catch(() => null)) as SourceApiResponse | null;

    if (!response.ok || payload?.ok === false || !payload?.source) {
      throw new Error(payload?.error || "Could not save output to Project Source Vault.");
    }

    return payload.source;
  }

  async function handleSave() {
    if (!activeProject) {
      setState("error");
      setMessage("Select a project before saving to the Project Source Vault.");
      return;
    }

    if (reportType === "bug") {
      setState("error");
      setMessage("Bug Collection save is intentionally deferred to the Bug Collection slice.");
      return;
    }

    setState("saving");
    setMessage("");

    try {
      const projectName = activeProject.name || "Project";
      const saved: Array<{ id: string; title: string }> = [];

      if (effectiveMode === "bundle" || effectiveMode === "both") {
        saved.push(
          await saveOneSource({
            title: defaultTitle(reportType, projectName),
            sourceType: defaultSourceType(reportType),
            tags: ["generated-output", reportType, "qatalyst"],
            body: markdown,
          })
        );
      }

      if ((effectiveMode === "individual" || effectiveMode === "both") && canUseIndividualTestCases) {
        for (let index = 0; index < testCases.length; index += 1) {
          const testCase = testCases[index];
          const title = normalizeTitle(asText(testCase.title), `Test Case ${index + 1}`);

          saved.push(
            await saveOneSource({
              title,
              sourceType: "test-case",
              tags: ["generated-output", "test-case", "qatalyst"],
              body: formatTestCaseSource(testCase, index),
            })
          );
        }
      }

      setState("saved");
      setMessage(`Saved ${saved.length} source${saved.length === 1 ? "" : "s"} to Project Source Vault.`);
      onSaved?.();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not save output to Project Source Vault.");
    }
  }

  if (!markdown.trim()) return null;

  return (
    <section className="save-generated-source-control" data-testid="save-generated-source-control">
      <div>
        <p className="report-kicker">Project Source Vault</p>
        <strong>Save generated output as reusable source memory</strong>
        <span>
          Saved sources are enabled by default and can be selected from the Sources dropdown on future runs.
        </span>
      </div>

      {reportType === "tests" && canUseIndividualTestCases ? (
        <label className="save-generated-source-mode">
          Save mode
          <select value={saveMode} onChange={(event) => setSaveMode(event.target.value as SaveMode)}>
            <option value="bundle">{saveModeLabel("bundle")}</option>
            <option value="individual">{saveModeLabel("individual")}</option>
            <option value="both">{saveModeLabel("both")}</option>
          </select>
        </label>
      ) : null}

      {reportType === "bug" ? (
        <p className="save-generated-source-note">
          Bug output will save to the future Bug Collection tab. Project Source Vault save is available for Test Cases,
          Risk Review, and Test Improver.
        </p>
      ) : null}

      <div className="save-generated-source-actions">
        <button
          className="save-generated-source-button"
          disabled={!canSave}
          onClick={handleSave}
          type="button"
        >
          {state === "saving" ? "Saving..." : "Save to Project Source Vault"}
        </button>
      </div>

      {message ? (
        <p
          className={
            state === "error"
              ? "save-generated-source-message save-generated-source-message-error"
              : "save-generated-source-message"
          }
        >
          {message}
        </p>
      ) : null}

      {!activeProject ? (
        <p className="save-generated-source-message save-generated-source-message-error">
          Select or create a project before saving generated output.
        </p>
      ) : null}
    </section>
  );
}
