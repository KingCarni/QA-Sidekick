import { getServerSession } from "next-auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reportTypeLabel } from "@/lib/reports";
import DeleteReportButton from "@/components/DeleteReportButton";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReportDetailPageProps = {
  params: Promise<{ id: string }>;
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

export default async function ReportDetailPage({ params }: ReportDetailPageProps) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const { id } = await params;

  if (!userId) {
    return (
      <main className="report-detail-page">
        <section className="report-detail-card">
          <p className="report-kicker">Saved QA Report</p>
          <h1>Sign in to view this report.</h1>
          <p>Saved reports are private to your account.</p>
          <div className="saved-report-actions">
            <Link className="account-buy-link" href="/api/auth/signin">
              Sign in
            </Link>
            <Link className="account-back-link" href="/reports">
              Back to Reports
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const report = await prisma.qAReport.findFirst({
    where: { id, userId },
  });

  if (!report) {
    notFound();
  }

  return (
    <main className="report-detail-page">
      <section className="report-detail-card">
        <div className="account-header-row">
          <div>
            <p className="report-kicker">{reportTypeLabel(report.type)}</p>
            <h1>{report.title || "Untitled QA Report"}</h1>
            <p>Saved {formatDate(report.createdAt)}</p>
          </div>

          <div className="account-header-actions">
            <Link className="account-buy-link" href="/reports">
              Back to Reports
            </Link>
            <Link className="account-back-link" href="/app">
              Launch App
            </Link>
          </div>
        </div>
      </section>

      {report.sourceInput ? (
        <section className="report-source-card">
          <p className="report-kicker">Source Input</p>
          <pre>{report.sourceInput}</pre>
        </section>
      ) : null}

      <section className="report-source-card">
        <div className="account-section-heading">
          <div>
            <p className="report-kicker">Saved Output</p>
            <h2>Markdown Report</h2>
          </div>
          <DeleteReportButton reportId={report.id} redirectTo="/reports" />
        </div>

        <pre className="report-markdown-preview">{report.markdown || "No Markdown output was saved."}</pre>
      </section>
    </main>
  );
}
