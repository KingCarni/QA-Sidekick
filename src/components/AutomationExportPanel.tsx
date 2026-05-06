"use client";

import { useMemo, useState } from "react";
import {
  buildAutomationExportBundle,
  buildAutomationExportMarkdown,
  downloadAutomationBundleAsMarkdown,
  downloadAutomationFilesIndividually,
  type AutomationExportTestCase,
} from "@/lib/automation-export";
import type { SafeAutomationCredentialProfile } from "@/lib/automation-credentials";

type AutomationExportPanelProps = {
  testCases: AutomationExportTestCase[];
  bundleName?: string;
  generationKey?: string;
  credentialProfiles?: SafeAutomationCredentialProfile[];
  defaultCredentialProfileKey?: string;
  envExample?: string;
};

type CopyState = "idle" | "copied" | "error";

export default function AutomationExportPanel({
  testCases,
  bundleName = "QAtalyst Automation Export",
  generationKey = "",
  credentialProfiles = [],
  defaultCredentialProfileKey = "",
  envExample = "",
}: AutomationExportPanelProps) {
  const [includePartial, setIncludePartial] = useState(true);
  const [includeManualReview, setIncludeManualReview] = useState(true);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [showFiles, setShowFiles] = useState(false);

  const bundle = useMemo(
    () =>
      buildAutomationExportBundle(testCases, {
        bundleName,
        includePartial,
        includeManualReview,
        credentialProfiles,
        defaultCredentialProfileKey,
        envExample,
      }),
    [bundleName, credentialProfiles, defaultCredentialProfileKey, envExample, generationKey, includeManualReview, includePartial, testCases]
  );

  if (testCases.length === 0) {
    return null;
  }

  async function handleCopyBundle(): Promise<void> {
    try {
      await navigator.clipboard.writeText(buildAutomationExportMarkdown(bundle));
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1400);
    } catch {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 1800);
    }
  }

  const exportDisabled = bundle.summary.skeletons === 0 && !includeManualReview;

  return (
    <section className="automation-export-card automation-export-card-primary" data-testid="automation-export-panel" data-generation-key={generationKey}>
      <div className="automation-export-header">
        <div>
          <p className="report-kicker">Automation Export</p>
          <h3>Export automation skeletons</h3>
          <p>
            Download Playwright/Cypress skeletons for automation-ready cases and keep manual-only cases in a review file.
          </p>
        </div>

        <div className="automation-export-score">
          <strong>{bundle.summary.skeletons}</strong>
          <span>skeletons</span>
        </div>
      </div>

      <div className="automation-export-stats">
        <div className="automation-export-stat-ready">
          <strong>{bundle.summary.ready}</strong>
          <span>Ready</span>
        </div>
        <div className="automation-export-stat-partial">
          <strong>{bundle.summary.partial}</strong>
          <span>Partial</span>
        </div>
        <div className="automation-export-stat-manual">
          <strong>{bundle.summary.manual}</strong>
          <span>Manual</span>
        </div>
        <div className="automation-export-stat-blocked">
          <strong>{bundle.summary.blocked}</strong>
          <span>Blocked</span>
        </div>
      </div>

      <div className="automation-export-substats">
        <span>{bundle.summary.total} total cases</span>
        <span>{bundle.summary.exportable} exportable cases</span>
        <span>{bundle.summary.manualReviewCases} manual-review cases</span>
      </div>

      {bundle.summary.skeletons !== bundle.summary.exportable ? (
        <div className="automation-export-warning">
          Exportable cases and skeleton files differ. QAtalyst is protecting duplicate filenames or manual-review framework cases.
        </div>
      ) : null}

      {bundle.summary.skeletons === 0 ? (
        <div className="automation-export-warning">
          No automation skeletons are currently exportable. Add clearer steps, setup, assertions, and selectors, or include manual-review export.
        </div>
      ) : null}

      <div className="automation-export-options">
        <label>
          <input
            checked={includePartial}
            onChange={(event) => setIncludePartial(event.target.checked)}
            type="checkbox"
          />
          Include partial automation candidates
        </label>

        <label>
          <input
            checked={includeManualReview}
            onChange={(event) => setIncludeManualReview(event.target.checked)}
            type="checkbox"
          />
          Include manual-review.md for manual/blocked cases
        </label>
      </div>

      <div className="automation-export-actions">
        <button disabled={exportDisabled} data-testid="download-markdown-bundle-button" type="button" onClick={() => downloadAutomationBundleAsMarkdown(bundleName, bundle)}>
          Download Markdown Bundle
        </button>

        <button disabled={exportDisabled} data-testid="download-automation-files-button" type="button" onClick={() => downloadAutomationFilesIndividually(bundle)}>
          Download Files
        </button>

        <button disabled={exportDisabled} type="button" onClick={handleCopyBundle}>
          {copyState === "copied" ? "Copied" : copyState === "error" ? "Copy Failed" : "Copy Bundle"}
        </button>

        <button type="button" data-testid="preview-automation-files-button" className="automation-export-secondary-button" onClick={() => setShowFiles((value) => !value)}>
          {showFiles ? "Hide Files" : "Preview Files"}
        </button>
      </div>

      {showFiles ? (
        <div className="automation-export-file-list">
          <p className="report-kicker">Files to export</p>
          <ul>
            {bundle.files.map((file) => (
              <li key={file.path}>
                <code>{file.path}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="automation-export-note">
        Browser-safe export. Files download locally; no backend storage or Jira write is used here.
      </p>
    </section>
  );
}
