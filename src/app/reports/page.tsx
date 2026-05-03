import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeReportType, reportPreview, reportTypeLabel } from "@/lib/reports";
import DeleteReportButton from "@/components/DeleteReportButton";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReportsPageProps = {
  searchParams: Promise<{ type?: string }>;
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

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const resolvedSearchParams = await searchParams;
  const activeType = normalizeReportType(resolvedSearchParams?.type);

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

  const reports = await prisma.qAReport.findMany({
    where: {
      userId,
      ...(activeType ? { type: activeType } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <main className="reports-page">
      <section className="reports-header-card">
        <div className="account-header-row">
          <div>
            <p className="report-kicker">Saved QA Reports</p>
            <h1>Saved QA Reports</h1>
            <p>Review previous test cases, risk reviews, bug reports, and test improvements.</p>
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

        <div className="reports-filter-row" aria-label="Saved report filters">
          {filters.map((filter) => {
            const isActive = filter.type === activeType || (!filter.type && !activeType);

            return (
              <Link
                className={isActive ? "reports-filter reports-filter-active" : "reports-filter"}
                href={filter.href}
                key={filter.href}
              >
                {filter.label}
              </Link>
            );
          })}
        </div>
      </section>

      {reports.length > 0 ? (
        <section className="reports-grid" aria-label="Saved reports">
          {reports.map((report) => (
            <article className="saved-report-card" key={report.id}>
              <div className="saved-report-meta">
                <span>{reportTypeLabel(report.type)}</span>
                <small>{formatDate(report.createdAt)}</small>
              </div>

              <h2>{report.title || "Untitled QA Report"}</h2>
              <p>{reportPreview(report.markdown, report.sourceInput)}</p>

              <div className="saved-report-actions">
                <Link className="account-buy-link" href={`/reports/${report.id}`}>
                  Open
                </Link>
                <DeleteReportButton reportId={report.id} redirectTo="/reports" />
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="saved-report-empty">
          <p className="report-kicker">No saved reports yet</p>
          <h2>No saved reports yet.</h2>
          <p>Generate a QA plan from the app, then save it here for later.</p>
          <Link className="account-buy-link" href="/app">
            Launch App
          </Link>
        </section>
      )}
    </main>
  );
}
