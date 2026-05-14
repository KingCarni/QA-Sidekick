import { getServerSession } from "next-auth";
import { apiError, apiOk, getErrorMessage, readJsonBody } from "@/lib/api-response";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTestRailId, TestRailClient } from "@/lib/testrail-client";
import { getUserTestRailConfigWithSecret } from "@/lib/testrail-config";
import type { TestRailSyncPreviewCase } from "@/lib/testrail-mapping";
import { durationSince, nowMs, serverLog } from "@/lib/server-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SyncCasesBody = {
  approve?: unknown;
  reportId?: unknown;
  mode?: unknown;
  cases?: unknown;
};

function cleanString(value: unknown) {
  return String(value ?? "").trim();
}

function isPreviewCase(value: unknown): value is TestRailSyncPreviewCase {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof (value as TestRailSyncPreviewCase).title === "string" &&
      typeof (value as TestRailSyncPreviewCase).contentHash === "string" &&
      typeof (value as TestRailSyncPreviewCase).sectionId === "number" &&
      typeof (value as TestRailSyncPreviewCase).payload === "object"
  );
}

async function getAuthorizedReportId(userId: string, reportId: string | null): Promise<string | null | false> {
  if (!reportId) return null;

  const report = await prisma.qAReport.findFirst({
    where: {
      id: reportId,
      userId,
    },
    select: {
      id: true,
    },
  });

  return report?.id ?? false;
}

export async function POST(req: Request): Promise<Response> {
  const startedAt = nowMs();
  const route = "/api/testrail/sync-cases";

  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return apiError(req, { status: 401, code: "UNAUTHORIZED", message: "Please sign in before syncing TestRail cases." });
    }

    const body = await readJsonBody<SyncCasesBody>(req);

    if (body.approve !== true) {
      return apiError(req, {
        status: 400,
        code: "VALIDATION_ERROR",
        message: "TestRail sync requires explicit approval after preview.",
      });
    }

    const cases = Array.isArray(body.cases) ? body.cases.filter(isPreviewCase) : [];
    if (cases.length === 0) {
      return apiError(req, { status: 400, code: "VALIDATION_ERROR", message: "No previewed TestRail cases were provided." });
    }

    const requestedReportId = cleanString(body.reportId) || null;
    const authorizedReportId = await getAuthorizedReportId(userId, requestedReportId);

    if (authorizedReportId === false) {
      return apiError(req, {
        status: 404,
        code: "NOT_FOUND",
        message: "Saved report not found.",
      });
    }

    const config = await getUserTestRailConfigWithSecret(userId);
    if (!config) {
      return apiError(req, { status: 400, code: "CONFIG_ERROR", message: "Configure TestRail before syncing cases." });
    }

    const reportId = authorizedReportId;
    const mode = cleanString(body.mode) === "update" ? "update" : "create";
    const client = new TestRailClient({ baseUrl: config.baseUrl, username: config.username, apiKey: config.apiKey });
    const results: Array<{ title: string; status: string; testRailCaseId?: number; error?: string }> = [];

    for (const item of cases) {
      try {
        const existingCaseId = Number(item.existingTestRailCaseId);
        const shouldUpdate = mode === "update" && Number.isInteger(existingCaseId) && existingCaseId > 0;
        const response = shouldUpdate
          ? await client.updateCase(existingCaseId, item.payload)
          : await client.addCase(item.sectionId, item.payload);
        const testRailCaseId = getTestRailId(response) ?? existingCaseId;

        if (!testRailCaseId) {
          throw new Error("TestRail did not return a case ID.");
        }

        await prisma.testRailCaseSyncMap.upsert({
          where: { userId_contentHash: { userId, contentHash: item.contentHash } },
          update: {
            reportId,
            testCaseIndex: item.index,
            title: item.title,
            testRailCaseId,
            projectId: config.projectId,
            suiteId: config.suiteId,
            sectionId: item.sectionId,
            syncStatus: "synced",
            lastSyncedAt: new Date(),
            lastError: null,
          },
          create: {
            userId,
            reportId,
            testCaseIndex: item.index,
            title: item.title,
            testRailCaseId,
            projectId: config.projectId,
            suiteId: config.suiteId,
            sectionId: item.sectionId,
            contentHash: item.contentHash,
            syncStatus: "synced",
            lastSyncedAt: new Date(),
          },
        });

        results.push({ title: item.title, status: shouldUpdate ? "updated" : "created", testRailCaseId });
      } catch (error) {
        await prisma.testRailCaseSyncMap
          .upsert({
            where: { userId_contentHash: { userId, contentHash: item.contentHash } },
            update: { title: item.title, syncStatus: "failed", lastError: getErrorMessage(error, "Sync failed.") },
            create: {
              userId,
              reportId,
              testCaseIndex: item.index,
              title: item.title,
              testRailCaseId: item.existingTestRailCaseId || null,
              projectId: config.projectId,
              suiteId: config.suiteId,
              sectionId: item.sectionId,
              contentHash: item.contentHash,
              syncStatus: "failed",
              lastError: getErrorMessage(error, "Sync failed."),
            },
          })
          .catch(() => null);

        results.push({ title: item.title, status: "failed", error: getErrorMessage(error, "Sync failed.") });
      }
    }

    serverLog.info("TestRail case sync completed.", {
      route,
      userId,
      status: 200,
      durationMs: durationSince(startedAt),
      meta: { caseCount: cases.length, successCount: results.filter((item) => item.status !== "failed").length },
    });

    return apiOk(req, { results });
  } catch (error) {
    serverLog.error("TestRail case sync failed.", { route, status: 500, durationMs: durationSince(startedAt), error });
    return apiError(req, { status: 500, code: "INTERNAL_ERROR", message: getErrorMessage(error, "Could not sync TestRail cases.") });
  }
}
