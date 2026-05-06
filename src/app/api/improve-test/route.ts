import { buildQaPrompt } from "@/lib/qaPrompts";
import { getOpenAIClient } from "@/lib/openai";
import { jsonError, qaRequestSchema } from "@/lib/api";
import { buildQAS73PromptBlock } from "@/lib/qas73-generator-quality-rules";
import {
  appendProjectContextToInput,
  buildProjectContextPromptRules,
} from "@/lib/project-context-injection";
import { buildAutomationCredentialPromptRules } from "@/lib/automation-credentials";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = qaRequestSchema.safeParse(body);
    if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid request.");

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
      buildQAS73PromptBlock("improve"),
    ].join("\n\n");
    const sourceWithProjectContext = appendProjectContextToInput(
      parsed.data.input,
      parsed.data.projectContextBlock || parsed.data.projectContext || ""
    );
    const userPrompt = buildQaPrompt("improve-test", sourceWithProjectContext);
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
    if (!content) return jsonError("No AI response was returned.", 502);

    return Response.json({
      ok: true,
      result: JSON.parse(content),
      context: {
        projectContextUsed: Boolean(parsed.data.projectContextUsed),
        selectedProjectId: parsed.data.selectedProjectId,
        selectedProjectName: parsed.data.selectedProjectName,
        selectedProjectSourceIds: parsed.data.selectedProjectSourceIds ?? [],
        projectContextSummary: parsed.data.projectContextSummary,
      },
    });
  } catch (error) {
    console.error("/improve-test failed", error);
    return jsonError("QA Sidekick could not complete this request.", 500);
  }
}
