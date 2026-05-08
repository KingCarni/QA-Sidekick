import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

type PromptCategory = "brainstorm" | "scope" | "qa" | "acceptance" | "jira";

type PromptSuggestion = {
  title: string;
  prompt: string;
  category: PromptCategory;
  tone: "blue" | "green" | "yellow" | "red";
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
        prompt: prompt.slice(0, 280),
        category: fallbackCategory,
        tone,
      };
    })
    .filter(Boolean)
    .slice(0, 4) as PromptSuggestion[];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    const draft = asString(body?.draft);
    const extraContext = asString(body?.extraContext);
    const projectName = asString(body?.projectName);
    const productType = asString(body?.productType);
    const category = normalizeCategory(body?.category);
    const readinessScore = Number(body?.readinessScore ?? 0);

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

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.35,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "You are the QAtalyst Feature Builder Live Prompt Companion.",
            "Your job is not to write the whole feature brief.",
            "Generate short, high-value prompts/questions that help the user clarify the feature idea.",
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
            `Current readiness score: ${Number.isFinite(readinessScore) ? readinessScore : 0}`,
            "",
            "Current rough feature idea:",
            draft,
            "",
            "Extra context:",
            extraContext || "None provided.",
            "",
            "Generate 3-4 targeted prompts. Keep each prompt practical, specific, and easy to paste into the draft.",
          ].join("\n"),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const prompts = normalizePrompts(parsed.prompts, category);
    const nextQuestion = asString(parsed.nextQuestion).slice(0, 240);

    return NextResponse.json({
      ok: true,
      nextQuestion,
      prompts,
    });
  } catch (error) {
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
