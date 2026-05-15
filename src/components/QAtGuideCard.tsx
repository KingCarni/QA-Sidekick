"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

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

type BrainSetupStep = {
  id: string;
  label: string;
  title: string;
  body: string;
  tab?: string;
  cta: string;
};

const BRAIN_SETUP_STORAGE_KEY = "qatalyst.brain-ftue-step";

const BRAIN_SETUP_STEPS: BrainSetupStep[] = [
  {
    id: "brain",
    label: "1 / 6",
    title: "Start in Project Brain.",
    body:
      "Project Brain is the setup home for reusable QA memory. I’ll walk you through the minimum pieces QAtalyst needs before sending you back to the toolbelt.",
    tab: "overview",
    cta: "Start Brain setup",
  },
  {
    id: "project",
    label: "2 / 6",
    title: "Set up your project workspace.",
    body:
      "Create or select the product/client workspace this QA memory belongs to. Projects keep sources, reports, bugs, rules, and integrations scoped to the right account.",
    tab: "projects",
    cta: "Open Projects",
  },
  {
    id: "sources",
    label: "3 / 6",
    title: "Add reusable source context.",
    body:
      "Source Vault is where product notes, specs, acceptance rules, release docs, and imported text live. This is what keeps generated QA work from starting cold.",
    tab: "sources",
    cta: "Open Source Vault",
  },
  {
    id: "jira",
    label: "4 / 6",
    title: "Connect Jira when you’re ready.",
    body:
      "Jira setup lets QAtalyst fetch tickets and prepare handoff-ready QA work. Add the site URL, email, token, project key, and issue type defaults.",
    tab: "integrations",
    cta: "Open Integrations",
  },
  {
    id: "testrail",
    label: "5 / 6",
    title: "Set up TestRail for coverage handoff.",
    body:
      "TestRail setup keeps generated test cases closer to your test management workflow. Configure it after Jira so saved coverage can move toward sync-ready output.",
    tab: "integrations",
    cta: "Review TestRail setup",
  },
  {
    id: "toolbelt",
    label: "6 / 6",
    title: "Return to the toolbelt and generate QA work.",
    body:
      "Once Brain has a project, source context, and integrations, go back to the toolbelt. QAtalyst will use the selected project memory while you generate test cases, bugs, risk reviews, and feature briefs.",
    cta: "Go to Toolbelt",
  },
];

function clampStepIndex(value: number) {
  return Math.min(Math.max(value, 0), BRAIN_SETUP_STEPS.length - 1);
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

function BrainSetupGuide({ imageSrc, videoSrc }: { imageSrc: string; videoSrc?: string }) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = BRAIN_SETUP_STEPS[stepIndex] ?? BRAIN_SETUP_STEPS[0];
  const isFirstStep = stepIndex === 0;
  const isFinalStep = stepIndex === BRAIN_SETUP_STEPS.length - 1;

  useEffect(() => {
    setStepIndex(getInitialBrainSetupStep());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(BRAIN_SETUP_STORAGE_KEY, String(stepIndex));
  }, [stepIndex]);

  const progressPercent = useMemo(
    () => Math.round(((stepIndex + 1) / BRAIN_SETUP_STEPS.length) * 100),
    [stepIndex]
  );

  function goToStep(nextIndex: number) {
    const safeIndex = clampStepIndex(nextIndex);
    const nextStep = BRAIN_SETUP_STEPS[safeIndex];

    setStepIndex(safeIndex);

    if (nextStep.tab) {
      setBrainTab(nextStep.tab);
    }
  }

  function handlePrimaryAction() {
    if (isFinalStep) {
      window.location.href = "/app";
      return;
    }

    if (step.tab) {
      setBrainTab(step.tab);
    }

    goToStep(stepIndex + 1);
  }

  function skipToToolbelt() {
    window.localStorage.setItem(BRAIN_SETUP_STORAGE_KEY, String(BRAIN_SETUP_STEPS.length - 1));
    window.location.href = "/app";
  }

  return (
    <div className="qat-guide-shell brain-qat-guide brain-qat-guide-flow">
      <div className="qat-guide-peek-layer" aria-hidden="true">
        {videoSrc ? (
          <video
            className="qat-guide-media"
            src={videoSrc}
            autoPlay
            loop
            muted
            playsInline
          />
        ) : (
          <img className="qat-guide-media" src={imageSrc} alt="" />
        )}
      </div>

      <section className="qat-guide-card" aria-label="QAt Brain setup guide">
        <div className="qat-guide-copy">
          <p className="qat-guide-eyebrow">QAt setup navigator</p>
          <h3>{step.title}</h3>
          <p>{step.body}</p>

          <div className="qat-guide-extra">
            <div
              style={{
                display: "grid",
                gap: 10,
                marginTop: 6,
              }}
            >
              <div
                aria-label={`Brain setup progress ${progressPercent}%`}
                style={{
                  height: 8,
                  overflow: "hidden",
                  borderRadius: 999,
                  background: "rgba(15, 23, 42, 0.92)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                }}
              >
                <div
                  style={{
                    width: `${progressPercent}%`,
                    height: "100%",
                    borderRadius: 999,
                    background: "linear-gradient(90deg, #22c55e, #facc15, #ef4444)",
                  }}
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
                  gap: 6,
                }}
              >
                {BRAIN_SETUP_STEPS.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => goToStep(index)}
                    title={item.title}
                    style={{
                      minHeight: 34,
                      borderRadius: 999,
                      border: index === stepIndex ? "1px solid rgba(248, 113, 113, 0.78)" : "1px solid rgba(96, 165, 250, 0.2)",
                      background: index === stepIndex ? "rgba(127, 29, 29, 0.56)" : "rgba(15, 23, 42, 0.72)",
                      color: index <= stepIndex ? "#ffffff" : "#94a3b8",
                      fontSize: "0.72rem",
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  alignItems: "center",
                  justifyContent: "space-between",
                  color: "#cbd5e1",
                  fontSize: "0.82rem",
                }}
              >
                <span>{step.label}</span>
                <span>{step.tab ? `Target: Brain / ${step.tab}` : "Target: Toolbelt"}</span>
              </div>
            </div>
          </div>

          <div className="qat-guide-actions">
            <button className="qat-guide-primary" type="button" onClick={handlePrimaryAction}>
              {step.cta}
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
        </div>
      </section>
    </div>
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

  const shellClassName = [
    "qat-guide-shell",
    compact ? "qat-guide-shell-compact" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={shellClassName}>
      <div className="qat-guide-peek-layer" aria-hidden="true">
        {videoSrc ? (
          <video
            className="qat-guide-media"
            src={videoSrc}
            autoPlay
            loop
            muted
            playsInline
          />
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
                <button
                  className="qat-guide-primary"
                  type="button"
                  onClick={primaryAction.onClick}
                >
                  {primaryAction.label}
                </button>
              ) : null}

              {secondaryAction ? (
                <button
                  className="qat-guide-secondary"
                  type="button"
                  onClick={secondaryAction.onClick}
                >
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
