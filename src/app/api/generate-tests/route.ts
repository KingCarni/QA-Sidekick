import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { jsonError, qaRequestSchema } from "@/lib/api";
import { authOptions } from "@/lib/auth";
import { getOpenAIClient } from "@/lib/openai";
import { buildQaPrompt } from "@/lib/qaPrompts";
import { buildQAS73PromptBlock } from "@/lib/qas73-generator-quality-rules";
import {
  appendProjectContextToInput,
  buildProjectContextPromptRules,
} from "@/lib/project-context-injection";
import { buildAutomationCredentialPromptRules } from "@/lib/automation-credentials";
import { isInsufficientCreditsError, runPaidAction } from "@/lib/paid-action";
import { getTestCaseCostSummary, normalizeRequestedTestCaseCount } from "@/lib/test-case-credit-meter";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return jsonError("Please sign in to use this tool.", 401);
    }

    const body = await req.json();
    const parsed = qaRequestSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid request.");
    }

    const requestedCount = normalizeRequestedTestCaseCount((body as { requestedCount?: unknown }).requestedCount, 10);
    const costSummary = getTestCaseCostSummary(requestedCount);
    const confirmedCost = Number((body as { confirmedCost?: unknown }).confirmedCost);

    if (costSummary.requiresConfirmation && confirmedCost !== costSummary.cost) {
      return Response.json({
        ok: true,
        ...costSummary,
        message: `${costSummary.testCaseCount} test cases will cost ${costSummary.cost} credits.`,
      });
    }

    const client = getOpenAIClient();
    const systemPrompt = [
      "You are QAtalyst, a senior QA analyst assistant. Return only valid JSON matching the requested schema. Do not wrap JSON in markdown.",
      buildProjectContextPromptRules(),
      `Project context used: ${parsed.data.projectContextUsed ? "yes" : "no"}`,
      `Project: ${parsed.data.selectedProjectName || "none"}`,
      `Project context summary: ${parsed.data.projectContextSummary || "No project context used."}`,
      parsed.data.automationCredentialPromptBlock || "",
      buildAutomationCredentialPromptRules(),
      `Automation credentials used: ${parsed.data.automationCredentialsUsed ? "yes" : "no"}`,
      `Automation credential profiles: ${parsed.data.automationCredentialProfileSummary || "none"}`,
      buildQAS73PromptBlock("tests"),
    ].join("\n\n");
    const sourceWithProjectContext = appendProjectContextToInput(
      parsed.data.input,
      parsed.data.projectContextBlock || parsed.data.projectContext || ""
    );
    const userPrompt = buildQaPrompt("generate-tests", sourceWithProjectContext);
    const meteredUserPrompt = [
      userPrompt,
      "",
      `Generate no more than ${costSummary.testCaseCount} test cases.`,
      "If the input could justify more test cases, prioritize the highest-value coverage first: happy path, critical negative paths, highest-risk edge cases, regression-sensitive checks, and accessibility/security only when directly relevant.",
      "Do not exceed the requested test case count.",
    ].join("\n");

    const result = await runPaidAction({
      userId,
      action: "test_cases_generate",
      requestId: req.headers.get("x-request-id") || randomUUID(),
      costOverride: costSummary.cost,
      meta: { route: "/api/generate-tests" },
      work: async () => {
        const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: meteredUserPrompt,
        },
      ],
        });

        const content = response.choices[0]?.message?.content;

        if (!content) {
          throw new Error("No AI response was returned.");
        }

        return {
          result: JSON.parse(content),
          requestedTestCaseCount: costSummary.testCaseCount,
          chargedCredits: costSummary.cost,
          context: {
            projectContextUsed: Boolean(parsed.data.projectContextUsed),
            selectedProjectId: parsed.data.selectedProjectId,
            selectedProjectName: parsed.data.selectedProjectName,
            selectedProjectSourceIds: parsed.data.selectedProjectSourceIds ?? [],
            projectContextSummary: parsed.data.projectContextSummary,
          },
        };
      },
    });

    return Response.json({
      ok: true,
      result: result.result,
      requestedTestCaseCount: result.requestedTestCaseCount,
      chargedCredits: result.chargedCredits,
      context: result.context,
      credits: {
        action: result.creditSpend.action,
        cost: result.creditSpend.cost,
        balanceAfter: result.creditSpend.balanceAfter,
        spendRef: result.creditSpend.ref,
      },
    });
  } catch (error) {
    if (isInsufficientCreditsError(error)) {
      return Response.json(
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

    console.error("/generate-tests failed", error);
    return jsonError("QA Sidekick could not complete this request.", 500);
  }
}
