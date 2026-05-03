import { getServerSession } from "next-auth";
import { apiError, apiOk, getErrorMessage, readJsonBody } from "@/lib/api-response";
import { authOptions } from "@/lib/auth";
import { getUserJiraConfigStatus } from "@/lib/jira-config";
import { buildJiraIssueDraft, createJiraIssue } from "@/lib/jira-issue";
import { durationSince, nowMs, serverLog } from "@/lib/server-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreateJiraIssueBody = {
  reportType?: unknown;
  markdown?: unknown;
  sourceInput?: unknown;
  structuredData?: unknown;
};

async function getSignedInUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

export async function POST(req: Request): Promise<Response> {
  const startedAt = nowMs();
  const route = "/api/jira/issues/create";

  try {
    const userId = await getSignedInUserId();

    if (!userId) {
      return apiError(req, {
        status: 401,
        code: "UNAUTHORIZED",
        message: "Please sign in before creating Jira issues.",
      });
    }

    const body = await readJsonBody<CreateJiraIssueBody>(req);
    const reportType = String(body.reportType ?? "").toLowerCase();

    if (reportType && reportType !== "bug") {
      return apiError(req, {
        status: 400,
        code: "VALIDATION_ERROR",
        message: "Only Bug Writer reports can create Jira bugs right now.",
      });
    }

    const markdown = typeof body.markdown === "string" ? body.markdown : "";

    if (!markdown.trim()) {
      return apiError(req, {
        status: 400,
        code: "VALIDATION_ERROR",
        message: "Generate or enter a Bug Writer report before creating a Jira issue.",
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

    const draft = buildJiraIssueDraft(
      {
        markdown,
        sourceInput: body.sourceInput,
        structuredData: body.structuredData,
      },
      jiraStatus.config
    );

    const result = await createJiraIssue(jiraStatus.config, draft);

    if (!result.ok) {
      serverLog.warn("Jira issue creation failed.", {
        route,
        userId,
        status: result.status,
        durationMs: durationSince(startedAt),
        meta: {
          projectKey: jiraStatus.config.projectKey,
          issueType: draft.issueType,
          error: result.error,
        },
      });

      return apiError(req, {
        status: result.status >= 400 && result.status < 600 ? result.status : 502,
        code: "JIRA_CREATE_FAILED",
        message: result.error,
        details: { jira: result.details },
      });
    }

    serverLog.info("Jira issue created.", {
      route,
      userId,
      status: 200,
      durationMs: durationSince(startedAt),
      meta: {
        issueKey: result.issue.key,
        projectKey: jiraStatus.config.projectKey,
        issueType: draft.issueType,
      },
    });

    return apiOk(req, {
      jiraIssue: result.issue,
      draft: {
        summary: draft.summary,
        issueType: draft.issueType,
        priorityName: draft.priorityName,
      },
    });
  } catch (error) {
    serverLog.error("Jira issue create route failed.", {
      route,
      status: 500,
      durationMs: durationSince(startedAt),
      error,
    });

    return apiError(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      message: getErrorMessage(error, "Could not create Jira issue."),
    });
  }
}
