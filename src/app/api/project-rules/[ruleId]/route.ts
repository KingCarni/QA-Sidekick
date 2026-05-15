import { getServerSession } from "next-auth";
import { apiError, apiOk, getErrorMessage, readJsonBody } from "@/lib/api-response";
import { authOptions } from "@/lib/auth";
import { deleteProjectRule, setProjectRuleEnabled } from "@/lib/project-rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ ruleId: string }>;
};

type PatchRuleBody = {
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
        message: "Please sign in before updating this QA rule.",
      });
    }

    const { ruleId } = await context.params;
    const body = await readJsonBody<PatchRuleBody>(req);

    if (typeof body.isEnabled !== "boolean") {
      return apiError(req, {
        status: 400,
        code: "VALIDATION_ERROR",
        message: "isEnabled must be true or false.",
      });
    }

    const result = await setProjectRuleEnabled(userId, ruleId, body.isEnabled);

    if (!result.ok || !result.rule) {
      return apiError(req, {
        status: 404,
        code: "NOT_FOUND",
        message: result.error || "Rule not found.",
      });
    }

    return apiOk(req, { rule: result.rule });
  } catch (error) {
    return apiError(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      message: getErrorMessage(error, "Could not update QA rule."),
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
        message: "Please sign in before deleting this QA rule.",
      });
    }

    const { ruleId } = await context.params;
    const result = await deleteProjectRule(userId, ruleId);

    if (!result.ok) {
      return apiError(req, {
        status: result.error === "Rule not found." ? 404 : 400,
        code: result.error === "Rule not found." ? "NOT_FOUND" : "BAD_REQUEST",
        message: result.error,
      });
    }

    return apiOk(req, { deleted: true });
  } catch (error) {
    return apiError(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      message: getErrorMessage(error, "Could not delete QA rule."),
    });
  }
}
