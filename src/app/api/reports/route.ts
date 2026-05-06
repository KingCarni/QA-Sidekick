import type { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { apiError, apiOk, getErrorMessage, readJsonBody } from "@/lib/api-response";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { durationSince, nowMs, serverLog } from "@/lib/server-log";
import { makeReportTitle, normalizeReportType, serializeReport, toPrismaJson } from "@/lib/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreateReportBody = {
  type?: unknown;
  title?: unknown;
  markdown?: unknown;
  structuredData?: unknown;
  sourceInput?: unknown;
  projectId?: unknown;
  projectName?: unknown;
  projectSourceIds?: unknown;
  projectContextSummary?: unknown;
  projectContextUsed?: unknown;
};

function normalizeLimit(value: string | null) {
  const parsed = Number(value ?? "");
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(Math.max(Math.trunc(parsed), 1), 100);
}

export async function GET(req: Request) {
  const startedAt = nowMs();
  const route = "/api/reports";

  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      serverLog.warn("Saved reports list blocked: unauthenticated user.", {
        route,
        status: 401,
        durationMs: durationSince(startedAt),
      });

      return apiError(req, {
        status: 401,
        code: "UNAUTHORIZED",
        message: "Please sign in to view saved reports.",
      });
    }

    const url = new URL(req.url);
    const type = normalizeReportType(url.searchParams.get("type"));
    const limit = normalizeLimit(url.searchParams.get("limit"));

    const where: Prisma.QAReportWhereInput = {
      userId,
      ...(type ? { type } : {}),
    };

    const reports = await prisma.qAReport.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    serverLog.info("Saved reports listed.", {
      route,
      userId,
      status: 200,
      durationMs: durationSince(startedAt),
      meta: { count: reports.length, type: type ?? "all", limit },
    });

    return apiOk(req, { reports: reports.map(serializeReport) });
  } catch (error) {
    serverLog.error("Saved reports list failed.", {
      route,
      status: 500,
      durationMs: durationSince(startedAt),
      error,
    });

    return apiError(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      message: getErrorMessage(error, "Could not load saved reports."),
    });
  }
}

export async function POST(req: Request) {
  const startedAt = nowMs();
  const route = "/api/reports";

  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      serverLog.warn("Saved report create blocked: unauthenticated user.", {
        route,
        status: 401,
        durationMs: durationSince(startedAt),
      });

      return apiError(req, {
        status: 401,
        code: "UNAUTHORIZED",
        message: "Please sign in to save reports.",
      });
    }

    const body = await readJsonBody<CreateReportBody>(req);
    const type = normalizeReportType(body.type);

    if (!type) {
      serverLog.warn("Saved report create blocked: invalid report type.", {
        route,
        userId,
        status: 400,
        durationMs: durationSince(startedAt),
        meta: { type: String(body.type ?? "") },
      });

      return apiError(req, {
        status: 400,
        code: "VALIDATION_ERROR",
        message: "Invalid report type.",
      });
    }

    const markdown = String(body.markdown ?? "").trim();
    const hasStructuredData = body.structuredData !== undefined && body.structuredData !== null;

    if (!markdown && !hasStructuredData) {
      serverLog.warn("Saved report create blocked: empty report.", {
        route,
        userId,
        status: 400,
        durationMs: durationSince(startedAt),
        meta: { type },
      });

      return apiError(req, {
        status: 400,
        code: "VALIDATION_ERROR",
        message: "A saved report needs Markdown output or structured data.",
      });
    }

    const projectId = String(body.projectId ?? "").trim() || null;

    if (projectId) {
      const project = await prisma.qAProject.findFirst({
        where: { id: projectId, userId },
        select: { id: true },
      });

      if (!project) {
        return apiError(req, {
          status: 404,
          code: "NOT_FOUND",
          message: "Project not found.",
        });
      }
    }

    const title = makeReportTitle({
      type,
      title: body.title,
      markdown,
      sourceInput: body.sourceInput,
    });
    const structuredData =
      body.structuredData && typeof body.structuredData === "object" && !Array.isArray(body.structuredData)
        ? {
            ...body.structuredData,
            projectContextMeta: {
              ...((body.structuredData as { projectContextMeta?: Record<string, unknown> }).projectContextMeta ?? {}),
              projectId,
              projectName: String(body.projectName ?? "").trim() || null,
              projectSourceIds: Array.isArray(body.projectSourceIds) ? body.projectSourceIds : [],
              projectContextSummary: String(body.projectContextSummary ?? "").trim() || null,
              projectContextUsed: Boolean(body.projectContextUsed),
            },
          }
        : body.structuredData;

    const report = await prisma.qAReport.create({
      data: {
        userId,
        projectId,
        type,
        title,
        markdown: markdown || null,
        structuredData: toPrismaJson(structuredData),
        sourceInput: String(body.sourceInput ?? "").trim() || null,
      },
    });

    serverLog.info("Saved report created.", {
      route,
      userId,
      status: 200,
      durationMs: durationSince(startedAt),
      meta: { reportId: report.id, type },
    });

    return apiOk(req, { report: serializeReport(report) });
  } catch (error) {
    serverLog.error("Saved report create failed.", {
      route,
      status: 500,
      durationMs: durationSince(startedAt),
      error,
    });

    return apiError(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      message: getErrorMessage(error, "Could not save report."),
    });
  }
}
