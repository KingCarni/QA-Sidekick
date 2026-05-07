"use client";

import {
  evaluateAutomationReadinessCase,
  getAutomationCaseTextFromObject,
  type AutomationFramework,
} from "@/lib/automation-readiness";
import {
  findCredentialProfileForText,
  type SafeAutomationCredentialProfile,
} from "@/lib/automation-credentials";
import {
  normalizeAutomationProjectConfig,
  type AutomationProjectConfig,
} from "@/lib/automation-project-config";

type SkeletonTestCase = {
  title?: unknown;
  type?: unknown;
  preconditions?: unknown;
  steps?: unknown;
  expectedResult?: unknown;
  priority?: unknown;
};

type AutomationSkeletonOptions = {
  credentialProfiles?: SafeAutomationCredentialProfile[];
  defaultCredentialProfileKey?: string;
  projectConfig?: Partial<AutomationProjectConfig>;
  exportMode?: "user-project" | "qatalyst-dogfood";
};

function safeString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    return value.map((item: unknown) => safeString(item)).join(", ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function normalizeSteps(steps: unknown): string[] {
  if (Array.isArray(steps)) {
    return steps
      .map((step: unknown) => safeString(step))
      .map((step: string) => step.trim())
      .filter(Boolean);
  }

  return safeString(steps)
    .split(/\r?\n+/)
    .map((step: string) => step.replace(/^\d+[.)]\s*/, "").trim())
    .filter(Boolean);
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);

  return slug || "generated-test";
}

