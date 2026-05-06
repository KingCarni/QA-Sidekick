import { expect, type Page } from "@playwright/test";
import { loginAs } from "./auth";

export type OpenQAToolOptions = {
  profileKey?: string;
  projectName?: string;
  requireAuth?: boolean;
};

function slugifyForTestId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function openQATool(page: Page, options: OpenQAToolOptions = {}) {
  const { profileKey = "standard-user", requireAuth = true } = options;

  if (requireAuth) {
    await loginAs(page, profileKey);
  }

  await page.goto("/app");
  await expect(page.getByTestId("qa-tool")).toBeVisible();

  if (options.projectName) {
    await selectProject(page, options.projectName);
  }
}

export async function selectTool(page: Page, tool: "test-cases" | "risk-review" | "bug-writer" | "test-improver") {
  await page.getByTestId(`tool-tab-${tool}`).click();
}

export async function selectProject(page: Page, projectName: string) {
  const picker = page.getByTestId("project-picker");

  await expect(picker).toBeVisible();

  await picker.selectOption({ label: projectName }).catch(async () => {
    await picker.click();
    await page.getByRole("option", { name: projectName }).click();
  });
}

export async function fetchJiraTicket(page: Page, ticketOrUrl: string) {
  await page.getByTestId("jira-ticket-input").fill(ticketOrUrl);
  await page.getByTestId("fetch-jira-ticket-button").click();
  await expect(page.getByTestId("fetched-jira-ticket-card")).toBeVisible();
}

export async function openChooseSourcesPanel(page: Page) {
  await page.getByTestId("choose-sources-button").click();
  await expect(page.getByTestId("choose-sources-panel")).toBeVisible();
}

export async function sourceCheckbox(page: Page, sourceName: string) {
  const slug = slugifyForTestId(sourceName);
  const byTestId = page.getByTestId(`source-checkbox-${slug}`);

  if (await byTestId.count()) {
    return byTestId;
  }

  return page.getByRole("checkbox", { name: sourceName });
}

export async function expectSourceVisible(page: Page, sourceName: string) {
  const checkbox = await sourceCheckbox(page, sourceName);
  await expect(checkbox).toBeVisible();
  return checkbox;
}

export async function getSelectedSourceCount(page: Page): Promise<number | null> {
  const countText = await page.getByTestId("selected-source-count").textContent().catch(() => null);
  if (!countText) return null;

  const match = countText.match(/\d+/);
  return match ? Number(match[0]) : null;
}

export async function expectSelectedSourceCount(page: Page, expectedCount: number) {
  await expect(page.getByTestId("selected-source-count")).toContainText(String(expectedCount));
}

export async function runTestCases(page: Page) {
  await selectTool(page, "test-cases");
  await page.getByTestId("run-test-cases-button").click();
  await expect(page.getByTestId("qa-output")).toBeVisible();
}

export async function expectGeneratedTestCase(page: Page, index = 1) {
  await expect(page.getByTestId(`test-case-card-${index}`)).toBeVisible();
}

export async function generateSkeletonForCase(page: Page, index = 1) {
  await page.getByTestId(`generate-skeleton-${index}`).click();
  await expect(page.getByTestId("automation-export-panel")).toBeVisible();
}
