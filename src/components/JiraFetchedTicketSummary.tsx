"use client";

import type { ParsedJiraTicket } from "@/lib/jira-ticket";

type JiraFetchedTicketSummaryProps = {
  ticket: ParsedJiraTicket | null;
  onRemove?: () => void;
};

function fieldValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "Not provided.";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "Not provided.";
  return String(value);
}

export default function JiraFetchedTicketSummary({ ticket, onRemove }: JiraFetchedTicketSummaryProps) {
  if (!ticket?.key) return null;

  return (
    <section className="jira-fetched-summary-card" aria-label="Fetched Jira ticket summary">
      <div className="jira-fetched-summary-top">
        <div>
          <p className="report-kicker">Fetched Jira Ticket</p>
          <h4>{ticket.key}</h4>
        </div>

        <div className="jira-fetched-summary-actions">
          {ticket.linkedTicket?.browseUrl ? (
            <a href={ticket.linkedTicket.browseUrl} rel="noreferrer" target="_blank">
              Open Jira
            </a>
          ) : null}

          {onRemove ? (
            <button type="button" onClick={onRemove}>
              Remove
            </button>
          ) : null}
        </div>
      </div>

      <div className="jira-fetched-summary-grid">
        <div>
          <span>Summary</span>
          <strong>{fieldValue(ticket.summary)}</strong>
        </div>

        <div>
          <span>Issue Type</span>
          <strong>{fieldValue(ticket.issueType)}</strong>
        </div>

        <div>
          <span>Status</span>
          <strong>{fieldValue(ticket.status)}</strong>
        </div>

        <div>
          <span>Priority</span>
          <strong>{fieldValue(ticket.priority)}</strong>
        </div>

        <div>
          <span>Labels</span>
          <strong>{fieldValue(ticket.labels)}</strong>
        </div>

        <div>
          <span>Acceptance Criteria</span>
          <strong>{Array.isArray(ticket.acceptanceCriteria) ? ticket.acceptanceCriteria.length : 0}</strong>
        </div>
      </div>
    </section>
  );
}
