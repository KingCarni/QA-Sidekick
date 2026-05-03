import { getServerSession } from "next-auth";
import { apiError, apiOk, getErrorMessage } from "@/lib/api-response";
import { authOptions } from "@/lib/auth";
import { getJiraCreateIssueReadiness, getUserJiraConfigStatus } from "@/lib/jira-config";
import { durationSince, nowMs, serverLog } from "@/lib/server-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const startedAt = nowMs();
  const route = "/api/jira/config/status";

  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return apiError(req, {
        status: 401,
        code: "UNAUTHORIZED",
        message: "Please sign in before checking Jira config.",
      });
    }

    const status = await getUserJiraConfigStatus(userId);
    const readiness = getJiraCreateIssueReadiness(status);

    serverLog.info("Jira config readiness checked.", {
      route,
      userId,
      status: 200,
      durationMs: durationSince(startedAt),
      meta: {
        configured: status.configured,
        ready: readiness.ready,
      },
    });

    return apiOk(req, {
      jira: status,
      readiness,
    });
  } catch (error) {
    serverLog.error("Jira config readiness failed.", {
      route,
      status: 500,
      durationMs: durationSince(startedAt),
      error,
    });

    return apiError(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      message: getErrorMessage(error, "Could not check Jira config."),
    });
  }
}
