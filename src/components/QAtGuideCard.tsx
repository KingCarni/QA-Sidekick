"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";

type QAtGuideAction = {
  label: string;
  onClick: () => void;
};

export type QAtGuideCardProps = {
  eyebrow?: string;
  title: string;
  body: string;
  imageSrc?: string;
  videoSrc?: string;
  primaryAction?: QAtGuideAction;
  secondaryAction?: QAtGuideAction;
  onDismiss?: () => void;
  className?: string;
  compact?: boolean;
  children?: ReactNode;
};

type BrainStepId = "brain" | "project" | "sources" | "jira" | "testrail" | "toolbelt";

type BrainStep = {
  id: BrainStepId;
  shortLabel: string;
  title: string;
  body: string;
  tab?: string;
  cta: string;
};

type BrainStatus = {
  isLoading: boolean;
  activeProjectName: string;
  hasProject: boolean;
  enabledSourceCount: number;
  hasSources: boolean;
  jiraConfigured: boolean;
  testRailConfigured: boolean;
  error: string;
};

type BrainRecommendation = {
  label: string;
  body: string;
  tab?: string;
  kind: "required" | "recommended" | "ready";
};

const ACTIVE_PROJECT_STORAGE_KEY = "qatalyst.activeProjectId";
const BRAIN_STEP_STORAGE_KEY = "qatalyst.brain-ftue-step";
const BRAIN_COMPLETE_STORAGE_KEY = "qatalyst.brain-ftue-complete";

const BRAIN_STEPS: BrainStep[] = [
  {
    id: "brain",
    shortLabel: "Brain",
    title: "Let’s set up your QA memory.",
    body: "I’ll help you configure the pieces QAtalyst needs to reuse project context safely before you head back to the toolbelt.",
    tab: "overview",
    cta: "Start setup",
  },
  {
    id: "project",
    shortLabel: "Project",
    title: "Create or select a project workspace.",
    body: "Projects keep sources, reports, bugs, rules, and integrations scoped to the right signed-in account and product.",
    tab: "projects",
    cta: "Open Projects",
  },
  {
    id: "sources",
    shortLabel: "Sources",
    title: "Add reusable source context.",
    body: "Source Vault stores product notes, specs, acceptance rules, release docs, and imported text so generated QA work stays grounded.",
    tab: "sources",
    cta: "Open Source Vault",
  },
  {
    id: "jira",
    shortLabel: "Jira",
    title: "Connect Jira for ticket-driven QA.",
    body: "Jira setup lets QAtalyst fetch tickets and prepare handoff-ready QA work from real issue context.",
    tab: "integrations",
    cta: "Open Integrations",
  },
  {
    id: "testrail",
    shortLabel: "TestRail",
    title: "Connect TestRail for coverage handoff.",
    body: "TestRail setup gives generated test cases a clearer path toward test management and future sync workflows.",
    tab: "integrations",
    cta: "Review TestRail",
  },
  {
    id: "toolbelt",
    shortLabel: "Toolbelt",
    title: "Brain is ready. Generate a first QA run.",
    body: "Your core Brain setup is complete. Go back to the toolbelt and run a small generation to verify the workflow.",
    cta: "Go to Toolbelt",
  },
];

const initialBrainStatus: BrainStatus = {
  isLoading: true,
  activeProjectName: "",
  hasProject: false,
  enabledSourceCount: 0,
  hasSources: false,
  jiraConfigured: false,
  testRailConfigured: false,
  error: "",
};

function clampStep(index: number) {
  return Math.min(Math.max(index, 0), BRAIN_STEPS.length - 1);
}

function isStepComplete(stepId: BrainStepId, status: BrainStatus) {
  if (stepId === "brain") return true;
  if (stepId === "project") return status.hasProject;
  if (stepId === "sources") return status.hasSources;
  if (stepId === "jira") return status.jiraConfigured;
  if (stepId === "testrail") return status.testRailConfigured;
  if (stepId === "toolbelt") return isBrainComplete(status);
  return false;
}

function isBrainComplete(status: BrainStatus) {
  return status.hasProject && status.hasSources && status.jiraConfigured && status.testRailConfigured;
}

