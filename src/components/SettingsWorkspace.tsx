"use client";

import { useEffect, useState } from "react";
import AutomationExportSettingsForm from "@/components/AutomationExportSettingsForm";
import E2EAutomationReadinessPanel from "@/components/E2EAutomationReadinessPanel";
import JiraSettingsForm from "@/components/JiraSettingsForm";
import ProjectAutomationCredentialsForm from "@/components/ProjectAutomationCredentialsForm";
import TestRailSettingsForm from "@/components/TestRailSettingsForm";
import type { AutomationCredentialProfile } from "@/lib/automation-credentials";
import {
  normalizeAutomationProjectConfig,
  type AutomationProjectConfig,
} from "@/lib/automation-project-config";
import type { SafeJiraConfig } from "@/lib/jira-config";

type SettingsWorkspaceProps = {
  initialJiraConfig: SafeJiraConfig | null;
  isAdmin: boolean;
  userEmail?: string | null;
};

type SettingsArea = "jira" | "testrail" | "admin";

export default function SettingsWorkspace({
  initialJiraConfig,
  isAdmin,
  userEmail,
}: SettingsWorkspaceProps) {
  const [activeArea, setActiveArea] = useState<SettingsArea>("jira");
  const [automationCredentialProfiles, setAutomationCredentialProfiles] = useState<AutomationCredentialProfile[]>([]);
  const [automationProjectConfig, setAutomationProjectConfig] = useState<AutomationProjectConfig>(() =>
    normalizeAutomationProjectConfig(null)
  );

  const tabClass = (area: SettingsArea) =>
    activeArea === area ? "settings-area-tab settings-area-tab-active" : "settings-area-tab";
  const showInternalE2ESetup = process.env.NEXT_PUBLIC_SHOW_E2E_ACCOUNT_SETUP === "true";

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storageKey = "qatalyst.automationCredentialProfiles.global";
    const stored = window.localStorage.getItem(storageKey);

    if (!stored) {
      setAutomationCredentialProfiles([]);
      return;
    }

    try {
      const parsed = JSON.parse(stored);
      setAutomationCredentialProfiles(Array.isArray(parsed) ? parsed : []);
    } catch {
      setAutomationCredentialProfiles([]);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storageKey = "qatalyst.automationExportConfig.global";
    const stored = window.localStorage.getItem(storageKey);

    if (!stored) {
      setAutomationProjectConfig(normalizeAutomationProjectConfig(null));
      return;
    }

    try {
      setAutomationProjectConfig(normalizeAutomationProjectConfig(JSON.parse(stored)));
    } catch {
      setAutomationProjectConfig(normalizeAutomationProjectConfig(null));
    }
  }, []);

  function updateAutomationCredentialProfiles(profiles: AutomationCredentialProfile[]) {
    setAutomationCredentialProfiles(profiles);

    if (typeof window === "undefined") return;

    window.localStorage.setItem("qatalyst.automationCredentialProfiles.global", JSON.stringify(profiles));
  }

  function updateAutomationProjectConfig(config: AutomationProjectConfig) {
    const normalized = normalizeAutomationProjectConfig(config);
    setAutomationProjectConfig(normalized);

    if (typeof window === "undefined") return;

    window.localStorage.setItem("qatalyst.automationExportConfig.global", JSON.stringify(normalized));
  }

  return (
    <section className="settings-wide-panel settings-wide-panel-with-projects" data-testid="settings-workspace">
      <div className="settings-area-strip">
        <p className="report-kicker">Integration Settings</p>
        <h2>Legacy integration setup</h2>
        <p className="settings-transition-copy">
          Project setup, Source Vault, Bug Collection, Saved Reports, and account profile now live in Project Brain or Account.
          This page stays focused on external tool connection settings during the migration.
        </p>

        <nav className="settings-area-tabs" aria-label="Settings areas">
          <button className={tabClass("jira")} data-testid="settings-tab-jira-integration" onClick={() => setActiveArea("jira")} type="button">
            Jira Integration
          </button>
          <button className={tabClass("testrail")} data-testid="settings-tab-testrail-integration" onClick={() => setActiveArea("testrail")} type="button">
            TestRail Integration
          </button>
          {isAdmin ? (
            <button className={tabClass("admin")} onClick={() => setActiveArea("admin")} type="button">
              Admin Debug
            </button>
          ) : null}
        </nav>
      </div>

      {activeArea === "jira" ? (
        <section className="settings-wide-section" id="jira-integration">
          <JiraSettingsForm initialConfig={initialJiraConfig} />
        </section>
      ) : null}

      {activeArea === "testrail" ? (
        <section className="settings-wide-section" id="testrail-integration">
          <TestRailSettingsForm />
        </section>
      ) : null}

      {activeArea === "admin" && isAdmin ? (
        <section className="settings-module-card admin-debug-card settings-wide-section" id="admin-debug">
          <p className="report-kicker">Admin Debug</p>
          <h2>Testing shortcuts</h2>
          <p>Admin-only debug hooks for faster local and beta testing.</p>

          {showInternalE2ESetup ? (
            <section className="dev-only-account-setup">
              <E2EAutomationReadinessPanel />
              <AutomationExportSettingsForm
                value={automationProjectConfig}
                onChange={updateAutomationProjectConfig}
              />
              <ProjectAutomationCredentialsForm
                profiles={automationCredentialProfiles}
                onChange={updateAutomationCredentialProfiles}
              />
            </section>
          ) : null}

          <div className="admin-debug-grid">
            <code>User: {userEmail ?? "unknown"}</code>
            <code>Jira configured: {initialJiraConfig ? "yes" : "no"}</code>
            <code>Project key: {initialJiraConfig?.projectKey ?? "none"}</code>
            <code>Next: wire smoke/debug actions</code>
          </div>
        </section>
      ) : null}
    </section>
  );
}
