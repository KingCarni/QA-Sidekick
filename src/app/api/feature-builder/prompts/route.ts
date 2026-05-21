import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { authOptions } from "@/lib/auth";
import { isInsufficientCreditsError, runPaidAction } from "@/lib/paid-action";

type PromptCategory = "brainstorm" | "scope" | "qa" | "acceptance" | "jira";

type PromptSuggestion = {
  title: string;
  prompt: string;
  category: PromptCategory;
  tone: "blue" | "green" | "yellow" | "red";
};

type ActiveQaLens = {
  label: string;
  detail: string;
  tone?: "blue" | "green" | "yellow" | "red";
};

type MissingCallout = {
  label: string;
  detail: string;
  isReady?: boolean;
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCategory(value: unknown): PromptCategory {
  const raw = asString(value);

  if (raw === "scope" || raw === "qa" || raw === "acceptance" || raw === "jira") {
    return raw;
  }

  return "brainstorm";
}

function normalizePrompts(value: unknown, fallbackCategory: PromptCategory): PromptSuggestion[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;

      const record = item as Record<string, unknown>;
      const title = asString(record.title);
      const prompt = asString(record.prompt);
      const rawTone = asString(record.tone);
      const tone =
        rawTone === "green" || rawTone === "yellow" || rawTone === "red" || rawTone === "blue"
          ? rawTone
          : "blue";

      if (!title || !prompt) return null;

      return {
        title: title.slice(0, 80),
        prompt: prompt.slice(0, 320),
        category: fallbackCategory,
        tone,
      };
    })
    .filter(Boolean)
    .slice(0, 4) as PromptSuggestion[];
}

function normalizeActiveLenses(value: unknown): ActiveQaLens[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const record = item as Record<string, unknown>;
      const label = asString(record.label);
      const detail = asString(record.detail);
      const rawTone = asString(record.tone);
      const tone =
        rawTone === "green" || rawTone === "yellow" || rawTone === "red" || rawTone === "blue"
          ? rawTone
          : undefined;

      if (!label && !detail) return null;
      return { label: label.slice(0, 80), detail: detail.slice(0, 240), tone };
    })
    .filter(Boolean)
    .slice(0, 5) as ActiveQaLens[];
}

function normalizeMissingCallouts(value: unknown): MissingCallout[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const record = item as Record<string, unknown>;
      const label = asString(record.label);
      const detail = asString(record.detail);
      const isReady = typeof record.isReady === "boolean" ? record.isReady : undefined;

      if (!label && !detail) return null;
      return { label: label.slice(0, 80), detail: detail.slice(0, 240), isReady };
    })
    .filter(Boolean)
    .slice(0, 8) as MissingCallout[];
}

function formatLenses(lenses: ActiveQaLens[]) {
  if (!lenses.length) return "None detected.";

  return lenses.map((lens) => `- ${lens.label || "QA lens"}: ${lens.detail || "No detail provided."}`).join("\n");
}

function formatMissingCallouts(callouts: MissingCallout[]) {
  if (!callouts.length) return "None provided.";

  return callouts.map((item) => `- ${item.label || "Missing detail"}: ${item.detail || "No detail provided."}`).join("\n");
}

