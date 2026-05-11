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

type TestRailTarget = {
  projectId?: number;
  suiteId?: number | null;
  defaultSectionId?: number;
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

function buildTestRailCaseUrl(caseId?: number) {
  if (!caseId) return "";
  return `https://gitajobautomation.testrail.io/index.php?/cases/view/${caseId}`;
}

export default function TestRailSyncPanel({ reportId, testCases, sourceJiraKey, sourceJiraUrl }: TestRailSyncPanelProps) {
  const [preview, setPreview] = useState<PreviewCase[]>([]);
  const [results, setResults] = useState<SyncResult[]>([]);
  const [target, setTarget] = useState<TestRailTarget | null>(null);
  const [state, setState] = useState<PanelState>("idle");
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"create" | "update">("create");

  const syncSummary = useMemo(() => {
    const failed = results.filter((item) => item.status === "failed").length;
    const created = results.filter((item) => item.status === "created").length;
    const updated = results.filter((item) => item.status === "updated").length;

    return { failed, created, updated, total: results.length };
  }, [results]);

  const previewSummary = useMemo(() => {
    const synced = preview.filter((item) => item.status === "synced").length;
    const notSynced = preview.filter((item) => item.status === "not_synced").length;
    const stale = preview.filter((item) => item.status === "stale").length;
    const sectionIds = Array.from(new Set(preview.map((item) => item.sectionId))).join(", ");

    return { synced, notSynced, stale, sectionIds };
  }, [preview]);

  async function buildPreview(options?: { silent?: boolean }) {
    if (!options?.silent) {
      setState("previewing");
      setMessage("");
      setResults([]);
    }

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
      setTarget(payload?.testrail ?? null);

      if (!options?.silent) {
        setState("ready");
        setMessage(`Preview ready: ${nextPreview.length} reviewed case(s) mapped for TestRail. Check the target and payloads before syncing.`);
      }
    } catch (error) {
      setPreview([]);
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not build TestRail sync preview.");
    }
  }

  async function syncCases() {
    const confirmed = window.confirm(
      `Send ${preview.length} reviewed case(s) to TestRail?\n\nMode: ${mode === "update" ? "Update mapped cases" : "Create new cases"}\nProject: ${target?.projectId ?? "configured project"}\nSuite: ${target?.suiteId ?? "default"}\nSection(s): ${previewSummary.sectionIds || target?.defaultSectionId || "configured section"}\n\nQAtalyst will write to TestRail only after this approval.`
    );
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
          : `Synced ${nextResults.length} reviewed case(s) directly to TestRail.`
      );

      await buildPreview({ silent: true });
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
          <h3>Push reviewed QA cases directly into TestRail</h3>
          <p>
            Turn QAtalyst-generated coverage into TestRail cases without copy/paste. Preview every mapped field,
            approve the write, then jump straight into the created or updated TestRail cases.
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
            onClick={() => buildPreview()}
            type="button"
          >
            {state === "previewing" ? "Previewing..." : "Preview TestRail Sync"}
          </button>

          <button
            className="copy-all-button testrail-approve-sync-button"
            disabled={!preview.length || state === "syncing"}
            onClick={syncCases}
            type="button"
          >
            {state === "syncing" ? "Syncing..." : "Approve & Send to TestRail"}
          </button>
        </div>
      </div>

      <div className="testrail-safe-sync-note">
        <strong>Safe TestRail handoff:</strong> Generate reviewed QA coverage → preview the exact TestRail payload → approve sync → open the created cases.
        No silent writes, and update mode only touches cases with an existing QAtalyst mapping.
      </div>

      {preview.length ? (
        <div className="testrail-sync-result-summary">
          <strong>Target summary</strong>
          <span>
            {preview.length} case(s) · {mode === "update" ? "update mapped cases" : "create new cases"} · Project {target?.projectId ?? "configured"} · Suite {target?.suiteId ?? "default"} · Section(s) {previewSummary.sectionIds || target?.defaultSectionId || "configured"}
          </span>
        </div>
      ) : null}

      {message ? <p className={messageClassForState(state)}>{message}</p> : null}

      {results.length ? (
        <div className="testrail-sync-result-list" data-testid="testrail-sync-results">
          <div className="testrail-sync-result-summary">
            <strong>TestRail Results</strong>
            <span>
              {syncSummary.created} created · {syncSummary.updated} updated · {syncSummary.failed} failed
            </span>
          </div>

          {results.map((item, index) => {
            const caseUrl = buildTestRailCaseUrl(item.testRailCaseId);

            return (
              <article className={`testrail-sync-result-row testrail-sync-result-row-${statusTone(item.status)}`} key={`${item.title}-${index}`}>
                <div>
                  <strong>{item.title}</strong>
                  {item.error ? (
                    <span>{item.error}</span>
                  ) : caseUrl ? (
                    <a href={caseUrl} target="_blank" rel="noreferrer">
                      Open C{item.testRailCaseId} in TestRail ↗
                    </a>
                  ) : (
                    <span>No TestRail case ID returned</span>
                  )}
                </div>
                <em>{statusLabel(item.status)}</em>
              </article>
            );
          })}
        </div>
      ) : null}

      {preview.length ? (
        <div className="testrail-preview-list">
          {preview.map((item) => {
            const existingCaseUrl = buildTestRailCaseUrl(item.existingTestRailCaseId ?? undefined);

            return (
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
                    <dd>
                      {existingCaseUrl ? (
                        <a href={existingCaseUrl} target="_blank" rel="noreferrer">
                          C{item.existingTestRailCaseId} ↗
                        </a>
                      ) : (
                        "None"
                      )}
                    </dd>
                  </div>
                </dl>

                <details>
                  <summary>View mapped TestRail payload</summary>
                  <pre>{JSON.stringify(item.payload, null, 2)}</pre>
                </details>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
