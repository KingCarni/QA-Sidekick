"use client";

import { useEffect, useMemo, useState } from "react";
import AutomationExportSettingsForm from "@/components/AutomationExportSettingsForm";
import E2EAutomationReadinessPanel from "@/components/E2EAutomationReadinessPanel";
import JiraSettingsForm, { type JiraIntegrationReadiness } from "@/components/JiraSettingsForm";
import ProjectAutomationCredentialsForm from "@/components/ProjectAutomationCredentialsForm";
import QAtCompanionRail from "@/components/QAtCompanionRail";
import TestRailSettingsForm, { type TestRailIntegrationReadiness } from "@/components/TestRailSettingsForm";
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

const EMPTY_JIRA_READINESS: JiraIntegrationReadiness = {
  configSaved: false,
  connectionTested: false,
  issueTypesLoaded: false,
  handoffReady: false,
};

const EMPTY_TESTRAIL_READINESS: TestRailIntegrationReadiness = {
  configSaved: false,
  connectionTested: false,
  projectTargetReady: false,
  exportReady: false,
};

function getIntegrationQAtGuidance(
  activeArea: SettingsArea,
  jiraReadiness: JiraIntegrationReadiness,
  testRailReadiness: TestRailIntegrationReadiness
) {
  if (activeArea === "testrail") {
    if (testRailReadiness.exportReady) {
      return {
        title: "TestRail export is ready.",
        body: "Your TestRail config is saved, the connection has been tested, and the project target is ready for preview-first export.",
        recommendationTitle: "Use TestRail from the Toolbelt",
        recommendationBody: "You can now generate coverage, review it, preview the sync, and approve the TestRail export flow.",
        tipTitle: "QAt says: keep preview-first sync",
        tipBody: "Do not silently write cases. Generate, review, preview sync, approve, then create or update TestRail cases.",
      };
    }

    if (testRailReadiness.connectionTested) {
      return {
        title: "TestRail connection works.",
        body: "The connection test passed. Confirm the project, suite, and default section before treating TestRail export as ready.",
        recommendationTitle: "Confirm project/suite targeting",
        recommendationBody: "Make sure the project ID and default section point to the right TestRail destination for generated cases.",
        tipTitle: "QAt says: verify the target",
        tipBody: "A working connection is not enough if the project or section points to the wrong place.",
      };
    }

    if (testRailReadiness.configSaved) {
      return {
        title: "TestRail config is saved.",
        body: "Your TestRail settings are saved. Run the connection test next, then confirm the project/suite target.",
        recommendationTitle: "Run the TestRail connection test",
        recommendationBody: "Testing the connection confirms QAtalyst can reach TestRail before export-ready workflows rely on it.",
        tipTitle: "QAt says: test before export",
        tipBody: "A saved config can still have stale keys or wrong project targets. Test it before trusting generated export output.",
      };
    }

    return {
      title: "TestRail setup guidance.",
      body: "Use this page to save TestRail connection details and confirm the project/suite QAtalyst should use for export-ready coverage.",
      recommendationTitle: "Save TestRail config first",
      recommendationBody: "Add the base URL, username, API key, project ID, and default section. Then save and test the connection.",
      tipTitle: "QAt says: start with required fields",
      tipBody: "Base URL, username, API key, project ID, and default section are the minimum useful TestRail setup.",
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

  if (jiraReadiness.handoffReady) {
    return {
      title: "Jira setup is ready.",
      body: "Your Jira config is saved, the connection test passed, issue types are loaded, and handoff readiness is confirmed.",
      recommendationTitle: "Jira setup is complete",
      recommendationBody: "The integration setup checks are complete. Head back to the Toolbelt when you are ready to use Jira in a QA workflow.",
      tipTitle: "QAt says: keep permissions healthy",
      tipBody: "If Jira handoff breaks later, re-run the connection test first. Permissions or tokens are usually the first thing to check.",
    };
  }

  if (jiraReadiness.issueTypesLoaded) {
    return {
      title: "Jira issue types are loaded.",
      body: "Your Jira config, connection test, and issue types are ready. Confirm handoff readiness before using Jira workflows.",
      recommendationTitle: "Confirm handoff readiness",
      recommendationBody: "Handoff readiness needs a saved config, successful connection test, loaded issue types, project visibility, and issue creation permission.",
      tipTitle: "QAt says: verify final readiness",
      tipBody: "This final setup check confirms QAtalyst can prepare Jira-ready work without guessing the project or issue type setup.",
    };
  }

  if (jiraReadiness.connectionTested) {
    return {
      title: "Jira connection works.",
      body: "The connection test passed. Refresh issue types if needed, then confirm handoff readiness before relying on Jira output.",
      recommendationTitle: "Refresh issue types",
      recommendationBody: "Issue types help QAtalyst pick the right Jira work type for bugs, tasks, stories, and future handoff flows.",
      tipTitle: "QAt says: load the real issue types",
      tipBody: "Using Jira's actual issue types prevents QAtalyst from preparing handoff work that does not match your project setup.",
    };
  }

  if (jiraReadiness.configSaved) {
    return {
      title: "Jira config is saved.",
      body: "Your Jira settings are saved. Run the connection test and refresh issue types before relying on Jira handoff workflows.",
      recommendationTitle: "Run the Jira connection test",
      recommendationBody: "A saved config is only half the job. Confirm project visibility and issue creation readiness.",
      tipTitle: "QAt says: verify permissions",
      tipBody: "The Jira account should be able to browse the project and create issues. If either permission is missing, handoff can fail later.",
    };
  }

  return {
    title: "Jira setup guidance.",
    body: "Add your Jira site, account email, project key, and issue type defaults so QAtalyst can prepare ticket-aware QA work.",
    recommendationTitle: "Save the Jira config, then test it",
    recommendationBody: "Start with the site URL and project key. After saving, run the connection test and refresh issue types.",
    tipTitle: "QAt says: project key matters",
    tipBody: "Use the exact Jira project key your team works in. That keeps fetched tickets and future created issues scoped to the right workspace.",
  };
}

function getSettingsChatIntro(activeArea: SettingsArea) {
  if (activeArea === "testrail") return "Ask QAt about TestRail setup, export readiness, project targeting, or preview-first sync.";
  if (activeArea === "admin") return "Ask QAt about internal setup scope, automation readiness, or where to continue configuration.";
  return "Ask QAt about Jira setup, issue types, permissions, handoff readiness, or ticket sync.";
}

function getSettingsChatPlaceholder(activeArea: SettingsArea) {
  if (activeArea === "testrail") return "Ask QAt: what is missing before TestRail export is ready?";
  if (activeArea === "admin") return "Ask QAt: what should I configure next?";
  return "Ask QAt: what is missing before Jira handoff is ready?";
}

export default function SettingsWorkspace({
  initialJiraConfig,
  isAdmin,
  userEmail,
}: SettingsWorkspaceProps) {
  const [activeArea, setActiveArea] = useState<SettingsArea>("jira");
  const [jiraReadiness, setJiraReadiness] = useState<JiraIntegrationReadiness>(() => ({
    ...EMPTY_JIRA_READINESS,
    configSaved: Boolean(initialJiraConfig),
  }));
  const [testRailReadiness, setTestRailReadiness] = useState<TestRailIntegrationReadiness>(EMPTY_TESTRAIL_READINESS);
  const [automationCredentialProfiles, setAutomationCredentialProfiles] = useState<AutomationCredentialProfile[]>([]);
  const [automationProjectConfig, setAutomationProjectConfig] = useState<AutomationProjectConfig>(() =>
    normalizeAutomationProjectConfig(null)
  );

  const jiraConfigured = jiraReadiness.configSaved;
  const integrationGuidance = useMemo(
    () => getIntegrationQAtGuidance(activeArea, jiraReadiness, testRailReadiness),
    [activeArea, jiraReadiness, testRailReadiness]
  );
  const progressPercent =
    activeArea === "jira"
      ? [jiraReadiness.configSaved, jiraReadiness.connectionTested, jiraReadiness.issueTypesLoaded, jiraReadiness.handoffReady].filter(Boolean).length * 25
      : activeArea === "testrail"
        ? [testRailReadiness.configSaved, testRailReadiness.connectionTested, testRailReadiness.projectTargetReady, testRailReadiness.exportReady].filter(Boolean).length * 25
        : 10;

  const tabClass = (area: SettingsArea) =>
    activeArea === area ? "settings-area-tab settings-area-tab-active" : "settings-area-tab";
  const showInternalE2ESetup = process.env.NEXT_PUBLIC_SHOW_E2E_ACCOUNT_SETUP === "true";

  function selectSettingsArea(area: SettingsArea) {
    setActiveArea(area);
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
            <JiraSettingsForm initialConfig={initialJiraConfig} onReadinessChange={setJiraReadiness} />
          </section>
        ) : null}

        {activeArea === "testrail" ? (
          <section className="settings-wide-section integrations-settings-section" id="testrail-integration">
            <TestRailSettingsForm onReadinessChange={setTestRailReadiness} />
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
        className="integrations-qAt-companion-rail qat-companion-panel-integrations"
        eyebrow="QAt Companion"
        title={integrationGuidance.title}
        body={integrationGuidance.body}
        stateLabel={activeArea === "jira" ? (jiraConfigured ? "Jira saved" : "Jira setup") : activeArea === "testrail" ? "TestRail" : "Admin"}
        imageSrc="/qat/FullQat.png"
        progressPercent={progressPercent}
        chatEnabled
        chatTitle="QAt Box"
        chatIntro={getSettingsChatIntro(activeArea)}
        chatPlaceholder={getSettingsChatPlaceholder(activeArea)}
        chatResponse="I can review this integration setup, but Project Brain context is not available yet."
        chatProjectId="qatalyst"
        steps={
          activeArea === "testrail"
            ? [
                {
                  label: "Config saved",
                  complete: testRailReadiness.configSaved,
                  active: !testRailReadiness.configSaved,
                  title: testRailReadiness.configSaved ? "TestRail config is saved" : "Save TestRail connection settings",
                  onClick: () => selectSettingsArea("testrail"),
                },
                {
                  label: "Connection test",
                  complete: testRailReadiness.connectionTested,
                  active: testRailReadiness.configSaved && !testRailReadiness.connectionTested,
                  title: testRailReadiness.connectionTested ? "TestRail connection tested" : "Run TestRail connection test",
                  onClick: () => selectSettingsArea("testrail"),
                },
                {
                  label: "Project/suite",
                  complete: testRailReadiness.projectTargetReady,
                  active: testRailReadiness.connectionTested && !testRailReadiness.projectTargetReady,
                  title: testRailReadiness.projectTargetReady ? "Project target ready" : "Confirm TestRail project and suite",
                  onClick: () => selectSettingsArea("testrail"),
                },
                {
                  label: "Export ready",
                  complete: testRailReadiness.exportReady,
                  active: testRailReadiness.projectTargetReady && !testRailReadiness.exportReady,
                  title: testRailReadiness.exportReady ? "Export readiness confirmed" : "Confirm export readiness",
                  onClick: () => selectSettingsArea("testrail"),
                },
              ]
            : [
                {
                  label: "Config saved",
                  complete: jiraReadiness.configSaved,
                  active: !jiraReadiness.configSaved,
                  title: jiraReadiness.configSaved ? "Jira config is saved" : "Save Jira config",
                  onClick: () => selectSettingsArea("jira"),
                },
                {
                  label: "Connection test",
                  complete: jiraReadiness.connectionTested,
                  active: jiraReadiness.configSaved && !jiraReadiness.connectionTested,
                  title: jiraReadiness.connectionTested ? "Jira connection tested" : "Run Jira connection test",
                  onClick: () => selectSettingsArea("jira"),
                },
                {
                  label: "Issue types",
                  complete: jiraReadiness.issueTypesLoaded,
                  active: jiraReadiness.connectionTested && !jiraReadiness.issueTypesLoaded,
                  title: jiraReadiness.issueTypesLoaded ? "Issue types loaded" : "Refresh Jira issue types",
                  onClick: () => selectSettingsArea("jira"),
                },
                {
                  label: "Handoff ready",
                  complete: jiraReadiness.handoffReady,
                  active: jiraReadiness.issueTypesLoaded && !jiraReadiness.handoffReady,
                  title: jiraReadiness.handoffReady ? "Jira handoff ready" : "Confirm Jira handoff readiness",
                  onClick: () => selectSettingsArea("jira"),
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
            value: jiraReadiness.handoffReady
              ? "Setup ready"
              : jiraReadiness.issueTypesLoaded
                ? "Types loaded"
                : jiraReadiness.connectionTested
                  ? "Tested"
                  : jiraReadiness.configSaved
                    ? "Saved"
                    : "Missing",
            state: jiraReadiness.handoffReady || jiraReadiness.connectionTested ? "ready" : jiraReadiness.configSaved ? "warning" : "warning",
          },
          {
            label: "TestRail",
            value: testRailReadiness.exportReady
              ? "Export ready"
              : testRailReadiness.connectionTested
                ? "Tested"
                : testRailReadiness.configSaved
                  ? "Saved"
                  : "Missing",
            state: testRailReadiness.exportReady || testRailReadiness.connectionTested ? "ready" : activeArea === "testrail" ? "warning" : "neutral",
          },
        ]}
        actions={[
          {
            label: "Open Toolbelt",
            variant: "primary",
            onClick: () => {
              window.location.href = "/app";
            },
          },
        ]}
        tip={{ title: integrationGuidance.tipTitle, body: integrationGuidance.tipBody }}
      />
    </>
  );
}
