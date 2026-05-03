import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { getCreditBalance } from "@/lib/credits";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatReason(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDelta(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export default async function AccountPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return (
      <main className="account-page">
        <section className="account-card account-hero-card">
          <p className="report-kicker">QAtalyst Account</p>
          <h1>Sign in to view your QAtalyst account.</h1>
          <p>Your credits, saved QA reports, and project workspace will appear here.</p>
          <Link className="account-back-link" href="/">
            Back to QAtalyst
          </Link>
        </section>
      </main>
    );
  }

  const [balance, recentLedger, recentEvents, recentReportsCount] = await Promise.all([
    getCreditBalance(userId),
    prisma.creditsLedger.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.event.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.qAReport.count({
      where: { userId },
    }),
  ]);

  const displayUser = session.user?.email ?? session.user?.name ?? "Signed-in user";
  const purchaseCount = recentLedger.filter((entry) => entry.reason === "purchase_stripe").length;

  return (
    <main className="account-page">
      <section className="account-card account-hero-card">
        <div className="account-header-row">
          <div>
            <p className="report-kicker">QAtalyst Account</p>
            <h1>Account</h1>
            <p>{displayUser}</p>
          </div>

          <div className="account-header-actions">
            <Link className="account-buy-link" href="/reports">
              Saved Reports
            </Link>
            <Link className="account-buy-link" href="/buy-credits">
              Buy Credits
            </Link>
            <Link className="account-back-link" href="/jira/settings">
              Jira Settings
            </Link>
            <Link className="account-back-link" href="/">
              Back to QAtalyst
            </Link>
          </div>
        </div>

        <div className="account-stat-grid">
          <div className="account-stat-card account-stat-primary">
            <span>Current credits</span>
            <strong>{balance}</strong>
          </div>
          <div className="account-stat-card">
            <span>Saved reports</span>
            <strong>{recentReportsCount}</strong>
          </div>
          <div className="account-stat-card">
            <span>Recent events</span>
            <strong>{recentEvents.length}</strong>
          </div>
          <div className="account-stat-card">
            <span>Stripe purchases</span>
            <strong>{purchaseCount}</strong>
          </div>
        </div>
      </section>

      <section className="account-card">
        <div className="account-section-heading">
          <div>
            <p className="report-kicker">Reports</p>
            <h2>Saved QA reports</h2>
          </div>
          <Link className="account-buy-link" href="/reports">
            View Reports
          </Link>
        </div>
        <p>Save generated test cases, risk reviews, bug reports, and test improvements from the app.</p>
      </section>

      <section className="account-card">
        <div className="account-section-heading">
          <div>
            <p className="report-kicker">Credits</p>
            <h2>Credit ledger</h2>
          </div>
          <span>{recentLedger.length} recent</span>
        </div>

        {recentLedger.length > 0 ? (
          <div className="account-table">
            {recentLedger.map((entry) => (
              <div className="account-table-row" key={entry.id}>
                <span>{formatReason(entry.reason)}</span>
                <strong className={entry.delta >= 0 ? "account-delta-positive" : "account-delta-negative"}>
                  {formatDelta(entry.delta)}
                </strong>
                <small>{formatDate(entry.createdAt)}</small>
              </div>
            ))}
          </div>
        ) : (
          <p>No credit history yet.</p>
        )}
      </section>

      <section className="account-card">
        <div className="account-section-heading">
          <div>
            <p className="report-kicker">Activity</p>
            <h2>Usage events</h2>
          </div>
          <span>{recentEvents.length} recent</span>
        </div>

        {recentEvents.length > 0 ? (
          <div className="account-table">
            {recentEvents.map((event) => (
              <div className="account-table-row account-table-row-two" key={event.id}>
                <span>{formatReason(event.type)}</span>
                <small>{formatDate(event.createdAt)}</small>
              </div>
            ))}
          </div>
        ) : (
          <p>No usage events yet.</p>
        )}
      </section>
    </main>
  );
}
