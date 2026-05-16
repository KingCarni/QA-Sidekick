"use client";

import { useEffect, useMemo, useState } from "react";
import AutomationExportSettingsForm from "@/components/AutomationExportSettingsForm";
import E2EAutomationReadinessPanel from "@/components/E2EAutomationReadinessPanel";
import JiraSettingsForm from "@/components/JiraSettingsForm";
import ProjectAutomationCredentialsForm from "@/components/ProjectAutomationCredentialsForm";
import QAtCompanionRail from "@/components/QAtCompanionRail";
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

function getIntegrationQAtGuidance(activeArea: SettingsArea, jiraConfigured: boolean) {
  if (activeArea === "testrail") {
    return {
      title: "Let’s connect TestRail next.",
      body: "Add your TestRail workspace details, validate the connection, then choose where QAtalyst should prepare or export generated coverage.",
      recommendationTitle: "Start with connection settings",
      recommendationBody: "TestRail setup works best when the base URL, user details, project, and suite are confirmed before exporting generated cases.",
      tipTitle: "QAt says: validate before exporting",
      tipBody: "Once TestRail details are saved, run a connection check before trusting export-ready output. It prevents stale project or suite targets.",
    };
  }

  if (activeArea === "admin") {
    return {
      title: "Internal setup tools are separate.",
      body: "Admin utilities help with beta and automation readiness. Keep Jira and TestRail setup focused on user-facing workflow connections.",
      recommendationTitle: "Return to an integration tab",
      recommendationBody: "Use Jira Integration or TestRail Integration when you want QAt to walk through external setup steps.",
      tipTitle: "QAt says: keep admin setup scoped",
      tipBody: "Internal automation setup is useful, but it should not replace the user-facing Jira and TestRail connection flow.",
    };
  }

  return jiraConfigured
    ? {
        title: "Jira setup is mostly ready.",
        body: "Review the saved Jira site, project key, issue types, and connection diagnostics before relying on Jira handoff workflows.",
        recommendationTitle: "Run or review the connection test",
        recommendationBody: "A saved config is only half the job. Confirm project visibility and issue creation readiness so QAtalyst can prepare reliable Jira work.",
        tipTitle: "QAt says: verify permissions",
        tipBody: "The Jira account should be able to browse the project and create issues. If either permission is missing, generated handoff work may look ready but fail later.",
      }
    : {
        title: "Let’s connect Jira first.",
        body: "Add your Jira site, account email, project key, and issue type defaults so QAtalyst can prepare ticket-aware QA work.",
        recommendationTitle: "Save the Jira config, then test it",
        recommendationBody: "Start with the site URL and project key. After saving, run the connection test and refresh issue types.",
        tipTitle: "QAt says: project key matters",
        tipBody: "Use the exact Jira project key your team works in. That keeps fetched tickets and future created issues scoped to the right workspace.",
      };
}

