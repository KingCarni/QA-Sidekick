import { getServerSession } from "next-auth";
import { apiError, apiOk, getErrorMessage, readJsonBody } from "@/lib/api-response";
import { authOptions } from "@/lib/auth";
import { buildQAtBrainContext } from "@/lib/qat-brain-context";
import { composeQAtAnswer } from "@/lib/qat-chat-composer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type QAtChatBody = {
  projectId?: unknown;
  question?: unknown;
};

function cleanQuestion(value: unknown): string {
  return String(value ?? "").trim().slice(0, 1200);
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

    const brainContext = await buildQAtBrainContext({
      userId,
      projectId,
      question,
      maxCharacters: 14000,
    });

    const composed = await composeQAtAnswer({
      question,
      contextBlock: brainContext.contextBlock,
      usedItems: brainContext.usedItems,
      missingContext: brainContext.missingContext,
    });

    return apiOk(req, {
      answer: composed.answer,
      usedSources: brainContext.usedItems.slice(0, 8).map((item) => ({
        id: item.id,
        title: item.title,
        type: item.kind,
      })),
      missingContext: brainContext.missingContext,
    });
  } catch (error) {
    return apiError(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      message: getErrorMessage(error, "QAt could not answer from Project Brain context."),
    });
  }
}