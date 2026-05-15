"use client";

import { useEffect, useMemo, useState } from "react";
import type { SafeQAProject } from "@/components/ProjectSettingsPanel";

const TEST_CASE_TYPES = ["smoke", "functional", "regression", "edge-case", "accessibility", "security", "performance", "integration", "other"] as const;
const TEST_CASE_PRIORITIES = ["low", "medium", "high", "critical"] as const;
const TEST_CASE_STATUSES = ["draft", "ready", "needs-review", "deprecated"] as const;

type SafeProjectTestCase = {
  id: string;
  userId: string;
  projectId: string;
  title: string;
  testType: string;
  priority: string;
  status: string;
  sourceType: string;
  sourceReportId: string | null;
  sourceJiraKey: string;
  preconditions: string;
  steps: string[];
  expectedResult: string;
  automationReadiness: string;
  qualityScore: number | null;
  tags: string[];
  notes: string;
  structuredData: unknown | null;
  testRailCaseId: number | null;
  testRailProjectId: number | null;
  testRailSuiteId: number | null;
  testRailSectionId: number | null;
  syncStatus: string;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  createdAt: string;
  updatedAt: string;
};

type TestCaseResponse = {
  ok?: boolean;
  error?: string;
  errors?: string[];
  testCases?: SafeProjectTestCase[];
  testCase?: SafeProjectTestCase;
};

type FormState = {
  id: string;
  title: string;
  testType: string;
  priority: string;
  status: string;
  sourceJiraKey: string;
  preconditions: string;
  stepsText: string;
  expectedResult: string;
  automationReadiness: string;
  tagsText: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  id: "",
  title: "",
  testType: "functional",
  priority: "medium",
  status: "draft",
  sourceJiraKey: "",
  preconditions: "",
  stepsText: "",
  expectedResult: "",
  automationReadiness: "",
  tagsText: "",
  notes: "",
};

function formatDate(value: string) {
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

function titleCase(value: string) {
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word.slice(0, 1).toUpperCase() + word.slice(1))
    .join(" ") || value;
}

function splitLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function formFromTestCase(testCase: SafeProjectTestCase): FormState {
  return {
    id: testCase.id,
    title: testCase.title,
    testType: testCase.testType,
    priority: testCase.priority,
    status: testCase.status,
    sourceJiraKey: testCase.sourceJiraKey,
    preconditions: testCase.preconditions,
    stepsText: testCase.steps.join("\n"),
    expectedResult: testCase.expectedResult,
    automationReadiness: testCase.automationReadiness,
    tagsText: testCase.tags.join(", "),
    notes: testCase.notes,
  };
}

function buildPayload(form: FormState) {
  return {
    id: form.id || undefined,
    title: form.title,
    testType: form.testType,
    priority: form.priority,
    status: form.status,
    sourceType: form.id ? "library" : "manual",
    sourceJiraKey: form.sourceJiraKey,
    preconditions: form.preconditions,
    steps: splitLines(form.stepsText),
    expectedResult: form.expectedResult,
    automationReadiness: form.automationReadiness,
    tags: splitTags(form.tagsText),
    notes: form.notes,
    syncStatus: "not_synced",
  };
}

function FieldBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="saved-report-source-details">
      <summary>{label}</summary>
      {children}
    </div>
  );
}

