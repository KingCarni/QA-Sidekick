"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
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
  status: "ready",
  sourceJiraKey: "",
  preconditions: "",
  stepsText: "",
  expectedResult: "",
  automationReadiness: "",
  tagsText: "",
  notes: "",
};

const shellCardStyle: CSSProperties = {
  maxWidth: "100%",
  overflow: "hidden",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  borderRadius: 26,
  background:
    "radial-gradient(circle at top left, rgba(239, 68, 68, 0.12), transparent 34%), linear-gradient(145deg, rgba(8, 11, 19, 0.98), rgba(0, 0, 0, 0.96))",
  padding: "40px 28px 28px",
};

const toolbarStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(180px, 1.15fr) repeat(3, minmax(120px, 0.75fr))",
  gap: 14,
  alignItems: "end",
  border: "1px solid rgba(96, 165, 250, 0.16)",
  borderRadius: 20,
  background: "rgba(15, 23, 42, 0.52)",
  padding: 16,
  margin: "20px 0",
};

const editorGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(220px, 0.72fr) minmax(0, 1.28fr)",
  gap: 18,
  alignItems: "start",
  maxWidth: "100%",
};

const visibleTenListStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  maxHeight: 940,
  overflowY: "auto",
  overflowX: "hidden",
  paddingRight: 6,
};

const formSingleRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: 12,
};

const formTwoColumnStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
  marginTop: 12,
};

const formThreeColumnStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 12,
  marginTop: 12,
};

const fieldLabelStyle: CSSProperties = {
  display: "grid",
  gap: 7,
  minWidth: 0,
  color: "#fca5a5",
  fontSize: "0.74rem",
  fontWeight: 900,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
};

const fieldControlStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
  color: "#f8fafc",
  background: "rgba(3, 7, 18, 0.88)",
  border: "1px solid rgba(96, 165, 250, 0.22)",
  borderRadius: 12,
  outline: "none",
  padding: "11px 12px",
  fontSize: "0.92rem",
  fontWeight: 650,
  letterSpacing: 0,
  textTransform: "none",
  boxShadow: "inset 0 12px 30px rgba(0, 0, 0, 0.28)",
};

