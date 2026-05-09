import { getServerSession } from "next-auth";
import { apiError, apiOk, getErrorMessage } from "@/lib/api-response";
import { authOptions } from "@/lib/auth";
import { clearUserJiraApiToken, getUserJiraConfigStatus } from "@/lib/jira-config";
import { durationSince, nowMs, serverLog } from "@/lib/server-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(req: Request): Promise<Response> {
  const startedAt = nowMs();
  const route = "/api/jira/config/token";

  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return apiError(req, {
        status: 401,
        code: "UNAUTHORIZED",
        message: "Please sign in before removing Jira API key.",
      });
    }

    const result = await clearUserJiraApiToken(userId);

    if (!result.ok) {
      return apiError(req, {
        status: 400,
        code: "BAD_REQUEST",
        message: result.error,
      });
    }

    serverLog.info("Jira API token removed.", {
      route,
      userId,
      status: 200,
      durationMs: durationSince(startedAt),
    });

    const status = await getUserJiraConfigStatus(userId);

    return apiOk(req, {
      jira: status,
      message: "Jira API key removed.",
    });
  } catch (error) {
    serverLog.error("Jira API token remove failed.", {
      route,
      status: 500,
      durationMs: durationSince(startedAt),
      error,
    });

    return apiError(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      message: getErrorMessage(error, "Could not remove Jira API key."),
    });
  }
}
