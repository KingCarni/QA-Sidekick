import { getServerSession } from "next-auth";
import { apiError, apiOk, getErrorMessage, readJsonBody } from "@/lib/api-response";
import { authOptions } from "@/lib/auth";
import {
  listProjectTerms,
  normalizeProjectTermPayload,
  saveProjectTerm,
} from "@/lib/project-terms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type SaveTermBody = {
  id?: unknown;
  term?: unknown;
  definition?: unknown;
  aliases?: unknown;
  preferredUsage?: unknown;
  category?: unknown;
  isEnabled?: unknown;
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
        message: "Please sign in before loading terminology.",
      });
    }

    const { id: projectId } = await context.params;
    const terms = await listProjectTerms(userId, projectId);

    return apiOk(req, { terms });
  } catch (error) {
    return apiError(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      message: getErrorMessage(error, "Could not load terminology."),
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
        message: "Please sign in before saving terminology.",
      });
    }

    const { id: projectId } = await context.params;
    const body = await readJsonBody<SaveTermBody>(req);
    const termId = typeof body.id === "string" && body.id.trim() ? body.id.trim() : null;
    const payload = normalizeProjectTermPayload(body);
    const result = await saveProjectTerm(userId, projectId, termId, payload);

    if (!result.ok) {
      const notFound = result.errors.includes("Project not found.") || result.errors.includes("Term not found.");

      return apiError(req, {
        status: notFound ? 404 : 400,
        code: notFound ? "NOT_FOUND" : "VALIDATION_ERROR",
        message: result.errors[0] ?? "Terminology entry is invalid.",
        details: { errors: result.errors },
      });
    }

    return apiOk(req, { term: result.term });
  } catch (error) {
    return apiError(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      message: getErrorMessage(error, "Could not save terminology."),
    });
  }
}
