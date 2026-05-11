"use client";

import { useMemo, useState } from "react";

export type BugEvidenceState = {
  files: File[];
  logText: string;
  evidenceReference: string;
  evidenceNotes: string;
  testerNotes: string;
};

type BugEvidencePanelProps = {
  value: BugEvidenceState;
  onChange: (nextValue: BugEvidenceState) => void;
};

const MAX_FILES = 5;
const MAX_FILE_SIZE_MB = 10;

export const EMPTY_BUG_EVIDENCE: BugEvidenceState = {
  files: [],
  logText: "",
  evidenceReference: "",
  evidenceNotes: "",
  testerNotes: "",
};

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function lines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function getBugEvidenceAttachmentCount(evidence: BugEvidenceState) {
  return evidence.files.length + (evidence.logText.trim() ? 1 : 0);
}

export function formatBugEvidenceForReport(evidence: BugEvidenceState) {
  const sections: string[] = [];
  const attachmentLines: string[] = [];

  for (const file of evidence.files) {
    attachmentLines.push(`- ${file.name} (${formatBytes(file.size)})`);
  }

  if (evidence.logText.trim()) {
    attachmentLines.push("- Pasted log output attached as a text file.");
  }

  if (evidence.evidenceReference.trim()) {
    attachmentLines.push(`- Reference: ${evidence.evidenceReference.trim()}`);
  }

  sections.push("Evidence");
  sections.push(attachmentLines.length > 0 ? attachmentLines.join("\n") : "- No evidence attached or referenced.");

  if (evidence.evidenceNotes.trim()) {
    sections.push("");
    sections.push("Evidence Notes");
    sections.push(lines(evidence.evidenceNotes).map((line) => `- ${line}`).join("\n"));
  }

  if (evidence.testerNotes.trim()) {
    sections.push("");
    sections.push("Additional Tester Notes");
    sections.push(lines(evidence.testerNotes).map((line) => `- ${line}`).join("\n"));
  }

  if (evidence.logText.trim()) {
    const previewLines = lines(evidence.logText).slice(0, 8);
    sections.push("");
    sections.push("Relevant Log Findings");
    sections.push(previewLines.map((line) => `- ${line}`).join("\n"));

    if (lines(evidence.logText).length > previewLines.length) {
      sections.push("- Log output truncated in report preview; full pasted log is attached.");
    }
  }

  return sections.join("\n").trim();
}

export function appendBugEvidenceToMarkdown(markdown: string, evidence: BugEvidenceState) {
  const cleanMarkdown = markdown.trim();
  const evidenceMarkdown = formatBugEvidenceForReport(evidence);

  if (!cleanMarkdown) return evidenceMarkdown;

  const withoutOldEvidence = cleanMarkdown
    .replace(/\n+Evidence\s*\n(?:- .*(?:\n|$)|No evidence attached or referenced\.)+/i, "")
    .replace(/\n+Evidence \/ Attachments\s*\n(?:- .*(?:\n|$)|No evidence attached or referenced\.)+/i, "")
    .trim();

  return `${withoutOldEvidence}\n\n${evidenceMarkdown}`.trim();
}

export default function BugEvidencePanel({ value, onChange }: BugEvidencePanelProps) {
  const [error, setError] = useState("");

  const attachmentCount = useMemo(() => getBugEvidenceAttachmentCount(value), [value]);

  function handleFilesSelected(selectedFiles: FileList | null) {
    setError("");

    if (!selectedFiles) return;

    const incoming = Array.from(selectedFiles);
    const combined = [...value.files, ...incoming];

    if (combined.length > MAX_FILES) {
      setError(`Attach up to ${MAX_FILES} files for this MVP pass.`);
      return;
    }

    const oversized = combined.find((file) => file.size > MAX_FILE_SIZE_MB * 1024 * 1024);
    if (oversized) {
      setError(`${oversized.name} is too large. Max file size is ${MAX_FILE_SIZE_MB}MB.`);
      return;
    }

    onChange({
      ...value,
      files: combined,
    });
  }

  function removeFile(indexToRemove: number) {
    onChange({
      ...value,
      files: value.files.filter((_, index) => index !== indexToRemove),
    });
  }

  return (
    <section className="bug-evidence-panel bug-evidence-panel-old-slot">
      <div className="bug-evidence-header">
        <div>
          <p className="report-kicker">Screenshots and Logs</p>
          <h3>Evidence</h3>
          <p>Attach evidence to the Jira bug after QAtalyst creates the issue.</p>
        </div>

        <span className="bug-evidence-count">{attachmentCount} selected</span>
      </div>

      <label className="bug-evidence-file-picker bug-evidence-upload-card">
        <span>Add screenshots/files</span>
        <input
          accept=".png,.jpg,.jpeg,.webp,.gif,.txt,.log,.csv,.json,.pdf,.zip,image/png,image/jpeg,image/webp,image/gif,text/plain,text/csv,application/json,application/pdf,application/zip"
          multiple
          onChange={(event) => handleFilesSelected(event.target.files)}
          type="file"
        />
        <small>PNG, JPG, WEBP, GIF, TXT, LOG, CSV, JSON, PDF, or ZIP. Up to 5 files.</small>
      </label>

      {value.files.length > 0 ? (
        <ul className="bug-evidence-file-list">
          {value.files.map((file, index) => (
            <li key={`${file.name}-${file.size}-${index}`}>
              <span>
                <strong>{file.name}</strong>
                <small>{formatBytes(file.size)}</small>
              </span>

              <button onClick={() => removeFile(index)} type="button">
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <label className="bug-evidence-text-label">
        <span>Evidence link or file reference</span>
        <input
          onChange={(event) =>
            onChange({
              ...value,
              evidenceReference: event.target.value,
            })
          }
          
          value={value.evidenceReference}
        />
      </label>

      <label className="bug-evidence-log-label">
        <span>Evidence notes</span>
        <textarea
          onChange={(event) =>
            onChange({
              ...value,
              evidenceNotes: event.target.value,
            })
          }
            value={value.evidenceNotes}
        />
      </label>

      <label className="bug-evidence-log-label">
        <span>Paste logs or console output</span>
        <textarea
          onChange={(event) =>
            onChange({
              ...value,
              logText: event.target.value,
            })
          }
          
          value={value.logText}
        />
      </label>

      <label className="bug-evidence-log-label">
        <span>Additional tester notes</span>
        <textarea
          onChange={(event) =>
            onChange({
              ...value,
              testerNotes: event.target.value,
            })
          }
          
          value={value.testerNotes}
        />
      </label>

      {error ? <p className="bug-evidence-error">{error}</p> : null}

      <p className="bug-evidence-note">
        
      </p>
    </section>
  );
}
