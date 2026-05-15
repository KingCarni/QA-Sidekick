"use client";

import { useEffect, useMemo, useState } from "react";
import ProjectSourceFileUploader from "@/components/ProjectSourceFileUploader";
import type { SafeQAProject } from "@/components/ProjectSettingsPanel";
import type { SourceFileExtractionResult } from "@/lib/source-file-extract";
import styles from "./ProjectSourceVaultPanel.module.css";

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

type SourceInfluenceState = "included" | "over-budget" | "disabled";

const SOURCE_CONTEXT_CHARACTER_BUDGET = 30000;

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

function formatSourceType(value: string): string {
  return SOURCE_TYPE_OPTIONS.find(([key]) => key === value)?.[1] ?? value.replace(/-/g, " ");
}

function formatUpdatedDate(value: string): string {
  if (!value) return "";

  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function getSourceContextBlockLength(source: SafeProjectSource): number {
  const block = [
    `Source: ${source.title}`,
    `Type: ${source.sourceType}`,
    source.tags.length ? `Tags: ${source.tags.join(", ")}` : "",
    "",
    source.body,
  ]
    .filter(Boolean)
    .join("\n");

  return block.length;
}

function buildInfluenceMap(sources: SafeProjectSource[]): Map<string, SourceInfluenceState> {
  const influenceMap = new Map<string, SourceInfluenceState>();
  let usedCharacters = 0;

  for (const source of sources) {
    if (!source.isEnabled) {
      influenceMap.set(source.id, "disabled");
      continue;
    }

    const sourceLength = getSourceContextBlockLength(source);

    if (usedCharacters + sourceLength <= SOURCE_CONTEXT_CHARACTER_BUDGET) {
      usedCharacters += sourceLength;
      influenceMap.set(source.id, "included");
    } else {
      influenceMap.set(source.id, "over-budget");
    }
  }

  return influenceMap;
}

function getInfluenceLabel(value: SourceInfluenceState): string {
  if (value === "included") return "Brain-ready";
  if (value === "over-budget") return "Over budget";
  return "Disabled";
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
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const selectedSource = useMemo(
    () => sources.find((source) => source.id === selectedSourceId) ?? null,
    [sources, selectedSourceId]
  );

  const influenceMap = useMemo(() => buildInfluenceMap(sources), [sources]);
  const enabledCount = sources.filter((source) => source.isEnabled).length;
  const totalWords = sources.reduce((sum, source) => sum + getWordCount(source.body), 0);
  const enabledWords = sources.filter((source) => source.isEnabled).reduce((sum, source) => sum + getWordCount(source.body), 0);
  const brainReadyCount = sources.filter((source) => influenceMap.get(source.id) === "included").length;
  const estimatedContextCharacters = sources
    .filter((source) => influenceMap.get(source.id) === "included")
    .reduce((sum, source) => sum + getSourceContextBlockLength(source), 0);
  const contextBudgetPercent = Math.min(100, Math.round((estimatedContextCharacters / SOURCE_CONTEXT_CHARACTER_BUDGET) * 100));

  const availableSourceTypes = useMemo(() => {
    return Array.from(new Set(sources.map((source) => source.sourceType).filter(Boolean))).sort();
  }, [sources]);

  const availableTags = useMemo(() => {
    return Array.from(new Set(sources.flatMap((source) => source.tags))).sort();
  }, [sources]);

  const filteredSources = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return sources.filter((source) => {
      const influenceState = influenceMap.get(source.id) ?? "disabled";
      const matchesSearch =
        !normalizedSearch ||
        source.title.toLowerCase().includes(normalizedSearch) ||
        source.sourceType.toLowerCase().includes(normalizedSearch) ||
        source.tags.some((tag) => tag.toLowerCase().includes(normalizedSearch)) ||
        source.body.toLowerCase().includes(normalizedSearch);
      const matchesType = typeFilter === "all" || source.sourceType === typeFilter;
      const matchesTag = tagFilter === "all" || source.tags.includes(tagFilter);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "enabled" && source.isEnabled) ||
        (statusFilter === "disabled" && !source.isEnabled) ||
        statusFilter === influenceState;

      return matchesSearch && matchesType && matchesTag && matchesStatus;
    });
  }, [sources, searchTerm, typeFilter, tagFilter, statusFilter, influenceMap]);

  const selectedInfluenceState = selectedSource ? influenceMap.get(selectedSource.id) ?? "disabled" : null;

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

  function clearFilters() {
    setSearchTerm("");
    setTypeFilter("all");
    setTagFilter("all");
    setStatusFilter("all");
  }

  function applyExtractedSource(result: SourceFileExtractionResult) {
    setSelectedSourceId("");
    setTitle(result.title);
    setSourceType(result.sourceType || "other");
    setTags(result.tags.join(", "));
    setBody(result.body);
    setIsEnabled(true);
    setMessage(`Loaded ${result.filename}. Review and save the source.`);
    setError("");
  }

  async function saveExtractedSource(result: SourceFileExtractionResult) {
    if (!activeProject?.id || !result.ok) return;

    setIsSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(activeProject.id)}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: result.title,
          sourceType: result.sourceType || "other",
          tags: result.tags,
          body: result.body,
          isEnabled: true,
        }),
      });

      const payload = (await response.json().catch(() => null)) as SourceApiResponse | null;

      if (!response.ok || payload?.ok === false || !payload?.source) {
        throw new Error(payload?.error || "Could not save extracted source.");
      }

      const savedSource = payload.source;

      setSources((current) => [savedSource, ...current]);
      setSelectedSourceId(savedSource.id);
      setMessage(`Saved source from file: ${savedSource.title}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save extracted source.");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveAllExtractedSources(results: SourceFileExtractionResult[]) {
    for (const result of results) {
      await saveExtractedSource(result);
    }
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
          <p>Store reusable product context for smarter QA generation.</p>
        </div>

        <button type="button" onClick={handleNewSource}>New Source</button>
      </div>

      <div className="source-vault-stats">
        <div><strong>{sources.length}</strong><span>Total sources</span></div>
        <div><strong>{enabledCount}</strong><span>Enabled</span></div>
        <div><strong>{brainReadyCount}</strong><span>Brain-ready</span></div>
        <div><strong>{totalWords}</strong><span>Approx. words</span></div>
      </div>

      <div className={styles.contextHealthCard}>
        <div>
          <p>Context influence budget</p>
          <strong>{estimatedContextCharacters.toLocaleString()} / {SOURCE_CONTEXT_CHARACTER_BUDGET.toLocaleString()} chars</strong>
          <span>{enabledWords.toLocaleString()} enabled words available. Enabled sources are included newest-first until the safe prompt budget is reached.</span>
        </div>
        <div className={styles.contextMeter} aria-label={`Source Vault context budget ${contextBudgetPercent}% used`}>
          <span style={{ width: `${contextBudgetPercent}%` }} />
        </div>
      </div>

      <ProjectSourceFileUploader
        onUseExtractedSource={applyExtractedSource}
        onUseAllExtractedSources={saveAllExtractedSources}
      />

      <div className={styles.filterPanel}>
        <label>
          Search sources
          <input
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search sources..."
            value={searchTerm}
          />
        </label>

        <label>
          Type
          <select onChange={(event) => setTypeFilter(event.target.value)} value={typeFilter}>
            <option value="all">All types</option>
            {availableSourceTypes.map((type) => (
              <option key={type} value={type}>{formatSourceType(type)}</option>
            ))}
          </select>
        </label>

        <label>
          Tag
          <select onChange={(event) => setTagFilter(event.target.value)} value={tagFilter}>
            <option value="all">All tags</option>
            {availableTags.map((tag) => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
        </label>

        <label>
          Influence
          <select onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
            <option value="all">All statuses</option>
            <option value="enabled">Enabled</option>
            <option value="included">Brain-ready</option>
            <option value="over-budget">Over budget</option>
            <option value="disabled">Disabled</option>
          </select>
        </label>

        <button type="button" onClick={clearFilters}>Clear</button>
      </div>

      <div className="source-vault-grid">
        <aside className="source-list-card">
          <div className={styles.listHeaderRow}>
            <p className="report-kicker">Saved Sources</p>
            <span>{filteredSources.length} shown</span>
          </div>

          {isLoading ? <p className="source-empty-text">Loading sources...</p> : null}
          {!isLoading && sources.length === 0 ? (
            <p className="source-empty-text">No sources yet. Add a product overview, requirements note, Jira epic, or QA notes to start building memory.</p>
          ) : null}
          {!isLoading && sources.length > 0 && filteredSources.length === 0 ? (
            <p className="source-empty-text">No sources match the current filters.</p>
          ) : null}

          <div className="source-list">
            {filteredSources.map((source) => {
              const influenceState = influenceMap.get(source.id) ?? "disabled";

              return (
                <div className={source.id === selectedSourceId ? "source-list-item source-list-item-active" : "source-list-item"} key={source.id}>
                  <button type="button" onClick={() => setSelectedSourceId(source.id)}>
                    <strong>{source.title}</strong>
                    <span>{formatSourceType(source.sourceType)}</span>
                    <div className={styles.sourceMetaRow}>
                      <small>{getWordCount(source.body).toLocaleString()} words</small>
                      <small>{formatUpdatedDate(source.updatedAt)}</small>
                    </div>
                    {source.tags.length ? <small>{source.tags.join(", ")}</small> : null}
                    <em className={`${styles.influencePill} ${styles[influenceState]}`}>{getInfluenceLabel(influenceState)}</em>
                  </button>

                  <button
                    className={source.isEnabled ? "source-enabled-toggle source-enabled-toggle-on" : "source-enabled-toggle"}
                    type="button"
                    onClick={() => handleToggleSource(source)}
                  >
                    {source.isEnabled ? "Enabled" : "Disabled"}
                  </button>
                </div>
              );
            })}
          </div>
        </aside>

        <div className="source-editor-card">
          <p className="report-kicker">{selectedSourceId ? "Edit Source" : "New Source"}</p>

          {selectedSource ? (
            <div className={styles.editorInfluenceCard}>
              <div>
                <span>Brain influence</span>
                <strong>{selectedInfluenceState ? getInfluenceLabel(selectedInfluenceState) : "New source"}</strong>
              </div>
              <p>
                {selectedInfluenceState === "included"
                  ? "This enabled source is currently inside the safe context budget and can influence AI workflows."
                  : selectedInfluenceState === "over-budget"
                    ? "This source is enabled but falls outside the current prompt budget. Shorten, disable lower-value sources, or use more targeted source selection later."
                    : "This source is disabled and will not be injected into future AI workflows."}
              </p>
            </div>
          ) : null}

          <label>Source title
            <input maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder="Example: Product Overview" value={title} />
          </label>

          <label>Source type
            <select onChange={(event) => setSourceType(event.target.value)} value={sourceType}>
              {SOURCE_TYPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>

          <label>Tags
            <input onChange={(event) => setTags(event.target.value)} placeholder="qa, requirements, jira, automation" value={tags} />
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
