"use client";

import { useEffect, useMemo, useState } from "react";
import type { SafeJiraConfig } from "@/lib/jira-config";

type JiraSettingsFormProps = {
  initialConfig: SafeJiraConfig | null;
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

export default function JiraSettingsForm({ initialConfig }: JiraSettingsFormProps) {
  const [siteUrl, setSiteUrl] = useState(initialConfig?.siteUrl ?? "");
  const [projectKey, setProjectKey] = useState(initialConfig?.projectKey ?? "");
  const [defaultIssueType, setDefaultIssueType] = useState(initialConfig?.defaultIssueType ?? "Task");
  const [defaultBugIssueType, setDefaultBugIssueType] = useState(initialConfig?.defaultBugIssueType ?? "Task");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("");
  const [issueTypes, setIssueTypes] = useState<IssueTypeOption[]>([]);
  const [issueTypeState, setIssueTypeState] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [issueTypeMessage, setIssueTypeMessage] = useState("");

  const jiraProjectUrl = useMemo(() => buildJiraProjectUrl(siteUrl, projectKey), [siteUrl, projectKey]);
  const jiraIssuesUrl = useMemo(() => buildJiraIssuesUrl(siteUrl, projectKey), [siteUrl, projectKey]);
  const configured = Boolean(siteUrl.trim() && projectKey.trim() && defaultIssueType.trim() && defaultBugIssueType.trim());
  const issueTypeNames = useMemo(() => uniqueIssueTypeNames(issueTypes), [issueTypes]);

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
          throw new Error(payload?.error || "Could not load Jira issue types.");
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
        setIssueTypeMessage(error instanceof Error ? error.message : "Could not load Jira issue types.");
      }
    }

    void loadIssueTypes();
  }, [initialConfig?.siteUrl, initialConfig?.projectKey, initialConfig?.defaultIssueType, initialConfig?.defaultBugIssueType]);

  async function handleRefreshIssueTypes() {
    setIssueTypeState("loading");
    setIssueTypeMessage("");

    try {
      const response = await fetch("/api/jira/issue-types", {
        method: "GET",
      });

      const payload = (await response.json().catch(() => null)) as IssueTypesResponse | null;

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || "Could not load Jira issue types.");
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
      setIssueTypeMessage(error instanceof Error ? error.message : "Could not load Jira issue types.");
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

      setSiteUrl(cleanedSiteUrl);
      setSaveState("saved");
      setMessage("Jira config saved. QAtalyst can use these defaults for future Jira actions.");
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
      setProjectKey("");
      setDefaultIssueType("Task");
      setDefaultBugIssueType("Task");
      setIssueTypes([]);
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
          <h2>{configured ? "Jira project ready" : "Connect your Jira project"}</h2>
          <p>
            Save your Jira site and project defaults so QAtalyst can prepare imports, project links,
            and future issue creation.
          </p>
        </div>

        <span className={configured ? "jira-status-pill jira-status-ready" : "jira-status-pill jira-status-missing"}>
          {configured ? "Configured" : "Not configured"}
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

        <label>
          <span>Project key</span>
          <input
            onChange={(event) => setProjectKey(event.target.value.toUpperCase())}
            placeholder="QAS"
            value={projectKey}
          />
        </label>

        <label>
          <span>Default issue type</span>
          <select onChange={(event) => setDefaultIssueType(event.target.value)} value={defaultIssueType}>
            {issueTypeNames.map((issueTypeName) => (
              <option key={issueTypeName} value={issueTypeName}>
                {issueTypeName}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Default bug issue type</span>
          <select onChange={(event) => setDefaultBugIssueType(event.target.value)} value={defaultBugIssueType}>
            {issueTypeNames.map((issueTypeName) => (
              <option key={issueTypeName} value={issueTypeName}>
                {issueTypeName}
              </option>
            ))}
          </select>
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
          className="secondary-action-button"
          disabled={issueTypeState === "loading" || !siteUrl.trim() || !projectKey.trim()}
          onClick={handleRefreshIssueTypes}
          type="button"
        >
          {issueTypeState === "loading" ? "Loading..." : "Refresh Issue Types"}
        </button>
      </div>

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
            className={jiraProjectUrl ? "jira-open-link-button" : "jira-open-link-button jira-link-button-disabled"}
            href={jiraProjectUrl || "#"}
            rel="noreferrer"
            target="_blank"
          >
            Open Project
          </a>

          <a
            aria-disabled={!jiraIssuesUrl}
            className={jiraIssuesUrl ? "jira-open-link-button jira-open-link-button-blue" : "jira-open-link-button jira-open-link-button-blue jira-link-button-disabled"}
            href={jiraIssuesUrl || "#"}
            rel="noreferrer"
            target="_blank"
          >
            View Issues
          </a>
        </div>
      </div>

      <div className="jira-settings-actions jira-settings-actions-polished">
        <button className="copy-all-button jira-primary-action" disabled={saveState === "saving"} onClick={handleSave} type="button">
          {saveState === "saving" ? "Saving..." : "Save Jira Config"}
        </button>

        <button className="secondary-action-button jira-danger-action" disabled={saveState === "saving"} onClick={handleDelete} type="button">
          Remove Config
        </button>
      </div>

      {message ? (
        <p className={saveState === "error" ? "jira-settings-message jira-settings-message-error" : "jira-settings-message"}>
          {message}
        </p>
      ) : null}
    </section>
  );
}
