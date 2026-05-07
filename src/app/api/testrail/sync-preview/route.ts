import { getServerSession } from "next-auth";
import { apiError, apiOk, getErrorMessage, readJsonBody } from "@/lib/api-response";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildTestRailSyncPreviewCase,
  extractTestCasesFromStructuredData,
  type GeneratedQATestCase,
} from "@/lib/testrail-mapping";
import { getUserTestRailConfig } from "@/lib/testrail-config";
import { durationSince, nowMs, serverLog } from "@/lib/server-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SyncPreviewBody = {
  reportId?: unknown;
  testCases?: unknown;
  sourceJiraKey?: unknown;
  sourceJiraUrl?: unknown;
};

function cleanString(value: unknown) {
  return String(value ?? "").trim();
}

export async function POST(req: Request): Promise<Response> {
  const startedAt = nowMs();
  const route = "/api/testrail/sync-preview";

  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return apiError(req, { status: 401, code: "UNAUTHORIZED", message: "Please sign in before previewing TestRail sync." });
    }

    const config = await getUserTestRailConfig(userId);

    if (!config) {
      return apiError(req, { status: 400, code: "CONFIG_ERROR", message: "Configure TestRail before previewing sync." });
    }

    const body = await readJsonBody<SyncPreviewBody>(req);
    const reportId = cleanString(body.reportId) || null;
    let testCases: GeneratedQATestCase[] = Array.isArray(body.testCases) ? (body.testCases as GeneratedQATestCase[]) : [];

    if (reportId) {
      const report = await prisma.qAReport.findFirst({ where: { id: reportId, userId } });
      if (!report) return apiError(req, { status: 404, code: "NOT_FOUND", message: "Saved report not found." });
      testCases = extractTestCasesFromStructuredData(report.structuredData);
    }

    if (testCases.length === 0) {
      return apiError(req, { status: 400, code: "VALIDATION_ERROR", message: "No generated test cases were found for TestRail sync." });
    }

    const hashes = testCases.map((testCase, index) =>
      buildTestRailSyncPreviewCase(testCase, index, config, {
        reportId,
        sourceJiraKey: cleanString(body.sourceJiraKey) || null,
        sourceJiraUrl: cleanString(body.sourceJiraUrl) || null,
      }).contentHash
    );

    const existingMaps = await prisma.testRailCaseSyncMap.findMany({
      where: { userId, contentHash: { in: hashes } },
      select: { contentHash: true, testRailCaseId: true },
    });
    const existingByHash = new Map(existingMaps.map((item) => [item.contentHash, item]));

    const preview = testCases.map((testCase, index) => {
      const previewCase = buildTestRailSyncPreviewCase(testCase, index, config, {
        reportId,
        sourceJiraKey: cleanString(body.sourceJiraKey) || null,
        sourceJiraUrl: cleanString(body.sourceJiraUrl) || null,
      });
      const existing = existingByHash.get(previewCase.contentHash);
      return existing
        ? { ...previewCase, existingTestRailCaseId: existing.testRailCaseId, status: "synced" as const }
        : previewCase;
    });

    serverLog.info("TestRail sync preview built.", {
      route,
      userId,
      status: 200,
      durationMs: durationSince(startedAt),
      meta: { reportId, caseCount: preview.length },
    });

    return apiOk(req, {
      preview,
      testrail: {
        projectId: config.projectId,
        suiteId: config.suiteId,
        defaultSectionId: config.defaultSectionId,
      },
    });
  } catch (error) {
    serverLog.error("TestRail sync preview failed.", { route, status: 500, durationMs: durationSince(startedAt), error });
    return apiError(req, { status: 500, code: "INTERNAL_ERROR", message: getErrorMessage(error, "Could not build TestRail sync preview.") });
  }
}
