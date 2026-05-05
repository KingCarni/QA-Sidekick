import { getServerSession } from "next-auth";
import { apiError, apiOk, getErrorMessage } from "@/lib/api-response";
import { authOptions } from "@/lib/auth";
import { getProjectContextPayload } from "@/lib/project-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getSignedInUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

export async function GET(req: Request, context: RouteContext): Promise<Response> {
  try {
    const userId = await getSignedInUserId();

    if (!userId) {
      return apiError(req, {
        status: 401,
        code: "UNAUTHORIZED",
        message: "Please sign in before loading project context.",
      });
    }

    const { id: projectId } = await context.params;
    const payload = await getProjectContextPayload(userId, projectId);

    if (!payload.project) {
      return apiError(req, {
        status: 404,
        code: "NOT_FOUND",
        message: "Project not found.",
      });
    }

    return apiOk(req, { projectContext: payload });
  } catch (error) {
    return apiError(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      message: getErrorMessage(error, "Could not load project context."),
    });
  }
}
