"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import BugCollectionPanel from "@/components/BugCollectionPanel";
import CreditsPill from "@/components/CreditsPill";
import ProjectRisksPanel from "@/components/ProjectRisksPanel";
import ProjectRulesPanel from "@/components/ProjectRulesPanel";
import ProjectSettingsPanel, { type SafeQAProject } from "@/components/ProjectSettingsPanel";
import ProjectSourceVaultPanel from "@/components/ProjectSourceVaultPanel";
import ProjectTerminologyPanel from "@/components/ProjectTerminologyPanel";
import QAtGuideCard from "@/components/QAtGuideCard";

type BrainTabId =
  | "overview"
  | "projects"
  | "sources"
  | "bugs"
  | "reports"
  | "rules"
  | "terminology"
  | "risks"
  | "features"
  | "integrations";

type BrainTab = {
  id: BrainTabId;
  label: string;
  eyebrow: string;
  title: string;
  body: string;
};

type ProjectsApiResponse = {
  ok?: boolean;
  error?: string;
  projects?: SafeQAProject[];
};

type SafeQAReport = {
  id: string;
  projectId: string | null;
  type: string;
  title: string | null;
  markdown: string | null;
  sourceInput: string | null;
  createdAt: string;
  updatedAt: string;
};

type ReportsApiResponse = {
  ok?: boolean;
  error?: string;
  reports?: SafeQAReport[];
};

const ACTIVE_PROJECT_STORAGE_KEY = "qatalyst.activeProjectId";

const BRAIN_TABS: BrainTab[] = [
  {
    id: "overview",
    label: "Overview",
    eyebrow: "Brain overview",
    title: "Give QAtalyst a reusable memory of your product.",
    body:
      "Project Brain is where project context, reusable sources, saved reports, team QA rules, terminology, risks, bug collections, features, and integrations live.",
  },
  {
    id: "projects",
    label: "Projects",
    eyebrow: "Project foundation",
    title: "Create the project containers your QA memory attaches to.",
    body:
      "Projects hold source memories, saved reports, saved bugs, Jira links, generated QA outputs, and product context.",
  },
  {
    id: "sources",
    label: "Source Vault",
    eyebrow: "Reusable context",
    title: "Store the source material QAtalyst should reuse.",
    body:
      "Use Source Vault for specs, product notes, saved outputs, imported context, important links, and release notes that should ground future QA work.",
  },
  {
    id: "bugs",
    label: "Bug Collection",
    eyebrow: "Saved defects",
    title: "Keep saved Bug Writer outputs attached to the right project.",
    body:
      "Bug Collection stores generated or saved defects separately from reusable source memory, so triage output does not pollute your product context.",
  },
  {
    id: "reports",
    label: "Saved Reports",
    eyebrow: "Generated artifacts",
    title: "Review saved QA reports and generated artifacts.",
    body:
      "Saved Reports keeps generated test plans, risk reviews, improved test cases, and other outputs available from the same project workspace.",
  },
  {
    id: "rules",
    label: "QA Rules",
    eyebrow: "Team standards",
    title: "Capture how your team expects QA work to be written.",
    body:
      "Document release gates, severity rules, coverage expectations, automation preferences, edge-case standards, and team-specific instructions.",
  },
  {
    id: "terminology",
    label: "Terminology",
    eyebrow: "Product language",
    title: "Teach QAtalyst your product vocabulary.",
    body:
      "Define acronyms, user roles, domain terms, feature names, naming conventions, and language that should appear consistently in generated QA artifacts.",
  },
  {
    id: "risks",
    label: "Risks / Hotspots",
    eyebrow: "Known fragile areas",
    title: "Track the areas that deserve extra QA attention.",
    body:
      "Record regression hotspots, historical bug patterns, risky systems, known integration traps, and release blockers that should influence future test planning.",
  },
  {
    id: "features",
    label: "Feature Registry",
    eyebrow: "Product map",
    title: "Build a lightweight map of what exists and what is coming.",
    body:
      "Track shipped features, planned work, active product areas, and in-progress changes so QAtalyst can reason with better product awareness.",
  },
  {
    id: "integrations",
    label: "Integrations",
    eyebrow: "Connected workflow",
    title: "Connect the tools that feed and receive QA work.",
    body:
      "Jira and TestRail belong here as workflow integrations inside Project Brain, not as the main project setup mental model.",
  },
];