function nextMissingStepIndex(status: BrainStatus) {
  const index = BRAIN_STEPS.findIndex((step) => !isStepComplete(step.id, status));
  return index >= 0 ? index : BRAIN_STEPS.length - 1;
}

function readBooleanPath(payload: unknown, path: string[]) {
  let current: unknown = payload;

  for (const segment of path) {
    if (!current || typeof current !== "object" || !(segment in current)) return false;
    current = (current as Record<string, unknown>)[segment];
  }

  return Boolean(current);
}

async function getJson(url: string) {
  const response = await fetch(url, { method: "GET", cache: "no-store" });
  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `Could not load ${url}.`);
  }

  return payload;
}

async function loadBrainStatus(): Promise<BrainStatus> {
  const projectsPayload = await getJson("/api/projects");
  const projects = Array.isArray(projectsPayload?.projects) ? projectsPayload.projects : [];
  const savedProjectId = typeof window !== "undefined" ? window.localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY) : null;
  const activeProject =
    projects.find((project: Record<string, unknown>) => project.id === savedProjectId) ?? projects[0] ?? null;
  const activeProjectId = typeof activeProject?.id === "string" ? activeProject.id : "";
  const activeProjectName = typeof activeProject?.name === "string" ? activeProject.name : "";

  let enabledSourceCount = 0;

  if (activeProjectId) {
    const sourcePayload = await getJson(`/api/projects/${encodeURIComponent(activeProjectId)}/sources`);
    const sources = Array.isArray(sourcePayload?.sources) ? sourcePayload.sources : [];
    enabledSourceCount = sources.filter((source: Record<string, unknown>) => Boolean(source.isEnabled)).length;
  }

  const [jiraResult, testRailResult] = await Promise.allSettled([
    getJson("/api/jira/config"),
    getJson("/api/testrail/config"),
  ]);

  const jiraPayload = jiraResult.status === "fulfilled" ? jiraResult.value : null;
  const testRailPayload = testRailResult.status === "fulfilled" ? testRailResult.value : null;

  return {
    isLoading: false,
    activeProjectName,
    hasProject: Boolean(activeProjectId),
    enabledSourceCount,
    hasSources: enabledSourceCount > 0,
    jiraConfigured: readBooleanPath(jiraPayload, ["jira", "configured"]),
    testRailConfigured: readBooleanPath(testRailPayload, ["testrail", "configured"]),
    error: "",
  };
}

function setBrainTab(tab: string) {
  const nextUrl = tab === "overview" ? "/brain" : `/brain?tab=${tab}`;
  window.history.replaceState(null, "", nextUrl);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function useRightRailMode() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    function sync() {
      setEnabled(window.innerWidth >= 1620);
    }

    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  return enabled;
}

function getRecommendations(status: BrainStatus): BrainRecommendation[] {
  if (!status.hasProject) {
    return [
      {
        label: "Create/select a project first",
        body: "Brain needs a project workspace before sources, rules, reports, and integrations can be scoped safely.",
        tab: "projects",
        kind: "required",
      },
    ];
  }

  const items: BrainRecommendation[] = [];

  if (!status.hasSources) {
    items.push({
      label: "Add at least one enabled source",
      body: "Source Vault gives QAtalyst reusable product context, so generated QA work does not start from a blank prompt.",
      tab: "sources",
      kind: "required",
    });
  } else if (status.enabledSourceCount < 2) {
    items.push({
      label: "Add one more source for stronger context",
      body: "A product overview plus requirements/spec notes will produce more grounded output.",
      tab: "sources",
      kind: "recommended",
    });
  }

  if (!status.jiraConfigured) {
    items.push({
      label: "Connect Jira for ticket-driven workflows",
      body: "Jira lets QAtalyst fetch real ticket context and prepare work that is easier to hand back to your team.",
      tab: "integrations",
      kind: "recommended",
    });
  }

  if (!status.testRailConfigured) {
    items.push({
      label: status.jiraConfigured ? "Connect TestRail after Jira" : "Plan TestRail setup before release handoff",
      body: "TestRail setup gives generated coverage a clearer path toward test management and future sync workflows.",
      tab: "integrations",
      kind: "recommended",
    });
  }

  if (isBrainComplete(status)) {
    items.push({
      label: "Brain setup is complete",
      body: "Project, source context, Jira, and TestRail are configured. Head to the toolbelt and run a small test case generation.",
      kind: "ready",
    });
  }

  return items.slice(0, 2);
}

