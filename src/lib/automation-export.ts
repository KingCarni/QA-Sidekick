"use client";

import {
  evaluateAutomationReadinessCase,
  getAutomationCaseTextFromObject,
  type AutomationReadinessCase,
  type AutomationReadinessLevel,
} from "@/lib/automation-readiness";
import { generateAutomationSkeleton } from "@/lib/automation-codegen";
import type { SafeAutomationCredentialProfile } from "@/lib/automation-credentials";
import { validateGeneratedSelectors } from "@/lib/selector-validation";
import {
  buildAutomationEnvExample,
  normalizeAutomationProjectConfig,
  type AutomationProjectConfig,
} from "@/lib/automation-project-config";

export type AutomationExportTestCase = {
  title?: unknown;
  type?: unknown;
  preconditions?: unknown;
  steps?: unknown;
  expectedResult?: unknown;
  priority?: unknown;
};

export type AutomationExportFile = {
  path: string;
  content: string;
  type: "playwright" | "cypress" | "manual" | "readme";
};

export type AutomationExportEvaluatedCase = {
  index: number;
  testCase: AutomationExportTestCase;
  readiness: AutomationReadinessCase;
  exportable: boolean;
  exportReason: string;
};

export type AutomationExportBundle = {
  files: AutomationExportFile[];
  evaluatedCases: AutomationExportEvaluatedCase[];
  summary: {
    total: number;
    skeletons: number;
    exportable: number;
    ready: number;
    partial: number;
    manual: number;
    blocked: number;
    manualReviewCases: number;
  };
};

function safeString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map((item: unknown) => safeString(item)).join(", ");
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function normalizeSteps(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item: unknown) => safeString(item).trim()).filter(Boolean);
  }

  return safeString(value)
    .split(/\r?\n+/)
    .map((line: string) => line.replace(/^\d+[.)]\s*/, "").trim())
    .filter(Boolean);
}

function normalizeTitle(value: unknown, index: number): string {
  const rawTitle = safeString(value).trim();

  if (!rawTitle || rawTitle === "Not specified.") {
    return `Test Case ${index + 1}`;
  }

  return rawTitle;
}

function uniquifyPath(path: string, usedPaths: Set<string>, index: number): string {
  if (!usedPaths.has(path)) {
    usedPaths.add(path);
    return path;
  }

  const dotIndex = path.lastIndexOf(".");
  const suffix = `-${index + 1}`;
  const candidate =
    dotIndex > -1 ? `${path.slice(0, dotIndex)}${suffix}${path.slice(dotIndex)}` : `${path}${suffix}`;

  if (!usedPaths.has(candidate)) {
    usedPaths.add(candidate);
    return candidate;
  }

  let attempt = 2;
  while (usedPaths.has(`${candidate}-${attempt}`)) {
    attempt += 1;
  }

  const fallback = `${candidate}-${attempt}`;
  usedPaths.add(fallback);
  return fallback;
}

function buildManualReviewCase(
  testCase: AutomationExportTestCase,
  index: number,
  readiness: AutomationReadinessCase,
  reason: string
): string {
  const title = normalizeTitle(testCase.title, index);
  const steps = normalizeSteps(testCase.steps);

  return [
    `## ${index + 1}. ${title}`,
    "",
    `Type: ${safeString(testCase.type) || "Not specified."}`,
    `Priority: ${safeString(testCase.priority) || "Not specified."}`,
    `Automation status: ${readiness.readiness}`,
    `Readiness score: ${readiness.score}/100`,
    `Reason: ${reason}`,
    "",
    "### Before Coding",
    ...(readiness.missingInputs.length
      ? readiness.missingInputs.map((item: string) => `- ${item}`)
      : ["- No major missing inputs detected."]),
    "",
    "### Preconditions",
    safeString(testCase.preconditions) || "Not specified.",
    "",
    "### Steps",
    ...(steps.length ? steps.map((step: string, stepIndex: number) => `${stepIndex + 1}. ${step}`) : ["1. Not specified."]),
    "",
    "### Expected Result",
    safeString(testCase.expectedResult) || "Not specified.",
    "",
  ].join("\n");
}

