import { jsonError, qaRequestSchema } from "@/lib/api";
import { getOpenAIClient } from "@/lib/openai";
import { buildBugReportPrompt } from "@/lib/qaPrompts";

type ScreenshotInput = {
  name?: unknown;
  type?: unknown;
  size?: unknown;
  dataUrl?: unknown;
};

function isScreenshotInput(value: unknown): value is ScreenshotInput {
  return typeof value === "object" && value !== null;
}

function getScreenshotInputs(value: unknown): ScreenshotInput[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isScreenshotInput)
    .filter((item) => typeof item.dataUrl === "string" && item.dataUrl.startsWith("data:image/"))
    .slice(0, 3);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = qaRequestSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid request.");
    }

    const screenshots = getScreenshotInputs((body as { screenshots?: unknown }).screenshots);
    const client = getOpenAIClient();

    const textPrompt = buildBugReportPrompt(parsed.data.input, {
      projectContext: parsed.data.projectContext,
    });

    const messages =
      screenshots.length > 0
        ? [
            {
              role: "user" as const,
              content: [
                {
                  type: "text" as const,
                  text: [
                    textPrompt,
                    "",
                    "Attached screenshot instructions:",
                    "- Review the attached screenshots only for visible UI evidence.",
                    "- Do not claim details that are not visible.",
                    "- If screenshots show useful evidence, mention it in qaNotes.",
                    "- If screenshot evidence changes severity/priority, explain briefly in impact or qaNotes.",
                  ].join("\\n"),
                },
                ...screenshots.map((screenshot) => ({
                  type: "image_url" as const,
                  image_url: {
                    url: String(screenshot.dataUrl),
                  },
                })),
              ],
            },
          ]
        : [
            {
              role: "user" as const,
              content: textPrompt,
            },
          ];

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages,
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
    console.error("/improve-bug failed", error);
    return jsonError("QA Sidekick could not complete this request.", 500);
  }
}
