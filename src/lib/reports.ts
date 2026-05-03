import type { Prisma, QAReport } from "@prisma/client";

export type ReportType = "tests" | "risk" | "bug" | "improve";

export const REPORT_TYPES = ["tests", "risk", "bug", "improve"] as const;

export function normalizeReportType(value: unknown): ReportType | null {
  const type = String(value ?? "").trim().toLowerCase();

  if (REPORT_TYPES.includes(type as ReportType)) {
    return type as ReportType;
  }

  return null;
}

export function reportTypeLabel(type: string) {
  switch (type) {
    case "tests":
      return "Test Cases";
    case "risk":
      return "Risk Review";
    case "bug":
      return "Bug Writer";
    case "improve":
      return "Test Improver";
    default:
      return "QA Report";
  }
}

export function toPrismaJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return value as Prisma.InputJsonValue;
}

export function makeReportTitle(args: {
  type: ReportType;
  title?: unknown;
  markdown?: unknown;
  sourceInput?: unknown;
}) {
  const explicit = String(args.title ?? "").trim();
  if (explicit) return explicit.slice(0, 140);

  const markdown = String(args.markdown ?? "");
  const h1 = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (h1) return h1.slice(0, 140);

  const source = String(args.sourceInput ?? "").trim().replace(/\s+/g, " ");
  if (source) return source.slice(0, 100);

  return reportTypeLabel(args.type);
}

export function serializeReport(report: QAReport) {
  return {
    id: report.id,
    type: report.type,
    title: report.title,
    markdown: report.markdown,
    structuredData: report.structuredData,
    sourceInput: report.sourceInput,
    projectId: report.projectId,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
  };
}

export function reportPreview(markdown?: string | null, sourceInput?: string | null) {
  const text = String(markdown || sourceInput || "")
    .replace(/[#*_`>\-]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return "No preview available.";
  return text.length > 180 ? `${text.slice(0, 180)}...` : text;
}