const BRAIN_TAB_IDS = new Set<BrainTabId>(BRAIN_TABS.map((tab) => tab.id));

function normalizeBrainTab(value: string | null): BrainTabId {
  return value && BRAIN_TAB_IDS.has(value as BrainTabId) ? (value as BrainTabId) : "overview";
}

const BRAIN_STATUS_CARDS = [
  { label: "Projects", value: "Live", text: "Project containers now live in Brain." },
  { label: "Source Vault", value: "Live", text: "Reusable context and saved project sources." },
  { label: "Bug Collection", value: "Live", text: "Saved defects now live in Brain." },
  { label: "Saved Reports", value: "Foundation", text: "Report history shell now lives in Brain." },
  { label: "QA Rules", value: "Live", text: "Team standards and release expectations now influence Brain context." },
  { label: "Terminology", value: "Live", text: "Project vocabulary and aliases now influence Brain context." },
  { label: "Risks / Hotspots", value: "Live", text: "Known fragile areas now influence Brain context." },
  { label: "Feature Registry", value: "Live", text: "Feature lifecycle context now influences Brain context." },
  { label: "Integrations", value: "Available", text: "Jira and TestRail setup lives here." },
];

function formatReportDate(value: string) {
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

function labelForReportType(type: string) {
  return type
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word.slice(0, 1).toUpperCase() + word.slice(1))
    .join(" ") || "Report";
}

function BrainHeroAccount() {
  const { data: session, status } = useSession();
  const displayName = session?.user?.email ?? session?.user?.name ?? "Not signed in";

  return (
    <aside className="brain-native-account" aria-label="Brain account controls">
      <img className="brain-native-logo" src="/qatalyst-header.png" alt="QAtalyst" />

      <div className="brain-native-user">
        <span>{session?.user ? "Signed in" : "Account"}</span>
        <strong>{status === "loading" ? "Loading account…" : displayName}</strong>
      </div>

      <div className="brain-native-actions">
        <Link className="brain-native-menu" href="/app">
          Menu
        </Link>

        {session?.user ? (
          <>
            <div className="brain-native-credits">
              <CreditsPill />
            </div>
            <Link className="brain-native-account-link" href="/account">
              Account
            </Link>
            <button className="brain-native-ghost" type="button" onClick={() => signOut()}>
              Sign out
            </button>
          </>
        ) : (
          <button className="brain-native-primary" type="button" onClick={() => signIn("google")}>
            Sign in
          </button>
        )}
      </div>
    </aside>
  );
}

