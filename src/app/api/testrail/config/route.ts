import { getServerSession } from "next-auth";
import { apiError, apiOk, getErrorMessage, readJsonBody } from "@/lib/api-response";
import { authOptions } from "@/lib/auth";
import {
  deleteUserTestRailConfig,
  getUserTestRailConfigStatus,
  normalizeTestRailConfigPayload,
  saveUserTestRailConfig,
} from "@/lib/testrail-config";
import { durationSince, nowMs, serverLog } from "@/lib/server-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SaveTestRailConfigBody = {
  baseUrl?: unknown;
  username?: unknown;
  apiKey?: unknown;
  projectId?: unknown;
  suiteId?: unknown;
  defaultSectionId?: unknown;
  milestoneId?: unknown;
  runId?: unknown;
  fieldMapping?: unknown;
};

async function getSignedInUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

export async function GET(req: Request): Promise<Response> {
  const startedAt = nowMs();
  const route = "/api/testrail/config";

  try {
    const userId = await getSignedInUserId();

    if (!userId) {
      return apiError(req, { status: 401, code: "UNAUTHORIZED", message: "Please sign in before configuring TestRail." });
    }

    const status = await getUserTestRailConfigStatus(userId);

    serverLog.info("TestRail config status loaded.", {
      route,
      userId,
      status: 200,
      durationMs: durationSince(startedAt),
      meta: { configured: status.configured, missingFieldCount: status.missingFields.length },
    });

    return apiOk(req, { testrail: status });
  } catch (error) {
    serverLog.error("TestRail config status failed.", { route, status: 500, durationMs: durationSince(startedAt), error });
    return apiError(req, { status: 500, code: "INTERNAL_ERROR", message: getErrorMessage(error, "Could not load TestRail config.") });
  }
}

export async function POST(req: Request): Promise<Response> {
  const startedAt = nowMs();
  const route = "/api/testrail/config";

  try {
    const userId = await getSignedInUserId();

    if (!userId) {
      return apiError(req, { status: 401, code: "UNAUTHORIZED", message: "Please sign in before configuring TestRail." });
    }

    const body = await readJsonBody<SaveTestRailConfigBody>(req);
    const payload = normalizeTestRailConfigPayload(body);
    const result = await saveUserTestRailConfig(userId, payload);

    if (!result.ok) {
      return apiError(req, {
        status: 400,
        code: "VALIDATION_ERROR",
        message: result.errors[0] ?? "TestRail config is invalid.",
        details: { errors: result.errors },
      });
    }

    serverLog.info("TestRail config saved.", {
      route,
      userId,
      status: 200,
      durationMs: durationSince(startedAt),
      meta: { projectId: result.config.projectId, suiteId: result.config.suiteId, defaultSectionId: result.config.defaultSectionId },
    });

    return apiOk(req, { testrail: { configured: true, missingFields: [], config: result.config } });
  } catch (error) {
    serverLog.error("TestRail config save failed.", { route, status: 500, durationMs: durationSince(startedAt), error });
    return apiError(req, { status: 500, code: "INTERNAL_ERROR", message: getErrorMessage(error, "Could not save TestRail config.") });
  }
}

export async function DELETE(req: Request): Promise<Response> {
  const startedAt = nowMs();
  const route = "/api/testrail/config";

  try {
    const userId = await getSignedInUserId();

    if (!userId) {
      return apiError(req, { status: 401, code: "UNAUTHORIZED", message: "Please sign in before configuring TestRail." });
    }

    const result = await deleteUserTestRailConfig(userId);

    if (!result.ok) {
      return apiError(req, { status: 400, code: "BAD_REQUEST", message: result.error });
    }

    serverLog.info("TestRail config deleted.", { route, userId, status: 200, durationMs: durationSince(startedAt) });

    return apiOk(req, {
      testrail: {
        configured: false,
        missingFields: ["TestRail base URL", "Username/email", "API key", "Project ID", "Default section ID"],
        config: null,
      },
    });
  } catch (error) {
    serverLog.error("TestRail config delete failed.", { route, status: 500, durationMs: durationSince(startedAt), error });
    return apiError(req, { status: 500, code: "INTERNAL_ERROR", message: getErrorMessage(error, "Could not delete TestRail config.") });
  }
}
