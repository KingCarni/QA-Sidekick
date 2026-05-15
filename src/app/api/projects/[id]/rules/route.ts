import { getServerSession } from "next-auth";
import { apiError, apiOk, getErrorMessage, readJsonBody } from "@/lib/api-response";
import { authOptions } from "@/lib/auth";
import {
  listProjectRules,
  normalizeProjectRulePayload,
  saveProjectRule,
} from "@/lib/project-rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type SaveRuleBody = {
  id?: unknown;
  title?: unknown;
  category?: unknown;
  severity?: unknown;
  appliesTo?: unknown;
  body?: unknown;
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
        message: "Please sign in before loading QA rules.",
      });
    }

    const { id: projectId } = await context.params;
    const rules = await listProjectRules(userId, projectId);

    return apiOk(req, { rules });
  } catch (error) {
    return apiError(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      message: getErrorMessage(error, "Could not load QA rules."),
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
        message: "Please sign in before saving QA rules.",
      });
    }

    const { id: projectId } = await context.params;
    const body = await readJsonBody<SaveRuleBody>(req);
    const ruleId = typeof body.id === "string" && body.id.trim() ? body.id.trim() : null;
    const payload = normalizeProjectRulePayload(body);
    const result = await saveProjectRule(userId, projectId, ruleId, payload);

    if (!result.ok) {
      const notFound = result.errors.includes("Project not found.") || result.errors.includes("Rule not found.");

      return apiError(req, {
        status: notFound ? 404 : 400,
        code: notFound ? "NOT_FOUND" : "VALIDATION_ERROR",
        message: result.errors[0] ?? "QA rule is invalid.",
        details: { errors: result.errors },
      });
    }

    return apiOk(req, { rule: result.rule });
  } catch (error) {
    return apiError(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      message: getErrorMessage(error, "Could not save QA rule."),
    });
  }
}