function SavedReportsPanel({ activeProject }: { activeProject: SafeQAProject | null }) {
  const [reports, setReports] = useState<SafeQAReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedReport = useMemo(
    () => reports.find((report) => report.id === selectedReportId) ?? reports[0] ?? null,
    [reports, selectedReportId]
  );

  const reportTypes = useMemo(() => {
    return Array.from(new Set(reports.map((report) => report.type).filter(Boolean))).sort();
  }, [reports]);

  const filteredReports = useMemo(() => {
    if (typeFilter === "all") return reports;
    return reports.filter((report) => report.type === typeFilter);
  }, [reports, typeFilter]);

  useEffect(() => {
    setReports([]);
    setSelectedReportId("");
    setMessage("");
    setError("");

    if (activeProject?.id) {
      void loadReports(activeProject.id);
    }
  }, [activeProject?.id]);

  async function loadReports(projectId: string) {
    setIsLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/reports`);
      const payload = (await response.json().catch(() => null)) as ReportsApiResponse | null;

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || "Could not load saved reports.");
      }

      const nextReports = payload?.reports ?? [];
      setReports(nextReports);
      setSelectedReportId(nextReports[0]?.id ?? "");
      setMessage(nextReports.length ? `Loaded ${nextReports.length} saved report${nextReports.length === 1 ? "" : "s"}.` : "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load saved reports.");
    } finally {
      setIsLoading(false);
    }
  }

  if (!activeProject) {
    return (
      <section className="saved-reports-panel saved-reports-empty">
        <p className="report-kicker">Saved Reports</p>
        <h2>Select a project first</h2>
        <p>Saved reports attach to a project. Create or select a project before reviewing generated QA artifacts.</p>
      </section>
    );
  }

  return (
    <section className="saved-reports-panel">
      <div className="saved-reports-header">
        <div>
          <p className="report-kicker">Saved Reports</p>
          <h2>{activeProject.name} reports</h2>
          <p>Review generated QA artifacts that were saved against this project.</p>
        </div>

        <button type="button" onClick={() => loadReports(activeProject.id)} disabled={isLoading}>
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="saved-reports-stats">
        <div><strong>{reports.length}</strong><span>Total reports</span></div>
        <div><strong>{reportTypes.length}</strong><span>Report types</span></div>
        <div><strong>{filteredReports.length}</strong><span>Visible</span></div>
      </div>

      <div className="saved-reports-toolbar">
        <label>
          Type
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="all">All</option>
            {reportTypes.map((type) => (
              <option key={type} value={type}>{labelForReportType(type)}</option>
            ))}
          </select>
        </label>
      </div>

      {message ? <p className="saved-reports-message">{message}</p> : null}
      {error ? <p className="saved-reports-error">{error}</p> : null}

      <div className="saved-reports-grid">
        <aside className="saved-reports-list-card">
          <p className="report-kicker">Report History</p>

          {isLoading ? <p className="saved-reports-muted">Loading reports...</p> : null}
          {!isLoading && filteredReports.length === 0 ? (
            <p className="saved-reports-muted">No saved reports match this filter yet.</p>
          ) : null}

          <div className="saved-reports-list">
            {filteredReports.map((report) => (
              <button
                className={report.id === selectedReport?.id ? "saved-report-list-item saved-report-list-item-active" : "saved-report-list-item"}
                key={report.id}
                type="button"
                onClick={() => setSelectedReportId(report.id)}
              >
                <strong>{report.title || labelForReportType(report.type)}</strong>
                <span>{labelForReportType(report.type)}</span>
                <small>{formatReportDate(report.updatedAt || report.createdAt)}</small>
              </button>
            ))}
          </div>
        </aside>

        <article className="saved-report-detail-card">
          {selectedReport ? (
            <>
              <div className="saved-report-detail-top">
                <div>
                  <p className="report-kicker">Selected Report</p>
                  <h3>{selectedReport.title || labelForReportType(selectedReport.type)}</h3>
                  <p>{labelForReportType(selectedReport.type)} · {formatReportDate(selectedReport.updatedAt || selectedReport.createdAt)}</p>
                </div>
              </div>

              {selectedReport.markdown ? (
                <div className="saved-report-markdown-preview">
                  <pre>{selectedReport.markdown}</pre>
                </div>
              ) : (
                <p className="saved-reports-muted">No markdown saved for this report.</p>
              )}

              {selectedReport.sourceInput ? (
                <details className="saved-report-source-details">
                  <summary>View original source input</summary>
                  <pre>{selectedReport.sourceInput}</pre>
                </details>
              ) : null}
            </>
          ) : (
            <p className="saved-reports-muted">Select a report to view details.</p>
          )}
        </article>
      </div>
    </section>
  );
}

export default function BrainPage() {
  const { status } = useSession();
  const [activeTab, setActiveTab] = useState<BrainTabId>("overview");
  const [activeProject, setActiveProject] = useState<SafeQAProject | null>(null);
  const [isLoadingActiveProject, setIsLoadingActiveProject] = useState(false);
  const [activeProjectError, setActiveProjectError] = useState("");

  const active = useMemo(
    () => BRAIN_TABS.find((tab) => tab.id === activeTab) ?? BRAIN_TABS[0],
    [activeTab]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const nextTab = normalizeBrainTab(new URLSearchParams(window.location.search).get("tab"));
    setActiveTab(nextTab);
  }, []);

  function selectBrainTab(tabId: BrainTabId) {
    setActiveTab(tabId);

    if (typeof window === "undefined") return;

    const nextUrl = tabId === "overview" ? "/brain" : `/brain?tab=${tabId}`;
    window.history.replaceState(null, "", nextUrl);
  }

  useEffect(() => {
    if (status !== "authenticated") {
      setActiveProject(null);
      setActiveProjectError("");
      return;
    }

    let cancelled = false;

    async function loadInitialActiveProject() {
      setIsLoadingActiveProject(true);
      setActiveProjectError("");

      try {
        const response = await fetch("/api/projects");
        const payload = (await response.json().catch(() => null)) as ProjectsApiResponse | null;

        if (!response.ok || payload?.ok === false) {
          throw new Error(payload?.error || "Could not load projects.");
        }

        if (cancelled) return;

        const projects = payload?.projects ?? [];

        if (projects.length === 0) {
          setActiveProject(null);
          return;
        }

        const savedProjectId = typeof window !== "undefined" ? window.localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY) : null;
        const nextActiveProject = projects.find((project) => project.id === savedProjectId) ?? projects[0];

        setActiveProject(nextActiveProject);

        if (typeof window !== "undefined") {
          window.localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, nextActiveProject.id);
        }
      } catch (error) {
        if (!cancelled) {
          setActiveProjectError(error instanceof Error ? error.message : "Could not load projects.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingActiveProject(false);
        }
      }
    }

    void loadInitialActiveProject();

    return () => {
      cancelled = true;
    };
  }, [status]);

  function handleActiveProjectChange(project: SafeQAProject | null) {
    setActiveProject(project);

    if (typeof window === "undefined") return;

    if (project?.id) {
      window.localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, project.id);
    } else {
      window.localStorage.removeItem(ACTIVE_PROJECT_STORAGE_KEY);
    }
  }

  return (
    <main className="qatalyst-brain-shell">
      <section className="brain-hero-shell" aria-label="Project Brain command center">
        <div className="brain-hero-copy">
          <div className="brain-breadcrumb-row">
            <Link href="/app">QAtalyst app</Link>
            <span>/</span>
            <strong>Project Brain</strong>
          </div>

          <p className="brain-eyebrow">Project Brain · Reusable context · Workflow intelligence</p>
          <h1>Project Brain gives QAtalyst product memory.</h1>
          <p>
            Configure the context, sources, rules, terms, risks, bug collections, saved reports, features, and integrations that keep generated QA work grounded in your actual product.
          </p>

          <div className="brain-hero-actions">
            <Link className="brain-primary-link" href="/app">
              Back to toolbelt
            </Link>
          </div>
        </div>

        <BrainHeroAccount />
      </section>

      <QAtGuideCard
        className="qat-ftue-card brain-qat-guide"
        eyebrow="QAt setup guide"
        title="Start with your project memory."
        body="Brain now owns reusable project context. Create/select a project, add source notes or docs, capture team QA rules, define terminology, track risks, map features, keep saved defects in Bug Collection, and review generated artifacts in Saved Reports."
        primaryAction={{ label: "Open Risks", onClick: () => selectBrainTab("risks") }}
        secondaryAction={{ label: "Feature Registry", onClick: () => selectBrainTab("features") }}
      />

      <section className="brain-workspace">
        <nav className="brain-tab-rail" aria-label="Project Brain sections">
          {BRAIN_TABS.map((tab) => (
            <button key={tab.id} className={activeTab === tab.id ? "active" : ""} type="button" onClick={() => selectBrainTab(tab.id)}>
              <span>{tab.eyebrow}</span>
              <strong>{tab.label}</strong>
            </button>
          ))}
        </nav>

        <section className="brain-panel" aria-live="polite">
          <div className="brain-panel-header">
            <p>{active.eyebrow}</p>
            <h2>{active.title}</h2>
            <span>{active.body}</span>
          </div>

          {activeProjectError ? (
            <div className="brain-active-project-strip brain-active-project-error">
              <div>
                <p className="brain-mini-eyebrow">Project load issue</p>
                <strong>{activeProjectError}</strong>
                <span>Open Projects to choose or create a workspace.</span>
              </div>
            </div>
          ) : null}

          {isLoadingActiveProject ? (
            <div className="brain-active-project-strip">
              <div>
                <p className="brain-mini-eyebrow">Project Brain</p>
                <strong>Loading active project…</strong>
                <span>QAtalyst is finding your most recent project workspace.</span>
              </div>
            </div>
          ) : null}

          {activeTab === "overview" ? (
            <div className="brain-overview-grid">
              {BRAIN_STATUS_CARDS.map((card) => (
                <article className="brain-status-card" key={card.label}>
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                  <p>{card.text}</p>
                </article>
              ))}

              <article className="brain-next-step-card">
                <p>Recommended next step</p>
                <h3>Move reusable context, team rules, terminology, risks, features, saved defects, and reports into Brain.</h3>
                <span>Create/select a project, then manage Source Vault, QA Rules, Terminology, Risks, Feature Registry, Bug Collection, and Saved Reports from one setup hub.</span>
                <button type="button" onClick={() => selectBrainTab(activeProject ? "risks" : "projects")}>
                  {activeProject ? "Open Risks" : "Set up project"}
                </button>
              </article>
            </div>
          ) : null}

          {activeTab === "projects" ? (
            <section className="brain-live-section">
              <ProjectSettingsPanel
                activeProjectId={activeProject?.id}
                onActiveProjectChange={handleActiveProjectChange}
              />
            </section>
          ) : null}

          {activeTab === "sources" ? (
            <section className="brain-live-section">
              <ProjectSourceVaultPanel activeProject={activeProject} />
            </section>
          ) : null}

          {activeTab === "bugs" ? (
            <section className="brain-live-section">
              <BugCollectionPanel activeProject={activeProject} />
            </section>
          ) : null}

          {activeTab === "reports" ? (
            <section className="brain-live-section">
              <SavedReportsPanel activeProject={activeProject} />
            </section>
          ) : null}

          {activeTab === "rules" ? (
            <section className="brain-live-section">
              <ProjectRulesPanel activeProject={activeProject} />
            </section>
          ) : null}

          {activeTab === "terminology" ? (
            <section className="brain-live-section">
              <ProjectTerminologyPanel activeProject={activeProject} />
            </section>
          ) : null}

          {activeTab === "risks" ? (
            <section className="brain-live-section">
              <ProjectRisksPanel activeProject={activeProject} mode="risks" />
            </section>
          ) : null}

          {activeTab === "features" ? (
            <section className="brain-live-section">
              <ProjectRisksPanel activeProject={activeProject} mode="features" />
            </section>
          ) : null}

          {activeTab === "integrations" ? (
            <div className="brain-integrations-grid">
              <article className="brain-integration-card">
                <div>
                  <p>Jira integration</p>
                  <h3>Pull tickets and create Jira-ready QA work.</h3>
                  <span>Jira setup stays available as an integration surface while Brain remains the primary workspace.</span>
                </div>
                <Link href="/jira/settings">Open Jira settings</Link>
              </article>

              <article className="brain-integration-card">
                <div>
                  <p>TestRail integration</p>
                  <h3>Keep generated test coverage close to test management.</h3>
                  <span>TestRail-ready output and sync controls should live here as part of the workflow setup story.</span>
                </div>
                <Link href="/jira/settings">Open TestRail settings</Link>
              </article>

              <article className="brain-integration-card muted">
                <div>
                  <p>Future integrations</p>
                  <h3>GitHub, Linear, Notion, Confluence, and more.</h3>
                  <span>Brain should remain the stable home for connected workflow tools as QAtalyst grows.</span>
                </div>
                <button type="button" disabled>
                  Planned
                </button>
              </article>
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}
