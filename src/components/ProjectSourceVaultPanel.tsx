"use client";

import { useEffect, useMemo, useState } from "react";
import type { SafeQAProject } from "@/components/ProjectSettingsPanel";

export type SafeProjectSource = {
  id: string;
  projectId: string;
  title: string;
  sourceType: string;
  body: string;
  tags: string[];
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type SourceApiResponse = {
  ok?: boolean;
  error?: string;
  sources?: SafeProjectSource[];
  source?: SafeProjectSource;
};

type ProjectSourceVaultPanelProps = {
  activeProject: SafeQAProject | null;
};

const SOURCE_TYPE_OPTIONS = [
  ["product-overview", "Product Overview"],
  ["requirements", "Requirements"],
  ["jira-epic", "Jira Epic"],
  ["design-doc", "Design Doc"],
  ["qa-notes", "QA Notes"],
  ["api-doc", "API Doc"],
  ["glossary", "Glossary"],
  ["platform-rules", "Platform Rules"],
  ["test-strategy", "Test Strategy"],
  ["other", "Other"],
];

function getWordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

export default function ProjectSourceVaultPanel({ activeProject }: ProjectSourceVaultPanelProps) {
  const [sources, setSources] = useState<SafeProjectSource[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [title, setTitle] = useState("");
  const [sourceType, setSourceType] = useState("product-overview");
  const [tags, setTags] = useState("");
  const [body, setBody] = useState("");
  const [isEnabled, setIsEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedSource = useMemo(
    () => sources.find((source) => source.id === selectedSourceId) ?? null,
    [sources, selectedSourceId]
  );

  const enabledCount = sources.filter((source) => source.isEnabled).length;
  const totalWords = sources.reduce((sum, source) => sum + getWordCount(source.body), 0);

  useEffect(() => {
    setSources([]);
    setSelectedSourceId("");
    resetEditor();

    if (activeProject?.id) {
      void loadSources(activeProject.id);
    }
  }, [activeProject?.id]);

  useEffect(() => {
    if (!selectedSource) return;

    setTitle(selectedSource.title);
    setSourceType(selectedSource.sourceType || "other");
    setTags(selectedSource.tags.join(", "));
    setBody(selectedSource.body);
    setIsEnabled(selectedSource.isEnabled);
  }, [selectedSource]);

  function resetEditor() {
    setTitle("");
    setSourceType("product-overview");
    setTags("");
    setBody("");
    setIsEnabled(true);
    setMessage("");
    setError("");
  }

  function handleNewSource() {
    setSelectedSourceId("");
    resetEditor();
  }

  async function loadSources(projectId: string) {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/sources`);
      const payload = (await response.json().catch(() => null)) as SourceApiResponse | null;

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || "Could not load project sources.");
      }

      setSources(payload?.sources ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load project sources.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveSource() {
    if (!activeProject?.id) return;

    setIsSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(activeProject.id)}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedSourceId || undefined,
          title,
          sourceType,
          tags,
          body,
          isEnabled,
        }),
      });

      const payload = (await response.json().catch(() => null)) as SourceApiResponse | null;

      if (!response.ok || payload?.ok === false || !payload?.source) {
        throw new Error(payload?.error || "Could not save project source.");
      }

      const savedSource = payload.source;

      setSources((current) => {
        const exists = current.some((source) => source.id === savedSource.id);
        return exists ? current.map((source) => (source.id === savedSource.id ? savedSource : source)) : [savedSource, ...current];
      });

      setSelectedSourceId(savedSource.id);
      setMessage(`Saved source: ${savedSource.title}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save project source.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleSource(source: SafeProjectSource) {
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/project-sources/${encodeURIComponent(source.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled: !source.isEnabled }),
      });

      const payload = (await response.json().catch(() => null)) as SourceApiResponse | null;

      if (!response.ok || payload?.ok === false || !payload?.source) {
        throw new Error(payload?.error || "Could not update source.");
      }

      const updated = payload.source;
      setSources((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setMessage(`${updated.title} is now ${updated.isEnabled ? "enabled" : "disabled"}.`);
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Could not update source.");
    }
  }

  async function handleDeleteSource() {
    if (!selectedSourceId) return;

    const sourceName = selectedSource?.title || "this source";
    if (!window.confirm(`Delete ${sourceName}? This removes it from the project source vault.`)) return;

    setIsSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/project-sources/${encodeURIComponent(selectedSourceId)}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => null)) as SourceApiResponse | null;

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || "Could not delete source.");
      }

      setSources((current) => current.filter((source) => source.id !== selectedSourceId));
      setSelectedSourceId("");
      resetEditor();
      setMessage(`Deleted source: ${sourceName}`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete source.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!activeProject) {
    return (
      <section className="project-source-vault-panel project-source-vault-empty">
        <p className="report-kicker">Project Source Vault</p>
        <h2>Select or create a project first</h2>
        <p>Sources attach to a specific project. Create a project in the Projects tab, then add reusable product context here.</p>
      </section>
    );
  }

  return (
    <section className="project-source-vault-panel">
      <div className="source-vault-header">
        <div>
          <p className="report-kicker">Project Source Vault</p>
          <h2>{activeProject.name} sources</h2>
          <p>Store reusable product context now. QAS-67 will inject enabled sources into QA generation.</p>
        </div>

        <button type="button" onClick={handleNewSource}>New Source</button>
      </div>

      <div className="source-vault-stats">
        <div><strong>{sources.length}</strong><span>Total sources</span></div>
        <div><strong>{enabledCount}</strong><span>Enabled</span></div>
        <div><strong>{totalWords}</strong><span>Approx. words</span></div>
      </div>

      <div className="source-vault-grid">
        <aside className="source-list-card">
          <p className="report-kicker">Saved Sources</p>

          {isLoading ? <p className="source-empty-text">Loading sources...</p> : null}
          {!isLoading && sources.length === 0 ? (
            <p className="source-empty-text">No sources yet. Add a product overview, requirements note, Jira epic, or QA notes to start building memory.</p>
          ) : null}

          <div className="source-list">
            {sources.map((source) => (
              <div className={source.id === selectedSourceId ? "source-list-item source-list-item-active" : "source-list-item"} key={source.id}>
                <button type="button" onClick={() => setSelectedSourceId(source.id)}>
                  <strong>{source.title}</strong>
                  <span>{source.sourceType}</span>
                  {source.tags.length ? <small>{source.tags.join(", ")}</small> : null}
                </button>

                <button
                  className={source.isEnabled ? "source-enabled-toggle source-enabled-toggle-on" : "source-enabled-toggle"}
                  type="button"
                  onClick={() => handleToggleSource(source)}
                >
                  {source.isEnabled ? "Enabled" : "Disabled"}
                </button>
              </div>
            ))}
          </div>
        </aside>

        <div className="source-editor-card">
          <p className="report-kicker">{selectedSourceId ? "Edit Source" : "New Source"}</p>

          <label>Source title
            <input maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder="Example: Combat System Overview" value={title} />
          </label>

          <label>Source type
            <select onChange={(event) => setSourceType(event.target.value)} value={sourceType}>
              {SOURCE_TYPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>

          <label>Tags
            <input onChange={(event) => setTags(event.target.value)} placeholder="combat, progression, mobile, admin" value={tags} />
          </label>

          <label className="source-enabled-checkbox">
            <input checked={isEnabled} onChange={(event) => setIsEnabled(event.target.checked)} type="checkbox" />
            Enabled for future project context
          </label>

          <label>Source body
            <textarea
              maxLength={24000}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Paste project context here. Examples: product overview, feature rules, platform matrix, test strategy, known risks, glossary..."
              value={body}
            />
          </label>

          <div className="source-editor-meta">
            <span>{body.length.toLocaleString()} / 24,000 characters</span>
            <span>{getWordCount(body).toLocaleString()} words</span>
          </div>

          <div className="source-editor-actions">
            <button disabled={isSaving || !title.trim() || body.trim().length < 20} onClick={handleSaveSource} type="button">
              {isSaving ? "Saving..." : "Save Source"}
            </button>

            {selectedSourceId ? (
              <button className="source-danger-button" disabled={isSaving} onClick={handleDeleteSource} type="button">
                Delete Source
              </button>
            ) : null}
          </div>

          {message ? <p className="source-settings-message">{message}</p> : null}
          {error ? <p className="source-settings-error">{error}</p> : null}
        </div>
      </div>
    </section>
  );
}