const textareaStyle: CSSProperties = {
  ...fieldControlStyle,
  resize: "vertical",
  lineHeight: 1.5,
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

function FieldLabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={fieldLabelStyle}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function FieldBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ ...fieldLabelStyle, marginTop: 14 }}>
      <span>{label}</span>
      {children}
    </label>
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
    <section className="qatalyst-testcase-library" style={shellCardStyle}>
      <style>{`
        .qatalyst-testcase-library option {
          color: #111827;
          background: #ffffff;
        }
        .qatalyst-testcase-library input,
        .qatalyst-testcase-library select,
        .qatalyst-testcase-library textarea {
          max-width: 100%;
        }
        .qatalyst-testcase-library .saved-reports-header h2 {
          margin-top: 8px;
          line-height: 1.02;
        }
        .qatalyst-testcase-library .saved-reports-list::-webkit-scrollbar {
          width: 9px;
        }
        .qatalyst-testcase-library .saved-reports-list::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.5);
          border-radius: 999px;
        }
        @media (max-width: 1100px) {
          .qatalyst-testcase-library-toolbar,
          .qatalyst-testcase-library-editor,
          .qatalyst-testcase-form-two,
          .qatalyst-testcase-form-three {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
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

      <div className="qatalyst-testcase-library-toolbar" style={toolbarStyle}>
        <FieldLabel label="Search">
          <input style={fieldControlStyle} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, tags, Jira key..." />
        </FieldLabel>
        <FieldLabel label="Type">
          <select style={fieldControlStyle} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="all">All types</option>
            {TEST_CASE_TYPES.map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}
          </select>
        </FieldLabel>
        <FieldLabel label="Status">
          <select style={fieldControlStyle} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All statuses</option>
            {TEST_CASE_STATUSES.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}
          </select>
        </FieldLabel>
        <FieldLabel label="Priority">
          <select style={fieldControlStyle} value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
            <option value="all">All priorities</option>
            {TEST_CASE_PRIORITIES.map((priority) => <option key={priority} value={priority}>{titleCase(priority)}</option>)}
          </select>
        </FieldLabel>
      </div>

      {message ? <p className="saved-reports-message">{message}</p> : null}
      {error ? <p className="saved-reports-error">{error}</p> : null}

      <div className="qatalyst-testcase-library-editor" style={editorGridStyle}>
        <aside className="saved-reports-list-card" style={{ minWidth: 0 }}>
          <p className="report-kicker">Saved Test Cases <span>{filteredTestCases.length} shown</span></p>
          {filteredTestCases.length > 10 ? (
            <p className="saved-reports-muted" style={{ marginTop: -6 }}>
              Showing 10 at a time. Scroll this list to view all matching cases.
            </p>
          ) : null}
          {filteredTestCases.length === 0 ? <p className="saved-reports-muted">No test cases match this filter yet.</p> : null}
          <div className="saved-reports-list" style={visibleTenListStyle}>
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

        <article className="saved-report-detail-card" style={{ minWidth: 0, overflow: "hidden" }}>
          <div className="saved-report-detail-top">
            <div>
              <p className="report-kicker">{form.id ? "Edit Test Case" : "New Test Case"}</p>
              <h3>{form.id ? form.title || "Untitled test case" : "Add reusable coverage"}</h3>
            </div>
          </div>

          <div style={formSingleRowStyle}>
            <FieldLabel label="Title">
              <input style={fieldControlStyle} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Example: User can complete checkout" />
            </FieldLabel>
          </div>

          <div className="qatalyst-testcase-form-three" style={formThreeColumnStyle}>
            <FieldLabel label="Type">
              <select style={fieldControlStyle} value={form.testType} onChange={(event) => setForm({ ...form, testType: event.target.value })}>{TEST_CASE_TYPES.map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}</select>
            </FieldLabel>
            <FieldLabel label="Priority">
              <select style={fieldControlStyle} value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>{TEST_CASE_PRIORITIES.map((priority) => <option key={priority} value={priority}>{titleCase(priority)}</option>)}</select>
            </FieldLabel>
            <FieldLabel label="Status">
              <select style={fieldControlStyle} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>{TEST_CASE_STATUSES.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}</select>
            </FieldLabel>
          </div>

          <div className="qatalyst-testcase-form-two" style={formTwoColumnStyle}>
            <FieldLabel label="Jira key">
              <input style={fieldControlStyle} value={form.sourceJiraKey} onChange={(event) => setForm({ ...form, sourceJiraKey: event.target.value })} placeholder="QAS-123" />
            </FieldLabel>
            <FieldLabel label="Tags">
              <input style={fieldControlStyle} value={form.tagsText} onChange={(event) => setForm({ ...form, tagsText: event.target.value })} placeholder="checkout, smoke, regression" />
            </FieldLabel>
          </div>

          <FieldBlock label="Preconditions">
            <textarea style={textareaStyle} value={form.preconditions} onChange={(event) => setForm({ ...form, preconditions: event.target.value })} placeholder="State, account, data, permissions, or setup needed before test starts..." rows={3} />
          </FieldBlock>

          <FieldBlock label="Steps">
            <textarea style={textareaStyle} value={form.stepsText} onChange={(event) => setForm({ ...form, stepsText: event.target.value })} placeholder="One step per line..." rows={7} />
          </FieldBlock>

          <FieldBlock label="Expected result">
            <textarea style={textareaStyle} value={form.expectedResult} onChange={(event) => setForm({ ...form, expectedResult: event.target.value })} placeholder="What should be true if the test passes?" rows={4} />
          </FieldBlock>

          <FieldBlock label="Automation readiness">
            <textarea style={textareaStyle} value={form.automationReadiness} onChange={(event) => setForm({ ...form, automationReadiness: event.target.value })} placeholder="Automation notes, selectors, data strategy, known blockers..." rows={3} />
          </FieldBlock>

          <FieldBlock label="Notes">
            <textarea style={textareaStyle} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Review notes, coverage notes, or handoff details..." rows={3} />
          </FieldBlock>

          <div className="saved-reports-header" style={{ marginTop: 16 }}>
            <button type="button" onClick={() => setForm(EMPTY_FORM)}>New</button>
            {form.id ? <button type="button" onClick={() => deleteTestCase(form.id)} disabled={isLoading}>Delete</button> : null}
            <button type="button" onClick={saveTestCase} disabled={isLoading}>{isLoading ? "Saving..." : "Save Test Case"}</button>
          </div>
        </article>
      </div>
    </section>
  );
}
