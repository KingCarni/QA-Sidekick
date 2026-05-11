import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
        error: error instanceof Error ? error.message : "Could not load saved reports.",
      },
      { status: 500 }
    );
  }
}
