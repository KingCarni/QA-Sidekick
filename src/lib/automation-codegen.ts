"use client";

import {
  evaluateAutomationReadinessCase,
  getAutomationCaseTextFromObject,
  type AutomationFramework,
} from "@/lib/automation-readiness";

type SkeletonTestCase = {
  title?: unknown;
  type?: unknown;
  preconditions?: unknown;
  steps?: unknown;
  expectedResult?: unknown;
  priority?: unknown;
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

function sourceSelectionSkeletonLines(): string[] {
  return [
    "    const sourceName = 'QAtalyst Product Overview'; // TODO: replace with seeded source fixture.",
    "    const sourceCheckbox = page.getByRole('checkbox', { name: sourceName }); // TODO: replace with stable data-testid if available.",
    "    const selectedCount = page.getByTestId('selected-source-count'); // TODO: add/use stable selector.",
    "",
    "    await expect(sourceCheckbox).toBeVisible();",
    "    await sourceCheckbox.check();",
    "    await expect(sourceCheckbox).toBeChecked();",
    "    // TODO: assert selected count increments after selecting.",
    "",
    "    await sourceCheckbox.uncheck();",
    "    await expect(sourceCheckbox).not.toBeChecked();",
    "    // TODO: assert selected count returns to the previous value after deselecting.",
    "    await expect(selectedCount).toBeVisible();",
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
  preferredFramework?: AutomationFramework
): {
  framework: "playwright" | "cypress";
  filename: string;
  code: string;
} {
  const readiness = evaluateAutomationReadinessCase(getAutomationCaseTextFromObject(testCase), index);
  const framework = preferredFramework && preferredFramework !== "manual-review" ? preferredFramework : readiness.framework;
  const title = safeString(testCase.title) || `Test Case ${index + 1}`;
  const steps = normalizeSteps(testCase.steps);
  const expectedResult = safeString(testCase.expectedResult) || "TODO: expected result";
  const preconditions = safeString(testCase.preconditions) || "TODO: preconditions";
  const testName = slugify(title);
  const combinedText = `${title}\n${preconditions}\n${steps.join("\n")}\n${expectedResult}`;

  if (isSourceSelectionFlow(combinedText)) {
    return {
      framework: "playwright",
      filename: `tests/${testName}.spec.ts`,
      code: [
        `import { test, expect } from "@playwright/test";`,
        "",
        `test.describe("${title.replace(/"/g, '\\"')}", () => {`,
        "  test.beforeEach(async ({ page }) => {",
        `    // Preconditions: ${escapeForComment(preconditions)}`,
        "    // TODO: seed project and enabled source fixtures.",
        "    await page.goto('/');",
        "  });",
        "",
        `  test("validates source selection updates", async ({ page }) => {`,
        ...sourceSelectionSkeletonLines(),
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
    filename: `tests/${testName}.spec.ts`,
    code: [
      `import { test, expect } from "@playwright/test";`,
      "",
      `test.describe("${title.replace(/"/g, '\\"')}", () => {`,
      "  test.beforeEach(async ({ page }) => {",
      `    // Preconditions: ${escapeForComment(preconditions)}`,
      "    // TODO: seed data, auth state, and app route.",
      "    await page.goto('/');",
      "  });",
      "",
      `  test("validates expected behavior", async ({ page }) => {`,
      ...actionLines,
      "",
      `    // Expected Result: ${escapeForComment(expectedResult)}`,
      "    // TODO: replace with a real assertion.",
      "    await expect(page.getByText(/success|saved|created|error|complete/i)).toBeVisible();",
      "  });",
      "});",
    ].join("\n"),
  };
}
