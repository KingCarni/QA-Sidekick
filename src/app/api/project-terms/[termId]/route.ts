import { getServerSession } from "next-auth";
import { apiError, apiOk, getErrorMessage, readJsonBody } from "@/lib/api-response";
import { authOptions } from "@/lib/auth";
import { deleteProjectTerm, setProjectTermEnabled } from "@/lib/project-terms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ termId: string }>;
};

type PatchTermBody = {
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
        message: "Please sign in before updating this terminology entry.",
      });
    }

    const { termId } = await context.params;
    const body = await readJsonBody<PatchTermBody>(req);

    if (typeof body.isEnabled !== "boolean") {
      return apiError(req, {
        status: 400,
        code: "VALIDATION_ERROR",
        message: "isEnabled must be true or false.",
      });
    }

    const result = await setProjectTermEnabled(userId, termId, body.isEnabled);

    if (!result.ok || !result.term) {
      return apiError(req, {
        status: 404,
        code: "NOT_FOUND",
        message: result.error || "Term not found.",
      });
    }

    return apiOk(req, { term: result.term });
  } catch (error) {
    return apiError(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      message: getErrorMessage(error, "Could not update terminology entry."),
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
        message: "Please sign in before deleting this terminology entry.",
      });
    }

    const { termId } = await context.params;
    const result = await deleteProjectTerm(userId, termId);

    if (!result.ok) {
      return apiError(req, {
        status: result.error === "Term not found." ? 404 : 400,
        code: result.error === "Term not found." ? "NOT_FOUND" : "BAD_REQUEST",
        message: result.error,
      });
    }

    return apiOk(req, { deleted: true });
  } catch (error) {
    return apiError(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      message: getErrorMessage(error, "Could not delete terminology entry."),
    });
  }
}
