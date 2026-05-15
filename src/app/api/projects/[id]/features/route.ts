import { getServerSession } from "next-auth";
import { apiError, apiOk, getErrorMessage, readJsonBody } from "@/lib/api-response";
import { authOptions } from "@/lib/auth";
import { listProjectFeatures, normalizeProjectFeaturePayload, saveProjectFeature } from "@/lib/project-risks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

async function getSignedInUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

export async function GET(req: Request, context: RouteContext): Promise<Response> {
  try {
    const userId = await getSignedInUserId();
    if (!userId) return apiError(req, { status: 401, code: "UNAUTHORIZED", message: "Please sign in before loading features." });
    const { id: projectId } = await context.params;
    const features = await listProjectFeatures(userId, projectId);
    return apiOk(req, { features });
  } catch (error) {
    return apiError(req, { status: 500, code: "INTERNAL_ERROR", message: getErrorMessage(error, "Could not load features.") });
  }
}

export async function POST(req: Request, context: RouteContext): Promise<Response> {
  try {
    const userId = await getSignedInUserId();
    if (!userId) return apiError(req, { status: 401, code: "UNAUTHORIZED", message: "Please sign in before saving features." });
    const { id: projectId } = await context.params;
    const body = await readJsonBody<Record<string, unknown>>(req);
    const featureId = typeof body.id === "string" && body.id.trim() ? body.id.trim() : null;
    const result = await saveProjectFeature(userId, projectId, featureId, normalizeProjectFeaturePayload(body));
    if (!result.ok) {
      const notFound = result.errors.includes("Project not found.") || result.errors.includes("Feature not found.");
      return apiError(req, { status: notFound ? 404 : 400, code: notFound ? "NOT_FOUND" : "VALIDATION_ERROR", message: result.errors[0] ?? "Feature is invalid.", details: { errors: result.errors } });
    }
    return apiOk(req, { feature: result.feature });
  } catch (error) {
    return apiError(req, { status: 500, code: "INTERNAL_ERROR", message: getErrorMessage(error, "Could not save feature.") });
  }
}
