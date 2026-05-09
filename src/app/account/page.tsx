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
      <main className="qas156-shell qas156-account-page">
        <section className="qas156-window qas156-account-hero qas156-account-hero-signed-out">
          <div className="qas156-hero-copy">
            <p className="qas156-kicker">QAtalyst Account</p>
            <h1>Sign in to view your QAtalyst workspace.</h1>
            <p>
              Your credits, saved QA reports, project workspace, and account activity will appear
              here once you sign in.
            </p>
            <div className="qas156-action-row">
              <Link className="qas156-button qas156-button-primary" href="/api/auth/signin">
                Sign in
              </Link>
              <Link className="qas156-button qas156-button-secondary" href="/">
                Back to QAtalyst
              </Link>
            </div>
          </div>

          <div className="qas156-logo-panel" aria-label="QAtalyst">
            <img src="/qatalyst-header.png" alt="QAtalyst" />
            <span>Reviewable QA workflow support for practical teams.</span>
          </div>
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
    <main className="qas156-shell qas156-account-page">
      <section className="qas156-window qas156-account-hero">
        <div className="qas156-hero-copy">
          <p className="qas156-kicker">QAtalyst Account</p>
          <h1>Account</h1>
          <p className="qas156-identity-line">{displayUser}</p>
          <p>
            Monitor credits, saved reports, usage activity, and account shortcuts from one polished
            QAtalyst control surface.
          </p>

          <div className="qas156-action-row">
            <Link className="qas156-button qas156-button-primary" href="/reports">
              Saved Reports
            </Link>
            <Link className="qas156-button qas156-button-primary" href="/buy-credits">
              Buy Credits
            </Link>
            <Link className="qas156-button qas156-button-secondary" href="/jira/settings">
              Settings
            </Link>
            <Link className="qas156-button qas156-button-secondary" href="/">
              Back to QAtalyst
            </Link>
          </div>
        </div>

        <div className="qas156-logo-panel" aria-label="QAtalyst">
          <img src="/qatalyst-header.png" alt="QAtalyst" />
          <span>Project-aware QA planning, credits, reports, and reusable context.</span>
        </div>
      </section>

      <section className="qas156-stat-grid" aria-label="Account summary">
        <article className="qas156-stat-card qas156-stat-card-primary">
          <span>Current credits</span>
          <strong>{balance}</strong>
        </article>
        <article className="qas156-stat-card">
          <span>Saved reports</span>
          <strong>{recentReportsCount}</strong>
        </article>
        <article className="qas156-stat-card">
          <span>Recent events</span>
          <strong>{recentEvents.length}</strong>
        </article>
        <article className="qas156-stat-card">
          <span>Stripe purchases</span>
          <strong>{purchaseCount}</strong>
        </article>
      </section>

      <section className="qas156-window qas156-account-feature-card">
        <div>
          <p className="qas156-kicker">Reports</p>
          <h2>Saved QA reports</h2>
          <p>
            Save generated test cases, risk reviews, bug reports, and test improvements from the app,
            then return to them when the team needs context.
          </p>
        </div>
        <Link className="qas156-button qas156-button-primary" href="/reports">
          View Reports
        </Link>
      </section>

      <section className="qas156-account-grid">
        <article className="qas156-window qas156-ledger-card">
          <div className="qas156-section-header">
            <div>
              <p className="qas156-kicker">Credits</p>
              <h2>Credit ledger</h2>
            </div>
            <span>{recentLedger.length} recent</span>
          </div>

          {recentLedger.length > 0 ? (
            <div className="qas156-ledger-list">
              {recentLedger.map((entry) => (
                <div className="qas156-ledger-row" key={entry.id}>
                  <span>{formatReason(entry.reason)}</span>
                  <strong className={entry.delta >= 0 ? "qas156-delta-positive" : "qas156-delta-negative"}>
                    {formatDelta(entry.delta)}
                  </strong>
                  <small>{formatDate(entry.createdAt)}</small>
                </div>
              ))}
            </div>
          ) : (
            <p className="qas156-empty-copy">No credit history yet.</p>
          )}
        </article>

        <article className="qas156-window qas156-activity-card">
          <div className="qas156-section-header">
            <div>
              <p className="qas156-kicker">Activity</p>
              <h2>Usage events</h2>
            </div>
            <span>{recentEvents.length} recent</span>
          </div>

          {recentEvents.length > 0 ? (
            <div className="qas156-ledger-list">
              {recentEvents.map((event) => (
                <div className="qas156-ledger-row qas156-ledger-row-two" key={event.id}>
                  <span>{formatReason(event.type)}</span>
                  <small>{formatDate(event.createdAt)}</small>
                </div>
              ))}
            </div>
          ) : (
            <p className="qas156-empty-copy">No usage events yet.</p>
          )}
        </article>
      </section>
    </main>
  );
}
