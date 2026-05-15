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

type BrainSetupStepId = "brain" | "project" | "sources" | "jira" | "testrail" | "toolbelt";

type BrainSetupStep = {
  id: BrainSetupStepId;
  label: string;
  shortLabel: string;
  title: string;
  body: string;
  tab?: string;
  cta: string;
};

type BrainSetupStatus = {
  isLoading: boolean;
  activeProjectId: string;
  activeProjectName: string;
  hasProject: boolean;
  sourceCount: number;
  enabledSourceCount: number;
  hasSources: boolean;
  jiraConfigured: boolean;
  testRailConfigured: boolean;
  error: string;
};

type BrainRecommendation = {
  id: string;
  label: string;
  body: string;
  tab?: string;
  priority: "required" | "recommended" | "ready";
};

const BRAIN_SETUP_STORAGE_KEY = "qatalyst.brain-ftue-step";
const BRAIN_SETUP_COMPLETE_STORAGE_KEY = "qatalyst.brain-ftue-complete";
const ACTIVE_PROJECT_STORAGE_KEY = "qatalyst.activeProjectId";

const BRAIN_SETUP_STEPS: BrainSetupStep[] = [
  {
    id: "brain",
    label: "1 / 6",
    shortLabel: "Brain",
    title: "Let’s set up your QA memory.",
    body:
      "I’ll help you configure the pieces QAtalyst needs to reuse project context safely before you head back to the toolbelt.",
    tab: "overview",
    cta: "Start setup",
  },
  {
    id: "project",
    label: "2 / 6",
    shortLabel: "Project",
    title: "Create or select a project workspace.",
    body:
      "Projects keep sources, reports, bugs, rules, and integrations scoped to the right signed-in account and product.",
    tab: "projects",
    cta: "Open Projects",
  },
  {
    id: "sources",
    label: "3 / 6",
    shortLabel: "Sources",
    title: "Add reusable source context.",
    body:
      "Source Vault is where product notes, specs, acceptance rules, release docs, and imported text live. This keeps generated QA work grounded.",
    tab: "sources",
    cta: "Open Source Vault",
  },
  {
    id: "jira",
    label: "4 / 6",
    shortLabel: "Jira",
    title: "Connect Jira for ticket-driven QA.",
    body:
      "Jira setup lets QAtalyst fetch tickets and prepare handoff-ready QA work from real issue context.",
    tab: "integrations",
    cta: "Open Integrations",
  },
  {
    id: "testrail",
    label: "5 / 6",
    shortLabel: "TestRail",
    title: "Connect TestRail for coverage handoff.",
    body:
      "TestRail setup gives generated test cases a clearer path toward test management and future sync workflows.",
    tab: "integrations",
    cta: "Review TestRail setup",
  },
  {
    id: "toolbelt",
    label: "6 / 6",
    shortLabel: "Toolbelt",
    title: "Brain is ready. Generate a first QA run.",
    body:
      "Your core Brain setup is complete. Go back to the toolbelt and run a small test case generation to verify the flow.",
    cta: "Go to Toolbelt",
  },
];

const INITIAL_BRAIN_SETUP_STATUS: BrainSetupStatus = {
  isLoading: true,
  activeProjectId: "",
  activeProjectName: "",
  hasProject: false,
  sourceCount: 0,
  enabledSourceCount: 0,
  hasSources: false,
  jiraConfigured: false,
  testRailConfigured: false,
  error: "",
};

function clampStepIndex(value: number) {
  return Math.min(Math.max(value, 0), BRAIN_SETUP_STEPS.length - 1);
}

function isStepComplete(stepId: BrainSetupStepId, status: BrainSetupStatus) {
  if (stepId === "brain") return true;
  if (stepId === "project") return status.hasProject;
  if (stepId === "sources") return status.hasSources;
  if (stepId === "jira") return status.jiraConfigured;
  if (stepId === "testrail") return status.testRailConfigured;
  if (stepId === "toolbelt") {
    return status.hasProject && status.hasSources && status.jiraConfigured && status.testRailConfigured;
  }

  return false;
}

