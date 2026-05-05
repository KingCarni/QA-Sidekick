"use client";

import { useEffect, useMemo, useState } from "react";
import type { SafeQAProject } from "@/components/ProjectSettingsPanel";
import { parseJiraTicket, type ParsedJiraTicket } from "@/lib/jira-ticket";

type StackedProjectJiraControlsProps = {
  activeProject: SafeQAProject | null;
  onActiveProjectChange: (project: SafeQAProject | null) => void;
  onJiraImport: (normalizedText: string, ticket: ParsedJiraTicket) => void;
};

type ProjectsResponse = {
  ok?: boolean;
  error?: string;
  projects?: SafeQAProject[];
};

type JiraFetchResponse = {
  ok?: boolean;
  error?: string;
  issue?: {
    key: string;
    browseUrl: string;
    normalizedText: string;
    parsedTicket: ParsedJiraTicket;
  };
};

function extractJiraKeyOrUrl(value: string) {
  const trimmed = value.trim();
  const url = trimmed.match(/https?:\/\/[^\s)]+\/browse\/[A-Z][A-Z0-9]+-\d+/i)?.[0];
  if (url) return url;

  const key = trimmed.match(/\b([A-Z][A-Z0-9]+-\d+)\b/i)?.[1];
  return key?.toUpperCase() ?? "";
}

function fieldValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "Not provided.";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "Not provided.";
  return String(value);
}

export default function StackedProjectJiraControls({
  activeProject,
  onActiveProjectChange,
  onJiraImport,
}: StackedProjectJiraControlsProps) {
  const [projects, setProjects] = useState<SafeQAProject[]>([]);
  const [projectError, setProjectError] = useState("");
  const [jiraQuery, setJiraQuery] = useState("");
  const [fetchState, setFetchState] = useState<"idle" | "fetching" | "fetched" | "error">("idle");
  const [fetchMessage, setFetchMessage] = useState("");
  const [fetchedBrowseUrl, setFetchedBrowseUrl] = useState("");
  const [fetchedTicket, setFetchedTicket] = useState<ParsedJiraTicket | null>(null);

  const jiraKeyOrUrl = useMemo(() => extractJiraKeyOrUrl(jiraQuery), [jiraQuery]);
  const canFetch = Boolean(jiraKeyOrUrl) && fetchState !== "fetching";

  useEffect(() => {
    let ignore = false;

    async function loadProjects() {
      setProjectError("");

      try {
        const response = await fetch("/api/projects", { method: "GET" });
        const payload = (await response.json().catch(() => null)) as ProjectsResponse | null;

        if (!response.ok || payload?.ok === false || !payload?.projects) {
          throw new Error(payload?.error || "Could not load projects.");
        }

        if (ignore) return;

        setProjects(payload.projects);

        if (!activeProject && payload.projects.length > 0) {
          onActiveProjectChange(payload.projects[0]);
        }
      } catch (error) {
        if (!ignore) {
          setProjectError(error instanceof Error ? error.message : "Could not load projects.");
        }
      }
    }

    void loadProjects();

    return () => {
      ignore = true;
    };
  }, [activeProject, onActiveProjectChange]);

  async function handleFetchFromJira() {
    if (!canFetch) return;

    setFetchState("fetching");
    setFetchMessage("");
    setFetchedBrowseUrl("");
    setFetchedTicket(null);

    try {
      const response = await fetch(`/api/jira/issues/${encodeURIComponent(jiraKeyOrUrl)}`, {
        method: "GET",
      });

      const payload = (await response.json().catch(() => null)) as JiraFetchResponse | null;

      if (!response.ok || payload?.ok === false || !payload?.issue) {
        throw new Error(payload?.error || "Could not fetch Jira issue.");
      }

      setFetchState("fetched");
      setFetchMessage(`Fetched ${payload.issue.key}`);
      setFetchedBrowseUrl(payload.issue.browseUrl || "");
      setFetchedTicket(payload.issue.parsedTicket);
      onJiraImport(payload.issue.normalizedText, payload.issue.parsedTicket);
    } catch (error) {
      setFetchState("error");
      setFetchMessage(error instanceof Error ? error.message : "Could not fetch Jira issue.");
    }
  }

  function handleRemoveJiraSource() {
    setJiraQuery("");
    setFetchState("idle");
    setFetchMessage("");
    setFetchedBrowseUrl("");
    setFetchedTicket(null);
    onJiraImport("", parseJiraTicket(""));
  }

  return (
    <section className="stacked-source-controls" aria-label="Project and Jira source controls">
      <div className="stacked-source-field">
        <label htmlFor="stacked-project-select">Project</label>
        <select
          id="stacked-project-select"
          value={activeProject?.id ?? ""}
          onChange={(event) => {
            const selectedProject = projects.find((project) => project.id === event.target.value) ?? null;
            onActiveProjectChange(selectedProject);
          }}
        >
          {projects.length === 0 ? <option value="">No projects</option> : null}
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>

      <div className="stacked-source-field">
        <label htmlFor="stacked-jira-input">Jira Ticket</label>

        <input
          id="stacked-jira-input"
          value={jiraQuery}
          placeholder="QAS-61 or Jira URL"
          onChange={(event) => {
            setJiraQuery(event.target.value);
            setFetchState("idle");
            setFetchMessage("");
            setFetchedBrowseUrl("");
            setFetchedTicket(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void handleFetchFromJira();
            }
          }}
        />

        <button
          className="stacked-fetch-button"
          type="button"
          disabled={!canFetch}
          onClick={handleFetchFromJira}
        >
          {fetchState === "fetching" ? "Fetching..." : "Fetch Jira Ticket"}
        </button>
      </div>

      {projectError ? (
        <div className="stacked-source-status stacked-source-status-error">
          {projectError}
        </div>
      ) : null}

      {fetchMessage ? (
        <div className={fetchState === "error" ? "stacked-source-status stacked-source-status-error" : "stacked-source-status"}>
          <span>{fetchMessage}</span>

          {fetchedBrowseUrl ? (
            <a href={fetchedBrowseUrl} target="_blank" rel="noreferrer">
              Open Jira
            </a>
          ) : null}

          {fetchState === "fetched" ? (
            <button type="button" onClick={handleRemoveJiraSource}>
              Remove
            </button>
          ) : null}
        </div>
      ) : null}

      {fetchedTicket?.key ? (
        <section className="jira-fetched-summary-card" aria-label="Fetched Jira ticket summary">
          <div className="jira-fetched-summary-top">
            <div>
              <p className="report-kicker">Fetched Jira Ticket</p>
              <h4>{fetchedTicket.key}</h4>
            </div>
          </div>

          <div className="jira-fetched-summary-grid">
            <div>
              <span>Summary</span>
              <strong>{fieldValue(fetchedTicket.summary)}</strong>
            </div>

            <div>
              <span>Issue Type</span>
              <strong>{fieldValue(fetchedTicket.issueType)}</strong>
            </div>

            <div>
              <span>Status</span>
              <strong>{fieldValue(fetchedTicket.status)}</strong>
            </div>

            <div>
              <span>Priority</span>
              <strong>{fieldValue(fetchedTicket.priority)}</strong>
            </div>

            <div>
              <span>Labels</span>
              <strong>{fieldValue(fetchedTicket.labels)}</strong>
            </div>

            <div>
              <span>Acceptance Criteria</span>
              <strong>{Array.isArray(fetchedTicket.acceptanceCriteria) ? fetchedTicket.acceptanceCriteria.length : 0}</strong>
            </div>
          </div>
        </section>
      ) : null}
    </section>
  );
}