function buildReadme(
  bundleName: string,
  bundle: Omit<AutomationExportBundle, "files"> & { files: AutomationExportFile[] },
  options?: { projectConfig?: AutomationProjectConfig; exportMode?: "user-project" | "qatalyst-dogfood" }
): string {
  const playwrightFiles = bundle.files.filter((file: AutomationExportFile) => file.type === "playwright");
  const cypressFiles = bundle.files.filter((file: AutomationExportFile) => file.type === "cypress");
  const manualFiles = bundle.files.filter((file: AutomationExportFile) => file.type === "manual");
  const selectorWarnings = bundle.files
    .filter((file: AutomationExportFile) => file.path.endsWith(".ts"))
    .flatMap((file: AutomationExportFile) =>
      validateGeneratedSelectors(file.content).map((issue) => `- \`${file.path}\`: ${issue.message}`)
    );

  const config = options?.projectConfig;
  const userProject = (options?.exportMode ?? "user-project") === "user-project";

  return [
    `# ${bundleName}`,
    "",
    userProject ? "Generated automation bundle for your project." : "Generated by QAtalyst.",
    "",
    "This export contains automation-ready skeletons and a manual review file for cases that are not safe to automate yet.",
    "",
    "## Summary",
    "",
    `- Total cases: ${bundle.summary.total}`,
    `- Exportable cases: ${bundle.summary.exportable}`,
    `- Skeleton files: ${bundle.summary.skeletons}`,
    `- Ready: ${bundle.summary.ready}`,
    `- Partial: ${bundle.summary.partial}`,
    `- Manual: ${bundle.summary.manual}`,
    `- Blocked: ${bundle.summary.blocked}`,
    `- Manual review cases: ${bundle.summary.manualReviewCases}`,
    "",
    "## Files",
    "",
    ...(playwrightFiles.length ? ["### Playwright", "", ...playwrightFiles.map((file: AutomationExportFile) => `- \`${file.path}\``), ""] : []),
    ...(cypressFiles.length ? ["### Cypress", "", ...cypressFiles.map((file: AutomationExportFile) => `- \`${file.path}\``), ""] : []),
    ...(manualFiles.length ? ["### Manual Review", "", ...manualFiles.map((file: AutomationExportFile) => `- \`${file.path}\``), ""] : []),
    ...(selectorWarnings.length
      ? [
          "## Selector Warnings",
          "",
          "QAtalyst detected unstable selector patterns in this generated spec. Prefer adding data-testid hooks and regenerating the skeleton.",
          "",
          ...selectorWarnings,
          "",
        ]
      : []),
    "## Before running generated tests",
    "",
    "- Install Playwright: `npm install -D @playwright/test` and `npx playwright install chromium`.",
    "- Use a Playwright config with `baseURL` pointed at your running app.",
    "- Fill env vars locally only. Never commit real secrets.",
    `- App route: \`${config?.appRoute ?? "APP_ROUTE"}\`.`,
    `- Login route: \`${config?.loginRoute ?? "LOGIN_ROUTE"}\`.`,
    `- Project fixture: \`${config?.projectFixtureName ?? "YOUR_PROJECT_FIXTURE"}\`.`,
    `- Source fixture: \`${config?.sourceFixtureName ?? "YOUR_SOURCE_FIXTURE"}\`.`,
    "- Ensure the app has the expected project/source fixture.",
    "- If selectors fail, add/update the data-testid hooks expected by `tests/support/app.ts`.",
    "",
    "## Selector contract",
    "",
    "- `qa-tool`",
    "- `qa-output`",
    "- `project-picker`",
    "- `choose-sources-button`",
    "- `choose-sources-panel`",
    "- `selected-source-count`",
    "- `source-checkbox-[slug]`",
    "- `jira-ticket-input`",
    "- `fetch-jira-ticket-button`",
    "- `run-test-cases-button`",
    "- `test-case-card-[number]`",
    "- `automation-fit-[number]`",
    "- `automation-export-panel`",
    "",
    "## QA Note",
    "",
    "These are code skeletons, not final automation. Confirm selectors, seed data, auth setup, routes, mocks, and assertions before treating them as runnable tests.",
    "",
  ].join("\n");
}

