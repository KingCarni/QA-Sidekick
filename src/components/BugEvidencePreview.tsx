"use client";

import { useEffect, useMemo, useState } from "react";
import type { BugEvidenceState } from "@/components/BugEvidencePanel";

type BugEvidencePreviewProps = {
  evidence: BugEvidenceState;
};

type ImagePreview = {
  name: string;
  url: string;
  size: number;
};

function isImageFile(file: File) {
  return file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(file.name);
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function splitLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function BugEvidencePreview({ evidence }: BugEvidencePreviewProps) {
  const [imagePreviews, setImagePreviews] = useState<ImagePreview[]>([]);

  const nonImageFiles = useMemo(() => evidence.files.filter((file) => !isImageFile(file)), [evidence.files]);
  const logLines = useMemo(() => splitLines(evidence.logText).slice(0, 8), [evidence.logText]);
  const evidenceNoteLines = useMemo(() => splitLines(evidence.evidenceNotes).slice(0, 8), [evidence.evidenceNotes]);
  const testerNoteLines = useMemo(() => splitLines(evidence.testerNotes).slice(0, 8), [evidence.testerNotes]);

  useEffect(() => {
    const nextPreviews = evidence.files
      .filter(isImageFile)
      .map((file) => ({
        name: file.name,
        size: file.size,
        url: URL.createObjectURL(file),
      }));

    setImagePreviews(nextPreviews);

    return () => {
      for (const preview of nextPreviews) {
        URL.revokeObjectURL(preview.url);
      }
    };
  }, [evidence.files]);

  const selectedCount = evidence.files.length + (evidence.logText.trim() ? 1 : 0);

  const hasEvidence =
    imagePreviews.length > 0 ||
    nonImageFiles.length > 0 ||
    evidence.logText.trim() ||
    evidence.evidenceReference.trim() ||
    evidence.evidenceNotes.trim() ||
    evidence.testerNotes.trim();

  if (!hasEvidence) return null;

  return (
    <section className="bug-evidence-preview-card bug-evidence-preview-card-bottom">
      <div className="bug-evidence-preview-header">
        <div>
          <p className="report-kicker">Evidence Preview</p>
          <h3>Screenshots and logs</h3>
          <p>These files will be attached to the Jira issue after it is created.</p>
        </div>

        <span>{selectedCount} selected</span>
      </div>

      {imagePreviews.length > 0 ? (
        <div className="bug-evidence-image-list">
          {imagePreviews.map((preview) => (
            <figure className="bug-evidence-image-preview" key={`${preview.name}-${preview.size}-${preview.url}`}>
              <div className="bug-evidence-image-frame">
                <img alt={preview.name} src={preview.url} />
              </div>

              <figcaption>
                <strong>{preview.name}</strong>
                <small>{formatBytes(preview.size)}</small>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}

      {nonImageFiles.length > 0 ? (
        <div className="bug-evidence-preview-section">
          <h4>Files</h4>
          <ul>
            {nonImageFiles.map((file) => (
              <li key={`${file.name}-${file.size}`}>
                {file.name} <span>{formatBytes(file.size)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {evidence.evidenceReference.trim() ? (
        <div className="bug-evidence-preview-section">
          <h4>Reference</h4>
          <p>{evidence.evidenceReference.trim()}</p>
        </div>
      ) : null}

      {evidenceNoteLines.length > 0 ? (
        <div className="bug-evidence-preview-section">
          <h4>Evidence notes</h4>
          <ul>
            {evidenceNoteLines.map((line, index) => (
              <li key={`${line}-${index}`}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {logLines.length > 0 ? (
        <div className="bug-evidence-preview-section">
          <h4>Log preview</h4>
          <pre>{logLines.join("\n")}</pre>
        </div>
      ) : null}

      {testerNoteLines.length > 0 ? (
        <div className="bug-evidence-preview-section">
          <h4>Tester notes</h4>
          <ul>
            {testerNoteLines.map((line, index) => (
              <li key={`${line}-${index}`}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
