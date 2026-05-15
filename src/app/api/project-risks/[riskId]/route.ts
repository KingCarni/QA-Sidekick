import { getServerSession } from "next-auth";
import { apiError, apiOk, getErrorMessage, readJsonBody } from "@/lib/api-response";
import { authOptions } from "@/lib/auth";
import { deleteProjectRisk, setProjectRiskEnabled } from "@/lib/project-risks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ riskId: string }> };

type PatchBody = { isEnabled?: unknown };

async function getSignedInUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

export async function PATCH(req: Request, context: RouteContext): Promise<Response> {
  try {
    const userId = await getSignedInUserId();
    if (!userId) return apiError(req, { status: 401, code: "UNAUTHORIZED", message: "Please sign in before updating this risk." });
    const { riskId } = await context.params;
    const body = await readJsonBody<PatchBody>(req);
    if (typeof body.isEnabled !== "boolean") return apiError(req, { status: 400, code: "VALIDATION_ERROR", message: "isEnabled must be true or false." });
    const result = await setProjectRiskEnabled(userId, riskId, body.isEnabled);
    if (!result.ok || !result.risk) return apiError(req, { status: 404, code: "NOT_FOUND", message: result.error || "Risk not found." });
    return apiOk(req, { risk: result.risk });
  } catch (error) {
    return apiError(req, { status: 500, code: "INTERNAL_ERROR", message: getErrorMessage(error, "Could not update risk.") });
  }
}

export async function DELETE(req: Request, context: RouteContext): Promise<Response> {
  try {
    const userId = await getSignedInUserId();
    if (!userId) return apiError(req, { status: 401, code: "UNAUTHORIZED", message: "Please sign in before deleting this risk." });
    const { riskId } = await context.params;
    const result = await deleteProjectRisk(userId, riskId);
    if (!result.ok) return apiError(req, { status: 404, code: "NOT_FOUND", message: result.error });
    return apiOk(req, { deleted: true });
  } catch (error) {
    return apiError(req, { status: 500, code: "INTERNAL_ERROR", message: getErrorMessage(error, "Could not delete risk.") });
  }
}