function buildAppFixture(): string {
  return [
    `import { expect, Page } from "@playwright/test";`,
    `import { loginAs } from "./auth";`,
    "",
    "export type OpenQAToolOptions = {",
    "  profileKey?: string;",
    "  projectName?: string;",
    "  requireAuth?: boolean;",
    "};",
    "",
    "function slugifyForTestId(value: string): string {",
    "  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');",
    "}",
    "",
    "export async function openQATool(page: Page, options: OpenQAToolOptions = {}) {",
    "  const { profileKey = 'standard-user', requireAuth = true } = options;",
    "  if (requireAuth) await loginAs(page, profileKey);",
    "  await page.goto('/app');",
    "  await expect(page.getByTestId('qa-tool')).toBeVisible();",
    "  if (options.projectName) await selectProject(page, options.projectName);",
    "}",
    "",
    "export async function selectProject(page: Page, projectName: string) {",
    "  const picker = page.getByTestId('project-picker');",
    "  await expect(picker).toBeVisible();",
    "  await picker.selectOption({ label: projectName });",
    "}",
    "",
    "export async function openChooseSourcesPanel(page: Page) {",
    "  await page.getByTestId('choose-sources-button').click();",
    "  await expect(page.getByTestId('choose-sources-panel')).toBeVisible();",
    "}",
    "",
    "export async function sourceCheckbox(page: Page, sourceName: string) {",
    "  const byTestId = page.getByTestId(`source-checkbox-${slugifyForTestId(sourceName)}`);",
    "  if (await byTestId.count()) return byTestId;",
    "  return page.getByRole('checkbox', { name: sourceName });",
    "}",
    "",
    "export async function expectSourceVisible(page: Page, sourceName: string) {",
    "  const checkbox = await sourceCheckbox(page, sourceName);",
    "  await expect(checkbox).toBeVisible();",
    "  return checkbox;",
    "}",
    "",
    "export async function getSelectedSourceCount(page: Page): Promise<number | null> {",
    "  const countText = await page.getByTestId('selected-source-count').textContent().catch(() => null);",
    "  const match = countText?.match(/\\d+/);",
    "  return match ? Number(match[0]) : null;",
    "}",
    "",
    "export async function expectSelectedSourceCount(page: Page, expectedCount: number) {",
    "  await expect(page.getByTestId('selected-source-count')).toContainText(String(expectedCount));",
    "}",
  ].join("\n");
}

function buildUserProjectAppFixture(): string {
  return [
    `import { expect, Page } from "@playwright/test";`,
    `import { loginAs } from "./auth";`,
    "",
    "export type OpenUserProjectOptions = {",
    "  profileKey?: string;",
    "  requireAuth?: boolean;",
    "};",
    "",
    `const APP_ROUTE = process.env.APP_ROUTE || "APP_ROUTE";`,
    `const POST_LOGIN_ROUTE = process.env.POST_LOGIN_ROUTE || "POST_LOGIN_ROUTE";`,
    "",
    "export async function openUserProject(page: Page, options: OpenUserProjectOptions = {}) {",
    `  const { profileKey = "standard-user", requireAuth = true } = options;`,
    "  if (requireAuth) {",
    "    await loginAs(page, profileKey);",
    `    if (POST_LOGIN_ROUTE !== "POST_LOGIN_ROUTE") await expect(page).toHaveURL(new RegExp(POST_LOGIN_ROUTE));`,
    "    return;",
    "  }",
    "  await page.goto(APP_ROUTE);",
    "}",
    "",
    "export function stableSelector(page: Page, testId: string) {",
    "  return page.getByTestId(testId);",
    "}",
    "",
    "export async function expectStableVisible(page: Page, testId: string) {",
    "  await expect(page.getByTestId(testId)).toBeVisible();",
    "}",
  ].join("\n");
}

function buildUserProjectAuthFixture(): string {
  return [
    `import { expect, type Page } from "@playwright/test";`,
    "",
    `type AuthProfileKey = "standard-user" | string;`,
    "",
    `const LOGIN_ROUTE = process.env.LOGIN_ROUTE || "LOGIN_ROUTE";`,
    `const POST_LOGIN_ROUTE = process.env.POST_LOGIN_ROUTE || "POST_LOGIN_ROUTE";`,
    "",
    "function requiredEnv(name: string): string {",
    "  const value = process.env[name];",
    "  if (!value) throw new Error(`Missing required e2e env var: ${name}. See .env.example.`);",
    "  return value;",
    "}",
    "",
    `export async function loginAs(page: Page, profileKey: AuthProfileKey = "standard-user") {`,
    `  if (profileKey !== "standard-user") throw new Error(\`Unknown auth profile "\${profileKey}". Add it to tests/support/auth.ts.\`);`,
    `  const email = requiredEnv("PROJECT_E2E_STANDARD_EMAIL");`,
    `  const password = requiredEnv("PROJECT_E2E_STANDARD_PASSWORD");`,
    "  await page.goto(LOGIN_ROUTE);",
    "  await page.getByLabel(/email|username/i).or(page.getByPlaceholder(/email|username/i)).fill(email);",
    "  await page.getByLabel(/password/i).or(page.getByPlaceholder(/password/i)).fill(password);",
    "  await page.getByRole('button', { name: /log in|login|sign in/i }).click();",
    `  if (POST_LOGIN_ROUTE !== "POST_LOGIN_ROUTE") await expect(page).toHaveURL(new RegExp(POST_LOGIN_ROUTE));`,
    "}",
  ].join("\n");
}

