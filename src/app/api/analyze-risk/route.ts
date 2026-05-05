import { jsonError, qaRequestSchema } from "@/lib/api";
import { getOpenAIClient } from "@/lib/openai";
import { buildRiskAnalysisPrompt } from "@/lib/qaPrompts";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = qaRequestSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid request.");
    }

    const client = getOpenAIClient();

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: buildRiskAnalysisPrompt(parsed.data.input, {
            projectContext: parsed.data.projectContext,
          }),
        },
      ],
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      return jsonError("No AI response was returned.", 502);
    }

    return Response.json({
      ok: true,
      result: JSON.parse(content),
    });
  } catch (error) {
    console.error("/analyze-risk failed", error);
    return jsonError("QA Sidekick could not complete this request.", 500);
  }
}
