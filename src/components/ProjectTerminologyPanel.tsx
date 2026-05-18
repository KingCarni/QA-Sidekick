"use client";

import { useEffect, useMemo, useState } from "react";
import type { SafeQAProject } from "@/components/ProjectSettingsPanel";
import styles from "./ProjectTerminologyPanel.module.css";

export type SafeProjectTerm = {
  id: string;
  projectId: string;
  term: string;
  definition: string;
  aliases: string[];
  preferredUsage: string | null;
  category: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type TermApiResponse = {
  ok?: boolean;
  error?: string;
  terms?: SafeProjectTerm[];
  term?: SafeProjectTerm;
};

export type ProjectTerminologyStats = {
  totalTerms: number;
  enabledTerms: number;
  aliasCount: number;
  categoryCount: number;
};

type ProjectTerminologyPanelProps = {
  activeProject: SafeQAProject | null;
  onStatsChange?: (stats: ProjectTerminologyStats) => void;
};

const CATEGORY_OPTIONS = [
  ["product", "Product"],
  ["feature", "Feature"],
  ["role", "User Role"],
  ["acronym", "Acronym"],
  ["system", "System"],
  ["integration", "Integration"],
  ["workflow", "Workflow"],
  ["qa-language", "QA Language"],
  ["business-domain", "Business Domain"],
  ["other", "Other"],
];

function formatLabel(value: string): string {
  return CATEGORY_OPTIONS.find(([key]) => key === value)?.[1] ?? value.replace(/-/g, " ");
}

function formatDate(value: string): string {
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

export default function ProjectTerminologyPanel({ activeProject, onStatsChange }: ProjectTerminologyPanelProps) {
  const [terms, setTerms] = useState<SafeProjectTerm[]>([]);
  const [selectedTermId, setSelectedTermId] = useState("");
  const [term, setTerm] = useState("");
  const [definition, setDefinition] = useState("");
  const [aliases, setAliases] = useState("");
  const [preferredUsage, setPreferredUsage] = useState("");
  const [category, setCategory] = useState("product");
  const [isEnabled, setIsEnabled] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedTerm = useMemo(() => terms.find((item) => item.id === selectedTermId) ?? null, [terms, selectedTermId]);
  const enabledTerms = terms.filter((item) => item.isEnabled);
  const aliasCount = terms.reduce((sum, item) => sum + item.aliases.length, 0);
  const categoryCount = new Set(terms.map((item) => item.category)).size;

  const terminologyStats = useMemo<ProjectTerminologyStats>(
    () => ({
      totalTerms: terms.length,
      enabledTerms: enabledTerms.length,
      aliasCount,
      categoryCount,
    }),
    [terms.length, enabledTerms.length, aliasCount, categoryCount]
  );

  useEffect(() => {
    onStatsChange?.(terminologyStats);
  }, [onStatsChange, terminologyStats]);

  const filteredTerms = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return terms.filter((item) => {
      const matchesSearch =
        !normalizedSearch ||
        item.term.toLowerCase().includes(normalizedSearch) ||
        item.definition.toLowerCase().includes(normalizedSearch) ||
        item.category.toLowerCase().includes(normalizedSearch) ||
        item.aliases.some((alias) => alias.toLowerCase().includes(normalizedSearch)) ||
        String(item.preferredUsage ?? "").toLowerCase().includes(normalizedSearch);
      const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "enabled" && item.isEnabled) ||
        (statusFilter === "disabled" && !item.isEnabled) ||
        (statusFilter === "has-aliases" && item.aliases.length > 0) ||
        (statusFilter === "has-preferred-usage" && Boolean(item.preferredUsage));

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [terms, searchTerm, categoryFilter, statusFilter]);

  useEffect(() => {
    setTerms([]);
    setSelectedTermId("");
    resetEditor();

    if (activeProject?.id) {
      void loadTerms(activeProject.id);
    }
  }, [activeProject?.id]);

  useEffect(() => {
    if (!selectedTerm) return;

    setTerm(selectedTerm.term);
    setDefinition(selectedTerm.definition);
    setAliases(selectedTerm.aliases.join(", "));
    setPreferredUsage(selectedTerm.preferredUsage ?? "");
    setCategory(selectedTerm.category);
    setIsEnabled(selectedTerm.isEnabled);
  }, [selectedTerm]);

  function resetEditor() {
    setTerm("");
    setDefinition("");
    setAliases("");
    setPreferredUsage("");
    setCategory("product");
    setIsEnabled(true);
    setMessage("");
    setError("");
  }

  function handleNewTerm() {
    setSelectedTermId("");
    resetEditor();
  }

  function clearFilters() {
    setSearchTerm("");
    setCategoryFilter("all");
    setStatusFilter("all");
  }

  async function loadTerms(projectId: string) {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/terms`);
      const payload = (await response.json().catch(() => null)) as TermApiResponse | null;

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || "Could not load terminology.");
      }

      setTerms(payload?.terms ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load terminology.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveTerm() {
    if (!activeProject?.id) return;

    setIsSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(activeProject.id)}/terms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedTermId || undefined,
          term,
          definition,
          aliases,
          preferredUsage,
          category,
          isEnabled,
        }),
      });

      const payload = (await response.json().catch(() => null)) as TermApiResponse | null;

      if (!response.ok || payload?.ok === false || !payload?.term) {
        throw new Error(payload?.error || "Could not save terminology entry.");
      }

      const savedTerm = payload.term;

      setTerms((current) => {
        const exists = current.some((item) => item.id === savedTerm.id);
        return exists ? current.map((item) => (item.id === savedTerm.id ? savedTerm : item)) : [savedTerm, ...current];
      });

      setSelectedTermId(savedTerm.id);
      setMessage(`Saved term: ${savedTerm.term}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save terminology entry.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleTerm(item: SafeProjectTerm) {
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/project-terms/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled: !item.isEnabled }),
      });

      const payload = (await response.json().catch(() => null)) as TermApiResponse | null;

      if (!response.ok || payload?.ok === false || !payload?.term) {
        throw new Error(payload?.error || "Could not update terminology entry.");
      }

      const updated = payload.term;
      setTerms((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
      setMessage(`${updated.term} is now ${updated.isEnabled ? "enabled" : "disabled"}.`);
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Could not update terminology entry.");
    }
  }

  async function handleDeleteTerm() {
    if (!selectedTermId) return;

    const termName = selectedTerm?.term || "this term";
    if (!window.confirm(`Delete ${termName}? This removes it from project terminology.`)) return;

    setIsSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/project-terms/${encodeURIComponent(selectedTermId)}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => null)) as TermApiResponse | null;

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || "Could not delete terminology entry.");
      }

      setTerms((current) => current.filter((entry) => entry.id !== selectedTermId));
      setSelectedTermId("");
      resetEditor();
      setMessage(`Deleted term: ${termName}`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete terminology entry.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!activeProject) {
    return (
      <section className={styles.emptyPanel}>
        <p className="report-kicker">Terminology</p>
        <h2>Select or create a project first</h2>
        <p>Terminology attaches to a specific project. Create a project, then define product language here.</p>
      </section>
    );
  }

  return (
    <section className={styles.termsPanel}>
      <div className={styles.header}>
        <div>
          <p className="report-kicker">Project Terminology</p>
          <h2>{activeProject.name} glossary</h2>
          <p>Define product language, acronyms, aliases, roles, and preferred wording so QAtalyst avoids naming drift.</p>
        </div>
        <button type="button" onClick={handleNewTerm}>New Term</button>
      </div>

      <div className={styles.statsGrid}>
        <div><strong>{terms.length}</strong><span>Total terms</span></div>
        <div><strong>{enabledTerms.length}</strong><span>Enabled</span></div>
        <div><strong>{aliasCount}</strong><span>Aliases</span></div>
        <div><strong>{categoryCount}</strong><span>Categories</span></div>
      </div>

      <div className={styles.influenceCard}>
        <div>
          <p>Brain influence</p>
          <strong>{enabledTerms.length ? `${enabledTerms.length} active term${enabledTerms.length === 1 ? "" : "s"}` : "No active terms yet"}</strong>
          <span>Enabled terminology is injected server-side with Project Brain context so generated QA work uses the right product language.</span>
        </div>
      </div>

      <div className={styles.filterPanel}>
        <label>
          Search terms
          <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search glossary..." />
        </label>
        <label>
          Category
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="all">All categories</option>
            {CATEGORY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All statuses</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
            <option value="has-aliases">Has aliases</option>
            <option value="has-preferred-usage">Has preferred usage</option>
          </select>
        </label>
        <button type="button" onClick={clearFilters}>Clear</button>
      </div>

      <div className={styles.termsGrid}>
        <aside className={styles.listCard}>
          <div className={styles.listHeaderRow}>
            <p className="report-kicker">Saved Terms</p>
            <span>{filteredTerms.length} shown</span>
          </div>

          {isLoading ? <p className={styles.muted}>Loading terminology...</p> : null}
          {!isLoading && terms.length === 0 ? <p className={styles.muted}>No terminology yet. Add acronyms, product terms, feature names, or role definitions to start.</p> : null}
          {!isLoading && terms.length > 0 && filteredTerms.length === 0 ? <p className={styles.muted}>No terms match the current filters.</p> : null}

          <div className={styles.termList}>
            {filteredTerms.map((item) => (
              <div className={item.id === selectedTermId ? `${styles.termItem} ${styles.termItemActive}` : styles.termItem} key={item.id}>
                <button type="button" onClick={() => setSelectedTermId(item.id)}>
                  <strong>{item.term}</strong>
                  <span>{formatLabel(item.category)}</span>
                  {item.aliases.length ? <small>Aliases: {item.aliases.join(", ")}</small> : null}
                  <small>{formatDate(item.updatedAt)}</small>
                  <em className={styles.categoryPill}>{item.category}</em>
                </button>
                <button
                  className={item.isEnabled ? styles.enabledToggleOn : styles.enabledToggle}
                  type="button"
                  onClick={() => handleToggleTerm(item)}
                >
                  {item.isEnabled ? "Enabled" : "Disabled"}
                </button>
              </div>
            ))}
          </div>
        </aside>

        <div className={styles.editorCard}>
          <p className="report-kicker">{selectedTermId ? "Edit Term" : "New Term"}</p>

          <label>Term
            <input value={term} onChange={(event) => setTerm(event.target.value)} maxLength={120} placeholder="Example: Message of the day" />
          </label>

          <label>Category
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {CATEGORY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>

          <label>Aliases / acronyms
            <input value={aliases} onChange={(event) => setAliases(event.target.value)} placeholder="Example: MOTD, daily message, announcement" />
          </label>

          <label>Preferred usage
            <textarea
              className={styles.shortTextarea}
              value={preferredUsage}
              onChange={(event) => setPreferredUsage(event.target.value)}
              maxLength={800}
              placeholder="Example: Use Message of the day for user-facing text. Use MOTD only in internal QA notes or technical references."
            />
          </label>

          <label className={styles.enabledCheckbox}>
            <input checked={isEnabled} onChange={(event) => setIsEnabled(event.target.checked)} type="checkbox" />
            Enabled for future Brain context
          </label>

          <label>Definition
            <textarea
              value={definition}
              onChange={(event) => setDefinition(event.target.value)}
              maxLength={2400}
              placeholder="Define the term clearly. Include product meaning, user-facing meaning, and QA implications when useful."
            />
          </label>

          <div className={styles.editorMeta}>
            <span>{definition.length.toLocaleString()} / 2,400 definition characters</span>
            <span>{preferredUsage.length.toLocaleString()} / 800 usage characters</span>
          </div>

          <div className={styles.editorActions}>
            <button disabled={isSaving || !term.trim() || definition.trim().length < 8} onClick={handleSaveTerm} type="button">
              {isSaving ? "Saving..." : "Save Term"}
            </button>
            {selectedTermId ? (
              <button className={styles.dangerButton} disabled={isSaving} onClick={handleDeleteTerm} type="button">
                Delete Term
              </button>
            ) : null}
          </div>

          {message ? <p className={styles.message}>{message}</p> : null}
          {error ? <p className={styles.error}>{error}</p> : null}
        </div>
      </div>
    </section>
  );
}
