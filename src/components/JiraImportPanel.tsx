"use client";

import { useMemo, useState } from "react";
import { getJiraImportSummary, parseJiraTicket, type ParsedJiraTicket } from "@/lib/jira-ticket";

type JiraImportPanelProps = {
  onImport: (normalizedText: string, ticket: ParsedJiraTicket) => void;
  isVisible?: boolean;
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

function getFetchedTicketUrl(ticket: ParsedJiraTicket | null) {
  return ticket?.linkedTicket?.browseUrl || "";
}

export default function JiraImportPanel({ onImport, isVisible = true }: JiraImportPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [jiraQuery, setJiraQuery] = useState("");
  const [fetchedTicket, setFetchedTicket] = useState<ParsedJiraTicket | null>(null);
  const [fetchState, setFetchState] = useState<"idle" | "fetching" | "fetched" | "error">("idle");
  const [fetchMessage, setFetchMessage] = useState("");

  const parsed = useMemo(() => fetchedTicket ?? parseJiraTicket(""), [fetchedTicket]);
  const jiraKeyOrUrl = useMemo(() => extractJiraKeyOrUrl(jiraQuery), [jiraQuery]);
  const canFetch = Boolean(jiraKeyOrUrl) && fetchState !== "fetching";
  const hasFetchedTicket = fetchState === "fetched" && Boolean(fetchedTicket?.key);

  if (!isVisible) {
    return null;
  }

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
      setFetchMessage(`Fetched ${payload.issue.key} from Jira.`);
      onImport(payload.issue.normalizedText, payload.issue.parsedTicket);
    } catch (error) {
      setFetchState("error");
      setFetchMessage(error instanceof Error ? error.message : "Could not fetch Jira issue.");
    }
  }

  function handleClearSource() {
    setJiraQuery("");
    setFetchedTicket(null);
    setFetchState("idle");
    setFetchMessage("");
    onImport("", parseJiraTicket(""));
  }

  return (
    <section className="jira-import-panel jira-source-fetch-only">
      <div className="jira-import-header jira-source-clean-header">
        <div>
          <p className="report-kicker">Jira Source</p>
          <h3>Fetch Jira ticket</h3>
        </div>

        <button className="secondary-action-button jira-import-toggle" onClick={() => setIsOpen((value) => !value)} type="button">
          {isOpen ? "Hide Source" : "Add Jira Source"}
        </button>
      </div>

      {isOpen ? (
        <div className="jira-import-body">
          <div className="jira-fetch-row jira-fetch-row-clean">
            <input
              className="jira-fetch-input"
              onChange={(event) => {
                setJiraQuery(event.target.value);
                setFetchedTicket(null);
                setFetchState("idle");
                setFetchMessage("");
              }}
              placeholder="Jira issue URL"
              value={jiraQuery}
            />

            <button className="jira-fetch-button" disabled={!canFetch} onClick={handleFetchFromJira} type="button">
              {fetchState === "fetching" ? "Fetching..." : "Fetch"}
            </button>
          </div>

          {fetchMessage ? (
            <p className={fetchState === "error" ? "jira-fetch-message jira-fetch-message-error" : "jira-fetch-message"}>
              {fetchMessage}
            </p>
          ) : null}

          {hasFetchedTicket ? (
            <div className="jira-import-preview jira-import-preview-compact jira-import-preview-fetched">
              <div className="jira-import-preview-top jira-import-preview-top-no-pill">
                <div>
                  <p className="report-kicker">Parsed Jira Source</p>
                  <strong>{getJiraImportSummary(parsed)}</strong>
                </div>
              </div>

              <div className="jira-linked-mini-row">
                {getFetchedTicketUrl(parsed) ? (
                  <a className="linked-jira-ticket-mini" href={getFetchedTicketUrl(parsed)} rel="noreferrer" target="_blank">
                    Go to {parsed.key || "Jira ticket"}
                  </a>
                ) : null}

                <button className="jira-clear-source-button" onClick={handleClearSource} type="button">
                  Remove Source
                </button>
              </div>

              <dl className="jira-import-fields">
                <div>
                  <dt>Key</dt>
                  <dd>{parsed.key || "Not found"}</dd>
                </div>
                <div>
                  <dt>Summary</dt>
                  <dd>{parsed.summary || "Not found"}</dd>
                </div>
                <div>
                  <dt>Issue Type</dt>
                  <dd>{parsed.issueType || "Not found"}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{parsed.status || "Not found"}</dd>
                </div>
                <div>
                  <dt>Priority</dt>
                  <dd>{parsed.priority || "Not found"}</dd>
                </div>
                <div>
                  <dt>Labels</dt>
                  <dd>{parsed.labels.length ? parsed.labels.join(", ") : "Not found"}</dd>
                </div>
                <div>
                  <dt>Acceptance Criteria</dt>
                  <dd>{parsed.acceptanceCriteria.length}</dd>
                </div>
                <div>
                  <dt>Assignee</dt>
                  <dd>{parsed.assignee || "Not found"}</dd>
                </div>
              </dl>

              {parsed.missingFields.length > 0 ? (
                <div className="jira-import-warning">
                  <strong>Missing fields:</strong> {parsed.missingFields.join(", ")}
                </div>
              ) : null}

              <p className="jira-import-success">
                Imported {parsed.key || "Jira source"} into the active QA tool.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
