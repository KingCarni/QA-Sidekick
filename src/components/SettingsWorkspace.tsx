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
type JiraWizardStep = "config" | "connection" | "issueTypes" | "handoff";
type TestRailWizardStep = "config" | "connection" | "target" | "export";

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
  testRailReadiness: TestRailIntegrationReadiness,
  jiraWizardStep: JiraWizardStep,
  testRailWizardStep: TestRailWizardStep
) {
  if (activeArea === "testrail") {
    if (testRailWizardStep === "config") {
      return {
        title: testRailReadiness.configSaved ? "TestRail config is saved." : "Save TestRail config first.",
        body: testRailReadiness.configSaved
          ? "TestRail connection details are saved. Move to the connection test when you are ready."
          : "Add the TestRail base URL, username, API key, project ID, and default section before testing export readiness.",
        recommendationTitle: "Step 1: Configuration",
        recommendationBody: "Save the required TestRail fields before testing the connection or loading target options.",
        tipTitle: "Required TestRail fields",
        tipBody: "Base URL, username, API key, project ID, and default section are the minimum useful TestRail setup.",
      };
    }

    if (testRailWizardStep === "connection") {
      return {
        title: testRailReadiness.connectionTested ? "TestRail connection works." : "Test the TestRail connection.",
        body: testRailReadiness.connectionTested
          ? "The connection test passed. Next, confirm the project/suite/section target."
          : "Run the connection test after saving config so QAtalyst can confirm TestRail is reachable.",
        recommendationTitle: "Step 2: Connection test",
        recommendationBody: "A saved config can still have stale credentials. Test before trusting export-ready workflows.",
        tipTitle: "Connection before export",
        tipBody: "If the connection fails, fix credentials or URL before working on suite and section targeting.",
      };
    }

    if (testRailWizardStep === "target") {
      return {
        title: testRailReadiness.projectTargetReady ? "TestRail target is selected." : "Confirm project/suite targeting.",
        body: testRailReadiness.projectTargetReady
          ? "The project target and default section are ready for preview-first export."
          : "Confirm the project, suite, and default section where generated cases should land.",
        recommendationTitle: "Step 3: Project target",
        recommendationBody: "Make sure generated cases will land in the intended TestRail project, suite, and section.",
        tipTitle: "Target accuracy matters",
        tipBody: "A working connection is not enough if the project or section points to the wrong place.",
      };
    }

    return {
      title: testRailReadiness.exportReady ? "TestRail export is ready." : "Confirm TestRail export readiness.",
      body: testRailReadiness.exportReady
        ? "Config, connection, and project target are ready for preview-first export."
        : "Export readiness needs saved config, a passing connection test, and a valid project/default section target.",
      recommendationTitle: "Step 4: Export readiness",
      recommendationBody: "Generate coverage, review it, preview the sync, then approve the TestRail export flow.",
      tipTitle: "Preview-first sync",
      tipBody: "Do not silently write cases. Generate, review, preview sync, approve, then create or update TestRail cases.",
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

  if (jiraWizardStep === "config") {
    return {
      title: jiraReadiness.configSaved ? "Jira config is saved." : "Save Jira config first.",
      body: jiraReadiness.configSaved
        ? "Jira site, account, project, and issue type defaults are saved. Move to connection testing next."
        : "Add your Jira site, account email, project key, and issue type defaults so QAtalyst can prepare ticket-aware QA work.",
      recommendationTitle: "Step 1: Configuration",
      recommendationBody: "Start with the site URL and project key. After saving, run the connection test and refresh issue types.",
      tipTitle: "Project key matters",
      tipBody: "Use the exact Jira project key your team works in. That keeps fetched tickets and created issues scoped to the right workspace.",
    };
  }

  if (jiraWizardStep === "connection") {
    return {
      title: jiraReadiness.connectionTested ? "Jira connection works." : "Test the Jira connection.",
      body: jiraReadiness.connectionTested
        ? "The connection test passed. Next, refresh issue types so QAtalyst uses your real Jira schema."
        : "Run the connection test to confirm project visibility and issue creation permissions before relying on Jira handoff.",
      recommendationTitle: "Step 2: Connection test",
      recommendationBody: "A saved config is only half the job. Confirm project visibility and issue creation readiness.",
      tipTitle: "Connection before handoff",
      tipBody: "If the connection fails, fix credentials, project key, or Jira permissions before refreshing issue types.",
    };
  }

  if (jiraWizardStep === "issueTypes") {
    return {
      title: jiraReadiness.issueTypesLoaded ? "Jira issue types are loaded." : "Refresh Jira issue types.",
      body: jiraReadiness.issueTypesLoaded
        ? "Issue types are loaded. QAtalyst can map Bug Writer output and general work to the configured Jira types."
        : "Load Jira's real issue types so QAtalyst does not rely on fallback assumptions for bugs, tasks, and stories.",
      recommendationTitle: "Step 3: Issue types",
      recommendationBody: "Using Jira's actual issue types prevents QAtalyst from preparing handoff work that does not match your project setup.",
      tipTitle: "Use the real Jira schema",
      tipBody: "Bug flows should use your intended Bug type. Non-bug flows can fall back to Task only when that matches your workflow.",
    };
  }

  return {
    title: jiraReadiness.handoffReady ? "Jira handoff is ready." : "Confirm Jira handoff readiness.",
    body: jiraReadiness.handoffReady
      ? "Jira config, connection, issue types, project visibility, and issue creation readiness are confirmed."
      : "Handoff readiness needs saved config, successful connection test, loaded issue types, project visibility, and issue creation permission.",
    recommendationTitle: "Step 4: Handoff readiness",
    recommendationBody: "Once ready, run one real Bug Writer → Create Jira Issue smoke test before trusting this in production.",
    tipTitle: "Final smoke test",
    tipBody: "Use one low-risk bug report to verify field mapping, issue type, priority, and created-ticket formatting.",
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

function scrollToIntegrationSection(area: SettingsArea) {
  if (typeof window === "undefined") return;
  const targetId = area === "testrail" ? "testrail-integration" : area === "admin" ? "admin-debug" : "jira-integration";
  window.requestAnimationFrame(() => {
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

export default function SettingsWorkspace({
  initialJiraConfig,
  isAdmin,
  userEmail,
}: SettingsWorkspaceProps) {
  const [activeArea, setActiveArea] = useState<SettingsArea>("jira");
  const [jiraWizardStep, setJiraWizardStep] = useState<JiraWizardStep>("config");
  const [testRailWizardStep, setTestRailWizardStep] = useState<TestRailWizardStep>("config");
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
    () => getIntegrationQAtGuidance(activeArea, jiraReadiness, testRailReadiness, jiraWizardStep, testRailWizardStep),
    [activeArea, jiraReadiness, testRailReadiness, jiraWizardStep, testRailWizardStep]
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
    scrollToIntegrationSection(area);
  }

  function selectJiraWizardStep(step: JiraWizardStep) {
    setActiveArea("jira");
    setJiraWizardStep(step);
    scrollToIntegrationSection("jira");
  }

  function selectTestRailWizardStep(step: TestRailWizardStep) {
    setActiveArea("testrail");
    setTestRailWizardStep(step);
    scrollToIntegrationSection("testrail");
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
                  active: testRailWizardStep === "config",
                  title: testRailReadiness.configSaved ? "TestRail config is saved" : "Save TestRail connection settings",
                  onClick: () => selectTestRailWizardStep("config"),
                },
                {
                  label: "Connection test",
                  complete: testRailReadiness.connectionTested,
                  active: testRailWizardStep === "connection",
                  title: testRailReadiness.connectionTested ? "TestRail connection tested" : "Run TestRail connection test",
                  onClick: () => selectTestRailWizardStep("connection"),
                },
                {
                  label: "Project/suite",
                  complete: testRailReadiness.projectTargetReady,
                  active: testRailWizardStep === "target",
                  title: testRailReadiness.projectTargetReady ? "Project target ready" : "Confirm TestRail project and suite",
                  onClick: () => selectTestRailWizardStep("target"),
                },
                {
                  label: "Export ready",
                  complete: testRailReadiness.exportReady,
                  active: testRailWizardStep === "export",
                  title: testRailReadiness.exportReady ? "Export readiness confirmed" : "Confirm export readiness",
                  onClick: () => selectTestRailWizardStep("export"),
                },
              ]
            : [
                {
                  label: "Config saved",
                  complete: jiraReadiness.configSaved,
                  active: jiraWizardStep === "config",
                  title: jiraReadiness.configSaved ? "Jira config is saved" : "Save Jira config",
                  onClick: () => selectJiraWizardStep("config"),
                },
                {
                  label: "Connection test",
                  complete: jiraReadiness.connectionTested,
                  active: jiraWizardStep === "connection",
                  title: jiraReadiness.connectionTested ? "Jira connection tested" : "Run Jira connection test",
                  onClick: () => selectJiraWizardStep("connection"),
                },
                {
                  label: "Issue types",
                  complete: jiraReadiness.issueTypesLoaded,
                  active: jiraWizardStep === "issueTypes",
                  title: jiraReadiness.issueTypesLoaded ? "Issue types loaded" : "Refresh Jira issue types",
                  onClick: () => selectJiraWizardStep("issueTypes"),
                },
                {
                  label: "Handoff ready",
                  complete: jiraReadiness.handoffReady,
                  active: jiraWizardStep === "handoff",
                  title: jiraReadiness.handoffReady ? "Jira handoff ready" : "Confirm Jira handoff readiness",
                  onClick: () => selectJiraWizardStep("handoff"),
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
