import { getServerSession } from "next-auth";
import { apiError, apiOk, getErrorMessage, readJsonBody } from "@/lib/api-response";
import { authOptions } from "@/lib/auth";
import {
  listBugCollectionItems,
  normalizeBugCollectionPayload,
  saveBugCollectionItem,
} from "@/lib/bug-collection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type SaveBugBody = Record<string, unknown> & {
  id?: unknown;
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
        message: "Please sign in before loading bug collection items.",
      });
    }

    const { id: projectId } = await context.params;
    const bugs = await listBugCollectionItems(userId, projectId);

    return apiOk(req, { bugs });
  } catch (error) {
    return apiError(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      message: getErrorMessage(error, "Could not load bug collection."),
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
        message: "Please sign in before saving bug collection items.",
      });
    }

    const { id: projectId } = await context.params;
    const body = await readJsonBody<SaveBugBody>(req);
    const bugId = typeof body.id === "string" && body.id.trim() ? body.id.trim() : null;
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
      message: getErrorMessage(error, "Could not save bug collection item."),
    });
  }
}
