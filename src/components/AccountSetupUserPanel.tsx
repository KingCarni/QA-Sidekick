"use client";

import { useSession } from "next-auth/react";

type AccountSetupUserPanelProps = {
  credits?: number | null;
  activeProjectName?: string;
  activeProjectDescription?: string;
  jiraConfigured?: boolean;
  testRailConfigured?: boolean;
};

function statusLabel(isReady?: boolean) {
  return isReady ? "Connected" : "Not configured";
}

export default function AccountSetupUserPanel({
  credits,
  activeProjectName,
  activeProjectDescription,
  jiraConfigured,
  testRailConfigured,
}: AccountSetupUserPanelProps) {
  const { data: session, status } = useSession();
  const user = session?.user;

  return (
    <section className="account-setup-user-panel">
      <div className="account-setup-hero">
        <div>
          <p className="report-kicker">Account Setup</p>
          <h3>Profile and workspace</h3>
          <p>
            Manage the account context QAtalyst uses for projects, sources, integrations, and
            generated QA output.
          </p>
        </div>

        <div className={status === "authenticated" ? "account-status-pill ready" : "account-status-pill"}>
          {status === "authenticated" ? "Signed in" : "Not signed in"}
        </div>
      </div>

      <div className="account-setup-grid">
        <article className="account-setup-card">
          <span>Signed-in account</span>
          <strong>{user?.email ?? "Not signed in"}</strong>
          <p>{user?.name ? `Profile: ${user.name}` : "Google account authentication is used for access."}</p>
        </article>

        <article className="account-setup-card">
          <span>Credits</span>
          <strong>{typeof credits === "number" ? credits : "—"}</strong>
          <p>Credits are used for AI generation actions.</p>
        </article>

        <article className="account-setup-card">
          <span>Active project</span>
          <strong>{activeProjectName || "No project selected"}</strong>
          <p>{activeProjectDescription || "Select or create a project before generating QA output."}</p>
        </article>

        <article className="account-setup-card">
          <span>Integrations</span>
          <strong>Jira: {statusLabel(jiraConfigured)}</strong>
          <p>TestRail: {statusLabel(testRailConfigured)}</p>
        </article>
      </div>

      <div className="account-setup-next-steps">
        <p className="report-kicker">Recommended setup</p>
        <ul>
          <li>Create or select a project.</li>
          <li>Add reusable project sources in Project Source Vault.</li>
          <li>Connect Jira if you want ticket fetch/create flows.</li>
          <li>Connect TestRail if you want preview-first test case sync.</li>
        </ul>
      </div>
    </section>
  );
}
