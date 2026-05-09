import { getServerSession } from "next-auth";
import { apiError, apiOk, getErrorMessage } from "@/lib/api-response";
import { authOptions } from "@/lib/auth";
import { normalizeJiraErrorMessage } from "@/lib/jira-error-normalizer";
import { getUserJiraConfigStatus } from "@/lib/jira-config";
import { fetchJiraIssueByKey } from "@/lib/jira-issue-fetch";
import { durationSince, nowMs, serverLog } from "@/lib/server-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    key: string;
  }>;
};

async function getSignedInUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

export async function GET(req: Request, context: RouteContext): Promise<Response> {
  const startedAt = nowMs();
  const route = "/api/jira/issues/[key]";

  try {
    const userId = await getSignedInUserId();

    if (!userId) {
      return apiError(req, {
        status: 401,
        code: "UNAUTHORIZED",
        message: "Please sign in before fetching Jira issues.",
      });
    }

    const { key } = await context.params;
    const issueKeyOrUrl = decodeURIComponent(String(key ?? "")).trim();

    if (!issueKeyOrUrl) {
      return apiError(req, {
        status: 400,
        code: "VALIDATION_ERROR",
        message: "Enter a Jira issue key or Jira issue URL.",
      });
    }

    const jiraStatus = await getUserJiraConfigStatus(userId);

    if (!jiraStatus.configured || !jiraStatus.config) {
      return apiError(req, {
        status: 400,
        code: "VALIDATION_ERROR",
        message:
          jiraStatus.missingFields.length > 0
            ? `Jira config is missing: ${jiraStatus.missingFields.join(", ")}.`
            : "Jira is not configured.",
      });
    }

    const result = await fetchJiraIssueByKey({
      config: jiraStatus.config,
      issueKeyOrUrl,
    });

    if (!result.ok) {
      serverLog.warn("Jira issue fetch failed.", {
        route,
        userId,
        status: result.status,
        durationMs: durationSince(startedAt),
        meta: {
          issueKeyOrUrl,
          projectKey: jiraStatus.config.projectKey,
          error: result.error,
        },
      });

      return apiError(req, {
        status: result.status >= 400 && result.status < 600 ? result.status : 502,
        code: "UPSTREAM_ERROR",
        message: normalizeJiraErrorMessage(result.error),
        details: { jira: result.details },
      });
    }

    serverLog.info("Jira issue fetched.", {
      route,
      userId,
      status: 200,
      durationMs: durationSince(startedAt),
      meta: {
        issueKey: result.issue.key,
        projectKey: jiraStatus.config.projectKey,
      },
    });

    return apiOk(req, {
      issue: {
        key: result.issue.key,
        browseUrl: result.issue.browseUrl,
        normalizedText: result.issue.normalizedText,
        parsedTicket: result.issue.parsedTicket,
      },
    });
  } catch (error) {
    serverLog.error("Jira issue fetch route failed.", {
      route,
      status: 500,
      durationMs: durationSince(startedAt),
      error,
    });

    return apiError(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      message: normalizeJiraErrorMessage(error, getErrorMessage(error, "Could not fetch Jira issue.")),
    });
  }
}
