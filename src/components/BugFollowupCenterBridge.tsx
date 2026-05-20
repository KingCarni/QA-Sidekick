"use client";

import { useEffect } from "react";

function cleanText(value: string | null | undefined, maxCharacters = 1000): string {
  const clean = String(value ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= maxCharacters) return clean;
  return `${clean.slice(0, maxCharacters).trim()}…`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setNativeTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.dispatchEvent(new Event("change", { bubbles: true }));
}

function getNativeBugFollowupCards(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(".bug-followup-section .follow-up-question-card"));
}

function getNativeBugQuestions(): string[] {
  return getNativeBugFollowupCards()
    .map((card) => cleanText(card.querySelector("strong")?.textContent ?? ""))
    .filter(Boolean);
}

function findNativeCard(question: string): HTMLElement | null {
  const target = cleanText(question);
  return getNativeBugFollowupCards().find((card) => cleanText(card.querySelector("strong")?.textContent ?? "") === target) ?? null;
}

function hideNativeBugFollowups() {
  document.querySelectorAll<HTMLElement>(".bug-followup-section").forEach((section) => {
    section.setAttribute("aria-hidden", "true");
    section.style.display = "none";
  });
}

function ensurePlacement(reportHeader: HTMLElement, box: HTMLElement) {
  const savedNotice = reportHeader.nextElementSibling instanceof HTMLElement && reportHeader.nextElementSibling.classList.contains("saved-edit-notice")
    ? reportHeader.nextElementSibling
    : null;
  const anchor = savedNotice ?? reportHeader;
  if (anchor.nextElementSibling !== box) {
    anchor.insertAdjacentElement("afterend", box);
  }
}

function markCard(card: HTMLElement, status: "Committed" | "No more questions") {
  card.dataset.resolution = status;
  card.classList.toggle("is-committed", status === "Committed");
  card.classList.toggle("is-closed", status === "No more questions");
  card.querySelectorAll<HTMLButtonElement>(".qat-bug-followup-action").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.action === status);
  });
}

function syncNative(question: string, answer: string, resolution: "Resolved" | "No more questions") {
  const nativeCard = findNativeCard(question);
  if (!nativeCard) return;

  const textarea = nativeCard.querySelector<HTMLTextAreaElement>("textarea");
  if (textarea) setNativeTextareaValue(textarea, answer);

  const button = Array.from(nativeCard.querySelectorAll<HTMLButtonElement>("button")).find(
    (candidate) => candidate.textContent?.trim() === resolution,
  );
  button?.click();
}

function handleBridgeClick(event: MouseEvent) {
  const target = event.target instanceof HTMLElement ? event.target : null;
  const button = target?.closest<HTMLButtonElement>(".qat-bug-followup-action");
  if (!button) return;

  const card = button.closest<HTMLElement>(".qat-bug-followup-answer-card");
  if (!card) return;

  event.preventDefault();
  const question = card.getAttribute("data-question") || "";
  const answer = card.querySelector<HTMLTextAreaElement>("textarea")?.value.trim() || "";

  if (button.dataset.action === "No more questions") {
    syncNative(question, answer, "No more questions");
    markCard(card, "No more questions");
    return;
  }

  if (!answer) return;
  syncNative(question, answer, "Resolved");
  markCard(card, "Committed");
}

function renderCenterFollowups() {
  const reportWrap = document.querySelector<HTMLElement>(".bug-report-wrap");
  const reportHeader = reportWrap?.querySelector<HTMLElement>(".report-header");
  if (!reportWrap || !reportHeader) return;

  const questions = getNativeBugQuestions();
  const signature = questions.join("||");
  const existing = reportWrap.querySelector<HTMLElement>(".qat-bug-followup-answer-box");

  if (!questions.length) {
    existing?.remove();
    return;
  }

  if (existing?.dataset.questionSignature === signature) {
    ensurePlacement(reportHeader, existing);
    return;
  }

  if (existing && existing.contains(document.activeElement)) return;

  const saved = new Map<string, { answer: string; resolution: string }>();
  existing?.querySelectorAll<HTMLElement>(".qat-bug-followup-answer-card").forEach((card) => {
    const question = card.getAttribute("data-question") || "";
    saved.set(question, {
      answer: card.querySelector<HTMLTextAreaElement>("textarea")?.value || "",
      resolution: card.dataset.resolution || "Open",
    });
  });

  const box = existing ?? document.createElement("section");
  box.className = "bug-section-card qat-bug-followup-answer-box";
  box.dataset.questionSignature = signature;
  box.setAttribute("data-testid", "qat-bug-followup-answer-box");
  box.innerHTML = `
    <div class="qat-bug-followup-answer-header">
      <div>
        <p class="report-kicker">Generated follow-ups</p>
        <h3>Answer follow-up questions</h3>
      </div>
      <span>${questions.length} active</span>
    </div>
    <p class="field-text">Answer these, then commit them into the report. Committing follow-up answers does not spend credits.</p>
    <div class="qat-bug-followup-answer-list">
      ${questions.map((question, index) => {
        const previous = saved.get(question) ?? { answer: "", resolution: "Open" };
        const escapedQuestion = escapeHtml(question);
        const escapedAnswer = escapeHtml(previous.answer);
        const statusClass = previous.resolution === "Committed" ? " is-committed" : previous.resolution === "No more questions" ? " is-closed" : "";
        return `
          <article class="qat-bug-followup-answer-card${statusClass}" data-question="${escapedQuestion}" data-resolution="${previous.resolution}">
            <span>Question ${index + 1}</span>
            <strong>${escapedQuestion}</strong>
            <textarea placeholder="Answer this follow-up...">${escapedAnswer}</textarea>
            <div class="qat-bug-followup-actions" aria-label="Follow-up actions">
              <button class="qat-bug-followup-action qat-bug-followup-commit${previous.resolution === "Committed" ? " is-active" : ""}" data-action="Committed" type="button">Commit to report</button>
              <button class="qat-bug-followup-action qat-bug-followup-close${previous.resolution === "No more questions" ? " is-active" : ""}" data-action="No more questions" type="button">No more questions</button>
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;

  ensurePlacement(reportHeader, box);
}

export default function BugFollowupCenterBridge() {
  useEffect(() => {
    document.addEventListener("click", handleBridgeClick);

    const tick = () => {
      hideNativeBugFollowups();
      renderCenterFollowups();
    };

    tick();
    const intervalId = window.setInterval(tick, 1000);

    return () => {
      document.removeEventListener("click", handleBridgeClick);
      window.clearInterval(intervalId);
    };
  }, []);

  return null;
}
