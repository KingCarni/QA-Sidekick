export const TEST_IDS = {
  qaTool: "qa-tool",
  qaOutput: "qa-output",

  toolTabTestCases: "tool-tab-test-cases",
  toolTabRiskReview: "tool-tab-risk-review",
  toolTabBugWriter: "tool-tab-bug-writer",
  toolTabTestImprover: "tool-tab-test-improver",

  projectPicker: "project-picker",
  jiraTicketInput: "jira-ticket-input",
  fetchJiraTicketButton: "fetch-jira-ticket-button",
  fetchedJiraTicketCard: "fetched-jira-ticket-card",

  chooseSourcesButton: "choose-sources-button",
  chooseSourcesPanel: "choose-sources-panel",
  selectedSourceCount: "selected-source-count",
  sourceList: "source-list",

  runTestCasesButton: "run-test-cases-button",
  runRiskReviewButton: "run-risk-review-button",
  runBugWriterButton: "run-bug-writer-button",
  runTestImproverButton: "run-test-improver-button",

  copyReportButton: "copy-report-button",
  exportMarkdownButton: "export-markdown-button",
  exportCsvButton: "export-csv-button",
  saveReportButton: "save-report-button",

  automationExportPanel: "automation-export-panel",
  downloadAutomationFilesButton: "download-automation-files-button",
  downloadMarkdownBundleButton: "download-markdown-bundle-button",
  copyAutomationBundleButton: "copy-automation-bundle-button",
  previewAutomationFilesButton: "preview-automation-files-button",

  accountSetupPanel: "account-setup-panel",
  e2eReadinessPanel: "e2e-readiness-panel",
  seedAllFixturesButton: "seed-all-fixtures-button",
} as const;

export function slugifyTestId(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function sourceOptionId(sourceTitleOrId: string) {
  return `source-option-${slugifyTestId(sourceTitleOrId)}`;
}

export function sourceCheckboxId(sourceTitleOrId: string) {
  return `source-checkbox-${slugifyTestId(sourceTitleOrId)}`;
}

export function testCaseCardId(index: number) {
  return `test-case-card-${index}`;
}

export function testCaseQualityId(index: number) {
  return `test-case-quality-${index}`;
}

export function automationFitId(index: number) {
  return `automation-fit-${index}`;
}

export function generateSkeletonId(index: number) {
  return `generate-skeleton-${index}`;
}

export function automationFitDetailsId(index: number) {
  return `automation-fit-details-${index}`;
}

export function riskCardId(index: number) {
  return `risk-card-${index}`;
}

export function bugReportSectionId(section: string) {
  return `bug-report-section-${slugifyTestId(section)}`;
}