function buildAuthFixture(profiles: SafeAutomationCredentialProfile[]): string {
  const profileEntries = profiles.map((profile) =>
    [
      `  "${profile.key}": {`,
      profile.emailEnvVar ? `    emailEnv: "${profile.emailEnvVar}",` : "",
      profile.usernameEnvVar ? `    usernameEnv: "${profile.usernameEnvVar}",` : "",
      `    passwordEnv: "${profile.passwordEnvVar}",`,
      "  },",
    ]
      .filter(Boolean)
      .join("\n")
  );

  return [
    `import { expect, Page } from "@playwright/test";`,
    "",
    `export type AuthProfileKey = ${profiles.map((profile) => `"${profile.key}"`).join(" | ") || '"standard-user"'} | string;`,
    "",
    "type AuthProfileEnv = {",
    "  emailEnv?: string;",
    "  usernameEnv?: string;",
    "  passwordEnv: string;",
    "};",
    "",
    "const AUTH_PROFILES: Record<string, AuthProfileEnv> = {",
    ...(profileEntries.length ? profileEntries : ['  "standard-user": { emailEnv: "PROJECT_E2E_STANDARD_EMAIL", passwordEnv: "PROJECT_E2E_STANDARD_PASSWORD" },']),
    "};",
    "",
    `export async function loginAs(page: Page, profileKey: AuthProfileKey = "standard-user") {`,
    "  const profile = AUTH_PROFILES[profileKey];",
    "  if (!profile) throw new Error(`Unknown auth profile: ${profileKey}`);",
    "",
    "  const username = profile.emailEnv",
    "    ? process.env[profile.emailEnv]",
    "    : profile.usernameEnv",
    "      ? process.env[profile.usernameEnv]",
    "      : '';",
    "  const password = process.env[profile.passwordEnv];",
    "",
    "  if (!username || !password) throw new Error(`Missing auth env vars for profile: ${profileKey}`);",
    "",
    "  await page.goto('/login');",
    "  await page.getByLabel(/email|username/i).fill(username);",
    "  await page.getByLabel(/password/i).fill(password);",
    "  await page.getByRole('button', { name: /log in|login|sign in/i }).click();",
    "  await expect(page).toHaveURL(/dashboard|app|account|home/i);",
    "}",
  ].join("\n");
}

function buildEnvExample(profiles: SafeAutomationCredentialProfile[]): string {
  if (profiles.length === 0) {
    return [
      "# QAtalyst generated automation credentials",
      "# Fill these locally or in CI. Do not commit real values.",
      "",
      "PROJECT_E2E_STANDARD_EMAIL=",
      "PROJECT_E2E_STANDARD_PASSWORD=",
      "PROJECT_E2E_ADMIN_EMAIL=",
      "PROJECT_E2E_ADMIN_PASSWORD=",
      "PROJECT_E2E_LIMITED_EMAIL=",
      "PROJECT_E2E_LIMITED_PASSWORD=",
    ].join("\n");
  }

  return [
    "# QAtalyst generated automation credentials",
    "# Fill these locally or in CI. Do not commit real values.",
    "",
    ...profiles.flatMap((profile) => [
      profile.emailEnvVar ? `${profile.emailEnvVar}=` : "",
      profile.usernameEnvVar ? `${profile.usernameEnvVar}=` : "",
      profile.passwordEnvVar ? `${profile.passwordEnvVar}=` : "",
      "",
    ]),
  ]
    .filter((line, index, lines) => line || lines[index - 1])
    .join("\n");
}

