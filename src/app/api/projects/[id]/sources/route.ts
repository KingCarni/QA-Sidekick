import { getServerSession } from "next-auth";
import { apiError, apiOk, getErrorMessage, readJsonBody } from "@/lib/api-response";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  listProjectSources,
  normalizeProjectSourcePayload,
  saveProjectSource,
} from "@/lib/project-sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type SaveSourceBody = {
  id?: unknown;
  title?: unknown;
  sourceType?: unknown;
  body?: unknown;
  tags?: unknown;
  isEnabled?: unknown;
};

async function getSignedInUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

async function userOwnsProject(userId: string, projectId: string): Promise<boolean> {
  if (!userId || !projectId) return false;

  const project = await prisma.qAProject.findFirst({
    where: {
      id: projectId,
      userId,
    },
    select: {
      id: true,
    },
  });

  return Boolean(project);
}

export async function GET(req: Request, context: RouteContext): Promise<Response> {
  try {
    const userId = await getSignedInUserId();

    if (!userId) {
      return apiError(req, {
        status: 401,
        code: "UNAUTHORIZED",
        message: "Please sign in before loading project sources.",
      });
    }

    const { id: projectId } = await context.params;

    if (!(await userOwnsProject(userId, projectId))) {
      return apiError(req, {
        status: 404,
        code: "NOT_FOUND",
        message: "Project not found.",
      });
    }

    const sources = await listProjectSources(userId, projectId);

    return apiOk(req, { sources });
  } catch (error) {
    return apiError(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      message: getErrorMessage(error, "Could not load project sources."),
    });
  }
}

export async function POST(req: Request, context: RouteContext): Promise<Response> {
  try {
    const userId = await getSignedInUserId();

    if (!userId) {
      return apiError(req, {
        status: 401,
        code: "UNAUTHORIZED",
        message: "Please sign in before saving project sources.",
      });
    }

    const { id: projectId } = await context.params;
    const body = await readJsonBody<SaveSourceBody>(req);
    const sourceId = typeof body.id === "string" && body.id.trim() ? body.id.trim() : null;
    const payload = normalizeProjectSourcePayload(body);
    const result = await saveProjectSource(userId, projectId, sourceId, payload);

    if (!result.ok) {
      const notFound = result.errors.includes("Project not found.") || result.errors.includes("Source not found.");

      return apiError(req, {
        status: notFound ? 404 : 400,
        code: notFound ? "NOT_FOUND" : "VALIDATION_ERROR",
        message: result.errors[0] ?? "Project source is invalid.",
        details: { errors: result.errors },
      });
    }

    return apiOk(req, { source: result.source });
  } catch (error) {
    return apiError(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      message: getErrorMessage(error, "Could not save project source."),
    });
  }
}
