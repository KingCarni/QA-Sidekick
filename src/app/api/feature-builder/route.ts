import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { authOptions } from "@/lib/auth";
import { isInsufficientCreditsError, runPaidAction } from "@/lib/paid-action";

type FeatureBrief = {
  title: string;
  summary: string;
  userValue: string;
  problemStatement: string;
  targetUsers: string[];
  inScope: string[];
  outOfScope: string[];
  userStories: string[];
  acceptanceCriteria: string[];
  qaRisks: string[];
  testIdeas: string[];
  analyticsOrTelemetry: string[];
  dependencies: string[];
  openQuestions: string[];
  jiraReadyNotes: string[];
};

const REFINEMENT_GUIDANCE: Record<string, string> = {
  "tighten-scope":
    "Tighten the feature brief. Make the first-pass MVP clearer. Move non-essential items to outOfScope. Keep the feature practical and buildable.",
  "add-qa-risks":
    "Expand qaRisks and testIdeas. Add edge cases, data integrity concerns, permissions, stale state, API failure, UX confusion, and regression areas.",
  "acceptance-criteria":
    "Improve acceptanceCriteria. Make them specific, observable, and testable. Prefer Given/When/Then style when useful.",
  "missing-questions":
    "Expand openQuestions. Surface missing product, technical, design, QA, analytics, permissions, and rollout questions.",
  "jira-ready":
    "Make this brief more Jira-ready. Improve title, userStories, jiraReadyNotes, dependencies, and acceptanceCriteria for ticket creation.",
  "simplify-mvp":
    "Simplify the MVP. Reduce scope to the smallest useful first release while preserving user value. Push extras into outOfScope or future-facing notes.",
  "future-enhancements":
    "Add future enhancement thinking without bloating the MVP. Keep inScope stable, and add later-phase ideas through outOfScope, openQuestions, or jiraReadyNotes.",
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.map((item) => String(item ?? "").trim()).filter(Boolean).slice(0, 14);
}

function normalizeBrief(value: unknown): FeatureBrief {
  const record =
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return {
    title: asString(record.title) || "Feature Brief",
    summary: asString(record.summary),
    userValue: asString(record.userValue),
    problemStatement: asString(record.problemStatement),
    targetUsers: asList(record.targetUsers),
    inScope: asList(record.inScope),
    outOfScope: asList(record.outOfScope),
    userStories: asList(record.userStories),
    acceptanceCriteria: asList(record.acceptanceCriteria),
    qaRisks: asList(record.qaRisks),
    testIdeas: asList(record.testIdeas),
    analyticsOrTelemetry: asList(record.analyticsOrTelemetry),
    dependencies: asList(record.dependencies),
    openQuestions: asList(record.openQuestions),
    jiraReadyNotes: asList(record.jiraReadyNotes),
  };
}

function listMarkdown(title: string, items: string[]) {
  return [`## ${title}`, ...(items.length ? items.map((item) => `- ${item}`) : ["- Not specified."])].join("\n");
}

