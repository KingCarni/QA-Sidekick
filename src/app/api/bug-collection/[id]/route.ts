import { getServerSession } from "next-auth";
import { apiError, apiOk, getErrorMessage, readJsonBody } from "@/lib/api-response";
import { authOptions } from "@/lib/auth";
import {
  deleteBugCollectionItem,
  normalizeBugCollectionPayload,
  saveBugCollectionItem,
  updateBugCollectionStatus,
} from "@/lib/bug-collection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type PatchBugBody = Record<string, unknown> & {
  status?: unknown;
  projectId?: unknown;
};

async function getSignedInUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

export async function PATCH(req: Request, context: RouteContext): Promise<Response> {
  try {
    const userId = await getSignedInUserId();

    if (!userId) {
      return apiError(req, {
        status: 401,
        code: "UNAUTHORIZED",
        message: "Please sign in before updating bug collection items.",
      });
    }

    const { id: bugId } = await context.params;
    const body = await readJsonBody<PatchBugBody>(req);

    if (Object.keys(body).length === 1 && "status" in body) {
      const result = await updateBugCollectionStatus(userId, bugId, body.status);

      if (!result.ok) {
        return apiError(req, {
          status: result.error.includes("not found") ? 404 : 400,
          code: result.error.includes("not found") ? "NOT_FOUND" : "VALIDATION_ERROR",
          message: result.error,
        });
      }

      return apiOk(req, { bug: result.bug });
    }

    const projectId = typeof body.projectId === "string" && body.projectId.trim() ? body.projectId.trim() : null;
    const payload = normalizeBugCollectionPayload(body);
    const result = await saveBugCollectionItem(userId, projectId, bugId, payload);

    if (!result.ok) {
      const notFound = result.errors.includes("Project not found.") || result.errors.includes("Bug collection item not found.");

      return apiError(req, {
        status: notFound ? 404 : 400,
        code: notFound ? "NOT_FOUND" : "VALIDATION_ERROR",
        message: result.errors[0] ?? "Bug collection item is invalid.",
        details: { errors: result.errors },
      });
    }

    return apiOk(req, { bug: result.bug });
  } catch (error) {
    return apiError(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      message: getErrorMessage(error, "Could not update bug collection item."),
    });
  }
}

export async function DELETE(req: Request, context: RouteContext): Promise<Response> {
  try {
    const userId = await getSignedInUserId();

    if (!userId) {
      return apiError(req, {
        status: 401,
        code: "UNAUTHORIZED",
        message: "Please sign in before deleting bug collection items.",
      });
    }

    const { id: bugId } = await context.params;
    const result = await deleteBugCollectionItem(userId, bugId);

    if (!result.ok) {
      return apiError(req, {
        status: result.error.includes("not found") ? 404 : 400,
        code: result.error.includes("not found") ? "NOT_FOUND" : "VALIDATION_ERROR",
        message: result.error,
      });
    }

    return apiOk(req, { deleted: true });
  } catch (error) {
    return apiError(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      message: getErrorMessage(error, "Could not delete bug collection item."),
    });
  }
}
