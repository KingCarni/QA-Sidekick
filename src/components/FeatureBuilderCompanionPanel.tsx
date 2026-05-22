"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { publishCreditBalanceUpdated } from "@/lib/credit-balance-events";

type PromptCategory = "brainstorm" | "scope" | "qa" | "acceptance" | "jira";
type ContextConfidence = "full" | "partial" | "minimal";
type MascotState = "idle" | "thinking" | "concern" | "ready";

type FeatureBuilderCompanionPanelProps = {
  draft: string;
  extraContext?: string;
  projectName?: string;
  productType?: string;
  onAppendPrompt: (prompt: string) => void;
};

type CompanionPrompt = {
  title: string;
  prompt: string;
  category: PromptCategory;
  tone: "blue" | "green" | "yellow" | "red";
};

type MissingCallout = { label: string; detail: string; isReady: boolean };
type GuidanceItem = { icon: string; title: string; detail: string; tone: "good" | "watch" | "risk" | "info" };
type QaLens = { id: string; label: string; detail: string; tone: "blue" | "green" | "yellow" | "red" };
type BuilderAction = { title: string; detail: string; prompt: string; tone: "blue" | "green" | "yellow" | "red" };
type LiveInsight = { label: string; value: string; detail: string; tone: "good" | "watch" | "risk" | "info" };
type AiPromptResponse = { ok?: boolean; error?: string; prompts?: CompanionPrompt[]; nextQuestion?: string; credits?: { balanceAfter?: number } };

const CATEGORY_LABELS: Record<PromptCategory, string> = {
  brainstorm: "Brainstorm",
  scope: "Scope",
  qa: "QA",
  acceptance: "Acceptance",
  jira: "Jira",
};

const CATEGORY_DESCRIPTIONS: Record<PromptCategory, string> = {
  brainstorm: "User, pain, value.",
  scope: "MVP boundaries.",
  qa: "Risk and edges.",
  acceptance: "Done states.",
  jira: "Ticket shape.",
};

const companionShellStyle: CSSProperties = {
  position: "sticky",
  top: "88px",
  alignSelf: "start",
  maxHeight: "calc(100vh - 108px)",
  overflowY: "auto",
  border: "1px solid rgba(59, 130, 246, 0.28)",
  borderRadius: "24px",
  background:
    "radial-gradient(circle at top left, rgba(59, 130, 246, 0.16), transparent 34%), radial-gradient(circle at 82% 8%, rgba(248, 113, 113, 0.12), transparent 32%), linear-gradient(145deg, rgba(8, 13, 27, 0.96), rgba(4, 5, 10, 0.98))",
  boxShadow: "0 24px 70px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255,255,255,0.06)",
};
const companionPadStyle: CSSProperties = { padding: "16px" };
const headerGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "72px minmax(0, 1fr) auto", gap: "12px", alignItems: "center" };
const mascotBadgeStyle: CSSProperties = { alignItems: "center", background: "linear-gradient(135deg, rgba(234, 179, 8, 0.16), rgba(239, 68, 68, 0.12))", border: "1px solid rgba(250, 204, 21, 0.28)", borderRadius: "20px", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)", display: "flex", height: "72px", justifyContent: "center", overflow: "hidden", position: "relative" };
const mascotImageStyle: CSSProperties = { display: "block", height: "64px", objectFit: "contain", width: "64px" };
const confidencePillBaseStyle: CSSProperties = { borderRadius: "999px", display: "inline-flex", flexDirection: "column", gap: "1px", minWidth: "108px", padding: "8px 10px", textAlign: "right" };
const guidanceCardStyle: CSSProperties = { border: "1px solid rgba(148, 163, 184, 0.18)", borderRadius: "16px", background: "rgba(0, 0, 0, 0.24)", padding: "12px" };
const categoryGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "7px", marginTop: "10px" };
const categoryButtonBaseStyle: CSSProperties = { border: "1px solid rgba(148, 163, 184, 0.2)", borderRadius: "13px", color: "#fff", cursor: "pointer", minHeight: "62px", padding: "8px", textAlign: "left" };
const activeCategoryButtonStyle: CSSProperties = { background: "radial-gradient(circle at top left, rgba(255,255,255,0.14), transparent 32%), linear-gradient(135deg, rgba(220, 38, 38, 0.92), rgba(127, 29, 29, 0.94))", border: "1px solid rgba(248, 113, 113, 0.48)", boxShadow: "0 14px 30px rgba(220, 38, 38, 0.18)" };
const inactiveCategoryButtonStyle: CSSProperties = { background: "radial-gradient(circle at top left, rgba(255,255,255,0.08), transparent 34%), linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(3, 7, 18, 0.9))" };
const promptGridStyle: CSSProperties = { display: "grid", gap: "9px", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))" };
const promptButtonStyle: CSSProperties = { borderRadius: "15px", color: "#fff", cursor: "pointer", display: "flex", flexDirection: "column", gap: "6px", minHeight: "86px", padding: "11px", textAlign: "left" };
const askAiButtonStyle: CSSProperties = { alignItems: "center", background: "linear-gradient(135deg, #2563eb, #1d4ed8)", border: "1px solid rgba(147, 197, 253, 0.38)", borderRadius: "999px", color: "#fff", display: "inline-flex", gap: "8px", fontSize: "0.75rem", fontWeight: 950, padding: "8px 11px" };
const guidanceItemStyle: CSSProperties = { alignItems: "flex-start", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", display: "grid", gap: "9px", gridTemplateColumns: "24px minmax(0, 1fr)", padding: "9px" };
const lensGridStyle: CSSProperties = { display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "10px" };
const compactDetailsStyle: CSSProperties = { ...guidanceCardStyle, marginTop: "10px", padding: "10px 12px" };
const liveInsightsGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "8px", marginTop: "10px" };

