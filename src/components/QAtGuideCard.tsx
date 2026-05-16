"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import QAtCompanionRail, {
  type QAtCompanionAction,
  type QAtCompanionRecommendation,
  type QAtCompanionSignal,
  type QAtCompanionStep,
} from "@/components/QAtCompanionRail";

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
const BRAIN_MINIMIZED_STORAGE_KEY = "qatalyst.brain-qat-companion-minimized";

const BRAIN_STEPS: BrainStep[] = [
  { id: "brain", shortLabel: "Brain", title: "Let’s set up your QA memory.", body: "I’ll help you configure the pieces QAtalyst needs to reuse project context safely before you head back to the toolbelt.", tab: "overview", cta: "Start setup" },
  { id: "project", shortLabel: "Project", title: "Create or select a project workspace.", body: "Projects keep sources, reports, bugs, rules, and integrations scoped to the right signed-in account and product.", tab: "projects", cta: "Open Projects" },
  { id: "sources", shortLabel: "Sources", title: "Add reusable source context.", body: "Source Vault stores product notes, specs, acceptance rules, release docs, and imported text so generated QA work stays grounded.", tab: "sources", cta: "Open Source Vault" },
  { id: "jira", shortLabel: "Jira", title: "Connect Jira for ticket-driven QA.", body: "Jira setup lets QAtalyst fetch tickets and prepare handoff-ready QA work from real issue context.", tab: "integrations", cta: "Open Integrations" },
  { id: "testrail", shortLabel: "TestRail", title: "Connect TestRail for coverage handoff.", body: "TestRail setup gives generated test cases a clearer path toward test management and future sync workflows.", tab: "integrations", cta: "Review TestRail" },
  { id: "toolbelt", shortLabel: "Toolbelt", title: "Brain is ready. Generate a first QA run.", body: "Your core Brain setup is complete. Go back to the toolbelt and run a small generation to verify the workflow.", cta: "Go to Toolbelt" },
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

function isBrainComplete(status: BrainStatus) {
  return status.hasProject && status.hasSources && status.jiraConfigured && status.testRailConfigured;
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
  const activeProject = projects.find((project: Record<string, unknown>) => project.id === savedProjectId) ?? projects[0] ?? null;
  const activeProjectId = typeof activeProject?.id === "string" ? activeProject.id : "";
  const activeProjectName = typeof activeProject?.name === "string" ? activeProject.name : "";
  let enabledSourceCount = 0;

  if (activeProjectId) {
    const sourcePayload = await getJson(`/api/projects/${encodeURIComponent(activeProjectId)}/sources`);
    const sources = Array.isArray(sourcePayload?.sources) ? sourcePayload.sources : [];
    enabledSourceCount = sources.filter((source: Record<string, unknown>) => Boolean(source.isEnabled)).length;
  }

  const [jiraResult, testRailResult] = await Promise.allSettled([getJson("/api/jira/config"), getJson("/api/testrail/config")]);
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

function getRecommendations(status: BrainStatus): BrainRecommendation[] {
  if (!status.hasProject) {
    return [{ label: "Create/select a project first", body: "Brain needs a project workspace before sources, rules, reports, and integrations can be scoped safely.", tab: "projects", kind: "required" }];
  }

  const items: BrainRecommendation[] = [];

  if (!status.hasSources) {
    items.push({ label: "Add at least one enabled source", body: "Source Vault gives QAtalyst reusable product context, so generated QA work does not start from a blank prompt.", tab: "sources", kind: "required" });
  } else if (status.enabledSourceCount < 2) {
    items.push({ label: "Add one more source for stronger context", body: "A product overview plus requirements/spec notes will produce more grounded output.", tab: "sources", kind: "recommended" });
  }

  if (!status.jiraConfigured) {
    items.push({ label: "Connect Jira for ticket-driven workflows", body: "Jira lets QAtalyst fetch real ticket context and prepare work that is easier to hand back to your team.", tab: "integrations", kind: "recommended" });
  }

  if (!status.testRailConfigured) {
    items.push({ label: status.jiraConfigured ? "Connect TestRail after Jira" : "Plan TestRail setup before release handoff", body: "TestRail setup gives generated coverage a clearer path toward test management and future sync workflows.", tab: "integrations", kind: "recommended" });
  }

  if (isBrainComplete(status)) {
    items.push({ label: "Brain setup is complete", body: "Project, source context, Jira, and TestRail are configured. Head to the toolbelt and run a small test case generation.", kind: "ready" });
  }

  return items.slice(0, 2);
}

function BrainQAtCompanion({ imageSrc, videoSrc }: { imageSrc: string; videoSrc?: string }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [status, setStatus] = useState<BrainStatus>(initialBrainStatus);
  const [setupCompleteDismissed, setSetupCompleteDismissed] = useState(false);
  const setupComplete = isBrainComplete(status);
  const step = BRAIN_STEPS[stepIndex] ?? BRAIN_STEPS[0];
  const currentStepComplete = isStepComplete(step.id, status);
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
      setStatus((current) => ({ ...current, isLoading: false, error: error instanceof Error ? error.message : "Could not check Brain setup status." }));
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

  const title = setupComplete && setupCompleteDismissed ? "Brain setup complete." : step.title;
  const body = setupComplete && setupCompleteDismissed ? "Your workspace is ready. I’ll stay in the Brain right rail as your companion instead of showing the setup wizard." : step.body;

  const steps: QAtCompanionStep[] = BRAIN_STEPS.map((item, index) => ({
    label: item.shortLabel,
    complete: isStepComplete(item.id, status),
    active: index === stepIndex,
    title: `${item.shortLabel}: ${isStepComplete(item.id, status) ? "Complete" : "Missing"}`,
    onClick: () => goToStep(index),
  }));

  const signals: QAtCompanionSignal[] = [
    { label: "Project", value: status.hasProject ? status.activeProjectName || "Selected" : "Missing", state: status.hasProject ? "active" : "warning" },
    { label: "Sources", value: status.hasSources ? `${status.enabledSourceCount} enabled` : "Missing", state: status.hasSources ? "active" : "warning" },
    { label: "Jira", value: status.jiraConfigured ? "Configured" : "Missing", state: status.jiraConfigured ? "active" : "warning" },
    { label: "TestRail", value: status.testRailConfigured ? "Configured" : "Missing", state: status.testRailConfigured ? "active" : "warning" },
  ];

  const recommendations: QAtCompanionRecommendation[] = getRecommendations(status).map((recommendation) => ({
    label: recommendation.label,
    body: recommendation.body,
    kind: recommendation.kind,
    onClick: () => openRecommendation(recommendation),
  }));

  const actions: QAtCompanionAction[] = [
    { label: status.isLoading ? "Checking setup..." : setupComplete ? "Open Toolbelt" : currentStepComplete ? "Next missing step" : step.cta, onClick: primaryAction, variant: "primary" },
    { label: "Recheck", onClick: () => refreshStatus(true) },
    ...(stepIndex > 0 && !setupComplete ? [{ label: "Back", onClick: () => goToStep(stepIndex - 1) } satisfies QAtCompanionAction] : []),
    setupComplete ? { label: "Show setup guide", onClick: resetSetupGuide } : { label: "Skip to toolbelt", onClick: () => { window.location.href = "/app"; } },
  ];

  return (
    <QAtCompanionRail
      className="brain-qat-companion"
      storageKey={BRAIN_MINIMIZED_STORAGE_KEY}
      eyebrow="QAt Companion"
      title={title}
      body={body}
      imageSrc={imageSrc}
      videoSrc={videoSrc}
      progressPercent={progressPercent}
      steps={steps}
      signals={signals}
      recommendations={recommendations}
      actions={actions}
    />
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
        {videoSrc ? <video className="qat-guide-media" src={videoSrc} autoPlay loop muted playsInline /> : <img className="qat-guide-media" src={imageSrc} alt="" />}
      </div>
      <section className="qat-guide-card" aria-label={title}>
        <div className="qat-guide-copy">
          <p className="qat-guide-eyebrow">{eyebrow}</p>
          <h3>{title}</h3>
          <p>{body}</p>
          {children ? <div className="qat-guide-extra">{children}</div> : null}
          {primaryAction || secondaryAction || onDismiss ? (
            <div className="qat-guide-actions">
              {primaryAction ? <button className="qat-guide-primary" type="button" onClick={primaryAction.onClick}>{primaryAction.label}</button> : null}
              {secondaryAction ? <button className="qat-guide-secondary" type="button" onClick={secondaryAction.onClick}>{secondaryAction.label}</button> : null}
              {onDismiss ? <button className="qat-guide-dismiss" type="button" onClick={onDismiss} aria-label="Dismiss QAt guidance">Dismiss</button> : null}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
