import type { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { apiError, apiOk, getErrorMessage, readJsonBody } from "@/lib/api-response";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { durationSince, nowMs, serverLog } from "@/lib/server-log";
import { makeReportTitle, normalizeReportType, serializeReport, toPrismaJson } from "@/lib/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type UpdateReportBody = {
  title?: unknown;
  markdown?: unknown;
  structuredData?: unknown;
  sourceInput?: unknown;
  type?: unknown;
};

async function getReportForUser(reportId: string, userId: string) {
  return prisma.qAReport.findFirst({
    where: { id: reportId, userId },
  });
}

export async function GET(req: Request, context: RouteContext) {
  const startedAt = nowMs();
  const route = "/api/reports/[id]";

  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return apiError(req, {
        status: 401,
        code: "UNAUTHORIZED",
        message: "Please sign in to view this report.",
      });
    }

    const { id } = await context.params;
    const report = await getReportForUser(id, userId);

    if (!report) {
      return apiError(req, {
        status: 404,
        code: "NOT_FOUND",
        message: "Saved report not found.",
      });
    }

    serverLog.info("Saved report loaded.", {
      route,
      userId,
      status: 200,
      durationMs: durationSince(startedAt),
      meta: { reportId: report.id, type: report.type },
    });

    return apiOk(req, { report: serializeReport(report) });
  } catch (error) {
    serverLog.error("Saved report load failed.", {
      route,
      status: 500,
      durationMs: durationSince(startedAt),
      error,
    });

    return apiError(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      message: getErrorMessage(error, "Could not load report."),
    });
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  const startedAt = nowMs();
  const route = "/api/reports/[id]";

  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return apiError(req, {
        status: 401,
        code: "UNAUTHORIZED",
        message: "Please sign in to update this report.",
      });
    }

    const { id } = await context.params;
    const existing = await getReportForUser(id, userId);

    if (!existing) {
      return apiError(req, {
        status: 404,
        code: "NOT_FOUND",
        message: "Saved report not found.",
      });
    }

    const body = await readJsonBody<UpdateReportBody>(req);
    const existingType = normalizeReportType(existing.type) ?? "tests";
    const nextType = body.type === undefined ? existingType : normalizeReportType(body.type);

    if (!nextType) {
      return apiError(req, {
        status: 400,
        code: "VALIDATION_ERROR",
        message: "Invalid report type.",
      });
    }

    const data: Prisma.QAReportUpdateInput = {};

    if (body.markdown !== undefined) {
      data.markdown = String(body.markdown ?? "").trim() || null;
    }

    if (body.structuredData !== undefined) {
      data.structuredData = toPrismaJson(body.structuredData);
    }

    if (body.sourceInput !== undefined) {
      data.sourceInput = String(body.sourceInput ?? "").trim() || null;
    }

    if (body.type !== undefined) {
      data.type = nextType;
    }

    if (body.title !== undefined || body.markdown !== undefined || body.sourceInput !== undefined || body.type !== undefined) {
      data.title = makeReportTitle({
        type: nextType,
        title: body.title ?? existing.title,
        markdown: body.markdown ?? existing.markdown,
        sourceInput: body.sourceInput ?? existing.sourceInput,
      });
    }

    const report = await prisma.qAReport.update({
      where: { id: existing.id },
      data,
    });

    serverLog.info("Saved report updated.", {
      route,
      userId,
      status: 200,
      durationMs: durationSince(startedAt),
      meta: { reportId: report.id, type: report.type },
    });

    return apiOk(req, { report: serializeReport(report) });
  } catch (error) {
    serverLog.error("Saved report update failed.", {
      route,
      status: 500,
      durationMs: durationSince(startedAt),
      error,
    });

    return apiError(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      message: getErrorMessage(error, "Could not update report."),
    });
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  const startedAt = nowMs();
  const route = "/api/reports/[id]";

  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return apiError(req, {
        status: 401,
        code: "UNAUTHORIZED",
        message: "Please sign in to delete this report.",
      });
    }

    const { id } = await context.params;
    const existing = await getReportForUser(id, userId);

    if (!existing) {
      return apiError(req, {
        status: 404,
        code: "NOT_FOUND",
        message: "Saved report not found.",
      });
    }

    await prisma.qAReport.delete({
      where: { id: existing.id },
    });

    serverLog.info("Saved report deleted.", {
      route,
      userId,
      status: 200,
      durationMs: durationSince(startedAt),
      meta: { reportId: existing.id, type: existing.type },
    });

    return apiOk(req, { deletedId: existing.id });
  } catch (error) {
    serverLog.error("Saved report delete failed.", {
      route,
      status: 500,
      durationMs: durationSince(startedAt),
      error,
    });

    return apiError(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      message: getErrorMessage(error, "Could not delete report."),
    });
  }
}
