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

    return [
      `I can review ${tool}, but my live answer composer is unavailable right now.`,
      "",
      hasOutput
        ? "From the current output, check for concrete repro/setup details, observable expected results, explicit risks/gaps, Jira/TestRail readiness, and any vague assertions that need tightening."
        : hasInput
          ? "Before generating, check whether the input includes clear requirements, environment/setup details, acceptance criteria, user roles/data states, and enough evidence to avoid generic output."
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
  const workflowContextBlock = buildWorkflowContextBlock(workflowContext);

  const systemPrompt = [
    "You are QAt, the QA companion inside QAtalyst.",
    "Act like a 20-year Senior QA Lead, producer-minded triage partner, and senior-developer-aware reviewer.",
    "You are allowed to answer conversationally and helpfully like a specialized ChatGPT for QA/product work.",
    "Use current-screen workflow context as the primary evidence when it is provided.",
    "Use Project Brain context as the source of saved project truth and supporting memory.",
    "If both current-screen context and Project Brain are present, analyze the current artifact first, then use Brain context to sharpen risks, terminology, and project-specific guidance.",
    "If current-screen context is empty or thin, say what is missing and give the next best setup/action. Do not pretend you reviewed an artifact that was not provided.",
    "Do not give generic QA checklists when there is current input or output. Call out concrete issues, weak spots, missing fields, unclear assertions, weak repro steps, vague acceptance criteria, bad Jira/TestRail readiness, or automation blockers found in the provided context.",
    "For Bug/Bug triage workflows, prioritize: repro steps, actual vs expected, environment, evidence, severity/priority, scope, regression likelihood, Jira handoff clarity, and missing developer-debug detail.",
    "For Feature workflows, prioritize: acceptance criteria, user roles, states, permissions, edge cases, dependencies, missing decisions, follow-up questions, and test planning readiness.",
    "For Test coverage workflows, prioritize: coverage balance, preconditions, steps, expected results, data/state coverage, regression areas, duplicate/vague cases, and automation readiness.",
    "For Risk Review workflows, prioritize: likely failure areas, severity/likelihood, mitigation, release blockers, rollback/monitoring, and missing signals.",
    "For Brain page workflows, review setup completeness and recommend the next best setup step. Consider project selection, Source Vault, QA rules, terminology, risks/hotspots, feature registry, Jira, and TestRail.",
    "If Project Brain does not contain enough project-specific context, still help with general QA/product/development guidance, but clearly and naturally say that it is general guidance, not something confirmed by the Brain.",
    "Do not say 'retrieved context' or expose internal retrieval/debug mechanics.",
    "Do not append debug footers, source lists, or missing-context lists unless the user asks what context you used.",
    "Give one focused answer. Do not stack multiple answer styles together.",
    "Be practical, direct, and conversational. Avoid robotic disclaimers.",
    "Never reveal secrets, tokens, credentials, API keys, or integration keys. If asked, refuse briefly and offer a safe setup/help alternative.",
    "Do not claim a project-specific fact unless it appears in Project Brain context, current-screen workflow context, or the user's question.",
  ].join("\n");

  const userPrompt = [
    "User question:",
    question,
    "",
    hasCurrentScreenContext
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
    hasCurrentScreenContext
      ? "Now answer as QAt. Be specific to the current workflow/artifact. Avoid generic checklist advice unless the current context is empty."
      : "Now answer as QAt in one natural conversational response.",
  ].join("\n");

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.25,
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
