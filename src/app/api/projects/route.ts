import { getServerSession } from "next-auth";
import { apiError, apiOk, getErrorMessage, readJsonBody } from "@/lib/api-response";
import { authOptions } from "@/lib/auth";
import {
  listUserQAProjects,
  normalizeQAProjectPayload,
  saveUserQAProject,
} from "@/lib/qa-projects";
import { durationSince, nowMs, serverLog } from "@/lib/server-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SaveProjectBody = {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  productType?: unknown;
};

async function getSignedInUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

export async function GET(req: Request): Promise<Response> {
  const startedAt = nowMs();
  const route = "/api/projects";

  try {
    const userId = await getSignedInUserId();

    if (!userId) {
      return apiError(req, {
        status: 401,
        code: "UNAUTHORIZED",
        message: "Please sign in before loading projects.",
      });
    }

    const projects = await listUserQAProjects(userId);

    serverLog.info("Projects loaded.", {
      route,
      userId,
      status: 200,
      durationMs: durationSince(startedAt),
      meta: { count: projects.length },
    });

    return apiOk(req, { projects });
  } catch (error) {
    serverLog.error("Projects load failed.", {
      route,
      status: 500,
      durationMs: durationSince(startedAt),
      error,
    });

    return apiError(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      message: getErrorMessage(error, "Could not load projects."),
    });
  }
}

export async function POST(req: Request): Promise<Response> {
  const startedAt = nowMs();
  const route = "/api/projects";

  try {
    const userId = await getSignedInUserId();

    if (!userId) {
      return apiError(req, {
        status: 401,
        code: "UNAUTHORIZED",
        message: "Please sign in before saving projects.",
      });
    }

    const body = await readJsonBody<SaveProjectBody>(req);
    const projectId = typeof body.id === "string" && body.id.trim() ? body.id.trim() : null;
    const payload = normalizeQAProjectPayload(body);
    const result = await saveUserQAProject(userId, projectId, payload);

    if (!result.ok) {
      return apiError(req, {
        status: result.errors.includes("Project not found.") ? 404 : 400,
        code: result.errors.includes("Project not found.") ? "NOT_FOUND" : "VALIDATION_ERROR",
        message: result.errors[0] ?? "Project is invalid.",
        details: { errors: result.errors },
      });
    }

    serverLog.info("Project saved.", {
      route,
      userId,
      status: 200,
      durationMs: durationSince(startedAt),
      meta: {
        projectId: result.project.id,
        name: result.project.name,
      },
    });

    return apiOk(req, { project: result.project });
  } catch (error) {
    serverLog.error("Project save failed.", {
      route,
      status: 500,
      durationMs: durationSince(startedAt),
      error,
    });

    return apiError(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      message: getErrorMessage(error, "Could not save project."),
    });
  }
}