function buildMarkdown(brief: FeatureBrief) {
  return [
    `# ${brief.title}`,
    "",
    "## Summary",
    brief.summary || "Not specified.",
    "",
    "## User Value",
    brief.userValue || "Not specified.",
    "",
    "## Problem Statement",
    brief.problemStatement || "Not specified.",
    "",
    listMarkdown("Target Users", brief.targetUsers),
    "",
    listMarkdown("User Stories", brief.userStories),
    "",
    listMarkdown("In Scope", brief.inScope),
    "",
    listMarkdown("Out of Scope", brief.outOfScope),
    "",
    listMarkdown("Acceptance Criteria", brief.acceptanceCriteria),
    "",
    listMarkdown("QA Risks", brief.qaRisks),
    "",
    listMarkdown("Test Ideas", brief.testIdeas),
    "",
    listMarkdown("Analytics / Telemetry", brief.analyticsOrTelemetry),
    "",
    listMarkdown("Dependencies", brief.dependencies),
    "",
    listMarkdown("Open Questions", brief.openQuestions),
    "",
    listMarkdown("Jira-ready Notes", brief.jiraReadyNotes),
  ].join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ ok: false, error: "Please sign in to use Feature Builder." }, { status: 401 });
    }

    const body = await req.json().catch(() => null);

    const mode = asString(body?.mode) === "refine" ? "refine" : "generate";
    const draft = asString(body?.draft);
    const extraContext = asString(body?.extraContext);
    const projectName = asString(body?.projectName);
    const projectType = asString(body?.projectType);
    const refinementAction = asString(body?.refinementAction);
    const refinementLabel = asString(body?.refinementLabel);
    const currentBrief = body?.currentBrief ?? null;
    const currentMarkdown = asString(body?.currentMarkdown);

    if (draft.length < 12 && mode === "generate") {
      return NextResponse.json(
        { ok: false, error: "Add a little more detail before generating a feature brief." },
        { status: 400 }
      );
    }

    if (mode === "refine" && !currentBrief) {
      return NextResponse.json(
        { ok: false, error: "Generate a feature brief before refining it." },
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

    const refinementGuidance =
      REFINEMENT_GUIDANCE[refinementAction] ||
      "Improve the feature brief while preserving accurate source details and realistic scope.";

    const systemPrompt = [
      "You are QAtalyst Feature Builder.",
      "Turn rough feature ideas into practical product/QA feature briefs.",
      "Do not invent committed facts. Mark uncertainty as open questions.",
      "Keep scope realistic for a first product pass.",
      mode === "refine"
        ? "You are refining an existing brief. Preserve useful existing content, improve the requested focus area, and return a full updated brief."
        : "You are generating a first structured feature brief from rough input.",
      "Return JSON only.",
      "",
      "JSON shape:",
      "{",
      '  "title": string,',
      '  "summary": string,',
      '  "userValue": string,',
      '  "problemStatement": string,',
      '  "targetUsers": string[],',
      '  "inScope": string[],',
      '  "outOfScope": string[],',
      '  "userStories": string[],',
      '  "acceptanceCriteria": string[],',
      '  "qaRisks": string[],',
      '  "testIdeas": string[],',
      '  "analyticsOrTelemetry": string[],',
      '  "dependencies": string[],',
      '  "openQuestions": string[],',
      '  "jiraReadyNotes": string[]',
      "}",
    ].join("\n");

    const userPrompt =
      mode === "refine"
        ? [
            `Project name: ${projectName || "Not specified"}`,
            `Project type: ${projectType || "Not specified"}`,
            "",
            `Requested refinement: ${refinementLabel || refinementAction || "Refine brief"}`,
            refinementGuidance,
            "",
            "Original rough feature idea:",
            draft || "Not provided.",
            "",
            "Extra context / constraints:",
            extraContext || "None provided.",
            "",
            "Current brief JSON:",
            JSON.stringify(currentBrief, null, 2),
            "",
            "Current markdown:",
            currentMarkdown || "Not provided.",
            "",
            "Return the full updated brief JSON, not just the changed section.",
          ].join("\n")
        : [
            `Project name: ${projectName || "Not specified"}`,
            `Project type: ${projectType || "Not specified"}`,
            "",
            "Rough feature idea:",
            draft,
            "",
            "Extra context / constraints:",
            extraContext || "None provided.",
          ].join("\n");

    const paidResult = await runPaidAction({
      userId,
      action: mode === "refine" ? "feature_builder_refine" : "feature_builder_generate",
      requestId: req.headers.get("x-request-id") || randomUUID(),
      meta: { route: "/api/feature-builder", mode, refinementAction },
      work: async () => {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: mode === "refine" ? 0.25 : 0.35,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: userPrompt,
            },
          ],
        });

        const raw = completion.choices[0]?.message?.content ?? "{}";
        const parsed = JSON.parse(raw) as unknown;
        const brief = normalizeBrief(parsed);
        const markdown = buildMarkdown(brief);

        return { brief, markdown };
      },
    });

    return NextResponse.json({
      ok: true,
      mode,
      refinementAction,
      brief: paidResult.brief,
      markdown: paidResult.markdown,
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
          error: error.message,
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

    console.error("Feature Builder failed", error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Feature Builder could not complete this request.",
      },
      { status: 500 }
    );
  }
}
