import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SaveReportPayload = {
  type?: unknown;
  title?: unknown;
  markdown?: unknown;
  structuredData?: unknown;
  sourceInput?: unknown;
  projectId?: unknown;
};

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function safeJsonValue(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined || value === null) return Prisma.JsonNull;

  try {
    JSON.stringify(value);
    return value as Prisma.InputJsonValue;
  } catch {
    return Prisma.JsonNull;
  }
}

function serializeReport(report: {
  id: string;
  projectId: string | null;
  type: string;
  title: string | null;
  markdown: string | null;
  sourceInput: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: report.id,
    projectId: report.projectId,
    type: report.type,
    title: report.title,
    markdown: report.markdown,
    sourceInput: report.sourceInput,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
  };
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await request.json().catch(() => null)) as SaveReportPayload | null;

    if (!payload) {
      return NextResponse.json({ ok: false, error: "Invalid report payload." }, { status: 400 });
    }

    const markdown = asString(payload.markdown).trim();

    if (!markdown) {
      return NextResponse.json({ ok: false, error: "Report markdown is required." }, { status: 400 });
    }

    const type = asString(payload.type, "report").trim() || "report";
    const title = asString(payload.title).trim() || "QA Report";
    const sourceInput = asString(payload.sourceInput);
    const requestedProjectId = asString(payload.projectId).trim();

    let projectId: string | null = null;

    if (requestedProjectId) {
      const project = await prisma.qAProject.findFirst({
        where: {
          id: requestedProjectId,
          userId,
        },
        select: {
          id: true,
        },
      });

      if (!project) {
        return NextResponse.json(
          { ok: false, error: "Selected project was not found or does not belong to this account." },
          { status: 404 }
        );
      }

      projectId = project.id;
    }

    const report = await prisma.qAReport.create({
      data: {
        userId,
        projectId,
        type,
        title,
        markdown,
        sourceInput,
        structuredData: safeJsonValue(payload.structuredData),
      },
      select: {
        id: true,
        projectId: true,
        type: true,
        title: true,
        markdown: true,
        sourceInput: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      report: serializeReport(report),
    });
  } catch (error) {
    console.error("Save report failed", error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Could not save report.",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const reports = await prisma.qAReport.findMany({
      where: {
        userId,
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 50,
      select: {
        id: true,
        projectId: true,
        type: true,
        title: true,
        markdown: true,
        sourceInput: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      reports: reports.map(serializeReport),
    });
  } catch (error) {
    console.error("Load reports failed", error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Could not load reports.",
      },
      { status: 500 }
    );
  }
}