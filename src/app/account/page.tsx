import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { getCreditBalance } from "@/lib/credits";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return (
      <main className="account-page">
        <section className="account-card">
          <p className="report-kicker">Account</p>
          <h1>Sign in to view your QA Sidekick account.</h1>
          <p>Your credits, saved QA reports, and project workspace will appear here.</p>
          <Link className="account-back-link" href="/">
            Back to QA Sidekick
          </Link>
        </section>
      </main>
    );
  }

  const [balance, recentLedger, recentEvents] = await Promise.all([
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
  ]);

  return (
    <main className="account-page">
      <section className="account-card">
        <div className="account-header-row">
          <div>
            <p className="report-kicker">Account</p>
            <h1>QA Sidekick Account</h1>
            <p>{session.user?.email ?? session.user?.name ?? "Signed-in user"}</p>
          </div>
          <Link className="account-back-link" href="/">
            Back to app
          </Link>
        </div>

        <div className="account-stat-grid">
          <div className="account-stat-card">
            <span>Current credits</span>
            <strong>{balance}</strong>
          </div>
          <div className="account-stat-card">
            <span>Recent ledger entries</span>
            <strong>{recentLedger.length}</strong>
          </div>
          <div className="account-stat-card">
            <span>Recent events</span>
            <strong>{recentEvents.length}</strong>
          </div>
        </div>
      </section>

      <section className="account-card">
        <h2>Credit ledger</h2>
        {recentLedger.length > 0 ? (
          <div className="account-table">
            {recentLedger.map((entry) => (
              <div className="account-table-row" key={entry.id}>
                <span>{entry.reason}</span>
                <strong>{entry.delta > 0 ? `+${entry.delta}` : entry.delta}</strong>
                <small>{entry.createdAt.toISOString().slice(0, 10)}</small>
              </div>
            ))}
          </div>
        ) : (
          <p>No credit history yet.</p>
        )}
      </section>

      <section className="account-card">
        <h2>Usage events</h2>
        {recentEvents.length > 0 ? (
          <div className="account-table">
            {recentEvents.map((event) => (
              <div className="account-table-row" key={event.id}>
                <span>{event.type}</span>
                <small>{event.createdAt.toISOString().slice(0, 10)}</small>
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