function isBrainSetupComplete(status: BrainSetupStatus) {
  return status.hasProject && status.hasSources && status.jiraConfigured && status.testRailConfigured;
}

function getFirstIncompleteStepIndex(status: BrainSetupStatus) {
  const setupStepIndex = BRAIN_SETUP_STEPS.findIndex((step) => !isStepComplete(step.id, status));
  return setupStepIndex >= 0 ? setupStepIndex : BRAIN_SETUP_STEPS.length - 1;
}

function getBrainRecommendations(status: BrainSetupStatus, setupComplete: boolean): BrainRecommendation[] {
  const recommendations: BrainRecommendation[] = [];

  if (!status.hasProject) {
    recommendations.push({
      id: "project-required",
      label: "Create/select a project first",
      body: "Brain needs a project workspace before sources, rules, reports, and integrations can be scoped safely.",
      tab: "projects",
      priority: "required",
    });

    return recommendations;
  }

  if (!status.hasSources) {
    recommendations.push({
      id: "sources-required",
      label: "Add at least one enabled source",
      body: "Source Vault gives QAtalyst reusable product context, so generated QA work does not start from a blank prompt.",
      tab: "sources",
      priority: "required",
    });
  } else if (status.enabledSourceCount < 2) {
    recommendations.push({
      id: "sources-recommended",
      label: "Add one more source for stronger context",
      body: "One source is enough to start, but a product overview plus requirements/spec notes will produce more grounded output.",
      tab: "sources",
      priority: "recommended",
    });
  }

  if (!status.jiraConfigured) {
    recommendations.push({
      id: "jira-recommended",
      label: "Connect Jira for ticket-driven workflows",
      body: "Jira lets QAtalyst fetch real ticket context and prepare work that is easier to hand back to your team.",
      tab: "integrations",
      priority: "recommended",
    });
  }

  if (status.jiraConfigured && !status.testRailConfigured) {
    recommendations.push({
      id: "testrail-recommended",
      label: "Connect TestRail after Jira",
      body: "TestRail setup gives generated coverage a clearer path toward test management and future sync workflows.",
      tab: "integrations",
      priority: "recommended",
    });
  } else if (!status.testRailConfigured) {
    recommendations.push({
      id: "testrail-later",
      label: "Plan TestRail setup before release handoff",
      body: "You can generate QA work without TestRail, but configure it before you expect reusable cases to move into a test case manager.",
      tab: "integrations",
      priority: "recommended",
    });
  }

  if (setupComplete) {
    recommendations.push({
      id: "ready-toolbelt",
      label: "Brain setup is complete",
      body: "Project, source context, Jira, and TestRail are configured. Head back to the toolbelt and generate a small test case run to verify the flow.",
      priority: "ready",
    });
  }

  return recommendations.slice(0, 2);
}

function getInitialBrainSetupStep() {
  if (typeof window === "undefined") return 0;

  const stored = Number(window.localStorage.getItem(BRAIN_SETUP_STORAGE_KEY));
  if (Number.isFinite(stored)) return clampStepIndex(stored);

  const currentTab = new URLSearchParams(window.location.search).get("tab") || "overview";
  const matchingIndex = BRAIN_SETUP_STEPS.findIndex((step) => step.tab === currentTab);
  return matchingIndex >= 0 ? matchingIndex : 0;
}

function setBrainTab(tab: string) {
  if (typeof window === "undefined") return;

  const nextUrl = tab === "overview" ? "/brain" : `/brain?tab=${tab}`;
  window.history.replaceState(null, "", nextUrl);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function readBooleanPath(payload: unknown, path: string[]) {
  let current: unknown = payload;

  for (const segment of path) {
    if (!current || typeof current !== "object" || !(segment in current)) return false;
    current = (current as Record<string, unknown>)[segment];
  }

  return Boolean(current);
}

function useBrainGutterLayout() {
  const [isGutterLayout, setIsGutterLayout] = useState(false);

  useEffect(() => {
    function syncLayout() {
      setIsGutterLayout(window.innerWidth >= 1420);
    }

    syncLayout();
    window.addEventListener("resize", syncLayout);
    return () => window.removeEventListener("resize", syncLayout);
  }, []);

  return isGutterLayout;
}

async function getJson(url: string) {
  const response = await fetch(url, { method: "GET", cache: "no-store" });
  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `Could not load ${url}.`);
  }

  return payload;
}

