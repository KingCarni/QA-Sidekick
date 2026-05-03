"use client";

import { useMemo, useState } from "react";
import { getJiraImportSummary, parseJiraTicket, type ParsedJiraTicket } from "@/lib/jira-ticket";

type JiraImportPanelProps = {
  onImport: (normalizedText: string, ticket: ParsedJiraTicket) => void;
  isVisible?: boolean;
};

export default function JiraImportPanel({ onImport, isVisible = true }: JiraImportPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [jiraText, setJiraText] = useState("");
  const [lastImported, setLastImported] = useState<ParsedJiraTicket | null>(null);

  const parsed = useMemo(() => parseJiraTicket(jiraText), [jiraText]);
  const hasInput = jiraText.trim().length > 0;
  const canImport = hasInput && Boolean(parsed.normalizedText.trim());

  if (!isVisible) {
    return null;
  }

  function handleImport() {
    if (!canImport) return;

    setLastImported(parsed);
    onImport(parsed.normalizedText, parsed);
  }

  return (
    <section className="jira-import-panel">
      <div className="jira-import-header">
        <div>
          <p className="report-kicker">Jira Source</p>
          <h3>Link or paste a Jira ticket</h3>
          <p>Paste a Jira URL or copied ticket text. Full Jira field sync comes in the next integration pass.</p>
        </div>

        <button className="secondary-action-button jira-import-toggle" onClick={() => setIsOpen((value) => !value)} type="button">
          {isOpen ? "Hide Import" : "Add Jira Source"}
        </button>
      </div>

      {isOpen ? (
        <div className="jira-import-body">
          <textarea
            className="jira-import-textarea"
            onChange={(event) => setJiraText(event.target.value)}
            placeholder="Paste a Jira URL like https://yourcompany.atlassian.net/browse/QAS-29 or paste copied Jira ticket text..."
            value={jiraText}
          />

          <div className="jira-import-preview">
            <div className="jira-import-preview-top">
              <div>
                <p className="report-kicker">Parsed Jira Source</p>
                <strong>{hasInput ? getJiraImportSummary(parsed) : "Waiting for Jira URL or ticket text..."}</strong>
              </div>

              <span className={`jira-confidence-pill jira-confidence-${parsed.confidence}`}>
                {hasInput ? parsed.confidence : "idle"}
              </span>
            </div>

            {parsed.linkedTicket ? (
              <div className="linked-jira-ticket-card">
                <div>
                  <p className="report-kicker">Linked by URL</p>
                  <strong>{parsed.linkedTicket.key}</strong>
                  <span>QAtalyst has the Jira link. Paste the full ticket body for richer analysis until live sync is added.</span>
                </div>

                <a href={parsed.linkedTicket.browseUrl} rel="noreferrer" target="_blank">
                  Open in Jira
                </a>
              </div>
            ) : null}

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
                <dt>Priority</dt>
                <dd>{parsed.priority || "Not found"}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{parsed.status || "Not found"}</dd>
              </div>
              <div>
                <dt>Labels</dt>
                <dd>{parsed.labels.length ? parsed.labels.join(", ") : "Not found"}</dd>
              </div>
              <div>
                <dt>Acceptance Criteria</dt>
                <dd>{parsed.acceptanceCriteria.length}</dd>
              </div>
            </dl>

            {hasInput && parsed.missingFields.length > 0 ? (
              <div className="jira-import-warning">
                <strong>Missing fields:</strong> {parsed.missingFields.join(", ")}
              </div>
            ) : null}

            {hasInput ? (
              <details className="jira-normalized-preview">
                <summary>Preview normalized Jira source</summary>
                <pre>{parsed.normalizedText}</pre>
              </details>
            ) : null}

            <div className="jira-import-actions jira-import-actions-single">
              <button className="copy-all-button" disabled={!canImport} onClick={handleImport} type="button">
                Use Jira Source
              </button>
            </div>

            {lastImported ? (
              <p className="jira-import-success">
                Imported {lastImported.key || "Jira source"} into the active QA tool.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