function categoryInstruction(category: PromptCategory) {
  if (category === "scope") {
    return "Prioritize MVP boundaries, out-of-scope calls, sequencing, dependencies, and release slicing.";
  }

  if (category === "qa") {
    return "Prioritize testability, failure states, permissions, stale state, edge cases, and regression coverage.";
  }

  if (category === "acceptance") {
    return "Prioritize observable acceptance criteria, Given/When/Then thinking, success states, and failure states.";
  }

  if (category === "jira") {
    return "Prioritize Jira-ready parent/child structure, implementation tasks, QA tasks, and preview-before-create safety.";
  }

  return "Prioritize user, pain, value, outcome, and first useful feature shape.";
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Please sign in before asking AI for prompts." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);

    const draft = asString(body?.draft);
    const extraContext = asString(body?.extraContext);
    const projectName = asString(body?.projectName);
    const productType = asString(body?.productType);
    const category = normalizeCategory(body?.category);
    const readinessScore = Number(body?.readinessScore ?? 0);
    const contextConfidence = asString(body?.contextConfidence) || "unknown";
    const activeQaLenses = normalizeActiveLenses(body?.activeQaLenses);
    const missingCallouts = normalizeMissingCallouts(body?.missingCallouts);

    if (draft.length < 80) {
      return NextResponse.json(
        { ok: false, error: "Add more feature context before asking AI for prompt suggestions." },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { ok: false, error: "OPENAI_API_KEY is not configured." },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const paidResult = await runPaidAction({
      userId,
      action: "feature_builder_prompt_suggestions",
      requestId: req.headers.get("x-request-id") || randomUUID(),
      meta: {
        route: "/api/feature-builder/prompts",
        category,
        readinessScore: Number.isFinite(readinessScore) ? readinessScore : 0,
        contextConfidence,
        activeQaLensCount: activeQaLenses.length,
      },
      work: async () => {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 0.32,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: [
                "You are the QAtalyst Feature Builder Live QAt companion.",
                "You are a senior QA/product thinking partner, not a generic chatbot.",
                "Your job is not to write the whole feature brief.",
                "Generate short, high-value prompts/questions that help the user clarify the feature idea and move toward Jira-ready work.",
                "Use the active QA lenses as priority signals. If a lens exists, at least one prompt should directly help the user resolve that risk.",
                "Avoid generic questions. Make prompts specific to the draft, the requested category, and the detected risks.",
                "Do not ask for secrets, tokens, passwords, or hidden credentials. Ask for safe setup/behavior details instead.",
                "Return JSON only.",
                "",
                "JSON shape:",
                "{",
                '  "nextQuestion": string,',
                '  "prompts": [',
                '    { "title": string, "prompt": string, "tone": "blue" | "green" | "yellow" | "red" }',
                "  ]",
                "}",
              ].join("\n"),
            },
            {
              role: "user",
              content: [
                `Project: ${projectName || "Not specified"}`,
                `Product type: ${productType || "Not specified"}`,
                `Requested prompt category: ${category}`,
                `Category instruction: ${categoryInstruction(category)}`,
                `Current readiness score: ${Number.isFinite(readinessScore) ? readinessScore : 0}`,
                `Context confidence: ${contextConfidence}`,
                "",
                "Active QA lenses:",
                formatLenses(activeQaLenses),
                "",
                "Missing readiness callouts:",
                formatMissingCallouts(missingCallouts),
                "",
                "Current rough feature idea:",
                draft,
                "",
                "Extra context:",
                extraContext || "None provided.",
                "",
                "Generate 3-4 targeted prompts. Keep each prompt practical, specific, and easy to paste into the draft.",
                "Prefer prompts that help the user make a decision or add concrete testable detail.",
              ].join("\n"),
            },
          ],
        });

        const raw = completion.choices[0]?.message?.content ?? "{}";
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const prompts = normalizePrompts(parsed.prompts, category);
        const nextQuestion = asString(parsed.nextQuestion).slice(0, 260);

        return { prompts, nextQuestion };
      },
    });

    return NextResponse.json({
      ok: true,
      nextQuestion: paidResult.nextQuestion,
      prompts: paidResult.prompts,
      credits: {
        action: paidResult.creditSpend.action,
        cost: paidResult.creditSpend.cost,
        balanceAfter: paidResult.creditSpend.balanceAfter,
        spendRef: paidResult.creditSpend.ref,
      },
    });
  } catch (error) {
    if (isInsufficientCreditsError(error)) {
      return NextResponse.json(
        {
          ok: false,
          code: "INSUFFICIENT_CREDITS",
          error: "Not enough credits. Ask AI for prompts costs 1 credit.",
          details: {
            action: error.action,
            cost: error.required,
            balance: error.balance,
            required: error.required,
          },
        },
        { status: 402 }
      );
    }

    console.error("Feature Builder prompt companion failed", error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Could not generate AI prompt suggestions.",
      },
      { status: 500 }
    );
  }
}
