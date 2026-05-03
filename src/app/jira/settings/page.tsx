import { getServerSession } from "next-auth";
import Image from "next/image";
import Link from "next/link";
import JiraSettingsForm from "@/components/JiraSettingsForm";
import { authOptions } from "@/lib/auth";
import { getUserJiraConfig } from "@/lib/jira-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const isAdmin = session?.user?.email === "gitajob.com@gmail.com";

  if (!userId) {
    return (
      <main className="reports-page">
        <section className="reports-hero settings-hero-real-logo">
          <div className="settings-hero-copy">
            <h1>Settings</h1>
            <p>Sign in to manage QAtalyst integrations, defaults, and account tools.</p>

            <div className="settings-hero-actions">
              <Link className="account-back-link" href="/">
                Back to QAtalyst
              </Link>
            </div>
          </div>

          <div className="settings-real-logo-wrap" aria-label="QAtalyst">
            <Image
              alt="QAtalyst"
              className="settings-real-logo"
              height={170}
              priority
              src="/qatalyst-logo-transparent.png"
              width={260}
            />
          </div>
        </section>
      </main>
    );
  }

  const config = await getUserJiraConfig(userId);

  return (
    <main className="reports-page">
      <section className="reports-hero settings-hero-real-logo">
        <div className="settings-hero-copy">
          <h1>Settings</h1>
          <p>Manage QAtalyst integrations, product defaults, and testing tools.</p>

          <div className="settings-hero-actions">
            <Link className="account-buy-link" href="/app">
              Launch App
            </Link>
            <Link className="account-back-link" href="/account">
              Account
            </Link>
          </div>
        </div>

        <div className="settings-real-logo-wrap" aria-label="QAtalyst">
          <Image
            alt="QAtalyst"
            className="settings-real-logo"
            height={170}
            priority
            src="/qatalyst-logo-transparent.png"
            width={260}
          />
        </div>
      </section>

      <section className="settings-wide-panel">
        <div className="settings-area-strip">
          <p className="report-kicker">Settings Areas</p>

          <nav className="settings-area-tabs" aria-label="Settings areas">
            <a href="#jira-integration">Jira Integration</a>
            <a href="#testrail-integration">TestRail Integration</a>
            {isAdmin ? <a href="#admin-debug">Admin Debug</a> : null}
          </nav>
        </div>

        <section className="settings-wide-section" id="jira-integration">
          <JiraSettingsForm initialConfig={config} />
        </section>

        <section className="settings-module-card settings-coming-soon-card settings-wide-section" id="testrail-integration">
          <p className="report-kicker">TestRail Integration</p>
          <h2>Coming soon</h2>
          <p>
            Future TestRail settings can live here: project IDs, suite defaults, case type mapping, and export behavior.
          </p>
        </section>

        {isAdmin ? (
          <section className="settings-module-card admin-debug-card settings-wide-section" id="admin-debug">
            <p className="report-kicker">Admin Debug</p>
            <h2>Testing shortcuts</h2>
            <p>Admin-only debug hooks for faster local and beta testing.</p>

            <div className="admin-debug-grid">
              <code>User: {session.user?.email}</code>
              <code>Jira configured: {config ? "yes" : "no"}</code>
              <code>Project key: {config?.projectKey ?? "none"}</code>
              <code>Next: wire smoke/debug actions</code>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
