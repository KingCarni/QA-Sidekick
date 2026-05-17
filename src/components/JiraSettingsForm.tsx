"use client";

import { useEffect, useMemo, useState } from "react";
import JiraCredentialFields from "@/components/JiraCredentialFields";
import { normalizeJiraErrorMessage } from "@/lib/jira-error-normalizer";
import type { SafeJiraConfig } from "@/lib/jira-config";

export type JiraIntegrationReadiness = {
  configSaved: boolean;
  connectionTested: boolean;
  issueTypesLoaded: boolean;
  handoffReady: boolean;
};

type JiraSettingsFormProps = {
  initialConfig: SafeJiraConfig | null;
  onReadinessChange?: (readiness: JiraIntegrationReadiness) => void;
};

type SaveState = "idle" | "saving" | "saved" | "error";

type IssueTypeOption = {
  id: string;
  name: string;
  description?: string;
  subtask?: boolean;
};

type IssueTypesResponse = {
  ok?: boolean;
  error?: string;
  issueTypes?: IssueTypeOption[];
};

type JiraConnectionResponse = {
  ok?: boolean;
  error?: string;
  connected?: boolean;
  accountEmail?: string;
  displayName?: string;
  projectKey?: string;
  projectVisible?: boolean;
  canCreateIssues?: boolean;
  canEditIssues?: boolean;
  canLinkIssues?: boolean;
};

type JiraConfigStatusPayload = {
  configured?: boolean;
  missingFields?: string[];
  config?: SafeJiraConfig | null;
  tokenHealth?: {
    hasSavedToken?: boolean;
    tokenHealth?: string;
    message?: string;
  };
};

const FALLBACK_ISSUE_TYPES = ["Task", "Story", "Epic"];

function cleanSiteUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  return trimmed.replace(/\/jira$/i, "");
}

function buildJiraProjectUrl(siteUrl: string, projectKey: string) {
  const base = cleanSiteUrl(siteUrl);
  const key = projectKey.trim().toUpperCase();

  if (!base || !key) return "";

  return `${base}/jira/software/projects/${encodeURIComponent(key)}/summary`;
}

function buildJiraIssuesUrl(siteUrl: string, projectKey: string) {
  const base = cleanSiteUrl(siteUrl);
  const key = projectKey.trim().toUpperCase();

  if (!base || !key) return "";

  const jql = encodeURIComponent(`project = ${key} ORDER BY updated DESC`);
  return `${base}/jira/issues/?jql=${jql}`;
}

function uniqueIssueTypeNames(issueTypes: IssueTypeOption[]) {
  const names = issueTypes.map((issueType) => issueType.name).filter(Boolean);
  const allNames = [...names, ...FALLBACK_ISSUE_TYPES];

  return Array.from(new Set(allNames));
}

