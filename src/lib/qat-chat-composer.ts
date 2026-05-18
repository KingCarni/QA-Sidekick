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
  return [
    "hi",
    "hello",
    "hey",
    "hi qat",
    "hello qat",
    "hey qat",
    "yo",
    "yo qat",
  ].includes(normalized);
}

function getUsedContextSummary(items: QAtBrainContextItem[]): string {
  if (!items.length) return "No Project Brain items were used.";

  return items
    .slice(0, 8)
    .map((item) => `${item.kind}: ${item.title}`)
    .join("; ");
}

function buildFallbackAnswer({
  question,
  contextBlock,
  usedItems,
  missingContext,
}: ComposeQAtAnswerInput): string {
  if (isGreetingOnly(question)) {
    return [
      "Hey — I’m QAt. I can help you reason through this project using the saved Project Brain context.",
      "",
      "Ask me about risks, QA rules, terminology, source context, feature coverage, or what context is missing.",
      "",
      `Used Brain context: ${getUsedContextSummary(usedItems)}`,
      missingContext.length ? `Missing Brain context: ${missingContext.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (!contextBlock.trim()) {
    return [
      "I do not have enough enabled Project Brain context to answer that yet.",
      "",
      missingContext.length
        ? `Missing Brain context: ${missingContext.join(", ")}`
        : "Missing Brain context: enabled Source Vault, QA rules, terminology, risks, or feature registry items.",
      "",
      "Add or enable more Brain context, then ask me again.",
    ].join("\n");
  }

  return [
    "I found relevant Project Brain context, but the LLM composer is unavailable right now.",
    "",
    "Here is the safest grounded summary I can provide from the retrieved context:",
    "",
    contextBlock.replace(/\s+/g, " ").trim().slice(0, 900),
    "",
    `Used Brain context: ${getUsedContextSummary(usedItems)}`,
    missingContext.length ? `Missing Brain context: ${missingContext.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function composeQAtAnswer(input: ComposeQAtAnswerInput): Promise<ComposeQAtAnswerResult> {
  const { question, contextBlock, usedItems, missingContext } = input;

  if (isGreetingOnly(question)) {
    return {
      answer: buildFallbackAnswer(input),
    };
  }

  if (!contextBlock.trim()) {
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
    "You answer using only the provided Project Brain context.",
    "You are practical, concise, and QA-focused.",
    "Do not invent project facts.",
    "Do not answer from generic AI knowledge when the Brain context is missing.",
    "If the Brain context is thin, say what is missing and what the user should add.",
    "For risk questions, prioritize saved risks/hotspots and testing guidance.",
    "For QA rule questions, prioritize saved QA rules.",
    "For terminology questions, explain saved terms, aliases, and preferred usage.",
    "For source/context questions, summarize what the Brain knows and what is missing.",
    "Do not expose secrets, tokens, credentials, or integration keys.",
    "Do not print raw context blocks unless the user explicitly asks for raw context.",    
  ].join("\n");

  const userPrompt = [
    "User question:",
    question,
    "",
    "Retrieved Project Brain context:",
    contextBlock,
    "",
    "Retrieved item summary:",
    getUsedContextSummary(usedItems),
    "",
    "Missing context:",
    missingContext.length ? missingContext.join(", ") : "None detected.",
    "",
    "Write a natural answer. Keep it grounded in the provided Brain context only.",
  ].join("\n");

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
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