async function loadBrainSetupStatus(): Promise<BrainSetupStatus> {
  const projectsPayload = await getJson("/api/projects");
  const projects = Array.isArray(projectsPayload?.projects) ? projectsPayload.projects : [];
  const savedProjectId = typeof window !== "undefined" ? window.localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY) : null;
  const activeProject =
    projects.find((project: Record<string, unknown>) => project.id === savedProjectId) ?? projects[0] ?? null;
  const activeProjectId = typeof activeProject?.id === "string" ? activeProject.id : "";
  const activeProjectName = typeof activeProject?.name === "string" ? activeProject.name : "";

  let sourceCount = 0;
  let enabledSourceCount = 0;

  if (activeProjectId) {
    const sourcePayload = await getJson(`/api/projects/${encodeURIComponent(activeProjectId)}/sources`);
    const sources = Array.isArray(sourcePayload?.sources) ? sourcePayload.sources : [];
    sourceCount = sources.length;
    enabledSourceCount = sources.filter((source: Record<string, unknown>) => Boolean(source.isEnabled)).length;
  }

  const [jiraResult, testRailResult] = await Promise.allSettled([
    getJson("/api/jira/config"),
    getJson("/api/testrail/config"),
  ]);

  const jiraPayload = jiraResult.status === "fulfilled" ? jiraResult.value : null;
  const testRailPayload = testRailResult.status === "fulfilled" ? testRailResult.value : null;
  const jiraConfigured = readBooleanPath(jiraPayload, ["jira", "configured"]);
  const testRailConfigured = readBooleanPath(testRailPayload, ["testrail", "configured"]);

  return {
    isLoading: false,
    activeProjectId,
    activeProjectName,
    hasProject: Boolean(activeProjectId),
    sourceCount,
    enabledSourceCount,
    hasSources: enabledSourceCount > 0,
    jiraConfigured,
    testRailConfigured,
    error: "",
  };
}

const smallPillStyle: CSSProperties = {
  padding: "7px 9px",
  borderRadius: 999,
  background: "rgba(22,101,52,0.3)",
  border: "1px solid rgba(34,197,94,0.28)",
  color: "#f8fafc",
  fontSize: "0.74rem",
  fontWeight: 900,
  lineHeight: 1,
};

