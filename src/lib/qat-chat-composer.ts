import OpenAI from "openai";
import type { QAtBrainContextItem } from "@/lib/qat-brain-context";

export type QAtWorkflowContext = {
  page?: "toolbelt" | "brain" | "integrations" | "unknown";
  activeTool?: string;
  workflowState?: string;
  sourceInput?: string;
  generatedOutput?: string;
  followUpContext?: string;
  setupState?: string;
};

export type ComposeQAtAnswerInput = {
  question: string;
  contextBlock: string;
  usedItems: QAtBrainContextItem[];
  missingContext: string[];
  workflowContext?: QAtWorkflowContext | null;
};

export type ComposeQAtAnswerResult = {
  answer: string;
};

function isGreetingOnly(value: string): boolean {
  const normalized = value.trim().toLowerCase().replace(/[^\w\s]/g, "");
  return ["hi", "hello", "hey", "hi qat", "hello qat", "hey qat", "yo", "yo qat"].includes(normalized);
}

function getUsedContextSummary(items: QAtBrainContextItem[]): string {
  if (!items.length) return "No Project Brain items were used.";

  return items
    .slice(0, 8)
    .map((item) => `${item.kind}: ${item.title}`)
    .join("; ");
}

function cleanInline(value: string | undefined): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function hasWorkflowContext(context: QAtWorkflowContext | null | undefined): boolean {
  if (!context) return false;
  return Boolean(
    cleanInline(context.sourceInput) ||
      cleanInline(context.generatedOutput) ||
      cleanInline(context.followUpContext) ||
      cleanInline(context.setupState) ||
      cleanInline(context.activeTool) ||
      cleanInline(context.workflowState),
  );
}

function buildWorkflowContextBlock(context: QAtWorkflowContext | null | undefined): string {
  if (!hasWorkflowContext(context)) return "No current-screen workflow context was provided.";

  const lines = [
    `Page: ${context?.page ?? "unknown"}`,
    context?.activeTool ? `Active tool/workflow: ${context.activeTool}` : "",
    context?.workflowState ? `Workflow state: ${context.workflowState}` : "",
    context?.setupState ? `Current setup/state summary:\n${context.setupState}` : "",
    context?.sourceInput ? `Current user input/source material:\n${context.sourceInput}` : "",
    context?.generatedOutput ? `Current generated output/artifact:\n${context.generatedOutput}` : "",
    context?.followUpContext ? `Follow-up answers/history:\n${context.followUpContext}` : "",
  ].filter(Boolean);

  return lines.join("\n\n").trim();
}

function buildFallbackAnswer({ question, contextBlock, missingContext, workflowContext }: ComposeQAtAnswerInput): string {
  if (isGreetingOnly(question)) {
    return [
      "Hey — I’m QAt. I can help you think through QA, product risk, test coverage, bugs, Jira handoff, and release readiness.",
      "",
      "I’ll use Project Brain context when it helps, and I’ll call it out naturally when I’m giving general QA guidance instead of project-specific guidance.",
    ].join("\n");
  }

  if (hasWorkflowContext(workflowContext)) {
    const tool = workflowContext?.activeTool || "this workflow";
    const hasOutput = Boolean(cleanInline(workflowContext?.generatedOutput));
    const hasInput = Boolean(cleanInline(workflowContext?.sourceInput));

    if (workflowContext?.page === "brain") {
      return [
        "I can review the visible Brain setup state, but my live answer composer is unavailable right now.",
        "",
        workflowContext.setupState ? workflowContext.setupState.slice(0, 900) : "Start by selecting a project, then add Source Vault context, QA rules, terminology, risks, and feature details so QAt has stronger project memory.",
      ].join("\n");
    }

    if (workflowContext?.page === "integrations") {
      return [
        `I can review ${tool}, but my live answer composer is unavailable right now.`,
        "",
        "Use the visible setup steps as the source of truth: completed steps are already verified, active steps are the next action, and missing steps are the only blockers to call out.",
      ].join("\n");
    }

    return [
      `I can review ${tool}, but my live answer composer is unavailable right now.`,
      "",
      hasOutput
        ? "From the current output, check for concrete repro/setup details, observable expected results, explicit risks/gaps, Jira/TestRail readiness, and any vague assertions that need tightening."
        : hasInput
          ? "Before generating, I can only review the source/refinement fields currently visible. I should not mention follow-up questions, severity justification, Jira links, or generated report sections until output exists."
          : "I do not see enough current input or generated output yet. Paste or generate the artifact first, then ask me to review it.",
    ].join("\n");
  }

  if (!contextBlock.trim()) {
    return [
      "I can still help with that as general QA guidance, but I don’t have enough saved Project Brain context to make it project-specific yet.",
      "",
      missingContext.length ? `What would make this stronger: ${missingContext.join(", ")}.` : "Add Source Vault notes, QA rules, terminology, risks, or feature details and I’ll ground the answer more tightly next time.",
    ].join("\n");
  }

  return [
    "I can help with that, but my live answer composer is unavailable right now.",
    "",
    "Based on the saved Project Brain context I found, here is the safest short read:",
    contextBlock.replace(/\s+/g, " ").trim().slice(0, 900),
  ].join("\n");
}

