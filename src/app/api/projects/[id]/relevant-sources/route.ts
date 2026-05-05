import { getServerSession } from "next-auth";
import { apiError, apiOk, getErrorMessage, readJsonBody } from "@/lib/api-response";
import { authOptions } from "@/lib/auth";
import { getProjectContextPayload } from "@/lib/project-context";
import { rankProjectSourcesForInput } from "@/lib/project-source-relevance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type RelevanceBody = {
  input?: unknown;
  toolId?: unknown;
  maxSuggested?: unknown;
};

async function getSignedInUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

export async function POST(req: Request, context: RouteContext): Promise<Response> {
  try {
    const userId = await getSignedInUserId();

    if (!userId) {
      return apiError(req, {
        status: 401,
        code: "UNAUTHORIZED",
        message: "Please sign in before loading relevant project sources.",
      });
    }

    const { id: projectId } = await context.params;
    const body = await readJsonBody<RelevanceBody>(req);
    const input = String(body.input ?? "");
    const toolId = String(body.toolId ?? "");
    const maxSuggested = typeof body.maxSuggested === "number" ? body.maxSuggested : 4;

    const contextPayload = await getProjectContextPayload(userId, projectId);

    if (!contextPayload.project) {
      return apiError(req, {
        status: 404,
        code: "NOT_FOUND",
        message: "Project not found.",
      });
    }

    const rankedSources = rankProjectSourcesForInput(
      contextPayload.sources,
      input,
      toolId,
      maxSuggested
    );

    return apiOk(req, {
      project: contextPayload.project,
      rankedSources,
      suggestedSourceIds: rankedSources.filter((source) => source.isSuggested).map((source) => source.id),
    });
  } catch (error) {
    return apiError(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      message: getErrorMessage(error, "Could not rank project sources."),
    });
  }
}
