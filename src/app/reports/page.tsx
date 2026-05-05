import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeReportType, reportPreview, reportTypeLabel } from "@/lib/reports";
import DeleteReportButton from "@/components/DeleteReportButton";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReportsPageProps = {
  searchParams: Promise<{
    type?: string;
    project?: string;
  }>;
};

const filters = [
  { href: "/reports", label: "All", type: null },
  { href: "/reports?type=tests", label: "Test Cases", type: "tests" },
  { href: "/reports?type=risk", label: "Risk Review", type: "risk" },
  { href: "/reports?type=bug", label: "Bug Writer", type: "bug" },
  { href: "/reports?type=improve", label: "Test Improver", type: "improve" },
] as const;

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(value);
}

function buildReportFilterHref(type: string | null, projectId: string | null) {
  const params = new URLSearchParams();

  if (type) params.set("type", type);
  if (projectId) params.set("project", projectId);

  const query = params.toString();
  return query ? `/reports?${query}` : "/reports";
}

function buildProjectFilterHref(projectId: string | null, type: string | null) {
  const params = new URLSearchParams();

  if (type) params.set("type", type);
  if (projectId) params.set("project", projectId);

  const query = params.toString();
  return query ? `/reports?${query}` : "/reports";
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const resolvedSearchParams = await searchParams;
  const activeType = normalizeReportType(resolvedSearchParams?.type);
  const activeProjectId = String(resolvedSearchParams?.project ?? "").trim() || null;

  if (!userId) {
    return (
      <main className="reports-page">
        <section className="reports-header-card">
          <p className="report-kicker">Saved QA Reports</p>
          <h1>Sign in to view saved reports.</h1>
          <p>Your saved test cases, risk reviews, bug reports, and test improvements will appear here.</p>
          <div className="saved-report-actions">
            <Link className="account-buy-link" href="/api/auth/signin">
              Sign in
            </Link>
            <Link className="account-back-link" href="/app">
              Back to App
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const [projects, reports] = await Promise.all([
    prisma.qAProject.findMany({
      where: { userId },
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        productType: true,
        _count: {
          select: { reports: true },
        },
      },
    }),
    prisma.qAReport.findMany({
      where: {
        userId,
        ...(activeType ? { type: activeType } : {}),
        ...(activeProjectId ? { projectId: activeProjectId } : {}),
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            productType: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const activeProject = projects.find((project) => project.id === activeProjectId) ?? null;

  return (
    <main className="reports-page">
      <section className="reports-header-card">
        <div className="account-header-row">
          <div>
            <p className="report-kicker">Saved QA Reports</p>
            <h1>Saved QA Reports</h1>
            <p>
              Review previous test cases, risk reviews, bug reports, and test improvements
              {activeProject ? ` for ${activeProject.name}` : ""}.
            </p>
          </div>

          <div className="account-header-actions">
            <Link className="account-buy-link" href="/app">
              Launch App
            </Link>
            <Link className="account-back-link" href="/account">
              Account
            </Link>
          </div>
        </div>

        <div className="reports-filter-row" aria-label="Saved report type filters">
          {filters.map((filter) => {
            const isActive = filter.type === activeType || (!filter.type && !activeType);

            return (
              <Link
                className={isActive ? "reports-filter reports-filter-active" : "reports-filter"}
                href={buildReportFilterHref(filter.type, activeProjectId)}
                key={filter.href}
              >
                {filter.label}
              </Link>
            );
          })}
        </div>

        <div className="reports-project-filter-card">
          <div>
            <p className="report-kicker">Project Filter</p>
            <strong>{activeProject ? activeProject.name : "All Projects"}</strong>
            <span>
              {projects.length > 0
                ? "Filter saved QA reports by project workspace."
                : "Create a project in Settings to organize future reports."}
            </span>
          </div>

          <div className="reports-project-filter-row" aria-label="Saved report project filters">
            <Link
              className={!activeProjectId ? "reports-project-filter reports-project-filter-active" : "reports-project-filter"}
              href={buildProjectFilterHref(null, activeType)}
            >
              All Projects
            </Link>

            <Link
              className={activeProjectId === "none" ? "reports-project-filter reports-project-filter-active" : "reports-project-filter"}
              href={buildProjectFilterHref("none", activeType)}
            >
              No Project
            </Link>

            {projects.map((project) => (
              <Link
                className={project.id === activeProjectId ? "reports-project-filter reports-project-filter-active" : "reports-project-filter"}
                href={buildProjectFilterHref(project.id, activeType)}
                key={project.id}
              >
                {project.name}
                <small>{project._count.reports}</small>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {reports.length > 0 ? (
        <section className="reports-grid" aria-label="Saved reports">
          {reports.map((report) => (
            <article className="saved-report-card saved-report-card-project-aware" key={report.id}>
              <div className="saved-report-meta">
                <span>{reportTypeLabel(report.type)}</span>
                <small>{formatDate(report.createdAt)}</small>
              </div>

              <div className="saved-report-project-pill">
                {report.project ? (
                  <>
                    <span>{report.project.name}</span>
                    <small>{report.project.productType || "project"}</small>
                  </>
                ) : (
                  <>
                    <span>No Project</span>
                    <small>legacy / unassigned</small>
                  </>
                )}
              </div>

              <h2>{report.title || "Untitled QA Report"}</h2>
              <p>{reportPreview(report.markdown, report.sourceInput)}</p>

              <div className="saved-report-actions">
                <Link className="account-buy-link" href={`/reports/${report.id}`}>
                  Open
                </Link>
                <DeleteReportButton reportId={report.id} redirectTo={buildProjectFilterHref(activeProjectId, activeType)} />
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="saved-report-empty">
          <p className="report-kicker">No saved reports found</p>
          <h2>No saved reports match these filters.</h2>
          <p>Generate a QA plan from the app, then save it here for later.</p>
          <Link className="account-buy-link" href="/app">
            Launch App
          </Link>
        </section>
      )}
    </main>
  );
}
