"use client";

import { useEffect, useState } from "react";
import AccountSetupUserPanel from "@/components/AccountSetupUserPanel";
import AutomationExportSettingsForm from "@/components/AutomationExportSettingsForm";
import BugCollectionPanel from "@/components/BugCollectionPanel";
import E2EAutomationReadinessPanel from "@/components/E2EAutomationReadinessPanel";
import JiraSettingsForm from "@/components/JiraSettingsForm";
import ProjectAutomationCredentialsForm from "@/components/ProjectAutomationCredentialsForm";
import ProjectSettingsPanel, { type SafeQAProject } from "@/components/ProjectSettingsPanel";
import ProjectSourceVaultPanel from "@/components/ProjectSourceVaultPanel";
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

type SettingsArea = "projects" | "source-vault" | "bugs" | "account-setup" | "jira" | "testrail" | "admin";

export default function SettingsWorkspace({
  initialJiraConfig,
  isAdmin,
  userEmail,
}: SettingsWorkspaceProps) {
  const [activeArea, setActiveArea] = useState<SettingsArea>("projects");
  const [activeProject, setActiveProject] = useState<SafeQAProject | null>(null);
  const [automationCredentialProfiles, setAutomationCredentialProfiles] = useState<AutomationCredentialProfile[]>([]);
  const [automationProjectConfig, setAutomationProjectConfig] = useState<AutomationProjectConfig>(() =>
    normalizeAutomationProjectConfig(null)
  );

  const tabClass = (area: SettingsArea) =>
    activeArea === area ? "settings-area-tab settings-area-tab-active" : "settings-area-tab";
  const showInternalE2ESetup = process.env.NEXT_PUBLIC_SHOW_E2E_ACCOUNT_SETUP === "true";

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storageKey = activeProject?.id
      ? `qatalyst.automationCredentialProfiles.${activeProject.id}`
      : "qatalyst.automationCredentialProfiles.global";
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
  }, [activeProject?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storageKey = activeProject?.id
      ? `qatalyst.automationExportConfig.${activeProject.id}`
      : "qatalyst.automationExportConfig.global";
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
  }, [activeProject?.id]);

  function updateAutomationCredentialProfiles(profiles: AutomationCredentialProfile[]) {
    setAutomationCredentialProfiles(profiles);

    if (typeof window === "undefined") return;

    const storageKey = activeProject?.id
      ? `qatalyst.automationCredentialProfiles.${activeProject.id}`
      : "qatalyst.automationCredentialProfiles.global";
    window.localStorage.setItem(storageKey, JSON.stringify(profiles));
  }

  function updateAutomationProjectConfig(config: AutomationProjectConfig) {
    const normalized = normalizeAutomationProjectConfig(config);
    setAutomationProjectConfig(normalized);

    if (typeof window === "undefined") return;

    const storageKey = activeProject?.id
      ? `qatalyst.automationExportConfig.${activeProject.id}`
      : "qatalyst.automationExportConfig.global";
    window.localStorage.setItem(storageKey, JSON.stringify(normalized));
  }

  return (
    <section className="settings-wide-panel settings-wide-panel-with-projects" data-testid="settings-workspace">
      <div className="settings-area-strip">
        <p className="report-kicker">Settings Areas</p>

        <nav className="settings-area-tabs" aria-label="Settings areas">
          <button className={tabClass("projects")} data-testid="settings-tab-projects" onClick={() => setActiveArea("projects")} type="button">
            Projects
          </button>
          <button className={tabClass("source-vault")} data-testid="settings-tab-source-vault" onClick={() => setActiveArea("source-vault")} type="button">
            Project Source Vault
          </button>
          <button className={tabClass("bugs")} data-testid="settings-tab-bug-collection" onClick={() => setActiveArea("bugs")} type="button">
            Bug Collection
          </button>
          <button className={tabClass("account-setup")} data-testid="settings-tab-account-setup" onClick={() => setActiveArea("account-setup")} type="button">
            Account Setup
          </button>
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

      {activeProject ? (
        <div className="active-project-settings-strip">
          <div>
            <p className="report-kicker">Active Project</p>
            <strong>{activeProject.name}</strong>
            <span>{activeProject.productType || "other"}</span>
          </div>
          <button type="button" onClick={() => setActiveArea("source-vault")}>
            Manage Sources
          </button>
        </div>
      ) : (
        <div className="active-project-settings-strip active-project-settings-strip-empty">
          <div>
            <p className="report-kicker">Active Project</p>
            <strong>No project selected</strong>
            <span>Create a project to start building reusable context memory.</span>
          </div>
          <button type="button" onClick={() => setActiveArea("projects")}>
            Create Project
          </button>
        </div>
      )}

      {activeArea === "projects" ? (
        <section className="settings-wide-section" id="projects">
          <ProjectSettingsPanel
            activeProjectId={activeProject?.id}
            onActiveProjectChange={setActiveProject}
          />
        </section>
      ) : null}

      {activeArea === "source-vault" ? (
        <section className="settings-wide-section" id="project-source-vault">
          <ProjectSourceVaultPanel activeProject={activeProject} />
        </section>
      ) : null}

      {activeArea === "bugs" ? (
        <section className="settings-wide-section" id="bug-collection">
          <BugCollectionPanel activeProject={activeProject} />
        </section>
      ) : null}

      {activeArea === "account-setup" ? (
        <section className="settings-wide-section account-setup-section" data-testid="account-setup-panel" id="account-setup">
          <AccountSetupUserPanel
            activeProjectName={activeProject?.name}
            activeProjectDescription={activeProject?.description}
            jiraConfigured={Boolean(initialJiraConfig)}
            testRailConfigured={false}
          />

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
        </section>
      ) : null}

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
