"use client";

import { useMemo, useState } from "react";
import ProjectPicker from "@/components/ProjectPicker";
import type { SafeQAProject } from "@/components/ProjectSettingsPanel";
import { parseJiraTicket, type ParsedJiraTicket } from "@/lib/jira-ticket";

type CompactProjectJiraControlsProps = {
  activeProject: SafeQAProject | null;
  onActiveProjectChange: (project: SafeQAProject | null) => void;
  onJiraImport: (normalizedText: string, ticket: ParsedJiraTicket) => void;
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

export default function CompactProjectJiraControls({
  activeProject,
  onActiveProjectChange,
  onJiraImport,
}: CompactProjectJiraControlsProps) {
  const [jiraQuery, setJiraQuery] = useState("");
  const [fetchedTicket, setFetchedTicket] = useState<ParsedJiraTicket | null>(null);
  const [fetchState, setFetchState] = useState<"idle" | "fetching" | "fetched" | "error">("idle");
  const [fetchMessage, setFetchMessage] = useState("");

  const jiraKeyOrUrl = useMemo(() => extractJiraKeyOrUrl(jiraQuery), [jiraQuery]);
  const canFetch = Boolean(jiraKeyOrUrl) && fetchState !== "fetching";

  async function handleFetchFromJira() {
    if (!canFetch) return;

    setFetchState("fetching");
    setFetchMessage("");
    setFetchedTicket(null);

    try {
      const response = await fetch(`/api/jira/issues/${encodeURIComponent(jiraKeyOrUrl)}`, {
        method: "GET",
      });

      const payload = (await response.json().catch(() => null)) as JiraFetchResponse | null;

      if (!response.ok || payload?.ok === false || !payload?.issue) {
        throw new Error(payload?.error || "Could not fetch Jira issue.");
      }

      setFetchedTicket(payload.issue.parsedTicket);
      setFetchState("fetched");
      setFetchMessage(`Fetched ${payload.issue.key}`);
      onJiraImport(payload.issue.normalizedText, payload.issue.parsedTicket);
    } catch (error) {
      setFetchState("error");
      setFetchMessage(error instanceof Error ? error.message : "Could not fetch Jira issue.");
    }
  }

  function handleClearJiraSource() {
    setJiraQuery("");
    setFetchedTicket(null);
    setFetchState("idle");
    setFetchMessage("");
    onJiraImport("", parseJiraTicket(""));
  }

  return (
    <section className="compact-source-controls compact-source-controls-polished" aria-label="Project and Jira source controls">
      <div className="compact-control-card compact-control-card-project">
        <p className="compact-control-label">Project</p>

        <div className="compact-project-picker-wrap">
          <ProjectPicker
            activeProjectId={activeProject?.id}
            onActiveProjectChange={onActiveProjectChange}
          />
        </div>
      </div>

      <div className="compact-control-card compact-control-card-jira">
        <p className="compact-control-label">Jira Ticket</p>

        <input
          id="compact-jira-ticket-input"
          onChange={(event) => {
            setJiraQuery(event.target.value);
            setFetchedTicket(null);
            setFetchState("idle");
            setFetchMessage("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void handleFetchFromJira();
            }
          }}
          placeholder="QAS-61"
          value={jiraQuery}
        />

        <button
          className="compact-jira-fetch-button"
          disabled={!canFetch}
          onClick={handleFetchFromJira}
          type="button"
        >
          {fetchState === "fetching" ? "Fetching..." : "Fetch Jira Ticket"}
        </button>
      </div>

      {fetchMessage ? (
        <div
          className={
            fetchState === "error"
              ? "compact-source-status compact-source-status-error"
              : "compact-source-status"
          }
        >
          <span>{fetchMessage}</span>

          {fetchedTicket?.key ? (
            <>
              {fetchedTicket.linkedTicket?.browseUrl ? (
                <a href={fetchedTicket.linkedTicket.browseUrl} rel="noreferrer" target="_blank">
                  Open {fetchedTicket.key}
                </a>
              ) : null}

              <button onClick={handleClearJiraSource} type="button">
                Remove
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
