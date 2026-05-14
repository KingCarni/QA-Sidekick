import { getServerSession } from "next-auth";
import { apiError, apiOk, getErrorMessage, readJsonBody } from "@/lib/api-response";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordSecurityAuditEvent, SECURITY_EVENTS } from "@/lib/security-audit";
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
      await recordSecurityAuditEvent({
        userId,
        type: SECURITY_EVENTS.BLOCKED_PROJECT_SOURCE_LIST,
        meta: {
          projectId,
          route: "/api/projects/[id]/sources",
          reason: "project_not_owned_or_missing",
        },
      });

      return apiError(req, {
        status: 404,
        code: "NOT_FOUND",
        message: "Project not found.",
      });
    }

    const sources = await listProjectSources(userId, projectId);

    await recordSecurityAuditEvent({
      userId,
      type: SECURITY_EVENTS.PROJECT_SOURCE_LISTED,
      meta: {
        projectId,
        route: "/api/projects/[id]/sources",
        sourceCount: sources.length,
      },
    });

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

      await recordSecurityAuditEvent({
        userId,
        type: SECURITY_EVENTS.PROJECT_SOURCE_SAVE_BLOCKED,
        meta: {
          projectId,
          sourceId,
          route: "/api/projects/[id]/sources",
          notFound,
          errorCount: result.errors.length,
        },
      });

      return apiError(req, {
        status: notFound ? 404 : 400,
        code: notFound ? "NOT_FOUND" : "VALIDATION_ERROR",
        message: result.errors[0] ?? "Project source is invalid.",
        details: { errors: result.errors },
      });
    }

    await recordSecurityAuditEvent({
      userId,
      type: SECURITY_EVENTS.PROJECT_SOURCE_SAVED,
      meta: {
        projectId,
        sourceId: result.source?.id,
        route: "/api/projects/[id]/sources",
        updatedExisting: Boolean(sourceId),
      },
    });

    return apiOk(req, { source: result.source });
  } catch (error) {
    return apiError(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      message: getErrorMessage(error, "Could not save project source."),
    });
  }
}