function BrainQAtCompanion({ imageSrc, videoSrc }: { imageSrc: string; videoSrc?: string }) {
  const rightRailMode = useRightRailMode();
  const [stepIndex, setStepIndex] = useState(0);
  const [status, setStatus] = useState<BrainStatus>(initialBrainStatus);
  const [setupCompleteDismissed, setSetupCompleteDismissed] = useState(false);
  const setupComplete = isBrainComplete(status);
  const step = BRAIN_STEPS[stepIndex] ?? BRAIN_STEPS[0];
  const currentStepComplete = isStepComplete(step.id, status);
  const recommendations = useMemo(() => getRecommendations(status), [status]);
  const completedCount = useMemo(() => BRAIN_STEPS.filter((item) => isStepComplete(item.id, status)).length, [status]);
  const progressPercent = Math.round((completedCount / BRAIN_STEPS.length) * 100);

  async function refreshStatus(syncToNextMissing = false) {
    setStatus((current) => ({ ...current, isLoading: true, error: "" }));

    try {
      const nextStatus = await loadBrainStatus();
      const complete = isBrainComplete(nextStatus);
      setStatus(nextStatus);

      if (complete) {
        window.localStorage.setItem(BRAIN_COMPLETE_STORAGE_KEY, "true");
        setSetupCompleteDismissed(true);
      }

      if (syncToNextMissing && !complete) {
        const nextIndex = nextMissingStepIndex(nextStatus);
        setStepIndex(nextIndex);
        const nextStep = BRAIN_STEPS[nextIndex];
        if (nextStep.tab) setBrainTab(nextStep.tab);
      }
    } catch (error) {
      setStatus((current) => ({
        ...current,
        isLoading: false,
        error: error instanceof Error ? error.message : "Could not check Brain setup status.",
      }));
    }
  }

  useEffect(() => {
    const storedStep = Number(window.localStorage.getItem(BRAIN_STEP_STORAGE_KEY));
    setStepIndex(Number.isFinite(storedStep) ? clampStep(storedStep) : 0);
    setSetupCompleteDismissed(window.localStorage.getItem(BRAIN_COMPLETE_STORAGE_KEY) === "true");
    void refreshStatus(true);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(BRAIN_STEP_STORAGE_KEY, String(stepIndex));
  }, [stepIndex]);

  function goToStep(index: number) {
    const safeIndex = clampStep(index);
    const nextStep = BRAIN_STEPS[safeIndex];
    setStepIndex(safeIndex);
    if (nextStep.tab) setBrainTab(nextStep.tab);
  }

  function openRecommendation(recommendation: BrainRecommendation) {
    if (!recommendation.tab) {
      window.location.href = "/app";
      return;
    }

    const nextIndex = BRAIN_STEPS.findIndex((item) => item.tab === recommendation.tab);
    if (nextIndex >= 0) setStepIndex(nextIndex);
    setBrainTab(recommendation.tab);
  }

  function primaryAction() {
    if (setupComplete || step.id === "toolbelt") {
      window.localStorage.setItem(BRAIN_COMPLETE_STORAGE_KEY, "true");
      window.location.href = "/app";
      return;
    }

    if (currentStepComplete) {
      goToStep(nextMissingStepIndex(status));
      return;
    }

    if (step.tab) setBrainTab(step.tab);
  }

  function resetSetupGuide() {
    window.localStorage.removeItem(BRAIN_COMPLETE_STORAGE_KEY);
    setSetupCompleteDismissed(false);
    void refreshStatus(true);
  }

  const shellStyle: CSSProperties = {
    position: rightRailMode ? "fixed" : "relative",
    top: rightRailMode ? 128 : undefined,
    right: rightRailMode ? 28 : undefined,
    zIndex: 30,
    width: rightRailMode ? 300 : "min(980px, 100%)",
    maxHeight: rightRailMode ? "calc(100vh - 150px)" : undefined,
    margin: rightRailMode ? 0 : "0 auto 24px",
    padding: 14,
    overflowY: rightRailMode ? "auto" : "visible",
    overflowX: "hidden",
    borderRadius: 22,
    border: "1px solid rgba(248, 113, 113, 0.24)",
    background:
      "radial-gradient(circle at 50% 18%, rgba(220,38,38,0.22), transparent 32%), radial-gradient(circle at 88% 72%, rgba(34,197,94,0.08), transparent 34%), linear-gradient(180deg, rgba(18,18,22,0.97), rgba(8,8,10,0.98))",
    boxShadow: "0 26px 80px rgba(0,0,0,0.42)",
    display: "grid",
    gap: 13,
  };

  const mascotStageStyle: CSSProperties = {
    minHeight: setupComplete && setupCompleteDismissed ? 198 : 230,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "radial-gradient(circle at 50% 44%, rgba(248,113,113,0.25), transparent 45%), linear-gradient(180deg, rgba(15,23,42,0.62), rgba(0,0,0,0.36))",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
  };

  const mascotStyle: CSSProperties = {
    width: "min(210px, 88%)",
    height: "auto",
    filter: "drop-shadow(0 24px 44px rgba(0,0,0,0.48))",
  };

  const title = setupComplete && setupCompleteDismissed ? "Brain setup complete." : step.title;
  const body =
    setupComplete && setupCompleteDismissed
      ? "Your workspace is ready. I’ll stay in the Brain right rail as your companion instead of showing the setup wizard."
      : step.body;

  return (
    <aside style={shellStyle} className="brain-qat-companion" aria-label="QAt Companion">
      <div style={mascotStageStyle} aria-hidden="true">
        {videoSrc ? (
          <video className="qat-guide-media" src={videoSrc} autoPlay loop muted playsInline style={mascotStyle} />
        ) : (
          <img src={imageSrc} alt="" style={mascotStyle} />
        )}
      </div>

      <section style={{ display: "grid", gap: 11 }}>
        <p className="qat-guide-eyebrow" style={{ margin: 0 }}>QAt Companion</p>
        <h3 style={{ margin: 0, fontSize: "1.48rem", lineHeight: 1.08, letterSpacing: "-0.052em" }}>{title}</h3>
        <p style={{ margin: 0, color: "#cbd5e1", fontSize: "0.86rem", lineHeight: 1.5 }}>{body}</p>

        <div aria-label={`Brain setup completion ${progressPercent}%`} style={{ height: 8, overflow: "hidden", borderRadius: 999, background: "rgba(15,23,42,0.92)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ width: `${progressPercent}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg, #22c55e, #facc15, #ef4444)" }} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 5 }}>
          {BRAIN_STEPS.map((item, index) => {
            const complete = isStepComplete(item.id, status);
            const active = index === stepIndex;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => goToStep(index)}
                title={`${item.shortLabel}: ${complete ? "Complete" : "Missing"}`}
                style={{
                  minHeight: 28,
                  borderRadius: 999,
                  border: active ? "1px solid rgba(248,113,113,0.78)" : complete ? "1px solid rgba(34,197,94,0.42)" : "1px solid rgba(96,165,250,0.2)",
                  background: active ? "rgba(127,29,29,0.56)" : complete ? "rgba(22,101,52,0.3)" : "rgba(15,23,42,0.72)",
                  color: complete || active ? "#ffffff" : "#94a3b8",
                  fontSize: "0.68rem",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                {complete ? "✓" : index + 1}
              </button>
            );
          })}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 5, color: "#e5e7eb", fontSize: "0.76rem" }}>
          <span>{status.hasProject ? `Project: ${status.activeProjectName || "Selected"}` : "Project: Missing"}</span>
          <span>{status.hasSources ? `Sources: ${status.enabledSourceCount} enabled` : "Sources: Missing"}</span>
          <span>{status.jiraConfigured ? "Jira: Configured" : "Jira: Missing"}</span>
          <span>{status.testRailConfigured ? "TestRail: Configured" : "TestRail: Missing"}</span>
        </div>

        {recommendations.length ? (
          <div style={{ display: "grid", gap: 8, paddingTop: 9, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <strong style={{ color: "#fca5a5", fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Recommended next move
            </strong>
            {recommendations.map((recommendation) => (
              <button
                key={recommendation.label}
                type="button"
                onClick={() => openRecommendation(recommendation)}
                style={{
                  textAlign: "left",
                  borderRadius: 12,
                  border: recommendation.kind === "required" ? "1px solid rgba(248,113,113,0.34)" : recommendation.kind === "ready" ? "1px solid rgba(34,197,94,0.32)" : "1px solid rgba(96,165,250,0.22)",
                  background: recommendation.kind === "required" ? "rgba(127,29,29,0.28)" : recommendation.kind === "ready" ? "rgba(6,78,59,0.26)" : "rgba(15,23,42,0.58)",
                  color: "#e5e7eb",
                  padding: "10px 11px",
                  cursor: "pointer",
                }}
              >
                <span style={{ display: "block", color: "#fff", fontWeight: 900, marginBottom: 4 }}>{recommendation.label}</span>
                <span style={{ display: "block", fontSize: "0.75rem", lineHeight: 1.4 }}>{recommendation.body}</span>
              </button>
            ))}
          </div>
        ) : null}

        {status.error ? <div style={{ color: "#fecaca", fontSize: "0.78rem" }}>{status.error}</div> : null}

        <div className="qat-guide-actions" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
          <button className="qat-guide-primary" type="button" onClick={primaryAction}>
            {status.isLoading ? "Checking setup..." : setupComplete ? "Open Toolbelt" : currentStepComplete ? "Next missing step" : step.cta}
          </button>
          <button className="qat-guide-secondary" type="button" onClick={() => refreshStatus(true)}>Recheck</button>
          {stepIndex > 0 && !setupComplete ? <button className="qat-guide-secondary" type="button" onClick={() => goToStep(stepIndex - 1)}>Back</button> : null}
          {setupComplete ? <button className="qat-guide-secondary" type="button" onClick={resetSetupGuide}>Show setup guide</button> : <button className="qat-guide-secondary" type="button" onClick={() => (window.location.href = "/app")}>Skip to toolbelt</button>}
        </div>
      </section>
    </aside>
  );
}

export default function QAtGuideCard({
  eyebrow = "QAt says",
  title,
  body,
  imageSrc = "/qat/qat-peek.png",
  videoSrc,
  primaryAction,
  secondaryAction,
  onDismiss,
  className = "",
  compact = false,
  children,
}: QAtGuideCardProps) {
  if (className.split(/\s+/).includes("brain-qat-guide")) {
    return <BrainQAtCompanion imageSrc={imageSrc} videoSrc={videoSrc} />;
  }

  const shellClassName = ["qat-guide-shell", compact ? "qat-guide-shell-compact" : "", className].filter(Boolean).join(" ");

  return (
    <div className={shellClassName}>
      <div className="qat-guide-peek-layer" aria-hidden="true">
        {videoSrc ? (
          <video className="qat-guide-media" src={videoSrc} autoPlay loop muted playsInline />
        ) : (
          <img className="qat-guide-media" src={imageSrc} alt="" />
        )}
      </div>

      <section className="qat-guide-card" aria-label={title}>
        <div className="qat-guide-copy">
          <p className="qat-guide-eyebrow">{eyebrow}</p>
          <h3>{title}</h3>
          <p>{body}</p>

          {children ? <div className="qat-guide-extra">{children}</div> : null}

          {primaryAction || secondaryAction || onDismiss ? (
            <div className="qat-guide-actions">
              {primaryAction ? (
                <button className="qat-guide-primary" type="button" onClick={primaryAction.onClick}>
                  {primaryAction.label}
                </button>
              ) : null}

              {secondaryAction ? (
                <button className="qat-guide-secondary" type="button" onClick={secondaryAction.onClick}>
                  {secondaryAction.label}
                </button>
              ) : null}

              {onDismiss ? (
                <button className="qat-guide-dismiss" type="button" onClick={onDismiss} aria-label="Dismiss QAt guidance">
                  Dismiss
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
