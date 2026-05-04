"use client";

import { useState } from "react";

type JiraCreateIssueButtonProps = {
  reportType: string;
  markdown: string;
  sourceInput?: string;
  structuredData?: unknown;
  evidenceFiles?: File[];
  logText?: string;
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

type AttachmentResponse = {
  ok?: boolean;
  error?: string;
  attachments?: Array<{
    filename: string;
    ok: boolean;
  }>;
};

function createLogFile(logText: string) {
  const trimmed = logText.trim();
  if (!trimmed) return null;

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");

  return new File([trimmed], `qatalyst-bug-log-${stamp}.txt`, {
    type: "text/plain",
  });
}

export default function JiraCreateIssueButton({
  reportType,
  markdown,
  sourceInput,
  structuredData,
  evidenceFiles = [],
  logText = "",
}: JiraCreateIssueButtonProps) {
  const [state, setState] = useState<CreateState>("idle");
  const [message, setMessage] = useState("");
  const [attachmentMessage, setAttachmentMessage] = useState("");
  const [issueUrl, setIssueUrl] = useState("");
  const [issueKey, setIssueKey] = useState("");

  async function uploadAttachments(createdIssueKey: string) {
    const logFile = createLogFile(logText);
    const filesToUpload = logFile ? [...evidenceFiles, logFile] : evidenceFiles;

    if (filesToUpload.length === 0) {
      return { ok: true, uploadedCount: 0 };
    }

    const formData = new FormData();

    for (const file of filesToUpload) {
      formData.append("file", file, file.name);
    }

    const response = await fetch(`/api/jira/issues/${encodeURIComponent(createdIssueKey)}/attachments`, {
      method: "POST",
      body: formData,
    });

    const payload = (await response.json().catch(() => null)) as AttachmentResponse | null;

    if (!response.ok || payload?.ok === false) {
      throw new Error(payload?.error || "Jira issue was created, but attachment upload failed.");
    }

    return {
      ok: true,
      uploadedCount: payload?.attachments?.length ?? filesToUpload.length,
    };
  }

  async function handleCreateIssue() {
    setState("creating");
    setMessage("");
    setAttachmentMessage("");
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

      const createdIssueKey = payload?.jiraIssue?.key ?? "";
      const createdIssueUrl = payload?.jiraIssue?.browseUrl ?? "";

      setIssueKey(createdIssueKey);
      setIssueUrl(createdIssueUrl);
      setMessage(createdIssueKey ? `Created ${createdIssueKey}.` : "Jira issue created.");

      try {
        const attachmentResult = await uploadAttachments(createdIssueKey);

        if (attachmentResult.uploadedCount > 0) {
          setAttachmentMessage(`Attached ${attachmentResult.uploadedCount} evidence file(s).`);
        }
      } catch (attachmentError) {
        setAttachmentMessage(
          attachmentError instanceof Error
            ? attachmentError.message
            : "Jira issue was created, but attachment upload failed."
        );
      }

      setState("created");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not create Jira issue.");
    }
  }

  const isDisabled = state === "creating" || reportType !== "bug" || !markdown.trim();
  const buttonText =
    state === "creating"
      ? "Creating..."
      : state === "created"
        ? "Create Another Jira Issue"
        : "Create Jira Issue";

  return (
    <div className="jira-create-issue-control jira-create-issue-control-stable">
      <div className="jira-create-issue-action-row">
        <button
          className="jira-create-issue-button"
          disabled={isDisabled}
          onClick={handleCreateIssue}
          type="button"
        >
          {buttonText}
        </button>
      </div>

      {(message || attachmentMessage) ? (
        <div className="jira-create-status-stack">
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

          {attachmentMessage ? (
            <div
              className={
                attachmentMessage.toLowerCase().includes("failed")
                  ? "jira-create-message jira-create-message-error"
                  : "jira-create-message jira-attachment-message"
              }
            >
              <span>{attachmentMessage}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