export async function composeQAtAnswer(input: ComposeQAtAnswerInput): Promise<ComposeQAtAnswerResult> {
  const { question, contextBlock, usedItems, missingContext, workflowContext } = input;

  if (isGreetingOnly(question)) {
    return {
      answer: buildFallbackAnswer(input),
    };
  }

  if (!process.env.OPENAI_API_KEY) {
    return {
      answer: buildFallbackAnswer(input),
    };
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const hasCurrentScreenContext = hasWorkflowContext(workflowContext);
  const hasGeneratedOutput = Boolean(cleanInline(workflowContext?.generatedOutput));
  const hasSourceInput = Boolean(cleanInline(workflowContext?.sourceInput));
  const hasFollowUps = Boolean(cleanInline(workflowContext?.followUpContext));
  const workflowPhase = hasGeneratedOutput ? "post-generation/generated-output review" : hasSourceInput ? "pre-generation/source-input review" : "empty/thin workflow review";
  const workflowContextBlock = buildWorkflowContextBlock(workflowContext);

  const systemPrompt = [
    "You are QAt, the QA companion inside QAtalyst.",
    "Act like a 20-year Senior QA Lead, producer-minded triage partner, and senior-developer-aware reviewer.",
    "Use current-screen workflow context as the primary evidence when it is provided.",
    "Use Project Brain context as saved project truth and supporting memory only after reviewing the current artifact/state.",
    "Keep embedded companion answers short: aim for 3 to 5 bullets, no long essay, no generic checklist unless there is no current context.",
    "Understand the workflow phase. Pre-generation/source-input review means the user has not generated the QAtalyst artifact yet. Post-generation/generated-output review means the generated artifact exists and can be critiqued directly.",
    "For integrations setup pages, lead with a readiness verdict: Ready, Partially ready, or Blocked. Treat completed steps, readiness signals, and visible status text as already verified. Do not ask the user to verify or confirm things the screen already says are saved, tested, loaded, connected, or ready.",
    "For integrations setup pages, only mention actual missing or active setup items. If Jira is saved/tested/types loaded/handoff ready, say it is ready and give one smoke-test next action. If TestRail is saved/tested/project target/export ready, say it is ready and give one export-preview next action.",
    "For integrations setup pages, avoid generic phrases like ensure, confirm, verify, double-check, or make sure unless the visible state is missing, warning, failed, or unknown. Do not invent permission doubts if the page says handoff/export is ready.",
    "For integrations setup pages, never expose or repeat credentials, API tokens, API keys, secrets, or masked secret values. If asked for a secret, refuse briefly and offer safe setup steps.",
    "HARD RULE FOR PRE-GENERATION: never mention follow-up questions, follow-up notes, missing follow-ups, generated follow-ups, or questions to include. Follow-up questions are not available yet.",
    "HARD RULE FOR PRE-GENERATION: do not ask the user to justify severity or priority. If visible severity/priority fields are filled, accept them as user-provided triage context.",
    "HARD RULE FOR PRE-GENERATION: do not mention Jira links, Jira ticket links, Jira access, or Jira comments unless the user specifically asks about Jira linking/comments.",
    "HARD RULE FOR PRE-GENERATION: do not complain about generated report sections, Jira handoff quality, automation readiness, or post-generation formatting. Only review the source text and visible refinement fields.",
    "Evidence rule: if an evidence upload/control is visible and empty, you may briefly say evidence would strengthen the report. Do not nag about evidence if the user already notes they will attach it later.",
    "For Bug/Bug triage pre-generation, focus only on: repro clarity, expected vs actual if fields are empty, environment completeness, impact clarity, and whether the current details are enough to generate a stronger bug report.",
    "For Bug/Bug triage post-generation, focus on: repro steps, expected vs actual, environment, evidence, scope, regression likelihood, developer-debug detail, and handoff clarity.",
    "For Feature workflows, prioritize acceptance criteria, user roles, states, permissions, edge cases, dependencies, and missing decisions. In pre-generation, do not mention generated follow-ups.",
    "For Test coverage workflows, prioritize coverage balance, preconditions, steps, expected results, data/state coverage, regression areas, duplicate/vague cases, and automation readiness when output exists.",
    "For Risk Review workflows, prioritize likely failure areas, severity/likelihood, mitigation, release blockers, rollback/monitoring, and missing signals.",
    "For Brain page workflows, review setup completeness and recommend the next best setup step. Consider project selection, Source Vault, QA rules, terminology, risks/hotspots, feature registry, Jira, and TestRail.",
    "If Project Brain is thin, still help with general QA guidance, but clearly and naturally say it is general guidance, not confirmed by Brain.",
    "Do not say 'retrieved context' or expose internal retrieval/debug mechanics.",
    "Never reveal secrets, tokens, credentials, API keys, or integration keys. If asked, refuse briefly and offer a safe setup/help alternative.",
    "Do not claim a project-specific fact unless it appears in Project Brain context, current-screen workflow context, or the user's question.",
  ].join("\n");

  const userPrompt = [
    "User question:",
    question,
    "",
    "Workflow phase:",
    workflowPhase,
    "Follow-up context present:",
    hasFollowUps ? "Yes. You may refer to provided follow-up answers/history." : "No. Do not mention follow-up questions at all in pre-generation.",
    "",
    workflowContext?.page === "integrations"
      ? "Current-screen integrations context. Treat completed/saved/tested/loaded/ready items as already true; do not ask to verify them again. Give a readiness verdict and one next action:"
      : hasCurrentScreenContext
        ? "Current-screen workflow context. Analyze this first and be concrete:"
        : "Current-screen workflow context:",
    workflowContextBlock,
    "",
    "Project Brain context available to you:",
    contextBlock.trim() || "No saved Project Brain context was retrieved for this question.",
    "",
    "Internal context summary. Use only if helpful; do not print this as a footer:",
    getUsedContextSummary(usedItems),
    "",
    "Known missing Brain context. Mention only if it directly improves the answer:",
    missingContext.length ? missingContext.join(", ") : "None detected.",
    "",
    workflowContext?.page === "integrations"
      ? "Now answer as QAt. Start with Ready / Partially ready / Blocked. Do not ask to verify completed setup checks. End with one practical next action."
      : hasCurrentScreenContext
        ? "Now answer as QAt. Be concise and specific to the current workflow phase. In pre-generation, do not mention follow-up questions, Jira links/comments, or severity/priority justification."
        : "Now answer as QAt in one natural conversational response.",
  ].join("\n");

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.15,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const answer = completion.choices[0]?.message?.content?.trim();

    if (!answer) {
      return {
        answer: buildFallbackAnswer(input),
      };
    }

    return { answer };
  } catch {
    return {
      answer: buildFallbackAnswer(input),
    };
  }
}
