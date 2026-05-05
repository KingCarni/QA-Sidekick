import { jsonError, qaRequestSchema } from "@/lib/api";
import { getOpenAIClient } from "@/lib/openai";
import { buildQaPrompt } from "@/lib/qaPrompts";
import { buildQAS73PromptBlock } from "@/lib/qas73-generator-quality-rules";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = qaRequestSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid request.");
    }

    const client = getOpenAIClient();
    const systemPrompt = [
      "You are QAtalyst, a senior QA analyst assistant. Return only valid JSON matching the requested schema. Do not wrap JSON in markdown.",
      buildQAS73PromptBlock("tests"),
    ].join("\n\n");
    const userPrompt = buildQaPrompt("generate-tests", parsed.data.input, {
      projectContext: parsed.data.projectContext,
    });

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

    if (!content) {
      return jsonError("No AI response was returned.", 502);
    }

    return Response.json({
      ok: true,
      result: JSON.parse(content),
    });
  } catch (error) {
    console.error("/generate-tests failed", error);
    return jsonError("QA Sidekick could not complete this request.", 500);
  }
}
