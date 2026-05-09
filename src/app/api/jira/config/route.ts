import { getServerSession } from "next-auth";
import { apiError, apiOk, getErrorMessage, readJsonBody } from "@/lib/api-response";
import { authOptions } from "@/lib/auth";
import {
  deleteUserJiraConfig,
  getUserJiraConfigStatus,
  normalizeJiraConfigPayload,
  saveUserJiraConfig,
} from "@/lib/jira-config";
import { durationSince, nowMs, serverLog } from "@/lib/server-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SaveJiraConfigBody = {
  siteUrl?: unknown;
  jiraEmail?: unknown;
  email?: unknown;
  username?: unknown;
  jiraApiToken?: unknown;
  apiToken?: unknown;
  projectKey?: unknown;
  defaultIssueType?: unknown;
  defaultBugIssueType?: unknown;
  fieldMapping?: unknown;
};

async function getSignedInUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

export async function GET(req: Request): Promise<Response> {
  const startedAt = nowMs();
  const route = "/api/jira/config";

  try {
    const userId = await getSignedInUserId();

    if (!userId) {
      serverLog.warn("Jira config request blocked: unauthenticated user.", {
        route,
        status: 401,
        durationMs: durationSince(startedAt),
      });

      return apiError(req, {
        status: 401,
        code: "UNAUTHORIZED",
        message: "Please sign in before configuring Jira.",
      });
    }

    const status = await getUserJiraConfigStatus(userId);

    serverLog.info("Jira config status loaded.", {
      route,
      userId,
      status: 200,
      durationMs: durationSince(startedAt),
      meta: {
        configured: status.configured,
        missingFieldCount: status.missingFields.length,
      },
    });

    return apiOk(req, { jira: status });
  } catch (error) {
    serverLog.error("Jira config status failed.", {
      route,
      status: 500,
      durationMs: durationSince(startedAt),
      error,
    });

    return apiError(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      message: getErrorMessage(error, "Could not load Jira config."),
    });
  }
}

export async function POST(req: Request): Promise<Response> {
  const startedAt = nowMs();
  const route = "/api/jira/config";

  try {
    const userId = await getSignedInUserId();

    if (!userId) {
      serverLog.warn("Jira config save blocked: unauthenticated user.", {
        route,
        status: 401,
        durationMs: durationSince(startedAt),
      });

      return apiError(req, {
        status: 401,
        code: "UNAUTHORIZED",
        message: "Please sign in before configuring Jira.",
      });
    }

    const body = await readJsonBody<SaveJiraConfigBody>(req);
    const payload = normalizeJiraConfigPayload(body);
    const result = await saveUserJiraConfig(userId, payload);

    if (!result.ok) {
      serverLog.warn("Jira config validation failed.", {
        route,
        userId,
        status: 400,
        durationMs: durationSince(startedAt),
        meta: {
          errors: result.errors,
        },
      });

      return apiError(req, {
        status: 400,
        code: "VALIDATION_ERROR",
        message: result.errors[0] ?? "Jira config is invalid.",
        details: { errors: result.errors },
      });
    }

    serverLog.info("Jira config saved.", {
      route,
      userId,
      status: 200,
      durationMs: durationSince(startedAt),
      meta: {
        projectKey: result.config.projectKey,
        defaultIssueType: result.config.defaultIssueType,
        defaultBugIssueType: result.config.defaultBugIssueType,
      },
    });

    const status = await getUserJiraConfigStatus(userId);

    return apiOk(req, {
      jira: status,
      message: "Saved Jira settings.",
    });
  } catch (error) {
    serverLog.error("Jira config save failed.", {
      route,
      status: 500,
      durationMs: durationSince(startedAt),
      error,
    });

    return apiError(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      message: getErrorMessage(error, "Could not save Jira config."),
    });
  }
}

export async function DELETE(req: Request): Promise<Response> {
  const startedAt = nowMs();
  const route = "/api/jira/config";

  try {
    const userId = await getSignedInUserId();

    if (!userId) {
      serverLog.warn("Jira config delete blocked: unauthenticated user.", {
        route,
        status: 401,
        durationMs: durationSince(startedAt),
      });

      return apiError(req, {
        status: 401,
        code: "UNAUTHORIZED",
        message: "Please sign in before configuring Jira.",
      });
    }

    const result = await deleteUserJiraConfig(userId);

    if (!result.ok) {
      return apiError(req, {
        status: 400,
        code: "BAD_REQUEST",
        message: result.error,
      });
    }

    serverLog.info("Jira config deleted.", {
      route,
      userId,
      status: 200,
      durationMs: durationSince(startedAt),
    });

    const status = await getUserJiraConfigStatus(userId);

    return apiOk(req, {
      jira: status,
      message: "Jira config removed.",
    });
  } catch (error) {
    serverLog.error("Jira config delete failed.", {
      route,
      status: 500,
      durationMs: durationSince(startedAt),
      error,
    });

    return apiError(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      message: getErrorMessage(error, "Could not delete Jira config."),
    });
  }
}
