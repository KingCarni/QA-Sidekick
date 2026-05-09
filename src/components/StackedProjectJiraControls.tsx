"use client";

import { useMemo, useState } from "react";
import { parseJiraTicket, type ParsedJiraTicket } from "@/lib/jira-ticket";
import { normalizeJiraErrorMessage } from "@/lib/jira-error-normalizer";

type StackedProjectJiraControlsProps = {
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

function fieldValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "Not provided.";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "Not provided.";
  return String(value);
}

export default function StackedProjectJiraControls({ onJiraImport }: StackedProjectJiraControlsProps) {
  const [jiraQuery, setJiraQuery] = useState("");
  const [fetchState, setFetchState] = useState<"idle" | "fetching" | "fetched" | "error">("idle");
  const [fetchMessage, setFetchMessage] = useState("");
  const [fetchedBrowseUrl, setFetchedBrowseUrl] = useState("");
  const [fetchedTicket, setFetchedTicket] = useState<ParsedJiraTicket | null>(null);

  const jiraKeyOrUrl = useMemo(() => extractJiraKeyOrUrl(jiraQuery), [jiraQuery]);
  const canFetch = Boolean(jiraKeyOrUrl) && fetchState !== "fetching";

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
      setFetchMessage(normalizeJiraErrorMessage(error, "Could not fetch Jira issue."));
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
    <section className="stacked-source-controls stacked-jira-only-controls" aria-label="Jira source controls">
      <div className="stacked-source-field">
        <label htmlFor="stacked-jira-input">Jira Ticket</label>

        <div className="jira-fetch-inline-row">
          <input
            id="stacked-jira-input"
            data-testid="jira-ticket-input"
            value={jiraQuery}
            placeholder="Ticket key or Jira URL"
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
            data-testid="fetch-jira-ticket-button"
            type="button"
            disabled={!canFetch}
            onClick={handleFetchFromJira}
          >
            {fetchState === "fetching" ? "Fetching..." : "Fetch Jira Ticket"}
          </button>
        </div>
      </div>

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
        <section className="jira-fetched-summary-card" data-testid="fetched-jira-ticket-card" aria-label="Fetched Jira ticket summary">
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
              <span>Source Detail</span>
              <strong>
                {fetchedTicket.description && fetchedTicket.description !== "Not provided."
                  ? "Description found"
                  : "Description missing"}
              </strong>
            </div>
          </div>
        </section>
      ) : null}
    </section>
  );
}
