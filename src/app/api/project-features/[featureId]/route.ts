import { getServerSession } from "next-auth";
import { apiError, apiOk, getErrorMessage, readJsonBody } from "@/lib/api-response";
import { authOptions } from "@/lib/auth";
import { deleteProjectFeature, setProjectFeatureEnabled } from "@/lib/project-risks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ featureId: string }> };

type PatchBody = { isEnabled?: unknown };

async function getSignedInUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

export async function PATCH(req: Request, context: RouteContext): Promise<Response> {
  try {
    const userId = await getSignedInUserId();
    if (!userId) return apiError(req, { status: 401, code: "UNAUTHORIZED", message: "Please sign in before updating this feature." });
    const { featureId } = await context.params;
    const body = await readJsonBody<PatchBody>(req);
    if (typeof body.isEnabled !== "boolean") return apiError(req, { status: 400, code: "VALIDATION_ERROR", message: "isEnabled must be true or false." });
    const result = await setProjectFeatureEnabled(userId, featureId, body.isEnabled);
    if (!result.ok || !result.feature) return apiError(req, { status: 404, code: "NOT_FOUND", message: result.error || "Feature not found." });
    return apiOk(req, { feature: result.feature });
  } catch (error) {
    return apiError(req, { status: 500, code: "INTERNAL_ERROR", message: getErrorMessage(error, "Could not update feature.") });
  }
}

export async function DELETE(req: Request, context: RouteContext): Promise<Response> {
  try {
    const userId = await getSignedInUserId();
    if (!userId) return apiError(req, { status: 401, code: "UNAUTHORIZED", message: "Please sign in before deleting this feature." });
    const { featureId } = await context.params;
    const result = await deleteProjectFeature(userId, featureId);
    if (!result.ok) return apiError(req, { status: 404, code: "NOT_FOUND", message: result.error });
    return apiOk(req, { deleted: true });
  } catch (error) {
    return apiError(req, { status: 500, code: "INTERNAL_ERROR", message: getErrorMessage(error, "Could not delete feature.") });
  }
}