function splitWords(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter(Boolean);
}
function includesAny(value: string, terms: RegExp[]) { return terms.some((term) => term.test(value)); }
function getSignals(draft: string, extraContext = "") {
  const combined = `${draft}\n${extraContext}`;
  const words = splitWords(combined);
  const hasUser = includesAny(combined, [/\b(user|player|admin|qa|tester|developer|dev|customer|manager|teacher|student|product owner|pm)\b/i]);
  const hasOutcome = includesAny(combined, [/\b(so that|because|goal|value|benefit|should|need|want|improve|reduce|increase|prevent|avoid|faster|easier|clearer)\b/i]);
  const hasScope = includesAny(combined, [/\b(in scope|out of scope|phase|mvp|first version|first pass|later|future|not included|exclude|defer)\b/i]);
  const hasRisk = includesAny(combined, [/\b(risk|edge|fail|failure|error|bug|security|permission|privacy|performance|stale|sync|regression|bad input)\b/i]);
  const hasAcceptance = includesAny(combined, [/\b(acceptance|given|when|then|criteria|success|done|validate|verify|must|should be able)\b/i]);
  const hasJira = includesAny(combined, [/\b(jira|ticket|issue|story|task|epic|subtask|sub-task|project key|issue type)\b/i]);
  const hasRoles = includesAny(combined, [/\b(admin|role|permission|auth|login|account|owner|member|access)\b/i]);
  const hasAsync = includesAny(combined, [/\b(upload|sync|import|export|background|processing|queue|webhook|callback|loading|refresh)\b/i]);
  const hasAi = includesAny(combined, [/\b(ai|prompt|generate|generated|model|companion|qat|assistant|suggestion)\b/i]);
  const hasBilling = includesAny(combined, [/\b(credit|credits|billing|stripe|checkout|purchase|subscription|price|paid)\b/i]);
  const hasData = includesAny(combined, [/\b(save|saved|database|source vault|project brain|context|memory|history|delete|archive)\b/i]);
  const hasIntegration = includesAny(combined, [/\b(jira|testrail|api|token|integration|webhook|sync|external)\b/i]);
  const hasUi = includesAny(combined, [/\b(button|modal|panel|dropdown|screen|page|form|field|input|toast|sidebar|mobile)\b/i]);
  return { wordCount: words.length, hasUser, hasOutcome, hasScope, hasRisk, hasAcceptance, hasJira, hasRoles, hasAsync, hasAi, hasBilling, hasData, hasIntegration, hasUi };
}
function getMissingCallouts(draft: string, extraContext = ""): MissingCallout[] {
  const signals = getSignals(draft, extraContext);
  return [
    { label: "Target user", detail: signals.hasUser ? "Target user signal found." : "Name who this is for and what they are trying to do.", isReady: signals.hasUser },
    { label: "User value", detail: signals.hasOutcome ? "Outcome/value signal found." : "Explain the pain solved or the outcome improved.", isReady: signals.hasOutcome },
    { label: "MVP scope", detail: signals.hasScope ? "Scope boundary signal found." : "Separate first-pass scope from later-phase ideas.", isReady: signals.hasScope },
    { label: "Acceptance criteria", detail: signals.hasAcceptance ? "Testable done signal found." : "Add testable success conditions before build starts.", isReady: signals.hasAcceptance },
    { label: "QA risk", detail: signals.hasRisk ? "Risk/failure signal found." : "Call out edge cases, stale state, permissions, or failure modes.", isReady: signals.hasRisk },
  ];
}
function getReadinessScore(draft: string, extraContext = "") {
  const callouts = getMissingCallouts(draft, extraContext);
  return Math.round((callouts.filter((item) => item.isReady).length / callouts.length) * 100);
}
function getContextConfidence(args: { draft: string; extraContext: string; projectName: string; productType: string }): ContextConfidence {
  const signals = getSignals(args.draft, args.extraContext);
  const score = [Boolean(args.projectName.trim()), Boolean(args.productType.trim()), args.extraContext.trim().length >= 40, signals.wordCount >= 35].filter(Boolean).length;
  if (score >= 3) return "full";
  if (score >= 1) return "partial";
  return "minimal";
}
function getConfidenceCopy(confidence: ContextConfidence) {
  if (confidence === "full") return { label: "Full context", detail: "Project + draft signals are strong.", color: "#86efac", border: "1px solid rgba(134, 239, 172, 0.36)", background: "rgba(22, 101, 52, 0.22)" };
  if (confidence === "partial") return { label: "Partial context", detail: "Useful, but QAt may need more detail.", color: "#fde68a", border: "1px solid rgba(250, 204, 21, 0.34)", background: "rgba(113, 63, 18, 0.24)" };
  return { label: "Minimal context", detail: "QAt can start, but expect broad guidance.", color: "#fecaca", border: "1px solid rgba(248, 113, 113, 0.34)", background: "rgba(127, 29, 29, 0.22)" };
}
function buildQaLenses(draft: string, extraContext = ""): QaLens[] {
  const signals = getSignals(draft, extraContext);
  const lenses: QaLens[] = [];
  if (signals.hasRoles) lenses.push({ id: "permissions", label: "Permissions", detail: "Roles, blocked users, safe failures.", tone: "yellow" });
  if (signals.hasAsync) lenses.push({ id: "async", label: "Async/state", detail: "Loading, retry, stale state, duplicates.", tone: "red" });
  if (signals.hasAi) lenses.push({ id: "ai", label: "AI review", detail: "Reviewable, editable, grounded output.", tone: "blue" });
  if (signals.hasBilling) lenses.push({ id: "billing", label: "Billing/credits", detail: "Duplicate charges, failed spends, pricing clarity.", tone: "red" });
  if (signals.hasData) lenses.push({ id: "data", label: "Persistence", detail: "Save, restore, ownership, delete behavior.", tone: "green" });
  if (signals.hasIntegration) lenses.push({ id: "integration", label: "Integration", detail: "Auth, API errors, mapping, preview sync.", tone: "yellow" });
  if (signals.hasUi) lenses.push({ id: "ui", label: "UX clarity", detail: "Empty, loading, error, success, mobile states.", tone: "blue" });
  if (!lenses.length && draft.trim()) lenses.push({ id: "general", label: "General QA", detail: "Failure states, ownership, criteria, regressions.", tone: "yellow" });
  return lenses.slice(0, 4);
}
function getSuggestedNextQuestion(draft: string, extraContext = "") {
  const missing = getMissingCallouts(draft, extraContext).find((item) => !item.isReady);
  const signals = getSignals(draft, extraContext);
  if (!draft.trim()) return "What feature are you trying to create, and who needs it?";
  if (missing?.label === "Target user") return "Who is the primary user for this feature?";
  if (missing?.label === "User value") return "What gets easier, faster, safer, or clearer once this feature exists?";
  if (signals.hasIntegration) return "What should happen if the integration succeeds, fails, times out, or returns partial data?";
  if (signals.hasRoles) return "Which user roles can use this feature, and what should blocked users see?";
  if (missing?.label === "MVP scope") return "What is included in the first version, and what should be deferred?";
  if (missing?.label === "Acceptance criteria") return "What would prove this feature works from a user point of view?";
  if (missing?.label === "QA risk") return "What could go wrong with bad input, permissions, stale state, or failed integrations?";
  return "What is the next decision needed before this can become a Jira-ready feature?";
}
function buildGuidanceFeed(args: { draft: string; extraContext: string; projectName: string; productType: string; readinessScore: number; confidence: ContextConfidence; lenses: QaLens[] }): GuidanceItem[] {
  const missing = getMissingCallouts(args.draft, args.extraContext).filter((item) => !item.isReady);
  const signals = getSignals(args.draft, args.extraContext);
  const items: GuidanceItem[] = [];
  if (signals.hasAi) items.push({ icon: "🤖", title: "AI workflow detected", detail: "Keep output reviewable before saving, syncing, or creating Jira work.", tone: "info" });
  if (signals.hasIntegration) items.push({ icon: "🔌", title: "Integration surface detected", detail: "Plan auth failures, permission mismatches, field mapping, and timeouts.", tone: "watch" });
  if (signals.hasBilling) items.push({ icon: "💳", title: "Credit/billing risk detected", detail: "Protect duplicate clicks, failed charges, and confusing pricing copy.", tone: "risk" });
  if (missing[0]) items.push({ icon: "🔎", title: `${missing[0].label} is the next gap`, detail: missing[0].detail, tone: "watch" });
  if (!signals.hasRisk && args.draft.trim()) items.push({ icon: "⚠️", title: "No risk lens yet", detail: "Add failure modes, permissions, stale state, bad input, or regression areas.", tone: "risk" });
  if (signals.hasAcceptance && signals.hasScope && signals.hasRisk) items.push({ icon: "✅", title: "This is getting buildable", detail: "Scope, acceptance, and risk signals are present. Next: preview Jira work.", tone: "good" });
  if (args.projectName && items.length < 3) items.push({ icon: "🧠", title: `Using ${args.projectName}`, detail: "Project context is available for this builder session.", tone: "info" });
  if (!items.length) items.push({ icon: "🧱", title: "Start rough", detail: "Give me the messy idea. QAt will turn it into scope, criteria, risks, and Jira work.", tone: "info" });
  return items.slice(0, 3);
}
function buildLiveInsights(draft: string, extraContext = ""): LiveInsight[] {
  const signals = getSignals(draft, extraContext);
  const lenses = buildQaLenses(draft, extraContext);
  return [
    { label: "User", value: signals.hasUser ? "Detected" : "Missing", detail: signals.hasUser ? "There is a usable actor/user signal." : "Add the role/person this helps.", tone: signals.hasUser ? "good" : "watch" },
    { label: "Value", value: signals.hasOutcome ? "Detected" : "Missing", detail: signals.hasOutcome ? "Outcome language is present." : "State what gets better after release.", tone: signals.hasOutcome ? "good" : "watch" },
    { label: "Scope", value: signals.hasScope ? "Bounded" : "Open", detail: signals.hasScope ? "MVP or boundary signal found." : "Define first pass vs later work.", tone: signals.hasScope ? "good" : "watch" },
    { label: "Risk", value: signals.hasRisk ? "Present" : "Thin", detail: signals.hasRisk ? "Risk language is present." : "Add failure modes before Jira creation.", tone: signals.hasRisk ? "good" : "risk" },
    { label: "Lens", value: lenses[0]?.label ?? "None yet", detail: lenses[0]?.detail ?? "No specialized QA lens detected yet.", tone: lenses[0]?.tone === "red" ? "risk" : lenses[0]?.tone === "yellow" ? "watch" : lenses[0] ? "info" : "watch" },
    { label: "Jira", value: signals.hasJira || (signals.hasScope && signals.hasAcceptance) ? "Can shape" : "Not ready", detail: signals.hasJira ? "Jira language is present." : "Scope + criteria improves Jira output.", tone: signals.hasJira || (signals.hasScope && signals.hasAcceptance) ? "good" : "watch" },
  ];
}
function buildBuilderActions(draft: string, extraContext = ""): BuilderAction[] {
  const signals = getSignals(draft, extraContext);
  const lenses = buildQaLenses(draft, extraContext);
  const actions: BuilderAction[] = [];
  if (!signals.hasUser) actions.push({ title: "Define user", detail: "Add who this helps and what they need.", tone: "blue", prompt: "Primary user: \nUser goal: \nCurrent pain: " });
  if (!signals.hasScope) actions.push({ title: "Shape MVP", detail: "Add first-pass boundaries.", tone: "green", prompt: "MVP scope: \nOut of scope for this pass: \nFuture follow-up ideas: " });
  if (!signals.hasAcceptance) actions.push({ title: "Add criteria", detail: "Make success testable.", tone: "green", prompt: "Acceptance criteria:\n- Given [context], when [action], then [observable result].\n- Given [failure/edge case], when [action], then [safe behavior]." });
  if (!signals.hasRisk || lenses.length) actions.push({ title: "Add QA risks", detail: "Turn detected lenses into test targets.", tone: "red", prompt: `QA risks to cover:\n${(lenses.length ? lenses : [{ label: "General QA", detail: "Failure states, permissions, stale state, bad input, and regression areas." }]).map((lens) => `- ${lens.label}: ${lens.detail}`).join("\n")}` });
  if (signals.hasScope && signals.hasAcceptance) actions.push({ title: "Prep Jira work", detail: "Move from feature idea to ticket shape.", tone: "yellow", prompt: "Jira-ready structure:\nParent ticket summary: \nImplementation tasks: \nQA tasks: \nReview/approval needed before creation: " });
  return actions.slice(0, 3);
}
function buildLocalPrompts(category: PromptCategory, draft: string, extraContext = ""): CompanionPrompt[] {
  const signals = getSignals(draft, extraContext);
  const lenses = buildQaLenses(draft, extraContext);
  const prompts: Record<PromptCategory, CompanionPrompt[]> = {
    brainstorm: [
      { title: "Start with user", category: "brainstorm", tone: "blue", prompt: "Who needs this feature, and what job are they trying to complete?" },
      { title: "Name pain", category: "brainstorm", tone: "blue", prompt: "What is frustrating, slow, risky, or unclear today?" },
      { title: "Describe win", category: "brainstorm", tone: "green", prompt: "What should the user be able to do after this feature ships?" },
    ],
    scope: [
      { title: "Define MVP", category: "scope", tone: "green", prompt: "What is the smallest useful first version of this feature?" },
      { title: "Boundary", category: "scope", tone: "yellow", prompt: "What is explicitly out of scope for this pass?" },
      { title: "Future lane", category: "scope", tone: "blue", prompt: "What would be useful later, but should not block the first release?" },
    ],
    qa: [
      { title: "Bad input", category: "qa", tone: "red", prompt: "What should happen when the user submits incomplete, vague, or invalid input?" },
      { title: "State risk", category: "qa", tone: "red", prompt: "What stale state, refresh, permission, or saved-config issues could affect this feature?" },
      { title: "Regression", category: "qa", tone: "yellow", prompt: "What existing workflows could break when this feature is added?" },
    ],
    acceptance: [
      { title: "G/W/T", category: "acceptance", tone: "green", prompt: "Write 3 acceptance criteria in Given/When/Then format." },
      { title: "Success state", category: "acceptance", tone: "green", prompt: "What should the user see when the action succeeds?" },
      { title: "Failure state", category: "acceptance", tone: "red", prompt: "What useful error should the user see when the action fails?" },
    ],
    jira: [
      { title: "Ticket shape", category: "jira", tone: "blue", prompt: "What should the Jira title, description, issue type, and acceptance criteria include?" },
      { title: "Child work", category: "jira", tone: "blue", prompt: "What implementation tasks or QA tasks should be created under this feature?" },
      { title: "Guardrail", category: "jira", tone: "yellow", prompt: "What must the user preview or approve before anything is created in Jira?" },
    ],
  };
  const categoryPrompts = [...prompts[category]];
  if (!signals.hasUser && category !== "brainstorm") categoryPrompts.unshift({ title: "Missing user", category, tone: "yellow", prompt: "Add the primary user before expanding this section." });
  if (!signals.hasScope && category !== "scope") categoryPrompts.push({ title: "Scope check", category, tone: "yellow", prompt: "What belongs in the first release, and what should wait?" });
  if (category === "qa" && lenses[0]) categoryPrompts.unshift({ title: lenses[0].label, category: "qa", tone: lenses[0].tone, prompt: lenses[0].detail });
  return categoryPrompts.slice(0, 4);
}
function getPromptStyle(tone: CompanionPrompt["tone"] | BuilderAction["tone"], isAi = false): CSSProperties {
  const toneStyles: Record<CompanionPrompt["tone"], CSSProperties> = {
    blue: { background: "linear-gradient(135deg, rgba(30, 64, 175, 0.44), rgba(15, 23, 42, 0.86))", border: "1px solid rgba(96, 165, 250, 0.34)" },
    green: { background: "linear-gradient(135deg, rgba(22, 101, 52, 0.42), rgba(15, 23, 42, 0.86))", border: "1px solid rgba(134, 239, 172, 0.32)" },
    yellow: { background: "linear-gradient(135deg, rgba(113, 63, 18, 0.44), rgba(15, 23, 42, 0.86))", border: "1px solid rgba(250, 204, 21, 0.32)" },
    red: { background: "linear-gradient(135deg, rgba(127, 29, 29, 0.46), rgba(15, 23, 42, 0.86))", border: "1px solid rgba(248, 113, 113, 0.34)" },
  };
  return { ...promptButtonStyle, ...toneStyles[tone], boxShadow: isAi ? "0 14px 30px rgba(37, 99, 235, 0.16)" : "none" };
}
function getGuidanceStyle(tone: GuidanceItem["tone"]): CSSProperties {
  const colors: Record<GuidanceItem["tone"], CSSProperties> = {
    good: { borderColor: "rgba(134, 239, 172, 0.3)", background: "rgba(22, 101, 52, 0.14)" },
    watch: { borderColor: "rgba(250, 204, 21, 0.28)", background: "rgba(113, 63, 18, 0.13)" },
    risk: { borderColor: "rgba(248, 113, 113, 0.3)", background: "rgba(127, 29, 29, 0.14)" },
    info: { borderColor: "rgba(96, 165, 250, 0.28)", background: "rgba(30, 64, 175, 0.13)" },
  };
  return { ...guidanceItemStyle, ...colors[tone] };
}
function getInsightStyle(tone: LiveInsight["tone"]): CSSProperties {
  const colors: Record<LiveInsight["tone"], CSSProperties> = {
    good: { borderColor: "rgba(134, 239, 172, 0.28)", background: "rgba(22, 101, 52, 0.13)" },
    watch: { borderColor: "rgba(250, 204, 21, 0.28)", background: "rgba(113, 63, 18, 0.13)" },
    risk: { borderColor: "rgba(248, 113, 113, 0.28)", background: "rgba(127, 29, 29, 0.13)" },
    info: { borderColor: "rgba(96, 165, 250, 0.28)", background: "rgba(30, 64, 175, 0.13)" },
  };
  return { ...colors[tone], border: colors[tone].borderColor as string, borderRadius: "13px", padding: "9px 10px" };
}
function getLensStyle(tone: QaLens["tone"]): CSSProperties {
  const styles: Record<QaLens["tone"], CSSProperties> = {
    blue: { border: "1px solid rgba(96, 165, 250, 0.3)", background: "rgba(30, 64, 175, 0.14)" },
    green: { border: "1px solid rgba(134, 239, 172, 0.28)", background: "rgba(22, 101, 52, 0.14)" },
    yellow: { border: "1px solid rgba(250, 204, 21, 0.3)", background: "rgba(113, 63, 18, 0.14)" },
    red: { border: "1px solid rgba(248, 113, 113, 0.3)", background: "rgba(127, 29, 29, 0.14)" },
  };
  return { ...styles[tone], borderRadius: "999px", padding: "7px 10px" };
}
function getMascotState(args: { readinessScore: number; hasRiskLens: boolean; isLoadingAiPrompts: boolean; draft: string }): MascotState {
  if (args.isLoadingAiPrompts) return "thinking";
  if (args.readinessScore >= 80) return "ready";
  if (args.draft.trim() && args.hasRiskLens) return "concern";
  return "idle";
}
function getMascotFrameStyle(state: MascotState): CSSProperties {
  if (state === "ready") return { borderColor: "rgba(134, 239, 172, 0.42)", boxShadow: "0 0 26px rgba(34, 197, 94, 0.12), inset 0 1px 0 rgba(255,255,255,0.08)" };
  if (state === "concern") return { borderColor: "rgba(250, 204, 21, 0.42)", boxShadow: "0 0 26px rgba(250, 204, 21, 0.12), inset 0 1px 0 rgba(255,255,255,0.08)" };
  if (state === "thinking") return { borderColor: "rgba(96, 165, 250, 0.42)", boxShadow: "0 0 26px rgba(59, 130, 246, 0.14), inset 0 1px 0 rgba(255,255,255,0.08)" };
  return {};
}
function getBriefingText(args: { readinessScore: number; confidence: ContextConfidence; qaLenses: QaLens[]; missingCallouts: MissingCallout[] }) {
  const missing = args.missingCallouts.filter((item) => !item.isReady).map((item) => item.label.toLowerCase());
  const lensNames = args.qaLenses.map((lens) => lens.label.toLowerCase());
  if (args.readinessScore >= 80) return "Nearly Jira-ready. Verify acceptance criteria, risk coverage, and child task shape.";
  if (lensNames.length) return `Watching ${lensNames.slice(0, 2).join(" + ")} risk. Resolve ${missing[0] || "the next gap"} before creating work.`;
  return `Need ${missing[0] || "more detail"} next. Add one concrete detail and QAt will tighten the next move.`;
}
function getWorkflowHint(readinessScore: number) {
  if (readinessScore >= 80) return "Ready to shape Jira work";
  if (readinessScore >= 50) return "Good draft, still needs polish";
  if (readinessScore > 0) return "Keep shaping before generation";
  return "Start with the rough idea";
}

