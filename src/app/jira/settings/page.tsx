import "../../integrations-settings-polish.css";

import { getServerSession } from "next-auth";
import Image from "next/image";
import Link from "next/link";
import SettingsWorkspace from "@/components/SettingsWorkspace";
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
      <main className="reports-page integrations-settings-page">
        <section className="reports-hero settings-hero-real-logo integrations-settings-hero">
          <div className="settings-hero-copy">
            <p className="brain-eyebrow">Integrations</p>
            <h1>Integration Settings</h1>
            <p>Sign in to connect external workflow tools used by QAtalyst.</p>

            <div className="settings-hero-actions integrations-settings-actions">
              <Link className="account-buy-link" href="/">
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
    <main className="reports-page integrations-settings-page">
      <section className="reports-hero settings-hero-real-logo integrations-settings-hero">
        <div className="settings-hero-copy">
          <p className="brain-eyebrow">Integrations</p>
          <h1>Integration Settings</h1>
          <p>Connect Jira and TestRail so QAtalyst can move reviewed QA work into the tools your team already uses.</p>

          <div className="settings-hero-actions integrations-settings-actions">
            <Link className="account-buy-link" href="/brain">
              Open Project Brain
            </Link>

            <Link className="account-back-link" href="/app">
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

      <SettingsWorkspace
        initialJiraConfig={config}
        isAdmin={isAdmin}
        userEmail={session.user?.email ?? null}
      />
    </main>
  );
}
