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
      <main className="reports-page">
        <section className="reports-hero settings-hero-real-logo">
          <div className="settings-hero-copy">
            <p className="brain-eyebrow">Legacy setup route · Integrations now live in Brain</p>
            <h1>Settings</h1>
            <p>
              Sign in to manage QAtalyst integrations, defaults, and account tools.
              Project setup, Source Vault, Bug Collection, and Saved Reports now live in Project Brain.
            </p>

            <div className="settings-hero-actions">
              <Link className="account-buy-link" href="/brain">
                Open Project Brain
              </Link>

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
          <p className="brain-eyebrow">Legacy setup route · Prefer Project Brain</p>
          <h1>Integrations & Settings</h1>
          <p>
            Jira setup still works here during transition, but Project Brain is now the primary workspace for projects, reusable QA memory, Source Vault, Bug Collection, and Saved Reports.
          </p>

          <div className="settings-hero-actions">
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
