"use client";

import { useState } from "react";

type TestRailSyncPanelProps = {
  reportId?: string;
  testCases: unknown[];
  sourceJiraKey?: string;
  sourceJiraUrl?: string;
};

type PreviewCase = {
  index: number;
  title: string;
  sectionId: number;
  type: string;
  priority: string;
  preconditions: string;
  steps: string[];
  expectedResult: string;
  refs?: string;
  automationNote: string;
  contentHash: string;
  existingTestRailCaseId?: number | null;
  status: "ready" | "stale" | "synced" | "not_synced";
  payload: Record<string, unknown>;
};

export default function TestRailSyncPanel({ reportId, testCases, sourceJiraKey, sourceJiraUrl }: TestRailSyncPanelProps) {
  const [preview, setPreview] = useState<PreviewCase[]>([]);
  const [state, setState] = useState<"idle" | "previewing" | "ready" | "syncing" | "synced" | "error">("idle");
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"create" | "update">("create");

  async function buildPreview() {
    setState("previewing");
    setMessage("");

    try {
      const response = await fetch("/api/testrail/sync-preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reportId, testCases, sourceJiraKey, sourceJiraUrl }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || "Could not build TestRail sync preview.");
      }

      setPreview(Array.isArray(payload?.preview) ? payload.preview : []);
      setState("ready");
      setMessage(`Preview ready: ${payload?.preview?.length ?? 0} case(s). Review before syncing.`);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not build TestRail sync preview.");
    }
  }

  async function syncCases() {
    const confirmed = window.confirm("Create/update these cases in TestRail? Review the preview first. This action writes to TestRail.");
    if (!confirmed) return;

    setState("syncing");
    setMessage("");

    try {
      const response = await fetch("/api/testrail/sync-cases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ approve: true, reportId, mode, cases: preview }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || "Could not sync TestRail cases.");
      }

      const results = Array.isArray(payload?.results) ? payload.results : [];
      const failed = results.filter((item: { status?: string }) => item.status === "failed").length;
      setState(failed ? "error" : "synced");
      setMessage(failed ? `Sync completed with ${failed} failed case(s).` : `Synced ${results.length} case(s) to TestRail.`);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not sync TestRail cases.");
    }
  }

  if (!testCases.length && !reportId) return null;

  return (
    <section className="testrail-sync-panel" data-testid="testrail-sync-panel">
      <div className="testrail-sync-header">
        <div>
          <p className="report-kicker">TestRail Sync</p>
          <h3>Preview before writing cases</h3>
          <p>QAtalyst will map generated test cases into TestRail fields and show the write payload first.</p>
        </div>

        <div className="testrail-sync-actions">
          <select value={mode} onChange={(event) => setMode(event.target.value === "update" ? "update" : "create")}>
            <option value="create">Create new cases</option>
            <option value="update">Update mapped cases</option>
          </select>
          <button className="secondary-action-button" disabled={state === "previewing" || state === "syncing"} onClick={buildPreview} type="button">
            {state === "previewing" ? "Previewing..." : "Preview Sync"}
          </button>
          <button className="copy-all-button" disabled={!preview.length || state === "syncing"} onClick={syncCases} type="button">
            {state === "syncing" ? "Syncing..." : "Approve & Sync"}
          </button>
        </div>
      </div>

      {message ? <p className={state === "error" ? "testrail-settings-message testrail-settings-message-error" : "testrail-settings-message"}>{message}</p> : null}

      {preview.length ? (
        <div className="testrail-preview-list">
          {preview.map((item) => (
            <article className="testrail-preview-card" key={item.contentHash}>
              <div className="testrail-preview-card-header">
                <strong>{item.title}</strong>
                <span>{item.status.replace("_", " ")}</span>
              </div>
              <dl>
                <div><dt>Section</dt><dd>{item.sectionId}</dd></div>
                <div><dt>Priority</dt><dd>{item.priority}</dd></div>
                <div><dt>Type</dt><dd>{item.type}</dd></div>
                <div><dt>Steps</dt><dd>{item.steps.length}</dd></div>
                <div><dt>Existing Case</dt><dd>{item.existingTestRailCaseId ? `C${item.existingTestRailCaseId}` : "None"}</dd></div>
              </dl>
              <details>
                <summary>View mapped payload</summary>
                <pre>{JSON.stringify(item.payload, null, 2)}</pre>
              </details>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
