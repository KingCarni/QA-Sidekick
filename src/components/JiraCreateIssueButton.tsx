"use client";

import { useState } from "react";

type JiraCreateIssueButtonProps = {
  reportType: string;
  markdown: string;
  sourceInput?: string;
  structuredData?: unknown;
};

type CreateState = "idle" | "creating" | "created" | "error";

type CreateResponse = {
  ok?: boolean;
  error?: string;
  jiraIssue?: {
    key: string;
    browseUrl: string;
  };
};

export default function JiraCreateIssueButton({
  reportType,
  markdown,
  sourceInput,
  structuredData,
}: JiraCreateIssueButtonProps) {
  const [state, setState] = useState<CreateState>("idle");
  const [message, setMessage] = useState("");
  const [issueUrl, setIssueUrl] = useState("");
  const [issueKey, setIssueKey] = useState("");

  async function handleCreateIssue() {
    setState("creating");
    setMessage("");
    setIssueUrl("");
    setIssueKey("");

    try {
      const response = await fetch("/api/jira/issues/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reportType,
          markdown,
          sourceInput,
          structuredData,
        }),
      });

      const payload = (await response.json().catch(() => null)) as CreateResponse | null;

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || "Could not create Jira issue.");
      }

      setIssueKey(payload?.jiraIssue?.key ?? "");
      setIssueUrl(payload?.jiraIssue?.browseUrl ?? "");
      setMessage(payload?.jiraIssue?.key ? `Created ${payload.jiraIssue.key}.` : "Jira issue created.");
      setState("created");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not create Jira issue.");
    }
  }

  const isDisabled = state === "creating" || reportType !== "bug" || !markdown.trim();

  return (
    <div className="jira-create-issue-control">
      <button
        className="jira-create-issue-button"
        disabled={isDisabled}
        onClick={handleCreateIssue}
        type="button"
      >
        {state === "creating" ? "Creating..." : "Create Jira Issue"}
      </button>

      {message ? (
        <div className={state === "error" ? "jira-create-message jira-create-message-error" : "jira-create-message"}>
          <span>{message}</span>
          {issueUrl ? (
            <a href={issueUrl} rel="noreferrer" target="_blank">
              Open {issueKey || "Issue"}
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
