"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

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

type QAtCompanionChatMessage = {
  id: string;
  role: "user" | "assistant";
  body: string;
};

type QAtChatResult = {
  answer: string;
  usedSources?: Array<{ id?: string; title: string; type?: string }>;
  missingContext?: string[];
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
  recommendationLabel?: string;
  actions?: QAtCompanionAction[];
  tip?: { title: string; body: string };
  footer?: ReactNode;
  className?: string;
  minimizedLabel?: string;
  chatEnabled?: boolean;
  chatTitle?: string;
  chatIntro?: string;
  chatPlaceholder?: string;
  chatResponse?: string;
  chatProjectId?: string | null;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatChatAnswer(payload: QAtChatResult): string {
  const sourceTitles = (payload.usedSources ?? [])
    .map((source) => source.title)
    .filter(Boolean)
    .slice(0, 4);
  const missingContext = (payload.missingContext ?? []).filter(Boolean);
  const parts = [payload.answer || "QAt could not find an answer in Project Brain context yet."];

  if (sourceTitles.length) {
    parts.push(`Used Brain context: ${sourceTitles.join(", ")}.`);
  }

  if (missingContext.length) {
    parts.push(`Missing context: ${missingContext.join(", ")}.`);
  }

  return parts.join("\n\n");
}

export default function QAtCompanionRail({
  storageKey,
  eyebrow = "QAt Companion",
  title,
  body,
  stateLabel,
  imageSrc = "/QAt/FullQat.png",
  videoSrc,
  progressPercent,
  steps = [],
  signals = [],
  recommendations = [],
  recommendationLabel = "Recommended next move",
  actions = [],
  tip,
  footer,
  className = "",
  minimizedLabel = "QAt",
  chatEnabled = false,
  chatTitle = "QAt Box",
  chatIntro = "Ask a project question. Full Project Brain answering is coming next.",
  chatPlaceholder = "Ask QAt about this project...",
  chatResponse = "I can take the question. Project Brain answering will be wired in the next pass, so I won’t invent an answer yet.",
  chatProjectId = null,
}: QAtCompanionRailProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<QAtCompanionChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);

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

  async function handleChatSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const question = chatInput.trim();

    if (!question) {
      chatInputRef.current?.focus();
      return;
    }

    const timestamp = Date.now();
    const fallbackAnswer = chatProjectId ? chatResponse : "Select a project before asking QAt.";

    setChatMessages((current) => [...current, { id: `user-${timestamp}`, role: "user", body: question }]);
    setChatInput("");

    if (!chatProjectId) {
      setChatMessages((current) => [...current, { id: `assistant-${timestamp}`, role: "assistant", body: fallbackAnswer }]);
      return;
    }

    setIsChatLoading(true);

    try {
      const response = await fetch("/api/qat/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: chatProjectId, question }),
      });
      const payload = (await response.json().catch(() => null)) as ({ ok?: boolean; message?: string } & Partial<QAtChatResult>) | null;

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.message || "QAt could not answer from Project Brain context.");
      }

      setChatMessages((current) => [
        ...current,
        {
          id: `assistant-${timestamp}`,
          role: "assistant",
          body: formatChatAnswer({
            answer: String(payload?.answer ?? fallbackAnswer),
            usedSources: payload?.usedSources,
            missingContext: payload?.missingContext,
          }),
        },
      ]);
    } catch (error) {
      setChatMessages((current) => [
        ...current,
        {
          id: `assistant-${timestamp}`,
          role: "assistant",
          body: error instanceof Error ? error.message : "QAt could not answer from Project Brain context.",
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  }

  if (isCollapsed) {
    return (
      <aside className={cx("qat-companion-rail", "qat-companion-rail-collapsed", className)} aria-label="QAt Companion minimized" data-testid="qat-companion-rail-collapsed">
        <button className="qat-companion-rail-collapsed-button" type="button" onClick={toggleCollapsed} aria-label="Expand QAt Companion" title="Expand QAt Companion" data-testid="qat-companion-expand">
          {videoSrc ? <video className="qat-companion-rail-collapsed-media" src={videoSrc} autoPlay loop muted playsInline /> : <img className="qat-companion-rail-collapsed-media" src={imageSrc} alt="" aria-hidden="true" />}
          <span>{minimizedLabel}</span>
        </button>
      </aside>
    );
  }

  const safeProgress = Math.max(0, Math.min(100, Number(progressPercent ?? 0)));

  return (
    <aside className={cx("qat-companion-rail", className)} aria-label="QAt Companion" data-testid="qat-companion-rail">
      <button className="qat-companion-rail-minimize" type="button" onClick={toggleCollapsed} aria-label="Minimize QAt Companion" data-testid="qat-companion-minimize">Min</button>

      <div className="qat-companion-rail-mascot-stage" aria-hidden="true" data-testid="qat-companion-mascot">
        {videoSrc ? <video className="qat-companion-rail-mascot" src={videoSrc} autoPlay loop muted playsInline /> : <img className="qat-companion-rail-mascot" src={imageSrc} alt="" />}
      </div>

      <section className="qat-companion-rail-copy">
        <p className="qat-companion-rail-eyebrow">{eyebrow}</p>
        <div className="qat-companion-rail-title-row">
          <h3 data-testid="qat-companion-title">{title}</h3>
          {stateLabel ? <span className="qat-companion-rail-state" data-testid="qat-companion-state">{stateLabel}</span> : null}
        </div>
        <p data-testid="qat-companion-body">{body}</p>
      </section>

      {typeof progressPercent === "number" ? <div className="qat-companion-rail-progress" aria-label={`QAt setup progress ${safeProgress}%`} data-testid="qat-companion-progress"><span style={{ width: `${safeProgress}%` }} /></div> : null}

      {steps.length ? <div className="qat-companion-rail-steps" aria-label="QAt steps" data-testid="qat-companion-steps">{steps.map((step, index) => <button key={`${step.label}-${index}`} type="button" className={cx(step.complete && "is-complete", step.active && "is-active")} title={step.title ?? step.label} aria-label={step.title ?? step.label} data-testid={`qat-step-${slugify(step.label)}`} onClick={step.onClick}>{step.complete ? "✓" : index + 1}</button>)}</div> : null}

      {signals.length ? <div className="qat-companion-rail-signals" aria-label="QAt signals" data-testid="qat-companion-signals">{signals.map((signal) => <span key={signal.label} className={signal.state ? `is-${signal.state}` : undefined} data-testid={`qat-signal-${slugify(signal.label)}`}><strong>{signal.label}</strong>{signal.value ? <em>{signal.value}</em> : null}</span>)}</div> : null}

      {recommendations.length ? <div className="qat-companion-rail-recommendations" data-testid="qat-companion-recommendations"><strong className="qat-companion-rail-section-label">{recommendationLabel}</strong>{recommendations.map((recommendation) => <button key={recommendation.label} type="button" className={recommendation.kind ? `is-${recommendation.kind}` : undefined} onClick={recommendation.onClick}><span>{recommendation.label}</span><small>{recommendation.body}</small></button>)}</div> : null}

      {chatEnabled ? (
        <section className="qat-companion-rail-chat" aria-label="QAt Box" data-testid="qat-companion-rail-chat">
          <div className="qat-companion-rail-chat-header">
            <strong>{chatTitle}</strong>
            <span>{chatIntro}</span>
          </div>

          <div className="qat-companion-rail-chat-log" aria-live="polite" data-testid="qat-companion-rail-chat-log">
            {chatMessages.length ? (
              chatMessages.map((message) => (
                <div key={message.id} className={cx("qat-companion-rail-chat-message", message.role === "assistant" ? "is-assistant" : "is-user")}>
                  <small>{message.role === "assistant" ? "QAt" : "You"}</small>
                  <p>{message.body}</p>
                </div>
              ))
            ) : (
              <p className="qat-companion-rail-chat-empty">Ask QAt a question to start the chat shell.</p>
            )}
            {isChatLoading ? <p className="qat-companion-rail-chat-empty">QAt is checking Project Brain context...</p> : null}
          </div>

          <form className="qat-companion-rail-chat-form" onSubmit={handleChatSubmit}>
            <textarea
              ref={chatInputRef}
              className="qat-companion-rail-chat-input"
              value={chatInput}
              placeholder={chatPlaceholder}
              rows={3}
              data-testid="qat-companion-rail-chat-input"
              disabled={isChatLoading}
              onChange={(event) => setChatInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <button className="qat-companion-rail-chat-submit" type="submit" data-testid="qat-companion-rail-chat-submit" disabled={isChatLoading}>
              {isChatLoading ? "Checking..." : "Send"}
            </button>
          </form>
        </section>
      ) : null}

      {actions.length ? <div className="qat-companion-rail-actions" aria-label="QAt actions" data-testid="qat-companion-actions">{actions.map((action) => <button key={action.label} type="button" className={action.variant === "primary" ? "is-primary" : undefined} disabled={action.disabled} data-testid={`qat-action-${slugify(action.label)}`} onClick={action.onClick}>{action.label}</button>)}</div> : null}

      {tip ? <div className="qat-companion-rail-tip" data-testid="qat-companion-tip"><strong>{tip.title}</strong><span>{tip.body}</span></div> : null}
      {footer ? <div className="qat-companion-rail-footer">{footer}</div> : null}
    </aside>
  );
}