export default function ProjectTestCaseLibraryPanel({ activeProject }: { activeProject: SafeQAProject | null }) {
  const [testCases, setTestCases] = useState<SafeProjectTestCase[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const filteredTestCases = useMemo(() => {
    const query = search.trim().toLowerCase();
    return testCases.filter((testCase) => {
      const matchesQuery = !query || [
        testCase.title,
        testCase.sourceJiraKey,
        testCase.expectedResult,
        testCase.preconditions,
        testCase.tags.join(" "),
      ].join(" ").toLowerCase().includes(query);
      const matchesType = typeFilter === "all" || testCase.testType === typeFilter;
      const matchesStatus = statusFilter === "all" || testCase.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || testCase.priority === priorityFilter;
      return matchesQuery && matchesType && matchesStatus && matchesPriority;
    });
  }, [priorityFilter, search, statusFilter, testCases, typeFilter]);

  const stats = useMemo(() => {
    return {
      total: testCases.length,
      ready: testCases.filter((testCase) => testCase.status === "ready").length,
      draft: testCases.filter((testCase) => testCase.status === "draft").length,
      synced: testCases.filter((testCase) => testCase.syncStatus === "synced").length,
    };
  }, [testCases]);

  useEffect(() => {
    setTestCases([]);
    setForm(EMPTY_FORM);
    setMessage("");
    setError("");

    if (activeProject?.id) {
      void loadTestCases(activeProject.id);
    }
  }, [activeProject?.id]);

  async function loadTestCases(projectId = activeProject?.id ?? "") {
    if (!projectId) return;
    setIsLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/test-cases`);
      const payload = (await response.json().catch(() => null)) as TestCaseResponse | null;

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || "Could not load test cases.");
      }

      setTestCases(payload?.testCases ?? []);
      setMessage(payload?.testCases?.length ? `Loaded ${payload.testCases.length} test case${payload.testCases.length === 1 ? "" : "s"}.` : "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load test cases.");
    } finally {
      setIsLoading(false);
    }
  }

  async function saveTestCase() {
    if (!activeProject?.id) return;
    setIsLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(activeProject.id)}/test-cases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(form)),
      });
      const payload = (await response.json().catch(() => null)) as TestCaseResponse | null;

      if (!response.ok || payload?.ok === false || !payload?.testCase) {
        throw new Error(payload?.error || payload?.errors?.[0] || "Could not save test case.");
      }

      setTestCases((current) => {
        const exists = current.some((item) => item.id === payload.testCase?.id);
        if (exists) return current.map((item) => item.id === payload.testCase?.id ? payload.testCase! : item);
        return [payload.testCase!, ...current];
      });
      setForm(formFromTestCase(payload.testCase));
      setMessage("Test case saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save test case.");
    } finally {
      setIsLoading(false);
    }
  }

  async function deleteTestCase(testCaseId: string) {
    setIsLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/project-test-cases/${encodeURIComponent(testCaseId)}`, { method: "DELETE" });
      const payload = (await response.json().catch(() => null)) as TestCaseResponse | null;

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || "Could not delete test case.");
      }

      setTestCases((current) => current.filter((item) => item.id !== testCaseId));
      if (form.id === testCaseId) setForm(EMPTY_FORM);
      setMessage("Test case deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete test case.");
    } finally {
      setIsLoading(false);
    }
  }

  if (!activeProject) {
    return (
      <section className="saved-reports-panel saved-reports-empty">
        <p className="report-kicker">Test Case Library</p>
        <h2>Select a project first</h2>
        <p>Test cases are project-scoped QA assets. Create or select a project before building your library.</p>
      </section>
    );
  }

  return (
    <section className="saved-reports-panel">
      <div className="saved-reports-header">
        <div>
          <p className="report-kicker">Test Case Library</p>
          <h2>{activeProject.name} coverage library</h2>
          <p>Store reusable test cases separately from Source Vault and Saved Reports. These are QA coverage assets, not product memory.</p>
        </div>
        <button type="button" onClick={() => loadTestCases()} disabled={isLoading}>{isLoading ? "Refreshing..." : "Refresh"}</button>
      </div>

      <div className="saved-reports-stats">
        <div><strong>{stats.total}</strong><span>Total cases</span></div>
        <div><strong>{stats.ready}</strong><span>Ready</span></div>
        <div><strong>{stats.draft}</strong><span>Draft</span></div>
        <div><strong>{stats.synced}</strong><span>Synced</span></div>
      </div>

      <div className="saved-reports-toolbar">
        <label>
          Search
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, tags, Jira key..." />
        </label>
        <label>
          Type
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="all">All types</option>
            {TEST_CASE_TYPES.map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}
          </select>
        </label>
        <label>
          Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All statuses</option>
            {TEST_CASE_STATUSES.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}
          </select>
        </label>
        <label>
          Priority
          <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
            <option value="all">All priorities</option>
            {TEST_CASE_PRIORITIES.map((priority) => <option key={priority} value={priority}>{titleCase(priority)}</option>)}
          </select>
        </label>
      </div>

      {message ? <p className="saved-reports-message">{message}</p> : null}
      {error ? <p className="saved-reports-error">{error}</p> : null}

      <div className="saved-reports-grid">
        <aside className="saved-reports-list-card">
          <p className="report-kicker">Saved Test Cases <span>{filteredTestCases.length} shown</span></p>
          {filteredTestCases.length === 0 ? <p className="saved-reports-muted">No test cases match this filter yet.</p> : null}
          <div className="saved-reports-list">
            {filteredTestCases.map((testCase) => (
              <button
                className={form.id === testCase.id ? "saved-report-list-item saved-report-list-item-active" : "saved-report-list-item"}
                key={testCase.id}
                type="button"
                onClick={() => setForm(formFromTestCase(testCase))}
              >
                <strong>{testCase.title}</strong>
                <span>{titleCase(testCase.testType)} · {titleCase(testCase.priority)} · {titleCase(testCase.status)}</span>
                <small>{testCase.sourceJiraKey ? `${testCase.sourceJiraKey} · ` : ""}{testCase.steps.length} steps · {formatDate(testCase.updatedAt)}</small>
              </button>
            ))}
          </div>
        </aside>

        <article className="saved-report-detail-card">
          <div className="saved-report-detail-top">
            <div>
              <p className="report-kicker">{form.id ? "Edit Test Case" : "New Test Case"}</p>
              <h3>{form.id ? form.title || "Untitled test case" : "Add reusable coverage"}</h3>
            </div>
          </div>

          <div className="saved-reports-toolbar" style={{ gridTemplateColumns: "1fr 0.6fr 0.6fr" }}>
            <label>Title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Example: User can reset password" /></label>
            <label>Type<select value={form.testType} onChange={(event) => setForm({ ...form, testType: event.target.value })}>{TEST_CASE_TYPES.map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}</select></label>
            <label>Priority<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>{TEST_CASE_PRIORITIES.map((priority) => <option key={priority} value={priority}>{titleCase(priority)}</option>)}</select></label>
          </div>

          <div className="saved-reports-toolbar" style={{ gridTemplateColumns: "0.7fr 0.7fr 1fr" }}>
            <label>Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>{TEST_CASE_STATUSES.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}</select></label>
            <label>Jira key<input value={form.sourceJiraKey} onChange={(event) => setForm({ ...form, sourceJiraKey: event.target.value })} placeholder="QAS-123" /></label>
            <label>Tags<input value={form.tagsText} onChange={(event) => setForm({ ...form, tagsText: event.target.value })} placeholder="login, smoke, regression" /></label>
          </div>

          <FieldBlock label="Preconditions">
            <textarea value={form.preconditions} onChange={(event) => setForm({ ...form, preconditions: event.target.value })} placeholder="State, account, data, permissions, or setup needed before test starts..." rows={3} />
          </FieldBlock>

          <FieldBlock label="Steps">
            <textarea value={form.stepsText} onChange={(event) => setForm({ ...form, stepsText: event.target.value })} placeholder="One step per line..." rows={7} />
          </FieldBlock>

          <FieldBlock label="Expected result">
            <textarea value={form.expectedResult} onChange={(event) => setForm({ ...form, expectedResult: event.target.value })} placeholder="What should be true if the test passes?" rows={4} />
          </FieldBlock>

          <FieldBlock label="Automation readiness">
            <textarea value={form.automationReadiness} onChange={(event) => setForm({ ...form, automationReadiness: event.target.value })} placeholder="Automation notes, selectors, data strategy, known blockers..." rows={3} />
          </FieldBlock>

          <FieldBlock label="Notes">
            <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Review notes, coverage notes, or handoff details..." rows={3} />
          </FieldBlock>

          <div className="saved-reports-header" style={{ marginTop: 12 }}>
            <button type="button" onClick={() => setForm(EMPTY_FORM)}>New</button>
            {form.id ? <button type="button" onClick={() => deleteTestCase(form.id)} disabled={isLoading}>Delete</button> : null}
            <button type="button" onClick={saveTestCase} disabled={isLoading}>{isLoading ? "Saving..." : "Save Test Case"}</button>
          </div>
        </article>
      </div>
    </section>
  );
}
