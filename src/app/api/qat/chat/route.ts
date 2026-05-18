import { getServerSession } from "next-auth";
import { apiError, apiOk, getErrorMessage, readJsonBody } from "@/lib/api-response";
import { authOptions } from "@/lib/auth";
import { buildProjectSourceContextBlock, listProjectSources } from "@/lib/project-sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type QAtChatBody = {
  projectId?: unknown;
  question?: unknown;
};

function cleanQuestion(value: unknown): string {
  return String(value ?? "").trim().slice(0, 1200);
}

function summarizeContext(contextBlock: string, question: string): string {
  const normalizedQuestion = question.toLowerCase();
  const sourceBlocks = contextBlock.split("\n\n---\n\n").filter(Boolean);
  const matchingBlocks = sourceBlocks.filter((block) => {
    const lower = block.toLowerCase();
    return normalizedQuestion
      .split(/\s+/)
      .filter((word) => word.length >= 4)
      .some((word) => lower.includes(word));
  });

  const blocksToUse = matchingBlocks.length ? matchingBlocks : sourceBlocks.slice(0, 2);
  const excerpt = blocksToUse
    .map((block) => block.replace(/\s+/g, " ").trim().slice(0, 520))
    .filter(Boolean)
    .join("\n\n");

  if (!excerpt) {
    return "I found enabled Source Vault entries, but I could not extract enough readable text to answer from them.";
  }

  return `Based on the enabled Source Vault context I found for this project, here is the most relevant context for your question:\n\n${excerpt}\n\nThis is a first-pass grounded answer. I am only using saved Project Brain source context here, so I will avoid filling gaps that are not present in the sources yet.`;
}

export async function POST(req: Request): Promise<Response> {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return apiError(req, {
        status: 401,
        code: "UNAUTHORIZED",
        message: "Please sign in before asking QAt.",
      });
    }

    const body = await readJsonBody<QAtChatBody>(req);
    const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
    const question = cleanQuestion(body.question);

    if (!projectId) {
      return apiError(req, {
        status: 400,
        code: "VALIDATION_ERROR",
        message: "Select a project before asking QAt.",
      });
    }

    if (!question) {
      return apiError(req, {
        status: 400,
        code: "VALIDATION_ERROR",
        message: "Ask QAt a question first.",
      });
    }

    const sources = await listProjectSources(userId, projectId);
    const enabledSources = sources.filter((source) => source.isEnabled);
    const contextBlock = buildProjectSourceContextBlock(enabledSources, 12000);

    if (!sources.length) {
      return apiOk(req, {
        answer:
          "I do not have any Source Vault entries for this project yet. Add a product overview, requirements notes, QA strategy, or release context first, then I can answer from that saved Brain context.",
        usedSources: [],
        missingContext: ["Source Vault entries"],
      });
    }

    if (!enabledSources.length || !contextBlock.trim()) {
      return apiOk(req, {
        answer:
          "I found Source Vault entries for this project, but none are currently enabled for Brain context. Enable the sources you want QAt to use, then ask again.",
        usedSources: [],
        missingContext: ["Enabled Source Vault context"],
      });
    }

    return apiOk(req, {
      answer: summarizeContext(contextBlock, question),
      usedSources: enabledSources.slice(0, 6).map((source) => ({
        id: source.id,
        title: source.title,
        type: source.sourceType,
      })),
      missingContext: [],
    });
  } catch (error) {
    return apiError(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      message: getErrorMessage(error, "QAt could not answer from Project Brain context."),
    });
  }
}
