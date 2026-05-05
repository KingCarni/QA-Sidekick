import { getServerSession } from "next-auth";
import { apiError, apiOk, getErrorMessage } from "@/lib/api-response";
import { authOptions } from "@/lib/auth";
import { deleteUserQAProject, getUserQAProject } from "@/lib/qa-projects";
import { durationSince, nowMs, serverLog } from "@/lib/server-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

async function getSignedInUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

export async function GET(req: Request, context: RouteContext): Promise<Response> {
  const startedAt = nowMs();
  const route = "/api/projects/[id]";

  try {
    const userId = await getSignedInUserId();

    if (!userId) {
      return apiError(req, {
        status: 401,
        code: "UNAUTHORIZED",
        message: "Please sign in before loading this project.",
      });
    }

    const { id } = await context.params;
    const project = await getUserQAProject(userId, id);

    if (!project) {
      return apiError(req, {
        status: 404,
        code: "NOT_FOUND",
        message: "Project not found.",
      });
    }

    return apiOk(req, { project });
  } catch (error) {
    serverLog.error("Project read failed.", {
      route,
      status: 500,
      durationMs: durationSince(startedAt),
      error,
    });

    return apiError(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      message: getErrorMessage(error, "Could not load project."),
    });
  }
}

export async function DELETE(req: Request, context: RouteContext): Promise<Response> {
  const startedAt = nowMs();
  const route = "/api/projects/[id]";

  try {
    const userId = await getSignedInUserId();

    if (!userId) {
      return apiError(req, {
        status: 401,
        code: "UNAUTHORIZED",
        message: "Please sign in before deleting this project.",
      });
    }

    const { id } = await context.params;
    const result = await deleteUserQAProject(userId, id);

    if (!result.ok) {
      return apiError(req, {
        status: result.error === "Project not found." ? 404 : 400,
        code: result.error === "Project not found." ? "NOT_FOUND" : "BAD_REQUEST",
        message: result.error,
      });
    }

    serverLog.info("Project deleted.", {
      route,
      userId,
      status: 200,
      durationMs: durationSince(startedAt),
      meta: { projectId: id },
    });

    return apiOk(req, { deleted: true });
  } catch (error) {
    serverLog.error("Project delete failed.", {
      route,
      status: 500,
      durationMs: durationSince(startedAt),
      error,
    });

    return apiError(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      message: getErrorMessage(error, "Could not delete project."),
    });
  }
}