function BrainSetupGuide({ imageSrc, videoSrc }: { imageSrc: string; videoSrc?: string }) {
  const isGutterLayout = useBrainGutterLayout();
  const [stepIndex, setStepIndex] = useState(0);
  const [status, setStatus] = useState<BrainSetupStatus>(INITIAL_BRAIN_SETUP_STATUS);
  const [setupCompleteDismissed, setSetupCompleteDismissed] = useState(false);
  const step = BRAIN_SETUP_STEPS[stepIndex] ?? BRAIN_SETUP_STEPS[0];
  const isFirstStep = stepIndex === 0;
  const isFinalStep = stepIndex === BRAIN_SETUP_STEPS.length - 1;
  const setupComplete = isBrainSetupComplete(status);
  const currentStepComplete = isStepComplete(step.id, status);

  async function refreshStatus(options?: { syncToNextMissing?: boolean }) {
    setStatus((current) => ({ ...current, isLoading: true, error: "" }));

    try {
      const nextStatus = await loadBrainSetupStatus();
      const nextSetupComplete = isBrainSetupComplete(nextStatus);
      setStatus(nextStatus);

      if (nextSetupComplete && typeof window !== "undefined") {
        window.localStorage.setItem(BRAIN_SETUP_COMPLETE_STORAGE_KEY, "true");
        setSetupCompleteDismissed(true);
      }

      if (options?.syncToNextMissing && !nextSetupComplete) {
        const nextIndex = getFirstIncompleteStepIndex(nextStatus);
        setStepIndex(nextIndex);

        const nextStep = BRAIN_SETUP_STEPS[nextIndex];
        if (nextStep?.tab) {
          setBrainTab(nextStep.tab);
        }
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
    setStepIndex(getInitialBrainSetupStep());
    setSetupCompleteDismissed(window.localStorage.getItem(BRAIN_SETUP_COMPLETE_STORAGE_KEY) === "true");
    void refreshStatus({ syncToNextMissing: true });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(BRAIN_SETUP_STORAGE_KEY, String(stepIndex));
  }, [stepIndex]);

  const completedSetupCount = useMemo(
    () => BRAIN_SETUP_STEPS.filter((item) => isStepComplete(item.id, status)).length,
    [status]
  );

  const progressPercent = useMemo(
    () => Math.round((completedSetupCount / BRAIN_SETUP_STEPS.length) * 100),
    [completedSetupCount]
  );

  const recommendations = useMemo(() => getBrainRecommendations(status, setupComplete), [status, setupComplete]);

  function goToStep(nextIndex: number) {
    const safeIndex = clampStepIndex(nextIndex);
    const nextStep = BRAIN_SETUP_STEPS[safeIndex];

    setStepIndex(safeIndex);

    if (nextStep.tab) {
      setBrainTab(nextStep.tab);
    }
  }

  function handlePrimaryAction() {
    if (isFinalStep || setupComplete) {
      window.localStorage.setItem(BRAIN_SETUP_COMPLETE_STORAGE_KEY, "true");
      window.location.href = "/app";
      return;
    }

    if (step.tab) {
      setBrainTab(step.tab);
    }

    if (currentStepComplete) {
      goToStep(getFirstIncompleteStepIndex(status));
      return;
    }

    goToStep(stepIndex);
  }

  function skipToToolbelt() {
    window.localStorage.setItem(BRAIN_SETUP_STORAGE_KEY, String(BRAIN_SETUP_STEPS.length - 1));
    window.location.href = "/app";
  }

  function openRecommendation(recommendation: BrainRecommendation) {
    if (!recommendation.tab) {
      window.location.href = "/app";
      return;
    }

    const index = BRAIN_SETUP_STEPS.findIndex((item) => item.tab === recommendation.tab);
    setStepIndex(index >= 0 ? index : stepIndex);
    setBrainTab(recommendation.tab);
  }

  function resetCompanionSetup() {
    window.localStorage.removeItem(BRAIN_SETUP_COMPLETE_STORAGE_KEY);
    setSetupCompleteDismissed(false);
    void refreshStatus({ syncToNextMissing: true });
  }

  const primaryLabel = setupComplete ? "Go to Toolbelt" : currentStepComplete && !isFinalStep ? "Next missing step" : step.cta;

  const companionShellStyle: CSSProperties = {
    position: isGutterLayout ? "fixed" : "relative",
    top: isGutterLayout ? 132 : undefined,
    right: isGutterLayout ? "max(18px, calc((100vw - 1760px) / 2 + 18px))" : undefined,
    zIndex: 30,
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 14,
    alignItems: "stretch",
    width: isGutterLayout ? 324 : "min(980px, 100%)",
    maxHeight: isGutterLayout ? "calc(100vh - 154px)" : undefined,
    margin: isGutterLayout ? 0 : "0 auto 24px",
    padding: 16,
    borderRadius: 24,
    border: "1px solid rgba(248, 113, 113, 0.22)",
    background:
      "radial-gradient(circle at 50% 18%, rgba(220, 38, 38, 0.22), transparent 32%), radial-gradient(circle at 85% 70%, rgba(34, 197, 94, 0.08), transparent 34%), linear-gradient(180deg, rgba(18, 18, 22, 0.97), rgba(8, 8, 10, 0.98))",
    boxShadow: "0 26px 80px rgba(0,0,0,0.42)",
    overflowY: isGutterLayout ? "auto" : "visible",
    overflowX: "hidden",
  };

  const mascotStageStyle: CSSProperties = {
    position: "relative",
    minHeight: setupComplete && setupCompleteDismissed ? 210 : 240,
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.08)",
    background:
      "radial-gradient(circle at 50% 44%, rgba(248,113,113,0.24), transparent 45%), linear-gradient(180deg, rgba(15,23,42,0.62), rgba(0,0,0,0.36))",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
  };

  const mascotStyle: CSSProperties = {
    width: "min(220px, 88%)",
    height: "auto",
    filter: "drop-shadow(0 24px 44px rgba(0,0,0,0.48))",
  };

  const titleStyle: CSSProperties = {
    margin: 0,
    fontSize: "clamp(1.35rem, 2.4vw, 1.8rem)",
    lineHeight: 1.08,
    letterSpacing: "-0.052em",
  };

  const copyStyle: CSSProperties = {
    margin: "9px 0 0",
    color: "#cbd5e1",
    fontSize: "0.9rem",
    lineHeight: 1.55,
  };

  if (setupComplete && setupCompleteDismissed) {
    return (
      <aside style={companionShellStyle} className="brain-qat-companion brain-qat-companion-ready" aria-label="QAt Companion">
        <div style={mascotStageStyle} aria-hidden="true">
          {videoSrc ? (
            <video className="qat-guide-media" src={videoSrc} autoPlay loop muted playsInline style={mascotStyle} />
          ) : (
            <img src={imageSrc} alt="" style={mascotStyle} />
          )}
        </div>

        <section style={{ display: "grid", gap: 13, minWidth: 0 }}>
          <p className="qat-guide-eyebrow" style={{ margin: 0 }}>QAt Companion</p>
          <h3 style={titleStyle}>Brain setup complete.</h3>
          <p style={copyStyle}>
            Your workspace is ready. I’ll stay in the Brain gutter as a companion instead of showing the setup wizard.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
            <span style={smallPillStyle}>Project</span>
            <span style={smallPillStyle}>{status.enabledSourceCount} sources</span>
            <span style={smallPillStyle}>Jira</span>
            <span style={smallPillStyle}>TestRail</span>
          </div>

          {recommendations[0] ? (
            <button
              type="button"
              onClick={() => openRecommendation(recommendations[0])}
              style={{
                textAlign: "left",
                borderRadius: 14,
                border: "1px solid rgba(34, 197, 94, 0.32)",
                background: "rgba(6, 78, 59, 0.26)",
                color: "#e5e7eb",
                padding: "11px 12px",
                cursor: "pointer",
              }}
            >
              <span style={{ display: "block", color: "#ffffff", fontWeight: 900, marginBottom: 5 }}>{recommendations[0].label}</span>
              <span style={{ display: "block", fontSize: "0.78rem", lineHeight: 1.45 }}>{recommendations[0].body}</span>
            </button>
          ) : null}

          <div className="qat-guide-actions" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
            <button className="qat-guide-primary" type="button" onClick={() => (window.location.href = "/app")}>
              Open Toolbelt
            </button>
            <button className="qat-guide-secondary" type="button" onClick={() => refreshStatus({ syncToNextMissing: false })}>
              Recheck
            </button>
            <button className="qat-guide-secondary" type="button" onClick={resetCompanionSetup}>
              Show setup guide
            </button>
          </div>
        </section>
      </aside>
    );
  }

  return (
    <aside style={companionShellStyle} className="brain-qat-companion brain-qat-companion-setup" aria-label="QAt Brain setup companion">
      <div style={mascotStageStyle} aria-hidden="true">
        {videoSrc ? (
          <video className="qat-guide-media" src={videoSrc} autoPlay loop muted playsInline style={mascotStyle} />
        ) : (
          <img src={imageSrc} alt="" style={mascotStyle} />
        )}
      </div>

      <section style={{ display: "grid", gap: 12, minWidth: 0 }}>
        <div>
          <p className="qat-guide-eyebrow" style={{ margin: "0 0 8px" }}>QAt Companion</p>
          <h3 style={titleStyle}>{step.title}</h3>
          <p style={copyStyle}>{step.body}</p>
        </div>

        <div aria-label={`Brain setup completion ${progressPercent}%`} style={{ height: 9, overflow: "hidden", borderRadius: 999, background: "rgba(15, 23, 42, 0.92)", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
          <div style={{ width: `${progressPercent}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg, #22c55e, #facc15, #ef4444)" }} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 5 }}>
          {BRAIN_SETUP_STEPS.map((item, index) => {
            const complete = isStepComplete(item.id, status);
            const active = index === stepIndex;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => goToStep(index)}
                title={`${item.shortLabel}: ${complete ? "Complete" : "Missing"}`}
                style={{
                  minHeight: 30,
                  borderRadius: 999,
                  border: active ? "1px solid rgba(248, 113, 113, 0.78)" : complete ? "1px solid rgba(34, 197, 94, 0.42)" : "1px solid rgba(96, 165, 250, 0.2)",
                  background: active ? "rgba(127, 29, 29, 0.56)" : complete ? "rgba(22, 101, 52, 0.3)" : "rgba(15, 23, 42, 0.72)",
                  color: complete || active ? "#ffffff" : "#94a3b8",
                  fontSize: "0.7rem",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                {complete ? "✓" : index + 1}
              </button>
            );
          })}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 6, fontSize: "0.78rem", color: "#e5e7eb" }}>
          <span>{status.hasProject ? `Project: ${status.activeProjectName || "Selected"}` : "Project: Missing"}</span>
          <span>{status.hasSources ? `Sources: ${status.enabledSourceCount} enabled` : "Sources: Missing"}</span>
          <span>{status.jiraConfigured ? "Jira: Configured" : "Jira: Missing"}</span>
          <span>{status.testRailConfigured ? "TestRail: Configured" : "TestRail: Missing"}</span>
        </div>

        {recommendations.length > 0 ? (
          <div style={{ display: "grid", gap: 8, paddingTop: 10, borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
            <strong style={{ color: "#fca5a5", fontSize: "0.72rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Recommended next move
            </strong>
            {recommendations.map((recommendation) => (
              <button
                key={recommendation.id}
                type="button"
                onClick={() => openRecommendation(recommendation)}
                style={{
                  textAlign: "left",
                  borderRadius: 12,
                  border: recommendation.priority === "required" ? "1px solid rgba(248, 113, 113, 0.34)" : recommendation.priority === "ready" ? "1px solid rgba(34, 197, 94, 0.32)" : "1px solid rgba(96, 165, 250, 0.22)",
                  background: recommendation.priority === "required" ? "rgba(127, 29, 29, 0.28)" : recommendation.priority === "ready" ? "rgba(6, 78, 59, 0.26)" : "rgba(15, 23, 42, 0.58)",
                  color: "#e5e7eb",
                  padding: "10px 12px",
                  cursor: "pointer",
                }}
              >
                <span style={{ display: "block", color: "#ffffff", fontWeight: 900, marginBottom: 4 }}>{recommendation.label}</span>
                <span style={{ display: "block", fontSize: "0.76rem", lineHeight: 1.42 }}>{recommendation.body}</span>
              </button>
            ))}
          </div>
        ) : null}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between", color: "#cbd5e1", fontSize: "0.82rem" }}>
          <span>{step.label}</span>
          <span>{currentStepComplete ? "Complete" : step.tab ? `Brain / ${step.tab}` : "Toolbelt"}</span>
        </div>

        {status.error ? <div style={{ color: "#fecaca", fontSize: "0.82rem" }}>{status.error}</div> : null}

        <div className="qat-guide-actions" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
          <button className="qat-guide-primary" type="button" onClick={handlePrimaryAction}>
            {status.isLoading ? "Checking setup..." : primaryLabel}
          </button>

          <button className="qat-guide-secondary" type="button" onClick={() => refreshStatus({ syncToNextMissing: true })}>
            Recheck setup
          </button>

          {!isFirstStep ? (
            <button className="qat-guide-secondary" type="button" onClick={() => goToStep(stepIndex - 1)}>
              Back
            </button>
          ) : null}

          <button className="qat-guide-secondary" type="button" onClick={skipToToolbelt}>
            Skip to toolbelt
          </button>
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
    return <BrainSetupGuide imageSrc={imageSrc} videoSrc={videoSrc} />;
  }

  const shellClassName = ["qat-guide-shell", compact ? "qat-guide-shell-compact" : "", className]
    .filter(Boolean)
    .join(" ");

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
                <button
                  className="qat-guide-dismiss"
                  type="button"
                  onClick={onDismiss}
                  aria-label="Dismiss QAt guidance"
                >
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