function formatUpdatedAt(value?: string) {
  if (!value) return "Not saved";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

export default function JiraSettingsForm({ initialConfig, onReadinessChange }: JiraSettingsFormProps) {
  const [siteUrl, setSiteUrl] = useState(initialConfig?.siteUrl ?? "");
  const [jiraEmail, setJiraEmail] = useState(initialConfig?.jiraEmail ?? "");
  const [jiraApiToken, setJiraApiToken] = useState("");
  const [hasSavedJiraApiToken, setHasSavedJiraApiToken] = useState(Boolean(initialConfig?.hasJiraApiToken));
  const [projectKey, setProjectKey] = useState(initialConfig?.projectKey ?? "");
  const [defaultIssueType, setDefaultIssueType] = useState(initialConfig?.defaultIssueType ?? "Task");
  const [defaultBugIssueType, setDefaultBugIssueType] = useState(initialConfig?.defaultBugIssueType ?? "Task");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("");
  const [issueTypes, setIssueTypes] = useState<IssueTypeOption[]>([]);
  const [issueTypeState, setIssueTypeState] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [issueTypeMessage, setIssueTypeMessage] = useState("");
  const [connectionState, setConnectionState] = useState<"idle" | "testing" | "connected" | "warning" | "error">("idle");
  const [connectionMessage, setConnectionMessage] = useState("");
  const [connectionDetails, setConnectionDetails] = useState<{
    projectVisible?: boolean;
    canCreateIssues?: boolean;
    canEditIssues?: boolean;
    canLinkIssues?: boolean;
  }>({});

  const jiraProjectUrl = useMemo(() => buildJiraProjectUrl(siteUrl, projectKey), [siteUrl, projectKey]);
  const jiraIssuesUrl = useMemo(() => buildJiraIssuesUrl(siteUrl, projectKey), [siteUrl, projectKey]);
  const missingJiraConfigItems = [
    !siteUrl.trim() ? "Jira site URL" : null,
    !jiraEmail.trim() ? "Jira username/email" : null,
    !jiraApiToken.trim() && !hasSavedJiraApiToken ? "Jira API token" : null,
    !projectKey.trim() ? "Project key" : null,
    !defaultIssueType.trim() ? "Default issue type" : null,
    !defaultBugIssueType.trim() ? "Default bug issue type" : null,
  ].filter(Boolean);
  const configured = missingJiraConfigItems.length === 0;
  const issueTypeNames = useMemo(() => uniqueIssueTypeNames(issueTypes), [issueTypes]);
  const diagnosticsReady =
    hasSavedJiraApiToken &&
    connectionState === "connected" &&
    connectionDetails.projectVisible === true &&
    connectionDetails.canCreateIssues === true;
  const diagnosticsStatusLabel = diagnosticsReady ? "Ready" : hasSavedJiraApiToken ? "Needs test" : "Missing API key";
  const diagnosticsStatusClass = diagnosticsReady ? "ready" : hasSavedJiraApiToken ? "warning" : "error";

  useEffect(() => {
    onReadinessChange?.({
      configSaved: configured,
      connectionTested: connectionState === "connected",
      issueTypesLoaded: issueTypeState === "loaded",
      handoffReady: diagnosticsReady,
    });
  }, [configured, connectionState, issueTypeState, diagnosticsReady, onReadinessChange]);

  function applyJiraStatus(jira?: JiraConfigStatusPayload | null) {
    const config = jira?.config;

    if (config) {
      setSiteUrl(config.siteUrl ?? "");
      setJiraEmail(config.jiraEmail ?? "");
      setProjectKey(config.projectKey ?? "");
      setDefaultIssueType(config.defaultIssueType ?? "Task");
      setDefaultBugIssueType(config.defaultBugIssueType ?? "Task");
      setHasSavedJiraApiToken(Boolean(config.hasJiraApiToken));
    } else {
      setHasSavedJiraApiToken(false);
    }

    if (!config?.hasJiraApiToken) {
      setConnectionState("idle");
      setConnectionMessage("Jira API key is not saved.");
      setConnectionDetails({});
      setIssueTypes([]);
      setIssueTypeState("idle");
      setIssueTypeMessage("Paste a Jira API key and save config to reconnect.");
    }
  }

  async function refreshJiraStatus() {
    const response = await fetch("/api/jira/config", {
      method: "GET",
      cache: "no-store",
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || payload?.ok === false) {
      throw new Error(payload?.error || "Could not refresh Jira config status.");
    }

    applyJiraStatus(payload?.jira);
    return payload?.jira as JiraConfigStatusPayload | undefined;
  }

  useEffect(() => {
    async function loadIssueTypes() {
      if (!initialConfig?.siteUrl || !initialConfig.projectKey) return;

      setIssueTypeState("loading");
      setIssueTypeMessage("");

      try {
        const response = await fetch("/api/jira/issue-types", {
          method: "GET",
        });

        const payload = (await response.json().catch(() => null)) as IssueTypesResponse | null;

        if (!response.ok || payload?.ok === false) {
          throw new Error(normalizeJiraErrorMessage(payload?.error || payload || "Could not load Jira issue types."));
        }

        const loadedIssueTypes = payload?.issueTypes ?? [];
        setIssueTypes(loadedIssueTypes);
        setIssueTypeState("loaded");
        setIssueTypeMessage(
          loadedIssueTypes.length > 0
            ? `Loaded ${loadedIssueTypes.length} issue types from Jira.`
            : "No Jira issue types were returned. Using safe defaults."
        );

        const loadedNames = loadedIssueTypes.map((issueType) => issueType.name);
        const preferredBugType = loadedNames.includes(initialConfig.defaultBugIssueType)
          ? initialConfig.defaultBugIssueType
          : loadedNames.includes("Bug")
            ? "Bug"
            : loadedNames.includes("Task")
              ? "Task"
              : loadedNames[0] || "Task";

        const preferredDefaultType = loadedNames.includes(initialConfig.defaultIssueType)
          ? initialConfig.defaultIssueType
          : loadedNames.includes("Task")
            ? "Task"
            : loadedNames[0] || "Task";

        setDefaultBugIssueType(preferredBugType);
        setDefaultIssueType(preferredDefaultType);
      } catch (error) {
        setIssueTypeState("error");
        setIssueTypeMessage(normalizeJiraErrorMessage(error, "Could not load Jira issue types."));
      }
    }

    void loadIssueTypes();
  }, [initialConfig?.siteUrl, initialConfig?.projectKey, initialConfig?.defaultIssueType, initialConfig?.defaultBugIssueType]);

  async function handleRefreshIssueTypes() {
    if (!siteUrl.trim() || !jiraEmail.trim() || (!jiraApiToken.trim() && !hasSavedJiraApiToken) || !projectKey.trim()) {
      setIssueTypeState("error");
      setIssueTypeMessage("Add Jira site URL, username/email, API token, and project key before refreshing issue types.");
      return;
    }

    setIssueTypeState("loading");
    setIssueTypeMessage("");

    try {
      const response = await fetch("/api/jira/issue-types", {
        method: "GET",
      });

      const payload = (await response.json().catch(() => null)) as IssueTypesResponse | null;

      if (!response.ok || payload?.ok === false) {
        throw new Error(normalizeJiraErrorMessage(payload?.error || payload || "Could not load Jira issue types."));
      }

      const loadedIssueTypes = payload?.issueTypes ?? [];
      setIssueTypes(loadedIssueTypes);
      setIssueTypeState("loaded");
      setIssueTypeMessage(
        loadedIssueTypes.length > 0
          ? `Loaded ${loadedIssueTypes.length} issue types from Jira.`
          : "No Jira issue types were returned. Using safe defaults."
      );
    } catch (error) {
      setIssueTypeState("error");
      setIssueTypeMessage(normalizeJiraErrorMessage(error, "Could not load Jira issue types."));
    }
  }

  async function handleTestConnection(forceSavedToken = false) {
    if (!forceSavedToken && !hasSavedJiraApiToken && !jiraApiToken.trim()) {
      setConnectionState("error");
      setConnectionMessage("Jira API key is not saved. Paste a Jira API token and save config first.");
      setConnectionDetails({});
      return;
    }

    setConnectionState("testing");
    setConnectionMessage("");

    try {
      const response = await fetch("/api/jira/test-connection", {
        method: "GET",
      });

      const payload = (await response.json().catch(() => null)) as JiraConnectionResponse | null;

      if (!response.ok || payload?.ok === false || !payload?.connected) {
        throw new Error(normalizeJiraErrorMessage(payload?.error || payload || "Could not test Jira connection."));
      }

      const account = payload.displayName || payload.accountEmail || "Jira account";
      const projectKeyText = payload.projectKey || projectKey || "project";

      setConnectionDetails({
        projectVisible: payload.projectVisible,
        canCreateIssues: payload.canCreateIssues,
        canEditIssues: payload.canEditIssues,
        canLinkIssues: payload.canLinkIssues,
      });

      if (payload.projectVisible && payload.canCreateIssues) {
        setConnectionState("connected");
        setConnectionMessage(`Connected to Jira as ${account}. Project ${projectKeyText} is visible and issue creation is allowed.`);

        if (issueTypeState === "error") {
          setIssueTypeState("idle");
          setIssueTypeMessage("Connection is ready. Refresh issue types to load supported Jira work types.");
        }
      } else {
        setConnectionState("warning");
        setConnectionMessage(
          payload.projectVisible
            ? `Connected to Jira as ${account}, but this account cannot create issues in ${projectKeyText}.`
            : `Connected to Jira as ${account}, but project ${projectKeyText} is not visible to this account.`
        );
      }

      await refreshJiraStatus();
    } catch (error) {
      setConnectionState("error");
      setConnectionMessage(normalizeJiraErrorMessage(error, "Could not test Jira connection."));
    }
  }

  async function handleRemoveApiKey() {
    const confirmed = window.confirm(
      "Remove the saved Jira API key? Site URL, email, project key, and issue type defaults will stay saved."
    );
    if (!confirmed) return;

    setSaveState("saving");
    setMessage("");

    try {
      const response = await fetch("/api/jira/config/token", {
        method: "DELETE",
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || "Could not remove Jira API key.");
      }

      const status = payload?.jira as JiraConfigStatusPayload | undefined;
      setJiraApiToken("");
      applyJiraStatus(status);
      setHasSavedJiraApiToken(Boolean(status?.config?.hasJiraApiToken));
      setConnectionState("idle");
      setConnectionMessage("Jira API key removed. Paste a new API token and save config to reconnect.");
      setConnectionDetails({});
      setIssueTypes([]);
      setIssueTypeState("idle");
      setIssueTypeMessage("Jira API key removed. Paste a new API token and save config to reconnect.");
      setSaveState("saved");
      setMessage(payload?.message || "Jira API key removed.");

      await refreshJiraStatus();
      setConnectionMessage("Jira API key removed. Paste a new API token and save config to reconnect.");
      setIssueTypeMessage("Jira API key removed. Paste a new API token and save config to reconnect.");
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "Could not remove Jira API key.");
    }
  }

  async function handleSave() {
    setSaveState("saving");
    setMessage("");

    try {
      const cleanedSiteUrl = cleanSiteUrl(siteUrl);
      const response = await fetch("/api/jira/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          siteUrl: cleanedSiteUrl,
          jiraEmail: jiraEmail.trim(),
          jiraApiToken: jiraApiToken.trim() || undefined,
          projectKey,
          defaultIssueType,
          defaultBugIssueType,
          fieldMapping: {},
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || "Could not save Jira config.");
      }

      setJiraApiToken("");
      const status = payload?.jira as JiraConfigStatusPayload | undefined;
      applyJiraStatus(status);
      setSaveState("saved");
      setMessage(payload?.message || "Saved Jira settings.");
      await refreshJiraStatus();
      await handleTestConnection(Boolean(status?.config?.hasJiraApiToken));
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "Could not save Jira config.");
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm("Remove Jira configuration? This will not delete anything from Jira.");
    if (!confirmed) return;

    setSaveState("saving");
    setMessage("");

    try {
      const response = await fetch("/api/jira/config", {
        method: "DELETE",
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || "Could not remove Jira config.");
      }

      setSiteUrl("");
      setJiraEmail("");
      setJiraApiToken("");
      setHasSavedJiraApiToken(false);
      setProjectKey("");
      setDefaultIssueType("Task");
      setDefaultBugIssueType("Task");
      setIssueTypes([]);
      setIssueTypeState("idle");
      setIssueTypeMessage("");
      setConnectionState("idle");
      setConnectionMessage("");
      setConnectionDetails({});
      setSaveState("saved");
      setMessage("Jira config removed.");
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "Could not remove Jira config.");
    }
  }

  return (
    <section className="jira-settings-card jira-settings-card-polished jira-settings-card-v2">
      <div className="jira-settings-status-row jira-settings-status-row-v2">
        <div className="jira-settings-heading-copy">
          <p className="report-kicker">Jira Connection</p>
          <h2>
            {connectionState === "connected"
              ? "Jira connection ready"
              : configured
                ? "Jira settings saved"
                : "Connect your Jira project"}
          </h2>
          <p>
            Save your Jira site and project defaults so QAtalyst can prepare imports, project links,
            and future issue creation.
          </p>
        </div>

        <span
          className={
            connectionState === "connected"
              ? "jira-status-pill ready"
              : configured
                ? "jira-status-pill warning"
                : "jira-status-pill error"
          }
        >
          {connectionState === "connected" ? "Ready" : configured ? "Saved" : "Not configured"}
        </span>
      </div>

      <div className="jira-settings-grid">
        <label>
          <span>Jira site URL</span>
          <input
            onChange={(event) => setSiteUrl(event.target.value)}
            placeholder="https://yourcompany.atlassian.net"
            value={siteUrl}
          />
        </label>

        <JiraCredentialFields
          jiraEmail={jiraEmail}
          jiraApiToken={jiraApiToken}
          hasSavedJiraApiToken={hasSavedJiraApiToken}
          onJiraEmailChange={setJiraEmail}
          onJiraApiTokenChange={setJiraApiToken}
        />

        <label>
          <span>Project key</span>
          <input
            onChange={(event) => setProjectKey(event.target.value.toUpperCase())}
            placeholder="QAS"
            value={projectKey}
          />
        </label>

        <label>
          <span>General issue type</span>
          <select onChange={(event) => setDefaultIssueType(event.target.value)} value={defaultIssueType}>
            {issueTypeNames.map((issueTypeName) => (
              <option key={issueTypeName} value={issueTypeName}>
                {issueTypeName}
              </option>
            ))}
          </select>
          <small>Used as the fallback for general Jira issues and future non-bug flows.</small>
        </label>

        <label>
          <span>Bug Writer issue type</span>
          <select onChange={(event) => setDefaultBugIssueType(event.target.value)} value={defaultBugIssueType}>
            {issueTypeNames.map((issueTypeName) => (
              <option key={issueTypeName} value={issueTypeName}>
                {issueTypeName}
              </option>
            ))}
          </select>
          <small>Used specifically when Bug Writer creates Jira issues.</small>
        </label>
      </div>

      <div className="jira-issue-type-helper">
        <div>
          <strong>Issue types</strong>
          <span>
            {issueTypeMessage ||
              "Save your Jira config, then refresh issue types to use the values supported by this project."}
          </span>
        </div>

        <button
          className="qatalyst-pill-button secondary"
          disabled={issueTypeState === "loading" || !siteUrl.trim() || !jiraEmail.trim() || (!jiraApiToken.trim() && !hasSavedJiraApiToken) || !projectKey.trim()}
          onClick={handleRefreshIssueTypes}
          type="button"
        >
          {issueTypeState === "loading" ? "Loading..." : "Refresh Issue Types"}
        </button>
      </div>

      <div className="jira-issue-type-helper">
        <div>
          <strong>Connection test</strong>
          <span>
            {connectionMessage ||
              "Your Jira API token must belong to the same email entered here, with Browse Projects permission for the selected project."}
          </span>
        </div>

        <button
          className="qatalyst-pill-button secondary"
          disabled={connectionState === "testing" || !configured}
          onClick={() => handleTestConnection()}
          type="button"
        >
          {connectionState === "testing" ? "Testing..." : "Test Jira Connection"}
        </button>
      </div>

      <section className="jira-diagnostics-card">
        <div className="jira-diagnostics-header">
          <div>
            <p className="report-kicker">Saved Jira Diagnostics</p>
            <h3>Connection status</h3>
          </div>
          <span
            className={`jira-status-pill ${diagnosticsStatusClass}`}
          >
            {connectionState === "testing" ? "Testing" : diagnosticsStatusLabel}
          </span>
        </div>
        <div className="jira-diagnostics-grid">
          <div><span>Site URL</span><strong>{siteUrl || "Not set"}</strong></div>
          <div><span>Jira email</span><strong>{jiraEmail || "Not set"}</strong></div>
          <div><span>Project key</span><strong>{projectKey || "Not set"}</strong></div>
          <div><span>API token saved</span><strong>{hasSavedJiraApiToken ? "Yes" : "No"}</strong></div>
          <div><span>Project visible</span><strong>{diagnosticsReady ? "Yes" : "Unknown"}</strong></div>
          <div><span>Can create issues</span><strong>{diagnosticsReady ? "Yes" : "Unknown"}</strong></div>
        </div>
        <p className="jira-diagnostics-help">
          Your Jira API token must belong to the same Atlassian account email saved here. That account needs Browse Projects and Create Issues permission for the selected project.
        </p>
      </section>

      <div className="jira-insight-panel jira-insight-panel-v2">
        <div>
          <p className="report-kicker">Jira Links</p>
          <h3>{configured ? `${projectKey || "Project"} is linked` : "Add your Jira site to unlock links"}</h3>
          <p>
            Quick links for the configured Jira project. These do not sync data yet; issue creation comes in the next Jira pass.
          </p>
        </div>

        <div className="jira-insight-actions jira-insight-actions-v2">
          <a
            aria-disabled={!jiraProjectUrl}
            className={jiraProjectUrl ? "qatalyst-pill-button green" : "qatalyst-pill-button green jira-link-button-disabled"}
            href={jiraProjectUrl || "#"}
            rel="noreferrer"
            target="_blank"
          >
            Open Project
          </a>

          <a
            aria-disabled={!jiraIssuesUrl}
            className={jiraIssuesUrl ? "qatalyst-pill-button" : "qatalyst-pill-button jira-link-button-disabled"}
            href={jiraIssuesUrl || "#"}
            rel="noreferrer"
            target="_blank"
          >
            View Issues
          </a>
        </div>
      </div>

      <div className="jira-settings-actions jira-settings-actions-polished">
        <button className="qatalyst-pill-button red" disabled={saveState === "saving"} onClick={handleSave} type="button">
          {saveState === "saving" ? "Saving..." : "Save Jira Config"}
        </button>

        <button className="qatalyst-pill-button secondary" disabled={saveState === "saving"} onClick={handleDelete} type="button">
          Remove Config
        </button>

        <button
          className="qatalyst-pill-button secondary"
          disabled={saveState === "saving" || !hasSavedJiraApiToken}
          onClick={handleRemoveApiKey}
          type="button"
        >
          Remove API Key
        </button>
      </div>

      <p className={configured ? "jira-settings-message jira-settings-message-success" : "jira-settings-message"}>
        {configured ? "Jira config is ready." : `Jira config is missing: ${missingJiraConfigItems.join(", ")}.`}
      </p>

      {message ? (
        <p className={saveState === "error" ? "jira-settings-message jira-settings-message-error" : "jira-settings-message"}>
          {message}
        </p>
      ) : null}
    </section>
  );
}
