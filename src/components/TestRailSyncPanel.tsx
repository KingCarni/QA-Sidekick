"use client";

import { useMemo, useState } from "react";

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

type SyncResult = {
  title: string;
  status: "created" | "updated" | "failed" | string;
  testRailCaseId?: number;
  error?: string;
};

type PanelState = "idle" | "previewing" | "ready" | "syncing" | "synced" | "partial" | "error";

function messageClassForState(state: PanelState) {
  if (state === "synced") return "testrail-settings-message testrail-settings-message-success testrail-sync-message-success";
  if (state === "partial" || state === "error") return "testrail-settings-message testrail-settings-message-error testrail-sync-message-error";
  if (state === "ready") return "testrail-settings-message testrail-sync-message-ready";

  return "testrail-settings-message";
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

function statusTone(status: string) {
  if (status === "synced" || status === "created" || status === "updated") return "success";
  if (status === "failed" || status === "stale") return "error";
  if (status === "ready") return "ready";
  return "neutral";
}

export default function TestRailSyncPanel({ reportId, testCases, sourceJiraKey, sourceJiraUrl }: TestRailSyncPanelProps) {
  const [preview, setPreview] = useState<PreviewCase[]>([]);
  const [results, setResults] = useState<SyncResult[]>([]);
  const [state, setState] = useState<PanelState>("idle");
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"create" | "update">("create");

  const syncSummary = useMemo(() => {
    const failed = results.filter((item) => item.status === "failed").length;
    const created = results.filter((item) => item.status === "created").length;
    const updated = results.filter((item) => item.status === "updated").length;

    return { failed, created, updated, total: results.length };
  }, [results]);

  async function buildPreview() {
    setState("previewing");
    setMessage("");
    setResults([]);

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

      const nextPreview = Array.isArray(payload?.preview) ? payload.preview : [];
      setPreview(nextPreview);
      setState("ready");
      setMessage(`Preview ready: ${nextPreview.length} case(s). Review the mapped payload before syncing.`);
    } catch (error) {
      setPreview([]);
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not build TestRail sync preview.");
    }
  }

  async function syncCases() {
    const confirmed = window.confirm("Create/update these cases in TestRail? Review the preview first. This action writes to TestRail.");
    if (!confirmed) return;

    setState("syncing");
    setMessage("");
    setResults([]);

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

      const nextResults = Array.isArray(payload?.results) ? payload.results : [];
      const failed = nextResults.filter((item: SyncResult) => item.status === "failed").length;

      setResults(nextResults);
      setState(failed ? "partial" : "synced");
      setMessage(
        failed
          ? `Sync completed with ${failed} failed case(s). Review the result rows below.`
          : `Synced ${nextResults.length} case(s) to TestRail.`
      );
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
          <p>
            QAtalyst maps generated test cases into TestRail fields, shows the exact write payload,
            then requires approval before anything is created or updated.
          </p>
        </div>

        <div className="testrail-sync-actions">
          <select
            aria-label="TestRail sync mode"
            value={mode}
            onChange={(event) => setMode(event.target.value === "update" ? "update" : "create")}
          >
            <option value="create">Create new cases</option>
            <option value="update">Update mapped cases</option>
          </select>

          <button
            className="secondary-action-button testrail-preview-sync-button"
            disabled={state === "previewing" || state === "syncing"}
            onClick={buildPreview}
            type="button"
          >
            {state === "previewing" ? "Previewing..." : "Preview Sync"}
          </button>

          <button
            className="copy-all-button testrail-approve-sync-button"
            disabled={!preview.length || state === "syncing"}
            onClick={syncCases}
            type="button"
          >
            {state === "syncing" ? "Syncing..." : "Approve & Sync"}
          </button>
        </div>
      </div>

      <div className="testrail-safe-sync-note">
        <strong>Safe sync rule:</strong> QAtalyst will not write to TestRail until you generate a preview and approve the sync.
        Create mode is the default. Update mode only updates cases that already have a stored TestRail mapping.
      </div>

      {message ? <p className={messageClassForState(state)}>{message}</p> : null}

      {results.length ? (
        <div className="testrail-sync-result-list" data-testid="testrail-sync-results">
          <div className="testrail-sync-result-summary">
            <strong>Sync Results</strong>
            <span>
              {syncSummary.created} created · {syncSummary.updated} updated · {syncSummary.failed} failed
            </span>
          </div>

          {results.map((item, index) => (
            <article className={`testrail-sync-result-row testrail-sync-result-row-${statusTone(item.status)}`} key={`${item.title}-${index}`}>
              <div>
                <strong>{item.title}</strong>
                {item.error ? <span>{item.error}</span> : <span>{item.testRailCaseId ? `C${item.testRailCaseId}` : "No TestRail case ID returned"}</span>}
              </div>
              <em>{statusLabel(item.status)}</em>
            </article>
          ))}
        </div>
      ) : null}

      {preview.length ? (
        <div className="testrail-preview-list">
          {preview.map((item) => (
            <article className={`testrail-preview-card testrail-preview-card-${statusTone(item.status)}`} key={item.contentHash}>
              <div className="testrail-preview-card-header">
                <strong>{item.title}</strong>
                <span>{statusLabel(item.status)}</span>
              </div>

              <dl>
                <div>
                  <dt>Section</dt>
                  <dd>{item.sectionId}</dd>
                </div>
                <div>
                  <dt>Priority</dt>
                  <dd>{item.priority}</dd>
                </div>
                <div>
                  <dt>Type</dt>
                  <dd>{item.type}</dd>
                </div>
                <div>
                  <dt>Steps</dt>
                  <dd>{item.steps.length}</dd>
                </div>
                <div>
                  <dt>Existing Case</dt>
                  <dd>{item.existingTestRailCaseId ? `C${item.existingTestRailCaseId}` : "None"}</dd>
                </div>
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