function escapeForComment(value: string): string {
  return value.replace(/\*\//g, "* /");
}

function inferSelectorHint(step: string): string {
  const lower = step.toLowerCase();

  if (lower.includes("jira") && lower.includes("fetch")) return "jira-fetch-button";
  if (lower.includes("jira") && (lower.includes("url") || lower.includes("key") || lower.includes("issue"))) {
    return "jira-source-input";
  }
  if (lower.includes("save")) return "save-button";
  if (lower.includes("submit")) return "submit-button";
  if (lower.includes("delete")) return "delete-button";
  if (lower.includes("search")) return "search-input";
  if (lower.includes("login") || lower.includes("sign in")) return "sign-in-submit-button";
  if (lower.includes("email")) return "email-input";
  if (lower.includes("password")) return "password-input";
  if (lower.includes("modal")) return "modal-dialog";
  if (lower.includes("toast") || lower.includes("message")) return "toast-message";

  return "";
}

function playwrightActionForStep(step: string): string {
  const selector = inferSelectorHint(step);
  const comment = `// Step: ${escapeForComment(step)}`;

  if (selector && /\b(click|trigger|select|open|press)\b/i.test(step)) {
    return `${comment}\n  await page.getByTestId("${selector}").click();`;
  }

  if (selector && /\b(input|enter|type|paste)\b/i.test(step)) {
    return `${comment}\n  await page.getByTestId("${selector}").fill("TODO: test value");`;
  }

  return `${comment}\n  // TODO: translate this step into a stable Playwright action.`;
}

function cypressActionForStep(step: string): string {
  const selector = inferSelectorHint(step);
  const comment = `// Step: ${escapeForComment(step)}`;

  if (selector && /\b(click|trigger|select|open|press)\b/i.test(step)) {
    return `${comment}\n  cy.get('[data-testid="${selector}"]').click();`;
  }

  if (selector && /\b(input|enter|type|paste)\b/i.test(step)) {
    return `${comment}\n  cy.get('[data-testid="${selector}"]').clear().type("TODO: test value");`;
  }

  return `${comment}\n  // TODO: translate this step into a stable Cypress action.`;
}

function isSourceSelectionFlow(text: string): boolean {
  return /\b(choose sources|project sources|source selection|selected source|selected sources|source count)\b/i.test(text) &&
    /\b(select|deselect|toggle|untoggle|check|uncheck|choose)\b/i.test(text);
}

function sourceSelectionSkeletonLines(sourceFixtureName: string): string[] {
  return [
    `    const sourceName = "${sourceFixtureName}";`,
    "    const source = await expectSourceVisible(page, sourceName);",
    "",
    "    if (await source.isChecked()) {",
    "      await source.uncheck();",
    "    }",
    "",
    "    const initialCount = await getSelectedSourceCount(page);",
    "",
    "    await source.check();",
    "    await expect(source).toBeChecked();",
    "",
    "    if (initialCount !== null) {",
    "      await expectSelectedSourceCount(page, initialCount + 1);",
    "    }",
    "",
    "    await source.uncheck();",
    "    await expect(source).not.toBeChecked();",
    "",
    "    if (initialCount !== null) {",
    "      await expectSelectedSourceCount(page, initialCount);",
    "    }",
  ];
}

function needsAuthSetup(text: string): boolean {
  return /\b(login|log in|logged in|signed in|auth|authenticated|credentials|account|role|permission|admin|user has access)\b/i.test(text);
}

function emitLoginSetup(profile: SafeAutomationCredentialProfile | null): string[] {
  if (!profile) {
    return [
      "    // TODO: configure auth state or login fixture for this test.",
      "    // Example: await loginAs(page, 'standard-user');",
    ];
  }

  return [
    `    // Auth profile: ${profile.name} (${profile.role})`,
    `    await loginAs(page, "${profile.key}"); // TODO: implement/import test fixture helper.`,
  ];
}

export function getSelectorHintsForTestCase(testCase: SkeletonTestCase): string[] {
  const steps = normalizeSteps(testCase.steps);
  const text = [
    safeString(testCase.title),
    safeString(testCase.preconditions),
    steps.join("\n"),
    safeString(testCase.expectedResult),
  ].join("\n");

  const hints = new Set<string>();

  if (/\bjira\b/i.test(text)) hints.add('data-testid="jira-source-input"');
  if (/\bfetch\b/i.test(text)) hints.add('data-testid="jira-fetch-button"');
  if (/\bissue\b/i.test(text)) hints.add('data-testid="jira-issue-result"');
  if (/\bsave\b/i.test(text)) hints.add('data-testid="save-button"');
  if (/\bsubmit\b/i.test(text)) hints.add('data-testid="submit-button"');
  if (/\bdelete\b/i.test(text)) hints.add('data-testid="delete-button"');
  if (/\btoast|message|error\b/i.test(text)) hints.add('data-testid="toast-message"');
  if (/\bsearch\b/i.test(text)) hints.add('data-testid="search-input"');
  if (/\blogin|sign in\b/i.test(text)) hints.add('data-testid="sign-in-submit-button"');

  return [...hints].slice(0, 8);
}

export function generateAutomationSkeleton(
  testCase: SkeletonTestCase,
  index: number,
  preferredFrameworkOrOptions?: AutomationFramework | AutomationSkeletonOptions,
  maybeOptions?: AutomationSkeletonOptions
): {
  framework: "playwright" | "cypress";
  filename: string;
  code: string;
} {
  const preferredFramework =
    typeof preferredFrameworkOrOptions === "string" ? preferredFrameworkOrOptions : undefined;
  const options =
    typeof preferredFrameworkOrOptions === "object" ? preferredFrameworkOrOptions : maybeOptions;
  const readiness = evaluateAutomationReadinessCase(getAutomationCaseTextFromObject(testCase), index, {
    credentialProfiles: options?.credentialProfiles,
  });
  const framework = preferredFramework && preferredFramework !== "manual-review" ? preferredFramework : readiness.framework;
  const title = safeString(testCase.title) || `Test Case ${index + 1}`;
  const steps = normalizeSteps(testCase.steps);
  const expectedResult = safeString(testCase.expectedResult) || "TODO: expected result";
  const preconditions = safeString(testCase.preconditions) || "TODO: preconditions";
  const testName = slugify(title);
  const combinedText = `${title}\n${preconditions}\n${steps.join("\n")}\n${expectedResult}`;
  const projectConfig = normalizeAutomationProjectConfig(options?.projectConfig);
  const exportMode = options?.exportMode ?? "user-project";
  const isDogfood = exportMode === "qatalyst-dogfood";
  const credentialProfile =
    findCredentialProfileForText(combinedText, options?.credentialProfiles ?? []) ??
    options?.credentialProfiles?.find((profile) => profile.key === options.defaultCredentialProfileKey) ??
    null;
  const authSetupLines = needsAuthSetup(combinedText) ? emitLoginSetup(credentialProfile) : [];

  if (isSourceSelectionFlow(combinedText)) {
    const sourceFixtureName = isDogfood ? "Project Product Overview" : projectConfig.sourceFixtureName;
    const projectFixtureName = isDogfood ? "Project" : projectConfig.projectFixtureName;

    return {
      framework: "playwright",
      filename: `tests/e2e/${testName}.spec.ts`,
      code: [
        `import { test, expect } from "@playwright/test";`,
        `import {`,
        `  expectSelectedSourceCount,`,
        `  expectSourceVisible,`,
        `  getSelectedSourceCount,`,
        `  openChooseSourcesPanel,`,
        `  openQATool,`,
        `} from "../support/app";`,
        "",
        `test.describe("${title.replace(/"/g, '\\"')}", () => {`,
        "  test.beforeEach(async ({ page }) => {",
        `    // Preconditions: ${escapeForComment(preconditions)}`,
        "    await openQATool(page, {",
        `      profileKey: "${credentialProfile?.key ?? projectConfig.defaultPersonaKey}",`,
        `      projectName: "${projectFixtureName}",`,
        "    });",
        "",
        "    await openChooseSourcesPanel(page);",
        "  });",
        "",
        `  test("validates source selection updates", async ({ page }) => {`,
        ...sourceSelectionSkeletonLines(sourceFixtureName),
        "",
        `    // Expected Result: ${escapeForComment(expectedResult)}`,
        "  });",
        "});",
      ].join("\n"),
    };
  }

  if (framework === "cypress") {
    const actionLines = steps.length
      ? steps.flatMap((step: string) => cypressActionForStep(step).split("\n"))
      : ["    // TODO: add test steps."];

    return {
      framework,
      filename: `cypress/e2e/${testName}.cy.ts`,
      code: [
        `describe("${title.replace(/"/g, '\\"')}", () => {`,
        "  beforeEach(() => {",
        `    // Preconditions: ${escapeForComment(preconditions)}`,
        "    // TODO: seed data, auth state, and app route.",
        ...(authSetupLines.length
          ? [
              "    // TODO: configure Cypress auth state from credential profile metadata.",
              `    // Suggested profile: ${credentialProfile?.key ?? "standard-user"}.`,
            ]
          : []),
        "    cy.visit('/');",
        "  });",
        "",
        `  it("validates expected behavior", () => {`,
        ...actionLines,
        "",
        `    // Expected Result: ${escapeForComment(expectedResult)}`,
        "    // TODO: replace with a real assertion.",
        "    cy.contains(/success|saved|created|error|complete/i).should('be.visible');",
        "  });",
        "});",
      ].join("\n"),
    };
  }

  const actionLines = steps.length
    ? steps.flatMap((step: string) =>
        playwrightActionForStep(step)
          .split("\n")
          .map((line: string) => `  ${line}`)
      )
    : ["    // TODO: add test steps."];

  return {
    framework: "playwright",
    filename: `tests/e2e/${testName}.spec.ts`,
    code: [
      `import { test, expect } from "@playwright/test";`,
      `import { openQATool } from "../support/app";`,
      "",
      `test.describe("${title.replace(/"/g, '\\"')}", () => {`,
      "  test.beforeEach(async ({ page }) => {",
      `    // Preconditions: ${escapeForComment(preconditions)}`,
      "    // TODO: seed data, auth state, and app route.",
      ...(authSetupLines.length
        ? [
            `    // Auth profile: ${credentialProfile?.name ?? "Standard User"}.`,
            `    await openQATool(page, { profileKey: "${credentialProfile?.key ?? projectConfig.defaultPersonaKey}" });`,
          ]
        : ["    await openQATool(page, { requireAuth: false });"]),
      "  });",
      "",
      `  test("validates expected behavior", async ({ page }) => {`,
      ...actionLines,
      "",
      `    // Expected Result: ${escapeForComment(expectedResult)}`,
      "    // TODO: replace with a specific app assertion.",
      "    await expect(page.getByTestId(\"qa-output\")).toBeVisible();",
      "  });",
      "});",
    ].join("\n"),
  };
}