export function buildAutomationExportBundle(
  testCases: AutomationExportTestCase[],
  options?: {
    bundleName?: string;
    includePartial?: boolean;
    includeManualReview?: boolean;
    credentialProfiles?: SafeAutomationCredentialProfile[];
    defaultCredentialProfileKey?: string;
    envExample?: string;
    projectConfig?: Partial<AutomationProjectConfig>;
    exportMode?: "user-project" | "qatalyst-dogfood";
  }
): AutomationExportBundle {
  const bundleName = options?.bundleName || "QAtalyst Automation Export";
  const includePartial = options?.includePartial ?? true;
  const includeManualReview = options?.includeManualReview ?? true;
  const credentialProfiles = options?.credentialProfiles ?? [];
  const exportMode = options?.exportMode ?? "user-project";
  const projectConfig = normalizeAutomationProjectConfig(options?.projectConfig);

  const files: AutomationExportFile[] = [];
  const manualReviewSections: string[] = [];
  const usedPaths = new Set<string>();

  const summary = {
    total: testCases.length,
    skeletons: 0,
    exportable: 0,
    ready: 0,
    partial: 0,
    manual: 0,
    blocked: 0,
    manualReviewCases: 0,
  };

  const evaluatedCases: AutomationExportEvaluatedCase[] = testCases.map((testCase: AutomationExportTestCase, index: number) => {
    const readiness = evaluateAutomationReadinessCase(getAutomationCaseTextFromObject(testCase), index, {
      credentialProfiles,
    });
    summary[readiness.readiness] += 1;

    const isReady = readiness.readiness === "ready";
    const isIncludedPartial = includePartial && readiness.readiness === "partial";
    const exportable = (isReady || isIncludedPartial) && readiness.framework !== "manual-review";

    let exportReason = "Exported as automation skeleton.";
    if (!exportable) {
      if (readiness.framework === "manual-review") {
        exportReason = "Manual-review framework selected.";
      } else if (readiness.readiness === "partial" && !includePartial) {
        exportReason = "Partial automation candidates are excluded.";
      } else if (readiness.readiness === "manual") {
        exportReason = "Manual-heavy case.";
      } else if (readiness.readiness === "blocked") {
        exportReason = "Blocked until missing automation inputs are clarified.";
      }
    }

    if (exportable) {
      summary.exportable += 1;
      const skeleton = generateAutomationSkeleton(testCase, index, readiness.framework, {
        credentialProfiles,
        defaultCredentialProfileKey: options?.defaultCredentialProfileKey,
        projectConfig,
        exportMode,
      });
      const uniquePath = uniquifyPath(skeleton.filename, usedPaths, index);

      files.push({
        path: uniquePath,
        content: skeleton.code,
        type: skeleton.framework,
      });

      summary.skeletons += 1;
    } else if (includeManualReview) {
      manualReviewSections.push(buildManualReviewCase(testCase, index, readiness, exportReason));
      summary.manualReviewCases += 1;
    }

    return {
      index,
      testCase,
      readiness,
      exportable,
      exportReason,
    };
  });

  if (manualReviewSections.length > 0) {
    files.push({
      path: uniquifyPath("manual-review.md", usedPaths, 0),
      type: "manual",
      content: [
        "# Manual Review Cases",
        "",
        "These cases should stay manual or be improved before automation skeleton generation.",
        "",
        ...manualReviewSections,
      ].join("\n"),
    });
  }

  const hasPlaywrightFiles = files.some((file) => file.type === "playwright");

  if (hasPlaywrightFiles) {
    files.push({
      path: "tests/support/auth.ts",
      type: "playwright",
      content: exportMode === "user-project" ? buildUserProjectAuthFixture() : buildAuthFixture(credentialProfiles),
    });
    files.push({
      path: "tests/support/app.ts",
      type: "playwright",
      content: exportMode === "user-project" ? buildUserProjectAppFixture() : buildAppFixture(),
    });
    files.push({
      path: ".env.example",
      type: "readme",
      content: exportMode === "user-project" ? buildAutomationEnvExample(projectConfig) : options?.envExample || buildEnvExample(credentialProfiles),
    });
  }

  const bundleWithoutReadme = {
    files,
    evaluatedCases,
    summary,
  };

  files.unshift({
    path: "README.md",
    type: "readme",
    content: buildReadme(bundleName, bundleWithoutReadme, { projectConfig, exportMode }),
  });

  return {
    files,
    evaluatedCases,
    summary,
  };
}

export function buildAutomationExportMarkdown(bundle: AutomationExportBundle): string {
  return bundle.files
    .map((file: AutomationExportFile) => {
      const language = file.path.endsWith(".ts") ? "ts" : "md";

      return [`# ${file.path}`, "", "```" + language, file.content, "```", ""].join("\n");
    })
    .join("\n---\n\n");
}

export function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

export function sanitizeDownloadFilename(value: string): string {
  const filename = value.toLowerCase().replace(/['"]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);
  return filename || "qatalyst-automation-export";
}

export function downloadAutomationBundleAsMarkdown(bundleName: string, bundle: AutomationExportBundle): void {
  downloadTextFile(`${sanitizeDownloadFilename(bundleName)}.md`, buildAutomationExportMarkdown(bundle));
}

export function downloadAutomationFilesIndividually(bundle: AutomationExportBundle): void {
  bundle.files.forEach((file: AutomationExportFile, index: number) => {
    const safePath = file.path.replace(/[\\/]+/g, "__");
    window.setTimeout(() => downloadTextFile(safePath, file.content), index * 250);
  });
}
