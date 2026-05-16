"use client";

import { useEffect, useState, type ReactNode } from "react";

export type QAtCompanionSignal = {
  label: string;
  value?: string;
  state?: "neutral" | "active" | "warning" | "ready";
};

export type QAtCompanionStep = {
  label: string;
  complete?: boolean;
  active?: boolean;
  title?: string;
  onClick?: () => void;
};

export type QAtCompanionRecommendation = {
  label: string;
  body: string;
  kind?: "required" | "recommended" | "ready";
  onClick?: () => void;
};

export type QAtCompanionAction = {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
};

export type QAtCompanionRailProps = {
  storageKey: string;
  eyebrow?: string;
  title: string;
  body: string;
  stateLabel?: string;
  imageSrc?: string;
  videoSrc?: string;
  progressPercent?: number;
  steps?: QAtCompanionStep[];
  signals?: QAtCompanionSignal[];
  recommendations?: QAtCompanionRecommendation[];
  actions?: QAtCompanionAction[];
  tip?: { title: string; body: string };
  footer?: ReactNode;
  className?: string;
  minimizedLabel?: string;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function QAtCompanionRail({
  storageKey,
  eyebrow = "QAt Companion",
  title,
  body,
  stateLabel,
  imageSrc = "/qat/qat-peek.png",
  videoSrc,
  progressPercent,
  steps = [],
  signals = [],
  recommendations = [],
  actions = [],
  tip,
  footer,
  className = "",
  minimizedLabel = "QAt",
}: QAtCompanionRailProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    setIsCollapsed(window.localStorage.getItem(storageKey) === "true");
  }, [storageKey]);

  function toggleCollapsed() {
    setIsCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(storageKey, String(next));
      return next;
    });
  }

  if (isCollapsed) {
    return (
      <aside className={cx("qat-companion-rail", "qat-companion-rail-collapsed", className)} aria-label="QAt Companion minimized">
        <button className="qat-companion-rail-collapsed-button" type="button" onClick={toggleCollapsed} aria-label="Expand QAt Companion" title="Expand QAt Companion">
          {videoSrc ? <video className="qat-companion-rail-collapsed-media" src={videoSrc} autoPlay loop muted playsInline /> : <img className="qat-companion-rail-collapsed-media" src={imageSrc} alt="" aria-hidden="true" />}
          <span>{minimizedLabel}</span>
        </button>
      </aside>
    );
  }

  const safeProgress = Math.max(0, Math.min(100, Number(progressPercent ?? 0)));

  return (
    <aside className={cx("qat-companion-rail", className)} aria-label="QAt Companion">
      <button className="qat-companion-rail-minimize" type="button" onClick={toggleCollapsed} aria-label="Minimize QAt Companion">Min</button>

      <div className="qat-companion-rail-mascot-stage" aria-hidden="true">
        {videoSrc ? <video className="qat-companion-rail-mascot" src={videoSrc} autoPlay loop muted playsInline /> : <img className="qat-companion-rail-mascot" src={imageSrc} alt="" />}
      </div>

      <section className="qat-companion-rail-copy">
        <p className="qat-companion-rail-eyebrow">{eyebrow}</p>
        <div className="qat-companion-rail-title-row">
          <h3>{title}</h3>
          {stateLabel ? <span className="qat-companion-rail-state">{stateLabel}</span> : null}
        </div>
        <p>{body}</p>
      </section>

      {typeof progressPercent === "number" ? <div className="qat-companion-rail-progress" aria-label={`QAt setup progress ${safeProgress}%`}><span style={{ width: `${safeProgress}%` }} /></div> : null}

      {steps.length ? <div className="qat-companion-rail-steps" aria-label="QAt steps">{steps.map((step, index) => <button key={`${step.label}-${index}`} type="button" className={cx(step.complete && "is-complete", step.active && "is-active")} title={step.title ?? step.label} onClick={step.onClick}>{step.complete ? "✓" : index + 1}</button>)}</div> : null}

      {signals.length ? <div className="qat-companion-rail-signals" aria-label="QAt signals">{signals.map((signal) => <span key={signal.label} className={signal.state ? `is-${signal.state}` : undefined}><strong>{signal.label}</strong>{signal.value ? <em>{signal.value}</em> : null}</span>)}</div> : null}

      {recommendations.length ? <div className="qat-companion-rail-recommendations"><strong className="qat-companion-rail-section-label">Recommended next move</strong>{recommendations.map((recommendation) => <button key={recommendation.label} type="button" className={recommendation.kind ? `is-${recommendation.kind}` : undefined} onClick={recommendation.onClick}><span>{recommendation.label}</span><small>{recommendation.body}</small></button>)}</div> : null}

      {actions.length ? <div className="qat-companion-rail-actions" aria-label="QAt actions">{actions.map((action) => <button key={action.label} type="button" className={action.variant === "primary" ? "is-primary" : undefined} disabled={action.disabled} onClick={action.onClick}>{action.label}</button>)}</div> : null}

      {tip ? <div className="qat-companion-rail-tip"><strong>{tip.title}</strong><span>{tip.body}</span></div> : null}
      {footer ? <div className="qat-companion-rail-footer">{footer}</div> : null}
    </aside>
  );
}
