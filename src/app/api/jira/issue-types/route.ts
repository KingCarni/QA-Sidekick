import { getServerSession } from "next-auth";
import { apiError, apiOk, getErrorMessage } from "@/lib/api-response";
import { authOptions } from "@/lib/auth";
import { getUserJiraConfigStatus } from "@/lib/jira-config";
import { listJiraProjectIssueTypes } from "@/lib/jira-issue-types";
import { durationSince, nowMs, serverLog } from "@/lib/server-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getSignedInUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

export async function GET(req: Request): Promise<Response> {
  const startedAt = nowMs();
  const route = "/api/jira/issue-types";

  try {
    const userId = await getSignedInUserId();

    if (!userId) {
      return apiError(req, {
        status: 401,
        code: "UNAUTHORIZED",
        message: "Please sign in before loading Jira issue types.",
      });
    }

    const jiraStatus = await getUserJiraConfigStatus(userId);

    if (!jiraStatus.configured || !jiraStatus.config) {
      return apiError(req, {
        status: 400,
        code: "JIRA_CONFIG_MISSING",
        message:
          jiraStatus.missingFields.length > 0
            ? `Jira config is missing: ${jiraStatus.missingFields.join(", ")}.`
            : "Jira is not configured.",
      });
    }

    const result = await listJiraProjectIssueTypes(jiraStatus.config);

    if (!result.ok) {
      serverLog.warn("Jira issue type load failed.", {
        route,
        userId,
        status: result.status,
        durationMs: durationSince(startedAt),
        meta: {
          projectKey: jiraStatus.config.projectKey,
          error: result.error,
        },
      });

      return apiError(req, {
        status: result.status >= 400 && result.status < 600 ? result.status : 502,
        code: "JIRA_ISSUE_TYPES_FAILED",
        message: result.error,
        details: { jira: result.details },
      });
    }

    serverLog.info("Jira issue types loaded.", {
      route,
      userId,
      status: 200,
      durationMs: durationSince(startedAt),
      meta: {
        projectKey: jiraStatus.config.projectKey,
        issueTypeCount: result.issueTypes.length,
      },
    });

    return apiOk(req, {
      issueTypes: result.issueTypes,
    });
  } catch (error) {
    serverLog.error("Jira issue type route failed.", {
      route,
      status: 500,
      durationMs: durationSince(startedAt),
      error,
    });

    return apiError(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      message: getErrorMessage(error, "Could not load Jira issue types."),
    });
  }
}
