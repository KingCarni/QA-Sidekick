import { getServerSession } from "next-auth";
import { apiError, apiOk, getErrorMessage, readJsonBody } from "@/lib/api-response";
import { authOptions } from "@/lib/auth";
import { deleteProjectSource, setProjectSourceEnabled } from "@/lib/project-sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ sourceId: string }>;
};

type PatchSourceBody = {
  isEnabled?: unknown;
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
        message: "Please sign in before updating this project source.",
      });
    }

    const { sourceId } = await context.params;
    const body = await readJsonBody<PatchSourceBody>(req);

    if (typeof body.isEnabled !== "boolean") {
      return apiError(req, {
        status: 400,
        code: "VALIDATION_ERROR",
        message: "isEnabled must be true or false.",
      });
    }

    const result = await setProjectSourceEnabled(userId, sourceId, body.isEnabled);

    if (!result.ok || !result.source) {
      return apiError(req, {
        status: 404,
        code: "NOT_FOUND",
        message: result.error || "Source not found.",
      });
    }

    return apiOk(req, { source: result.source });
  } catch (error) {
    return apiError(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      message: getErrorMessage(error, "Could not update project source."),
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
        message: "Please sign in before deleting this project source.",
      });
    }

    const { sourceId } = await context.params;
    const result = await deleteProjectSource(userId, sourceId);

    if (!result.ok) {
      return apiError(req, {
        status: result.error === "Source not found." ? 404 : 400,
        code: result.error === "Source not found." ? "NOT_FOUND" : "BAD_REQUEST",
        message: result.error,
      });
    }

    return apiOk(req, { deleted: true });
  } catch (error) {
    return apiError(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      message: getErrorMessage(error, "Could not delete project source."),
    });
  }
}