export default function SettingsWorkspace({
  initialJiraConfig,
  isAdmin,
  userEmail,
}: SettingsWorkspaceProps) {
  const [activeArea, setActiveArea] = useState<SettingsArea>("jira");
  const [hasAskedSettingsQAt, setHasAskedSettingsQAt] = useState(false);
  const [automationCredentialProfiles, setAutomationCredentialProfiles] = useState<AutomationCredentialProfile[]>([]);
  const [automationProjectConfig, setAutomationProjectConfig] = useState<AutomationProjectConfig>(() =>
    normalizeAutomationProjectConfig(null)
  );

  const jiraConfigured = Boolean(initialJiraConfig);
  const integrationGuidance = useMemo(
    () => getIntegrationQAtGuidance(activeArea, jiraConfigured),
    [activeArea, jiraConfigured]
  );
  const progressPercent = activeArea === "jira" ? (jiraConfigured ? 70 : 20) : activeArea === "testrail" ? 25 : 10;

  const tabClass = (area: SettingsArea) =>
    activeArea === area ? "settings-area-tab settings-area-tab-active" : "settings-area-tab";
  const showInternalE2ESetup = process.env.NEXT_PUBLIC_SHOW_E2E_ACCOUNT_SETUP === "true";

  function selectSettingsArea(area: SettingsArea) {
    setActiveArea(area);
    setHasAskedSettingsQAt(false);
  }

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
    <>
      <section className="settings-wide-panel integrations-settings-panel" data-testid="settings-workspace">
        <div className="settings-area-strip integrations-settings-strip">
          <div className="integrations-settings-header">
            <div>
              <p className="report-kicker">Connected Workflow Tools</p>
              <h2>External integrations</h2>
              <p className="settings-transition-copy">
                Configure the external QA systems QAtalyst uses for ticket sync, report export, and future workflow automation.
              </p>
            </div>
          </div>

          <nav className="settings-area-tabs integrations-settings-tabs" aria-label="Settings areas">
            <button className={tabClass("jira")} data-testid="settings-tab-jira-integration" onClick={() => selectSettingsArea("jira")} type="button">
              Jira Integration
            </button>
            <button className={tabClass("testrail")} data-testid="settings-tab-testrail-integration" onClick={() => selectSettingsArea("testrail")} type="button">
              TestRail Integration
            </button>
            {isAdmin ? (
              <button className={tabClass("admin")} onClick={() => selectSettingsArea("admin")} type="button">
                Admin Tools
              </button>
            ) : null}
          </nav>
        </div>

        {activeArea === "jira" ? (
          <section className="settings-wide-section integrations-settings-section" id="jira-integration">
            <JiraSettingsForm initialConfig={initialJiraConfig} />
          </section>
        ) : null}

        {activeArea === "testrail" ? (
          <section className="settings-wide-section integrations-settings-section" id="testrail-integration">
            <TestRailSettingsForm />
          </section>
        ) : null}

        {activeArea === "admin" && isAdmin ? (
          <section className="settings-module-card admin-debug-card settings-wide-section integrations-settings-section" id="admin-debug">
            <p className="report-kicker">Internal Tools</p>
            <h2>Automation utilities</h2>
            <p>Internal QA and automation setup helpers used during development and beta testing.</p>

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
            </div>
          </section>
        ) : null}
      </section>

      <QAtCompanionRail
        storageKey="qatalyst-integrations-qAt-companion-collapsed"
        className="integrations-qAt-companion-rail"
        eyebrow="QAt Companion"
        title={integrationGuidance.title}
        body={integrationGuidance.body}
        stateLabel={activeArea === "jira" ? (jiraConfigured ? "Jira ready" : "Jira setup") : activeArea === "testrail" ? "TestRail setup" : "Admin"}
        imageSrc="/qat/FullQat.png"
        progressPercent={progressPercent}
        steps={
          activeArea === "testrail"
            ? [
                {
                  label: "Workspace",
                  complete: false,
                  active: true,
                  title: "Add TestRail workspace URL",
                  onClick: () => selectSettingsArea("testrail"),
                },
                {
                  label: "Connection",
                  complete: false,
                  active: false,
                  title: "Save connection settings",
                  onClick: () => selectSettingsArea("testrail"),
                },
                {
                  label: "Validate",
                  complete: false,
                  active: false,
                  title: "Validate TestRail connection",
                  onClick: () => selectSettingsArea("testrail"),
                },
                {
                  label: "Project",
                  complete: false,
                  active: false,
                  title: "Select project and suite",
                  onClick: () => selectSettingsArea("testrail"),
                },
                {
                  label: "Export",
                  complete: false,
                  active: false,
                  title: "Confirm export readiness",
                  onClick: () => selectSettingsArea("testrail"),
                },
                {
                  label: "Toolbelt",
                  complete: false,
                  active: false,
                  title: "Return to Toolbelt",
                  onClick: () => {
                    window.location.href = "/app";
                  },
                },
              ]
            : [
                {
                  label: "Site",
                  complete: jiraConfigured,
                  active: !jiraConfigured,
                  title: "Add Jira site and account",
                  onClick: () => selectSettingsArea("jira"),
                },
                {
                  label: "Project",
                  complete: jiraConfigured,
                  active: jiraConfigured,
                  title: "Confirm Jira project key",
                  onClick: () => selectSettingsArea("jira"),
                },
                {
                  label: "Types",
                  complete: jiraConfigured,
                  active: false,
                  title: "Load issue types",
                  onClick: () => selectSettingsArea("jira"),
                },
                {
                  label: "Validate",
                  complete: false,
                  active: false,
                  title: "Test Jira connection",
                  onClick: () => selectSettingsArea("jira"),
                },
                {
                  label: "Create",
                  complete: false,
                  active: false,
                  title: "Confirm issue creation readiness",
                  onClick: () => selectSettingsArea("jira"),
                },
                {
                  label: "Toolbelt",
                  complete: false,
                  active: false,
                  title: "Return to Toolbelt",
                  onClick: () => {
                    window.location.href = "/app";
                  },
                },
              ]
        }
        signals={[
          {
            label: "Active setup",
            value: activeArea === "jira" ? "Jira" : activeArea === "testrail" ? "TestRail" : "Admin",
            state: "neutral",
          },
          {
            label: "Jira",
            value: jiraConfigured ? "Saved" : "Missing",
            state: jiraConfigured ? "ready" : "warning",
          },
          {
            label: "TestRail",
            value: "Needs review",
            state: activeArea === "testrail" ? "warning" : "neutral",
          },
        ]}
        actions={[
          {
            label: "Ask QAt",
            variant: "secondary",
            onClick: () => setHasAskedSettingsQAt(true),
          },
          {
            label: "Open Brain",
            variant: "secondary",
            onClick: () => {
              window.location.href = "/brain?tab=integrations";
            },
          },
          {
            label: "Open Toolbelt",
            variant: "primary",
            onClick: () => {
              window.location.href = "/app";
            },
          },
        ]}
        tip={
          hasAskedSettingsQAt
            ? {
                title: integrationGuidance.tipTitle,
                body: integrationGuidance.tipBody,
              }
            : {
                title: integrationGuidance.recommendationTitle,
                body: integrationGuidance.recommendationBody,
              }
        }
      />
    </>
  );
}