export default function FeatureBuilderCompanionPanel({ draft, extraContext = "", projectName = "", productType = "", onAppendPrompt }: FeatureBuilderCompanionPanelProps) {
  const [activeCategory, setActiveCategory] = useState<PromptCategory>("brainstorm");
  const [aiPrompts, setAiPrompts] = useState<CompanionPrompt[]>([]);
  const [aiNextQuestion, setAiNextQuestion] = useState("");
  const [isLoadingAiPrompts, setIsLoadingAiPrompts] = useState(false);
  const [aiError, setAiError] = useState("");
  const readinessScore = useMemo(() => getReadinessScore(draft, extraContext), [draft, extraContext]);
  const missingCallouts = useMemo(() => getMissingCallouts(draft, extraContext), [draft, extraContext]);
  const qaLenses = useMemo(() => buildQaLenses(draft, extraContext), [draft, extraContext]);
  const liveInsights = useMemo(() => buildLiveInsights(draft, extraContext), [draft, extraContext]);
  const confidence = useMemo(() => getContextConfidence({ draft, extraContext, projectName, productType }), [draft, extraContext, projectName, productType]);
  const confidenceCopy = useMemo(() => getConfidenceCopy(confidence), [confidence]);
  const guidanceFeed = useMemo(() => buildGuidanceFeed({ draft, extraContext, projectName, productType, readinessScore, confidence, lenses: qaLenses }), [draft, extraContext, projectName, productType, readinessScore, confidence, qaLenses]);
  const nextQuestion = useMemo(() => aiNextQuestion || getSuggestedNextQuestion(draft, extraContext), [aiNextQuestion, draft, extraContext]);
  const localPrompts = useMemo(() => buildLocalPrompts(activeCategory, draft, extraContext), [activeCategory, draft, extraContext]);
  const builderActions = useMemo(() => buildBuilderActions(draft, extraContext), [draft, extraContext]);
  const briefingText = useMemo(() => getBriefingText({ readinessScore, confidence, qaLenses, missingCallouts }), [readinessScore, confidence, qaLenses, missingCallouts]);
  const mascotState = useMemo(() => getMascotState({ readinessScore, hasRiskLens: qaLenses.some((lens) => lens.tone === "red" || lens.tone === "yellow"), isLoadingAiPrompts, draft }), [readinessScore, qaLenses, isLoadingAiPrompts, draft]);
  const canAskAi = draft.trim().length >= 80 && !isLoadingAiPrompts;

  async function requestAiPrompts() {
    if (!canAskAi) return;
    setIsLoadingAiPrompts(true);
    setAiError("");
    try {
      const response = await fetch("/api/feature-builder/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft, extraContext, projectName, productType, category: activeCategory, readinessScore, contextConfidence: confidence, activeQaLenses: qaLenses, missingCallouts: missingCallouts.filter((item) => !item.isReady), liveInsights }),
      });
      const payload = (await response.json().catch(() => null)) as AiPromptResponse | null;
      if (!response.ok || payload?.ok === false) throw new Error(payload?.error || "Could not generate AI prompt suggestions.");
      setAiPrompts(payload?.prompts ?? []);
      setAiNextQuestion(payload?.nextQuestion ?? "");
      if (typeof payload?.credits?.balanceAfter === "number") publishCreditBalanceUpdated(payload.credits.balanceAfter);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Could not generate AI prompt suggestions.");
    } finally {
      setIsLoadingAiPrompts(false);
    }
  }

  return (
    <aside className="feature-builder-companion-card feature-companion-smart-card" style={companionShellStyle}>
      <div style={companionPadStyle}>
        <div style={headerGridStyle}>
          <div aria-hidden="true" style={{ ...mascotBadgeStyle, ...getMascotFrameStyle(mascotState) }}><img alt="" src="/qat/ConstructionQat.png" style={mascotImageStyle} /></div>
          <div><p className="report-kicker">QAt Command Center</p><h3 style={{ color: "#fff", fontSize: "1.08rem", lineHeight: 1.18, margin: "0 0 5px" }}>{getWorkflowHint(readinessScore)}</h3><p style={{ color: "rgba(229,231,235,0.7)", lineHeight: 1.4, margin: 0, fontSize: "0.82rem" }}>{briefingText}</p></div>
          <div style={{ ...confidencePillBaseStyle, background: confidenceCopy.background, border: confidenceCopy.border }}><strong style={{ color: confidenceCopy.color, fontSize: "0.76rem" }}>{confidenceCopy.label}</strong><span style={{ color: "rgba(229,231,235,0.6)", fontSize: "0.66rem", lineHeight: 1.2 }}>{confidenceCopy.detail}</span></div>
        </div>

        <div aria-label={`Readiness score ${readinessScore}%`} role="progressbar" aria-valuenow={readinessScore} aria-valuemin={0} aria-valuemax={100} style={{ marginTop: "13px" }}><div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", gap: "12px", marginBottom: "7px" }}><span style={{ color: "rgba(229,231,235,0.7)", fontSize: "0.72rem", fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase" }}>Readiness</span><strong style={{ color: readinessScore >= 80 ? "#86efac" : readinessScore >= 50 ? "#fde68a" : "#fecaca" }}>{readinessScore}%</strong></div><div style={{ background: "rgba(15,23,42,0.9)", border: "1px solid rgba(148,163,184,0.18)", borderRadius: "999px", height: "9px", overflow: "hidden" }}><span style={{ background: readinessScore >= 80 ? "linear-gradient(90deg, #22c55e, #86efac)" : readinessScore >= 50 ? "linear-gradient(90deg, #f59e0b, #fde68a)" : "linear-gradient(90deg, #ef4444, #fca5a5)", borderRadius: "999px", display: "block", height: "100%", width: `${readinessScore}%` }} /></div></div>

        <section style={{ ...guidanceCardStyle, marginTop: "12px", borderColor: "rgba(96,165,250,0.24)", background: "linear-gradient(135deg, rgba(30,64,175,0.14), rgba(0,0,0,0.24))" }}>
          <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", gap: "10px" }}><p className="report-kicker" style={{ margin: 0 }}>Live insights</p><span style={{ color: "rgba(229,231,235,0.5)", fontSize: "0.68rem", fontWeight: 850 }}>Updates while typing</span></div>
          <div style={liveInsightsGridStyle}>{liveInsights.map((insight) => <div key={insight.label} title={insight.detail} style={getInsightStyle(insight.tone)}><strong style={{ color: "rgba(255,255,255,0.82)", display: "block", fontSize: "0.66rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>{insight.label}</strong><span style={{ color: "#fff", display: "block", fontSize: "0.78rem", fontWeight: 900, marginTop: "3px" }}>{insight.value}</span></div>)}</div>
        </section>

        <section style={{ ...guidanceCardStyle, marginTop: "12px", borderColor: "rgba(250,204,21,0.28)", background: "linear-gradient(135deg, rgba(113,63,18,0.28), rgba(0,0,0,0.25))" }}><p className="report-kicker" style={{ marginBottom: "7px" }}>Suggested next move</p><button onClick={() => onAppendPrompt(nextQuestion)} style={{ border: "1px solid rgba(250,204,21,0.34)", borderRadius: "14px", background: "rgba(15,23,42,0.74)", color: "#fff", cursor: "pointer", fontWeight: 900, lineHeight: 1.35, padding: "11px 12px", textAlign: "left", width: "100%" }} type="button">{nextQuestion}<span style={{ color: "rgba(253,230,138,0.8)", display: "block", fontSize: "0.68rem", fontWeight: 850, marginTop: "5px" }}>Click to insert into the draft</span></button></section>

        <section style={{ ...guidanceCardStyle, marginTop: "12px" }}><div style={{ alignItems: "center", display: "flex", gap: "10px", justifyContent: "space-between", marginBottom: "10px" }}><div><h4 style={{ color: "#fff", fontSize: "0.9rem", margin: 0 }}>{CATEGORY_LABELS[activeCategory]} accelerators</h4><p style={{ color: "rgba(229,231,235,0.58)", fontSize: "0.7rem", margin: "3px 0 0" }}>Quick inserts that move the brief forward.</p></div><button disabled={!canAskAi} onClick={requestAiPrompts} style={askAiButtonStyle} type="button"><span>{isLoadingAiPrompts ? "Asking..." : "Ask AI"}</span><strong>1 credit</strong></button></div>
          <div role="tablist" aria-label="Prompt categories" style={categoryGridStyle}>{(Object.keys(CATEGORY_LABELS) as PromptCategory[]).map((category) => { const isActive = activeCategory === category; return <button aria-selected={isActive} key={category} onClick={() => { setActiveCategory(category); setAiPrompts([]); setAiNextQuestion(""); setAiError(""); }} role="tab" style={{ ...categoryButtonBaseStyle, ...(isActive ? activeCategoryButtonStyle : inactiveCategoryButtonStyle) }} type="button"><strong style={{ display: "block", fontSize: "0.76rem", marginBottom: "4px" }}>{CATEGORY_LABELS[category]}</strong><span style={{ color: "rgba(229,231,235,0.62)", display: "block", fontSize: "0.64rem", lineHeight: 1.25 }}>{CATEGORY_DESCRIPTIONS[category]}</span></button>; })}</div>
          {!canAskAi && draft.trim().length < 80 ? <p style={{ color: "rgba(229,231,235,0.58)", fontSize: "0.74rem", margin: "10px 0 0" }}>Type more context before custom AI prompts.</p> : null}
          {aiError ? <p className="feature-builder-error">{aiError}</p> : null}
          <div style={{ ...promptGridStyle, marginTop: "10px" }}>{[...aiPrompts, ...localPrompts].slice(0, 5).map((item, index) => <button key={`${item.title}-${item.prompt}-${index}`} onClick={() => onAppendPrompt(item.prompt)} style={getPromptStyle(item.tone, index < aiPrompts.length)} type="button"><strong style={{ color: "#fff", fontSize: "0.82rem", lineHeight: 1.25 }}>{item.title}</strong><span style={{ color: "rgba(229,231,235,0.7)", fontSize: "0.72rem", lineHeight: 1.36 }}>{item.prompt}</span>{index < aiPrompts.length ? <em style={{ color: "#bfdbfe", fontSize: "0.64rem", fontStyle: "normal", fontWeight: 950, letterSpacing: "0.1em", textTransform: "uppercase" }}>AI suggested</em> : null}</button>)}</div>
        </section>

        {builderActions.length ? <section style={{ ...guidanceCardStyle, marginTop: "12px" }}><div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", gap: "10px", marginBottom: "9px" }}><h4 style={{ color: "#fff", fontSize: "0.9rem", margin: 0 }}>Recommended actions</h4><span style={{ color: "rgba(229,231,235,0.48)", fontSize: "0.68rem", fontWeight: 850 }}>Click to append</span></div><div style={promptGridStyle}>{builderActions.map((action) => <button key={action.title} onClick={() => onAppendPrompt(action.prompt)} style={{ ...getPromptStyle(action.tone), minHeight: "74px" }} type="button"><strong style={{ color: "#fff", fontSize: "0.8rem" }}>{action.title}</strong><span style={{ color: "rgba(229,231,235,0.66)", fontSize: "0.7rem", lineHeight: 1.32 }}>{action.detail}</span></button>)}</div></section> : null}

        {qaLenses.length ? <section style={{ ...guidanceCardStyle, marginTop: "12px" }}><div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", gap: "10px" }}><h4 style={{ color: "#fff", fontSize: "0.9rem", margin: 0 }}>Active QA lenses</h4><span style={{ color: "rgba(229,231,235,0.48)", fontSize: "0.68rem", fontWeight: 850 }}>Detected</span></div><div style={lensGridStyle}>{qaLenses.map((lens) => <div key={lens.id} title={lens.detail} style={getLensStyle(lens.tone)}><strong style={{ color: "#fff", fontSize: "0.7rem" }}>{lens.label}</strong></div>)}</div></section> : null}

        <details style={compactDetailsStyle}><summary style={{ color: "#fff", cursor: "pointer", fontSize: "0.86rem", fontWeight: 900 }}>QAt notes</summary><div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>{guidanceFeed.map((item) => <div key={`${item.title}-${item.detail}`} style={getGuidanceStyle(item.tone)}><span style={{ fontSize: "1rem", lineHeight: 1 }}>{item.icon}</span><div><strong style={{ color: "#fff", display: "block", fontSize: "0.78rem", lineHeight: 1.32 }}>{item.title}</strong><span style={{ color: "rgba(229,231,235,0.66)", display: "block", fontSize: "0.7rem", lineHeight: 1.35, marginTop: "3px" }}>{item.detail}</span></div></div>)}</div></details>
        <details style={compactDetailsStyle}><summary style={{ color: "#fff", cursor: "pointer", fontSize: "0.86rem", fontWeight: 900 }}>Readiness reasoning</summary><div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>{missingCallouts.map((callout) => <div key={callout.label} style={{ border: callout.isReady ? "1px solid rgba(134,239,172,0.24)" : "1px solid rgba(248,113,113,0.18)", borderRadius: "13px", background: callout.isReady ? "rgba(22,101,52,0.14)" : "rgba(0,0,0,0.22)", padding: "9px 10px" }}><strong style={{ color: callout.isReady ? "#86efac" : "#fecaca", display: "block", fontSize: "0.76rem" }}>{callout.isReady ? "✓ " : "• "}{callout.label}</strong><span style={{ color: "rgba(229,231,235,0.62)", display: "block", fontSize: "0.68rem", lineHeight: 1.32, marginTop: "3px" }}>{callout.detail}</span></div>)}</div></details>
      </div>
    </aside>
  );
}
