"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

export type QAtCompanionSignal = { label: string; value?: string; state?: "neutral" | "active" | "warning" | "ready" };
export type QAtCompanionStep = { label: string; complete?: boolean; active?: boolean; title?: string; onClick?: () => void };
export type QAtCompanionRecommendation = { label: string; body: string; kind?: "required" | "recommended" | "ready"; onClick?: () => void };
export type QAtCompanionAction = { label: string; onClick: () => void; variant?: "primary" | "secondary"; disabled?: boolean };

type QAtCompanionChatMessage = { id: string; role: "user" | "assistant"; body: string };
type QAtWorkflowContext = { page: "toolbelt" | "brain" | "integrations" | "unknown"; activeTool?: string; workflowState?: string; sourceInput?: string; generatedOutput?: string; followUpContext?: string; setupState?: string };
type QAtChatResult = { answer: string; usedSources?: Array<{ id?: string; title: string; type?: string }>; missingContext?: string[] };

type QAtalystWindow = typeof window & {
  __qatalystBugContextFetchPatched?: boolean;
  __qatalystOriginalFetch?: typeof fetch;
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

function cx(...parts: Array<string | false | null | undefined>) { return parts.filter(Boolean).join(" "); }
function slugify(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
function formatChatAnswer(payload: QAtChatResult): string { return payload.answer || "QAt could not find an answer in Project Brain context yet."; }
function compactText(value: string | null | undefined, maxCharacters = 6000): string {
  const clean = String(value ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= maxCharacters) return clean;
  return `${clean.slice(0, maxCharacters).trim()}… [truncated]`;
}
function readText(selector: string, maxCharacters = 6000): string {
  if (typeof document === "undefined") return "";
  const element = document.querySelector(selector);
  return compactText(element?.textContent ?? "", maxCharacters);
}
function readTextAreaValue(selector: string, maxCharacters = 6000): string {
  if (typeof document === "undefined") return "";
  const element = document.querySelector<HTMLTextAreaElement>(selector);
  return compactText(element?.value ?? "", maxCharacters);
}
function labelTextWithoutControls(label: HTMLLabelElement | null | undefined): string {
  if (!label) return "";
  const clone = label.cloneNode(true) as HTMLLabelElement;
  clone.querySelectorAll("input, textarea, select, button, option").forEach((node) => node.remove());
  return compactText(clone.textContent ?? "", 120);
}
function getFieldLabel(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string {
  const directLabel = labelTextWithoutControls(element.labels?.[0]);
  const parentLabel = labelTextWithoutControls(element.closest("label"));
  const ariaLabel = element.getAttribute("aria-label");
  const dataLabel = element.getAttribute("data-qat-label");
  const placeholder = element.getAttribute("placeholder");
  const fieldGroup = element.closest(".field, .form-field, .input-group, .bug-context-field, .bug-context-row, .qa-field");
  const nearbyLabel = fieldGroup?.querySelector(".field-label, .input-label, span, small")?.textContent;
  return compactText(dataLabel || directLabel || ariaLabel || nearbyLabel || parentLabel || placeholder || element.name || element.id || "Field", 120);
}
function readControlValue(control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string {
  if (control instanceof HTMLSelectElement) {
    return control.value || control.options[control.selectedIndex]?.text || "";
  }

  if (control instanceof HTMLInputElement && (control.type === "checkbox" || control.type === "radio")) {
    return control.checked ? "checked" : "unchecked";
  }

  return control.value;
}
function readVisibleFormValues(maxCharacters = 7000): string {
  if (typeof document === "undefined") return "";
  const controls = Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select"));
  const rows: string[] = [];
  const seen = new Set<string>();

  for (const control of controls) {
    if (control.closest(".qat-companion-rail")) continue;
    if (control instanceof HTMLInputElement && (control.type === "hidden" || control.type === "password")) continue;
    if (control.disabled) continue;
    const rects = control.getClientRects();
    if (!rects.length) continue;
    const cleanValue = compactText(readControlValue(control), 800);
    if (!cleanValue) continue;
    const label = getFieldLabel(control);
    const row = `${label}: ${cleanValue}`;
    if (seen.has(row)) continue;
    seen.add(row);
    rows.push(row);
    if (rows.join("\n").length >= maxCharacters) break;
  }

  return compactText(rows.join("\n"), maxCharacters);
}
function readFollowUpContext(maxCharacters = 4000): string {
  if (typeof document === "undefined") return "";
  const sections = Array.from(document.querySelectorAll(".follow-up-answer-box, .followup-history-card"));
  return compactText(sections.map((section) => section.textContent ?? "").join("\n\n"), maxCharacters);
}
function readBugSupplementalContext(maxCharacters = 5000): string {
  if (typeof document === "undefined") return "";
  const fields = Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("[data-qat-bug-extra='true']"));
  const rows = fields
    .map((field) => {
      const label = getFieldLabel(field);
      const value = readControlValue(field);
      return value.trim() ? `${label}: ${value.trim()}` : "";
    })
    .filter(Boolean);
  return compactText(rows.join("\n"), maxCharacters);
}
function injectBugSupplementalContextFields() {
  if (typeof document === "undefined") return;
  if (document.querySelector(".qat-bug-supplemental-context")) return;
  const bugPanel = Array.from(document.querySelectorAll<HTMLElement>(".follow-up-answer-box")).find((section) =>
    /refine bug context/i.test(section.textContent ?? "")
  );
  if (!bugPanel) return;
  const evidencePanel = bugPanel.querySelector(".bug-evidence-panel, [data-testid='bug-evidence-panel']");
  const section = document.createElement("div");
  section.className = "bug-refine-section qat-bug-supplemental-context";
  section.innerHTML = `
    <h4>Triage details</h4>
    <p class="bug-refine-help-text">Optional fields QAt and Bug Writer can use before generation.</p>
    <div class="bug-context-grid">
      <label>Severity
        <select data-qat-bug-extra="true" data-qat-label="Severity">
          <option value="">Not selected</option>
          <option value="Critical">Critical</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </label>
      <label>Priority
        <select data-qat-bug-extra="true" data-qat-label="Priority">
          <option value="">Not selected</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </label>
      <label>Expected result
        <textarea data-qat-bug-extra="true" data-qat-label="Expected result" placeholder="What should happen instead?"></textarea>
      </label>
      <label>Actual result
        <textarea data-qat-bug-extra="true" data-qat-label="Actual result" placeholder="What actually happens?"></textarea>
      </label>
      <label>Impact
        <textarea data-qat-bug-extra="true" data-qat-label="Impact" placeholder="Who is affected and how bad is it?"></textarea>
      </label>
    </div>
  `;
  if (evidencePanel) {
    bugPanel.insertBefore(section, evidencePanel);
  } else {
    bugPanel.appendChild(section);
  }
}
function moveBugFollowUpQuestionsUnderReportHeader() {
  if (typeof document === "undefined") return;
  const reportWrap = document.querySelector<HTMLElement>(".bug-report-wrap");
  if (!reportWrap) return;

  const reportHeader = reportWrap.querySelector<HTMLElement>(".report-header");
  const followUpCard = Array.from(reportWrap.querySelectorAll<HTMLElement>(".bug-section-card")).find((section) => {
    const heading = section.querySelector("h3")?.textContent?.trim().toLowerCase();
    return heading === "follow-up questions";
  });

  if (!reportHeader || !followUpCard) return;

  followUpCard.classList.add("bug-followup-priority-card");

  const savedNotice = reportHeader.nextElementSibling instanceof HTMLElement && reportHeader.nextElementSibling.classList.contains("saved-edit-notice")
    ? reportHeader.nextElementSibling
    : null;
  const anchor = savedNotice ?? reportHeader;

  if (anchor.nextElementSibling !== followUpCard) {
    anchor.insertAdjacentElement("afterend", followUpCard);
  }
}
function patchBugWriterFetchOnce() {
  if (typeof window === "undefined") return;
  const win = window as QAtalystWindow;
  if (win.__qatalystBugContextFetchPatched) return;
  win.__qatalystBugContextFetchPatched = true;
  win.__qatalystOriginalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes("/api/improve-bug") && init?.body && typeof init.body === "string") {
      const supplementalContext = readBugSupplementalContext();
      if (supplementalContext) {
        try {
          const body = JSON.parse(init.body) as { input?: unknown };
          const currentInput = String(body.input ?? "");
          if (!currentInput.includes("SUPPLEMENTAL BUG TRIAGE FIELDS")) {
            body.input = [
              currentInput,
              "",
              "SUPPLEMENTAL BUG TRIAGE FIELDS - treat these as already answered if provided:",
              supplementalContext,
            ].join("\n");
            init = { ...init, body: JSON.stringify(body) };
          }
        } catch {
          // Keep original request if the body is not JSON.
        }
      }
    }
    return win.__qatalystOriginalFetch ? win.__qatalystOriginalFetch(input, init) : fetch(input, init);
  };
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
  chatIntro = "Ask QAt about this project using saved Project Brain context.",
  chatPlaceholder = "Ask QAt about this project...",
  chatResponse = "I can take the question, but I need Project Brain context before I can answer safely.",
  chatProjectId = null,
}: QAtCompanionRailProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<QAtCompanionChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => { setIsCollapsed(window.localStorage.getItem(storageKey) === "true"); }, [storageKey]);
  useEffect(() => {
    if (!className.includes("qat-companion-panel-bug")) return;
    injectBugSupplementalContextFields();
    moveBugFollowUpQuestionsUnderReportHeader();
    patchBugWriterFetchOnce();
    const intervalId = window.setInterval(() => {
      injectBugSupplementalContextFields();
      moveBugFollowUpQuestionsUnderReportHeader();
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [className]);

  function toggleCollapsed() {
    setIsCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(storageKey, String(next));
      return next;
    });
  }

  function buildContextualAsk(): { question: string; displayQuestion: string; workflowContext: QAtWorkflowContext } {
    const pathname = typeof window !== "undefined" ? window.location.pathname : "";
    const isBrainPage = pathname.startsWith("/brain") || className.includes("brain");
    const isIntegrationPage = pathname.includes("settings") || pathname.includes("integrations");
    const activeTool = className.match(/qat-companion-panel-([a-z-]+)/)?.[1];
    const workflowState = stateLabel || (readText("[data-testid='qa-output']", 200) ? "Reviewing" : "Waiting");

    if (isBrainPage) {
      const setupState = [
        `Current Brain companion title: ${title}`,
        `Current Brain companion guidance: ${body}`,
        progressPercent !== undefined ? `Brain setup progress: ${progressPercent}%` : "",
        steps.length ? `Setup steps: ${steps.map((step) => `${step.label}: ${step.complete ? "complete" : "missing"}${step.active ? " (active)" : ""}`).join("; ")}` : "",
        signals.length ? `Signals: ${signals.map((signal) => `${signal.label}: ${signal.value ?? signal.state ?? "unknown"}`).join("; ")}` : "",
        recommendations.length ? `Recommendations: ${recommendations.map((recommendation) => `${recommendation.label} - ${recommendation.body}`).join("; ")}` : "",
        `Visible Brain section: ${readText(".brain-panel", 5000)}`,
        `Visible form values: ${readVisibleFormValues(4000)}`,
      ].filter(Boolean).join("\n");
      return { question: "Review my current Project Brain setup and tell me the next best step.", displayQuestion: "Ask QAt: review current Brain setup", workflowContext: { page: "brain", workflowState, setupState: compactText(setupState, 9000) } };
    }

    const sourceInput = readTextAreaValue("[data-testid='qa-source-input']", 7000);
    const generatedOutput = readText("[data-testid='qa-output']", 9000);
    const followUpContext = readFollowUpContext(5000);
    const contextSummary = readText(".qa-context-used-line", 1000);
    const liveFormValues = readVisibleFormValues(7000);
    const outputExists = Boolean(generatedOutput && !generatedOutput.includes("No generated artifact yet"));
    const inputExists = Boolean(sourceInput || liveFormValues);
    const question = outputExists
      ? `Review my current ${title} output and tell me the most important QA risks, gaps, and next steps.`
      : inputExists
        ? `Review my current ${title} input before I run it. Tell me what looks risky, missing, or worth clarifying.`
        : `Review my current ${title} workflow state and tell me what I should do next.`;

    return {
      question,
      displayQuestion: `Ask QAt: review current ${activeTool ?? "workflow"}`,
      workflowContext: {
        page: isIntegrationPage ? "integrations" : "toolbelt",
        activeTool: activeTool ?? title,
        workflowState,
        sourceInput: compactText([sourceInput, liveFormValues ? `Live form/refinement values:\n${liveFormValues}` : ""].filter(Boolean).join("\n\n"), 12000),
        generatedOutput,
        followUpContext,
        setupState: compactText([
          `Companion title: ${title}`,
          `Companion guidance: ${body}`,
          contextSummary ? `Project context line: ${contextSummary}` : "",
          tip ? `Current tip: ${tip.title} - ${tip.body}` : "",
        ].filter(Boolean).join("\n"), 3000),
      },
    };
  }

  async function submitChatQuestion(question: string, options?: { displayQuestion?: string; workflowContext?: QAtWorkflowContext }) {
    const cleanedQuestion = question.trim();
    if (!cleanedQuestion) { chatInputRef.current?.focus(); return; }
    const timestamp = Date.now();
    const fallbackAnswer = chatProjectId ? chatResponse : "Select a project before asking QAt.";
    const displayQuestion = options?.displayQuestion?.trim() || cleanedQuestion;
    setChatMessages((current) => [...current, { id: `user-${timestamp}`, role: "user", body: displayQuestion }]);
    setChatInput("");
    if (!chatProjectId) {
      setChatMessages((current) => [...current, { id: `assistant-${timestamp}`, role: "assistant", body: fallbackAnswer }]);
      return;
    }
    setIsChatLoading(true);
    try {
      const response = await fetch("/api/qat/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: chatProjectId, question: cleanedQuestion, workflowContext: options?.workflowContext }) });
      const payload = (await response.json().catch(() => null)) as ({ ok?: boolean; message?: string } & Partial<QAtChatResult>) | null;
      if (!response.ok || payload?.ok === false) throw new Error(payload?.message || "QAt could not answer from Project Brain context.");
      setChatMessages((current) => [...current, { id: `assistant-${timestamp}`, role: "assistant", body: formatChatAnswer({ answer: String(payload?.answer ?? fallbackAnswer), usedSources: payload?.usedSources, missingContext: payload?.missingContext }) }]);
    } catch (error) {
      setChatMessages((current) => [...current, { id: `assistant-${timestamp}`, role: "assistant", body: error instanceof Error ? error.message : "QAt could not answer from Project Brain context." }]);
    } finally {
      setIsChatLoading(false);
    }
  }

  async function handleChatSubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); await submitChatQuestion(chatInput); }
  async function handleContextualAsk() {
    if (!chatEnabled) return;
    const contextualAsk = buildContextualAsk();
    await submitChatQuestion(contextualAsk.question, { displayQuestion: contextualAsk.displayQuestion, workflowContext: contextualAsk.workflowContext });
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
  const hasContextualSuggestion = (stateLabel ?? "waiting").trim().toLowerCase() !== "waiting";
  const visibleActions = actions.filter((action) => {
    const label = action.label.trim().toLowerCase();
    return label !== "ask qat" && label !== "open brain";
  });

  return (
    <aside className={cx("qat-companion-rail", className)} aria-label="QAt Companion" data-testid="qat-companion-rail">
      <div className="qat-companion-rail-shell-header">
        <p className="qat-companion-rail-eyebrow">{eyebrow}</p>
        <button className="qat-companion-rail-minimize" type="button" onClick={toggleCollapsed} aria-label="Minimize QAt Companion" data-testid="qat-companion-minimize">Min</button>
      </div>

      <div className="qat-companion-rail-mascot-stage" aria-hidden="true" data-testid="qat-companion-mascot">
        {videoSrc ? <video className="qat-companion-rail-mascot" src={videoSrc} autoPlay loop muted playsInline /> : <img className="qat-companion-rail-mascot" src={imageSrc} alt="" />}
      </div>

      {chatEnabled ? (
        <section className="qat-companion-rail-chat" aria-label="QAt Box" data-testid="qat-companion-rail-chat">
          <div className="qat-companion-rail-chat-header"><strong>{chatTitle}</strong>{chatIntro ? <span>{chatIntro}</span> : null}</div>
          <div className="qat-companion-rail-chat-log" aria-live="polite" data-testid="qat-companion-rail-chat-log">
            {chatMessages.length ? chatMessages.map((message) => (
              <div key={message.id} className={cx("qat-companion-rail-chat-message", message.role === "assistant" ? "is-assistant" : "is-user")}>
                <small>{message.role === "assistant" ? "QAt" : "You"}</small><p>{message.body}</p>
              </div>
            )) : null}
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
              onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }}
            />
            <button className="qat-companion-rail-chat-submit" type="submit" data-testid="qat-companion-rail-chat-submit" disabled={isChatLoading}>{isChatLoading ? "Checking..." : "Send"}</button>
            <button className={cx("qat-companion-rail-contextual-ask", hasContextualSuggestion ? "is-ready" : "is-idle")} type="button" data-testid="qat-companion-rail-contextual-ask" disabled={isChatLoading} onClick={handleContextualAsk}>{isChatLoading ? "Checking..." : "Ask QAt"}</button>
          </form>
        </section>
      ) : null}

      <section className="qat-companion-rail-copy">
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
      {visibleActions.length ? <div className="qat-companion-rail-actions" aria-label="QAt actions" data-testid="qat-companion-actions">{visibleActions.map((action) => <button key={action.label} type="button" className={action.variant === "primary" ? "is-primary" : undefined} disabled={action.disabled} data-testid={`qat-action-${slugify(action.label)}`} onClick={action.onClick}>{action.label}</button>)}</div> : null}
      {tip ? <div className="qat-companion-rail-tip" data-testid="qat-companion-tip"><strong>{tip.title}</strong><span>{tip.body}</span></div> : null}
      {footer ? <div className="qat-companion-rail-footer">{footer}</div> : null}
    </aside>
  );
}
