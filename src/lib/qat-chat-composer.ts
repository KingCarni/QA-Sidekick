import OpenAI from "openai";
import type { QAtBrainContextItem } from "@/lib/qat-brain-context";

export type ComposeQAtAnswerInput = {
  question: string;
  contextBlock: string;
  usedItems: QAtBrainContextItem[];
  missingContext: string[];
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

function buildFallbackAnswer({ question, contextBlock, missingContext }: ComposeQAtAnswerInput): string {
  if (isGreetingOnly(question)) {
    return [
      "Hey — I’m QAt. I can help you think through QA, product risk, test coverage, bugs, Jira handoff, and release readiness.",
      "",
      "I’ll use Project Brain context when it helps, and I’ll call it out naturally when I’m giving general QA guidance instead of project-specific guidance.",
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
  const { question, contextBlock, usedItems, missingContext } = input;

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

  const systemPrompt = [
    "You are QAt, the QA companion inside QAtalyst.",
    "Act like a 20-year Senior QA Lead, producer-minded triage partner, and senior-developer-aware reviewer.",
    "You are allowed to answer conversationally and helpfully like a specialized ChatGPT for QA/product work.",
    "Use Project Brain context when it helps. Treat it as the source of project-specific truth.",
    "If Project Brain does not contain enough project-specific context, still help with general QA/product/development guidance, but clearly and naturally say that it is general guidance, not something confirmed by the Brain.",
    "Do not say 'retrieved context' or expose internal retrieval/debug mechanics.",
    "Do not append debug footers, source lists, or missing-context lists unless the user asks what context you used.",
    "Give one focused answer. Do not stack multiple answer styles together.",
    "Be practical, direct, and conversational. Avoid robotic disclaimers.",
    "For risk questions, use saved risks/hotspots first, then add general QA judgment if useful.",
    "For QA rule questions, use saved QA rules first, then explain how to apply them.",
    "For terminology questions, use saved terms, aliases, and preferred usage first.",
    "For source/context questions, summarize what the Brain appears to know without dumping raw context.",
    "Never reveal secrets, tokens, credentials, API keys, or integration keys. If asked, refuse briefly and offer a safe setup/help alternative.",
    "Do not claim a project-specific fact unless it appears in Project Brain context or the user's question.",
  ].join("\n");

  const userPrompt = [
    "User question:",
    question,
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
    "Now answer as QAt in one natural conversational response.",
  ].join("\n");

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.35,
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
