import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { buildQaPrompt } from "@/lib/qaPrompts";
import { getOpenAIClient } from "@/lib/openai";
import { jsonError, qaRequestSchema } from "@/lib/api";
import { authOptions } from "@/lib/auth";
import { buildQAS73PromptBlock } from "@/lib/qas73-generator-quality-rules";
import {
  appendProjectContextToInput,
  buildProjectContextPromptRules,
} from "@/lib/project-context-injection";
import {
  buildAuthorizedProjectContextPayload,
  serializeAuthorizedProjectContext,
} from "@/lib/server-project-context";
import { buildAutomationCredentialPromptRules } from "@/lib/automation-credentials";
import { isInsufficientCreditsError, runPaidAction } from "@/lib/paid-action";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return jsonError("Please sign in to use this tool.", 401);
    }

    const body = await req.json();
    const parsed = qaRequestSchema.safeParse(body);
    if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid request.");

    const authorizedProjectContext = await buildAuthorizedProjectContextPayload(userId, parsed.data, {
      route: "/api/improve-test",
      workflow: "test-improver",
    });
    const authorizedProjectContextMeta = serializeAuthorizedProjectContext(authorizedProjectContext);
    const client = getOpenAIClient();
    const systemPrompt = [
      "You are QAtalyst, a senior QA analyst assistant. Return only valid JSON matching the requested schema. Do not wrap JSON in markdown.",
      buildProjectContextPromptRules(),
      `Project context used: ${authorizedProjectContext.projectContextUsed ? "yes" : "no"}`,
      `Project: ${authorizedProjectContext.selectedProjectName || "none"}`,
      `Project context summary: ${authorizedProjectContext.projectContextSummary || "No project context used."}`,
      `Project rules used: ${authorizedProjectContext.projectRulesSummary}`,
      parsed.data.automationCredentialPromptBlock || "",
      buildAutomationCredentialPromptRules(),
      `Automation credentials used: ${parsed.data.automationCredentialsUsed ? "yes" : "no"}`,
      `Automation credential profiles: ${parsed.data.automationCredentialProfileSummary || "none"}`,
      buildQAS73PromptBlock("improve"),
    ].join("\n\n");
    const sourceWithProjectContext = appendProjectContextToInput(
      parsed.data.input,
      authorizedProjectContext.projectContextBlock
    );
    const userPrompt = buildQaPrompt("improve-test", sourceWithProjectContext);
    const result = await runPaidAction({
      userId,
      action: "test_improver_generate",
      requestId: req.headers.get("x-request-id") || randomUUID(),
      meta: { route: "/api/improve-test" },
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
              content: userPrompt,
            },
          ],
        });

        const content = response.choices[0]?.message?.content;
        if (!content) throw new Error("No AI response was returned.");

        return {
          result: JSON.parse(content),
          context: authorizedProjectContextMeta,
        };
      },
    });

    return Response.json({
      ok: true,
      result: result.result,
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

    console.error("/improve-test failed", error);
    return jsonError("QA Sidekick could not complete this request.", 500);
  }
}
