"use client";

import { useEffect, useMemo, useState } from "react";
import type { SafeQAProject } from "@/components/ProjectSettingsPanel";

export type SafeBugCollectionItem = {
  id: string;
  projectId: string | null;
  title: string;
  status: string;
  severity: string;
  priority: string;
  summary: string;
  environment: string;
  steps: string[];
  expectedResult: string;
  actualResult: string;
  impact: string;
  missingInfo: string[];
  followUps: string[];
  qaNotes: string[];
  sourceInput: string;
  markdown: string;
  jiraIssueKey: string;
  jiraIssueUrl: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

type BugApiResponse = {
  ok?: boolean;
  error?: string;
  bugs?: SafeBugCollectionItem[];
  bug?: SafeBugCollectionItem;
};

type BugCollectionPanelProps = {
  activeProject: SafeQAProject | null;
};

const STATUS_OPTIONS = [
  ["new", "New"],
  ["triaged", "Triaged"],
  ["in_progress", "In Progress"],
  ["fixed", "Fixed"],
  ["wont_fix", "Won't Fix"],
  ["archived", "Archived"],
];

function labelForStatus(status: string) {
  return STATUS_OPTIONS.find(([value]) => value === status)?.[1] ?? status;
}

function formatDate(value: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export default function BugCollectionPanel({ activeProject }: BugCollectionPanelProps) {
  const [bugs, setBugs] = useState<SafeBugCollectionItem[]>([]);
  const [selectedBugId, setSelectedBugId] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedBug = useMemo(
    () => bugs.find((bug) => bug.id === selectedBugId) ?? bugs[0] ?? null,
    [bugs, selectedBugId]
  );

  const filteredBugs = useMemo(() => {
    if (statusFilter === "all") return bugs;
    if (statusFilter === "active") return bugs.filter((bug) => bug.status !== "archived" && bug.status !== "fixed" && bug.status !== "wont_fix");
    return bugs.filter((bug) => bug.status === statusFilter);
  }, [bugs, statusFilter]);

  const counts = useMemo(() => {
    return {
      total: bugs.length,
      active: bugs.filter((bug) => bug.status !== "archived" && bug.status !== "fixed" && bug.status !== "wont_fix").length,
      fixed: bugs.filter((bug) => bug.status === "fixed").length,
      archived: bugs.filter((bug) => bug.status === "archived").length,
    };
  }, [bugs]);

  useEffect(() => {
    setBugs([]);
    setSelectedBugId("");
    setMessage("");
    setError("");

    if (activeProject?.id) {
      void loadBugs(activeProject.id);
    }
  }, [activeProject?.id]);

  async function loadBugs(projectId: string) {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/bugs`);
      const payload = (await response.json().catch(() => null)) as BugApiResponse | null;

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || "Could not load bug collection.");
      }

      setBugs(payload?.bugs ?? []);
      setSelectedBugId(payload?.bugs?.[0]?.id ?? "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load bug collection.");
    } finally {
      setIsLoading(false);
    }
  }

  async function updateBugStatus(bugId: string, status: string) {
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/bug-collection/${encodeURIComponent(bugId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const payload = (await response.json().catch(() => null)) as BugApiResponse | null;

      if (!response.ok || payload?.ok === false || !payload?.bug) {
        throw new Error(payload?.error || "Could not update bug status.");
      }

      setBugs((current) => current.map((bug) => (bug.id === payload.bug!.id ? payload.bug! : bug)));
      setMessage(`Updated status: ${labelForStatus(payload.bug.status)}`);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update bug status.");
    }
  }

  async function deleteBug(bugId: string) {
    if (!window.confirm("Delete this bug from the collection?")) return;

    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/bug-collection/${encodeURIComponent(bugId)}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => null)) as BugApiResponse | null;

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || "Could not delete bug.");
      }

      setBugs((current) => current.filter((bug) => bug.id !== bugId));
      setSelectedBugId("");
      setMessage("Deleted bug from collection.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete bug.");
    }
  }

  if (!activeProject) {
    return (
      <section className="bug-collection-panel bug-collection-empty">
        <p className="report-kicker">Bug Collection</p>
        <h2>Select a project first</h2>
        <p>Saved bugs attach to a project. Create or select a project before building a bug collection.</p>
      </section>
    );
  }

  return (
    <section className="bug-collection-panel">
      <div className="bug-collection-header">
        <div>
          <p className="report-kicker">Bug Collection</p>
          <h2>{activeProject.name} defects</h2>
          <p>Track saved Bug Writer outputs separately from reusable Project Source Vault memory.</p>
        </div>

        <button type="button" onClick={() => loadBugs(activeProject.id)} disabled={isLoading}>
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="bug-collection-stats">
        <div><strong>{counts.total}</strong><span>Total</span></div>
        <div><strong>{counts.active}</strong><span>Active</span></div>
        <div><strong>{counts.fixed}</strong><span>Fixed</span></div>
        <div><strong>{counts.archived}</strong><span>Archived</span></div>
      </div>

      <div className="bug-collection-toolbar">
        <label>
          Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="active">Active</option>
            <option value="all">All</option>
            {STATUS_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
      </div>

      {message ? <p className="bug-collection-message">{message}</p> : null}
      {error ? <p className="bug-collection-error">{error}</p> : null}

      <div className="bug-collection-grid">
        <aside className="bug-collection-list-card">
          <p className="report-kicker">Saved Bugs</p>

          {isLoading ? <p className="bug-collection-muted">Loading bugs...</p> : null}
          {!isLoading && filteredBugs.length === 0 ? (
            <p className="bug-collection-muted">No bugs match this filter yet.</p>
          ) : null}

          <div className="bug-collection-list">
            {filteredBugs.map((bug) => (
              <button
                className={bug.id === selectedBug?.id ? "bug-collection-list-item bug-collection-list-item-active" : "bug-collection-list-item"}
                key={bug.id}
                type="button"
                onClick={() => setSelectedBugId(bug.id)}
              >
                <strong>{bug.title}</strong>
                <span>{labelForStatus(bug.status)} · {bug.priority || "No priority"} · {bug.severity || "No severity"}</span>
                <small>{formatDate(bug.updatedAt)}</small>
              </button>
            ))}
          </div>
        </aside>

        <article className="bug-collection-detail-card">
          {selectedBug ? (
            <>
              <div className="bug-collection-detail-top">
                <div>
                  <p className="report-kicker">Selected Bug</p>
                  <h3>{selectedBug.title}</h3>
                  <p>{selectedBug.summary || "No summary saved."}</p>
                </div>

                <label>
                  Status
                  <select value={selectedBug.status} onChange={(event) => updateBugStatus(selectedBug.id, event.target.value)}>
                    {STATUS_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="bug-collection-detail-meta">
                <div><span>Priority</span><strong>{selectedBug.priority || "Not set"}</strong></div>
                <div><span>Severity</span><strong>{selectedBug.severity || "Not set"}</strong></div>
                <div><span>Updated</span><strong>{formatDate(selectedBug.updatedAt)}</strong></div>
              </div>

              <section>
                <h4>Steps to Reproduce</h4>
                {selectedBug.steps.length ? (
                  <ol>{selectedBug.steps.map((step, index) => <li key={`${step}-${index}`}>{step}</li>)}</ol>
                ) : (
                  <p className="bug-collection-muted">No steps saved.</p>
                )}
              </section>

              <section>
                <h4>Expected / Actual</h4>
                <p><strong>Expected:</strong> {selectedBug.expectedResult || "Not saved."}</p>
                <p><strong>Actual:</strong> {selectedBug.actualResult || "Not saved."}</p>
              </section>

              <section>
                <h4>Impact</h4>
                <p>{selectedBug.impact || "No impact saved."}</p>
              </section>

              {selectedBug.markdown ? (
                <details>
                  <summary>View saved markdown</summary>
                  <pre>{selectedBug.markdown}</pre>
                </details>
              ) : null}

              <div className="bug-collection-detail-actions">
                <button type="button" onClick={() => updateBugStatus(selectedBug.id, "archived")}>Archive</button>
                <button className="bug-collection-danger-button" type="button" onClick={() => deleteBug(selectedBug.id)}>Delete</button>
              </div>
            </>
          ) : (
            <p className="bug-collection-muted">Select a bug to view details.</p>
          )}
        </article>
      </div>
    </section>
  );
}
