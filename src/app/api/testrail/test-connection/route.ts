import { getServerSession } from "next-auth";
import { apiError, apiOk, getErrorMessage } from "@/lib/api-response";
import { authOptions } from "@/lib/auth";
import { TestRailClient } from "@/lib/testrail-client";
import { getUserTestRailConfigWithSecret } from "@/lib/testrail-config";
import { durationSince, nowMs, serverLog } from "@/lib/server-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const startedAt = nowMs();
  const route = "/api/testrail/test-connection";

  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return apiError(req, { status: 401, code: "UNAUTHORIZED", message: "Please sign in before testing TestRail." });
    }

    const config = await getUserTestRailConfigWithSecret(userId);

    if (!config) {
      return apiError(req, { status: 400, code: "CONFIG_ERROR", message: "Save TestRail config before testing the connection." });
    }

    const client = new TestRailClient({ baseUrl: config.baseUrl, username: config.username, apiKey: config.apiKey });
    const [project, priorities, caseTypes] = await Promise.all([
      client.getProject(config.projectId),
      client.getPriorities().catch(() => []),
      client.getCaseTypes().catch(() => []),
    ]);

    serverLog.info("TestRail connection test succeeded.", {
      route,
      userId,
      status: 200,
      durationMs: durationSince(startedAt),
      meta: { projectId: config.projectId, priorityCount: priorities.length, typeCount: caseTypes.length },
    });

    return apiOk(req, {
      ok: true,
      message: "TestRail connection succeeded.",
      project: { id: project.id, name: project.name },
      priorityCount: priorities.length,
      caseTypeCount: caseTypes.length,
    });
  } catch (error) {
    serverLog.error("TestRail connection test failed.", { route, status: 500, durationMs: durationSince(startedAt), error });
    return apiError(req, { status: 500, code: "UPSTREAM_ERROR", message: getErrorMessage(error, "Could not connect to TestRail.") });
  }
}
