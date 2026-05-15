"use client";

import { useEffect, useMemo, useState } from "react";
import type { SafeQAProject } from "@/components/ProjectSettingsPanel";
import styles from "./ProjectRulesPanel.module.css";

export type SafeProjectRule = {
  id: string;
  projectId: string;
  title: string;
  category: string;
  severity: string;
  appliesTo: string[];
  body: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type RuleApiResponse = {
  ok?: boolean;
  error?: string;
  rules?: SafeProjectRule[];
  rule?: SafeProjectRule;
};

type ProjectRulesPanelProps = {
  activeProject: SafeQAProject | null;
};

const CATEGORY_OPTIONS = [
  ["coverage", "Coverage"],
  ["release-gate", "Release Gate"],
  ["severity", "Severity / Priority"],
  ["bug-reporting", "Bug Reporting"],
  ["automation", "Automation"],
  ["accessibility", "Accessibility"],
  ["security", "Security"],
  ["platform", "Platform"],
  ["data", "Data"],
  ["performance", "Performance"],
  ["team-standard", "Team Standard"],
  ["other", "Other"],
];

const SEVERITY_OPTIONS = [
  ["low", "Low"],
  ["medium", "Medium"],
  ["high", "High"],
  ["critical", "Critical"],
];

const WORKFLOW_OPTIONS = [
  ["all", "All workflows"],
  ["test-cases", "Test Cases"],
  ["bug-writer", "Bug Writer"],
  ["risk-review", "Risk Review"],
  ["test-improver", "Test Improver"],
  ["feature-builder", "Feature Builder"],
  ["automation", "Automation"],
];

function formatLabel(options: string[][], value: string): string {
  return options.find(([key]) => key === value)?.[1] ?? value.replace(/-/g, " ");
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

function getRuleWeight(rule: SafeProjectRule): number {
  if (!rule.isEnabled) return 0;
  if (rule.severity === "critical") return 4;
  if (rule.severity === "high") return 3;
  if (rule.severity === "medium") return 2;
  return 1;
}

export default function ProjectRulesPanel({ activeProject }: ProjectRulesPanelProps) {
  const [rules, setRules] = useState<SafeProjectRule[]>([]);
  const [selectedRuleId, setSelectedRuleId] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("coverage");
  const [severity, setSeverity] = useState("medium");
  const [appliesTo, setAppliesTo] = useState<string[]>(["all"]);
  const [body, setBody] = useState("");
  const [isEnabled, setIsEnabled] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [workflowFilter, setWorkflowFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedRule = useMemo(() => rules.find((rule) => rule.id === selectedRuleId) ?? null, [rules, selectedRuleId]);
  const enabledRules = rules.filter((rule) => rule.isEnabled);
  const criticalRules = enabledRules.filter((rule) => rule.severity === "critical" || rule.severity === "high");
  const ruleWeight = rules.reduce((sum, rule) => sum + getRuleWeight(rule), 0);

  const filteredRules = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return rules.filter((rule) => {
      const matchesSearch =
        !normalizedSearch ||
        rule.title.toLowerCase().includes(normalizedSearch) ||
        rule.category.toLowerCase().includes(normalizedSearch) ||
        rule.severity.toLowerCase().includes(normalizedSearch) ||
        rule.appliesTo.some((workflow) => workflow.toLowerCase().includes(normalizedSearch)) ||
        rule.body.toLowerCase().includes(normalizedSearch);
      const matchesCategory = categoryFilter === "all" || rule.category === categoryFilter;
      const matchesWorkflow = workflowFilter === "all" || rule.appliesTo.includes("all") || rule.appliesTo.includes(workflowFilter);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "enabled" && rule.isEnabled) ||
        (statusFilter === "disabled" && !rule.isEnabled) ||
        (statusFilter === "critical" && rule.isEnabled && rule.severity === "critical") ||
        (statusFilter === "high" && rule.isEnabled && rule.severity === "high");

      return matchesSearch && matchesCategory && matchesWorkflow && matchesStatus;
    });
  }, [rules, searchTerm, categoryFilter, workflowFilter, statusFilter]);

  useEffect(() => {
    setRules([]);
    setSelectedRuleId("");
    resetEditor();

    if (activeProject?.id) {
      void loadRules(activeProject.id);
    }
  }, [activeProject?.id]);

  useEffect(() => {
    if (!selectedRule) return;

    setTitle(selectedRule.title);
    setCategory(selectedRule.category);
    setSeverity(selectedRule.severity);
    setAppliesTo(selectedRule.appliesTo.length ? selectedRule.appliesTo : ["all"]);
    setBody(selectedRule.body);
    setIsEnabled(selectedRule.isEnabled);
  }, [selectedRule]);

  function resetEditor() {
    setTitle("");
    setCategory("coverage");
    setSeverity("medium");
    setAppliesTo(["all"]);
    setBody("");
    setIsEnabled(true);
    setMessage("");
    setError("");
  }

  function handleNewRule() {
    setSelectedRuleId("");
    resetEditor();
  }

  function clearFilters() {
    setSearchTerm("");
    setCategoryFilter("all");
    setWorkflowFilter("all");
    setStatusFilter("all");
  }

  function toggleWorkflow(value: string) {
    setAppliesTo((current) => {
      if (value === "all") return ["all"];

      const withoutAll = current.filter((item) => item !== "all");
      const next = withoutAll.includes(value)
        ? withoutAll.filter((item) => item !== value)
        : [...withoutAll, value];

      return next.length ? next : ["all"];
    });
  }

  async function loadRules(projectId: string) {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/rules`);
      const payload = (await response.json().catch(() => null)) as RuleApiResponse | null;

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || "Could not load QA rules.");
      }

      setRules(payload?.rules ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load QA rules.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveRule() {
    if (!activeProject?.id) return;

    setIsSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(activeProject.id)}/rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedRuleId || undefined,
          title,
          category,
          severity,
          appliesTo,
          body,
          isEnabled,
        }),
      });

      const payload = (await response.json().catch(() => null)) as RuleApiResponse | null;

      if (!response.ok || payload?.ok === false || !payload?.rule) {
        throw new Error(payload?.error || "Could not save QA rule.");
      }

      const savedRule = payload.rule;

      setRules((current) => {
        const exists = current.some((rule) => rule.id === savedRule.id);
        return exists ? current.map((rule) => (rule.id === savedRule.id ? savedRule : rule)) : [savedRule, ...current];
      });

      setSelectedRuleId(savedRule.id);
      setMessage(`Saved rule: ${savedRule.title}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save QA rule.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleRule(rule: SafeProjectRule) {
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/project-rules/${encodeURIComponent(rule.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled: !rule.isEnabled }),
      });

      const payload = (await response.json().catch(() => null)) as RuleApiResponse | null;

      if (!response.ok || payload?.ok === false || !payload?.rule) {
        throw new Error(payload?.error || "Could not update QA rule.");
      }

      const updated = payload.rule;
      setRules((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setMessage(`${updated.title} is now ${updated.isEnabled ? "enabled" : "disabled"}.`);
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Could not update QA rule.");
    }
  }

  async function handleDeleteRule() {
    if (!selectedRuleId) return;

    const ruleName = selectedRule?.title || "this rule";
    if (!window.confirm(`Delete ${ruleName}? This removes it from project QA rules.`)) return;

    setIsSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/project-rules/${encodeURIComponent(selectedRuleId)}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => null)) as RuleApiResponse | null;

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || "Could not delete QA rule.");
      }

      setRules((current) => current.filter((rule) => rule.id !== selectedRuleId));
      setSelectedRuleId("");
      resetEditor();
      setMessage(`Deleted rule: ${ruleName}`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete QA rule.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!activeProject) {
    return (
      <section className={styles.emptyPanel}>
        <p className="report-kicker">QA Rules</p>
        <h2>Select or create a project first</h2>
        <p>QA rules attach to a specific project. Create a project, then capture reusable team standards here.</p>
      </section>
    );
  }

  return (
    <section className={styles.rulesPanel}>
      <div className={styles.header}>
        <div>
          <p className="report-kicker">QA Rules Engine</p>
          <h2>{activeProject.name} rules</h2>
          <p>Capture team standards, release gates, severity rules, and workflow-specific QA expectations.</p>
        </div>
        <button type="button" onClick={handleNewRule}>New Rule</button>
      </div>

      <div className={styles.statsGrid}>
        <div><strong>{rules.length}</strong><span>Total rules</span></div>
        <div><strong>{enabledRules.length}</strong><span>Enabled</span></div>
        <div><strong>{criticalRules.length}</strong><span>High/Critical</span></div>
        <div><strong>{ruleWeight}</strong><span>Rule weight</span></div>
      </div>

      <div className={styles.influenceCard}>
        <div>
          <p>Brain influence</p>
          <strong>{enabledRules.length ? `${enabledRules.length} active rule${enabledRules.length === 1 ? "" : "s"}` : "No active rules yet"}</strong>
          <span>Enabled rules are injected server-side with Project Brain context when they match the selected workflow.</span>
        </div>
      </div>

      <div className={styles.filterPanel}>
        <label>
          Search rules
          <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search rules..." />
        </label>
        <label>
          Category
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="all">All categories</option>
            {CATEGORY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          Workflow
          <select value={workflowFilter} onChange={(event) => setWorkflowFilter(event.target.value)}>
            <option value="all">All workflows</option>
            {WORKFLOW_OPTIONS.filter(([value]) => value !== "all").map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All statuses</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
          </select>
        </label>
        <button type="button" onClick={clearFilters}>Clear</button>
      </div>

      <div className={styles.rulesGrid}>
        <aside className={styles.listCard}>
          <div className={styles.listHeaderRow}>
            <p className="report-kicker">Saved Rules</p>
            <span>{filteredRules.length} shown</span>
          </div>

          {isLoading ? <p className={styles.muted}>Loading rules...</p> : null}
          {!isLoading && rules.length === 0 ? <p className={styles.muted}>No QA rules yet. Add coverage expectations, release gates, or team standards to start.</p> : null}
          {!isLoading && rules.length > 0 && filteredRules.length === 0 ? <p className={styles.muted}>No rules match the current filters.</p> : null}

          <div className={styles.ruleList}>
            {filteredRules.map((rule) => (
              <div className={rule.id === selectedRuleId ? `${styles.ruleItem} ${styles.ruleItemActive}` : styles.ruleItem} key={rule.id}>
                <button type="button" onClick={() => setSelectedRuleId(rule.id)}>
                  <strong>{rule.title}</strong>
                  <span>{formatLabel(CATEGORY_OPTIONS, rule.category)} · {formatLabel(SEVERITY_OPTIONS, rule.severity)}</span>
                  <small>{rule.appliesTo.map((item) => formatLabel(WORKFLOW_OPTIONS, item)).join(", ")}</small>
                  <small>{formatDate(rule.updatedAt)}</small>
                  <em className={`${styles.severityPill} ${styles[rule.severity]}`}>{rule.severity}</em>
                </button>
                <button
                  className={rule.isEnabled ? styles.enabledToggleOn : styles.enabledToggle}
                  type="button"
                  onClick={() => handleToggleRule(rule)}
                >
                  {rule.isEnabled ? "Enabled" : "Disabled"}
                </button>
              </div>
            ))}
          </div>
        </aside>

        <div className={styles.editorCard}>
          <p className="report-kicker">{selectedRuleId ? "Edit Rule" : "New Rule"}</p>

          <label>Rule title
            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={140} placeholder="Example: Payment changes require regression coverage" />
          </label>

          <label>Category
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {CATEGORY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>

          <label>Severity
            <select value={severity} onChange={(event) => setSeverity(event.target.value)}>
              {SEVERITY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>

          <div className={styles.workflowPicker}>
            <span>Applies to</span>
            <div>
              {WORKFLOW_OPTIONS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={appliesTo.includes(value) ? styles.workflowSelected : ""}
                  onClick={() => toggleWorkflow(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <label className={styles.enabledCheckbox}>
            <input checked={isEnabled} onChange={(event) => setIsEnabled(event.target.checked)} type="checkbox" />
            Enabled for future Brain context
          </label>

          <label>Rule instruction
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={4000}
              placeholder="Describe the team standard. Example: Any payment-related change must include regression coverage for successful payment, declined payment, refund/void behavior, saved cards, and receipt/event logging when relevant."
            />
          </label>

          <div className={styles.editorMeta}>
            <span>{body.length.toLocaleString()} / 4,000 characters</span>
          </div>

          <div className={styles.editorActions}>
            <button disabled={isSaving || !title.trim() || body.trim().length < 12} onClick={handleSaveRule} type="button">
              {isSaving ? "Saving..." : "Save Rule"}
            </button>
            {selectedRuleId ? (
              <button className={styles.dangerButton} disabled={isSaving} onClick={handleDeleteRule} type="button">
                Delete Rule
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
