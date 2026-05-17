import { expect, test, type Page } from "@playwright/test";
import { loginAs } from "../support/auth";

async function openQAtCompanion(page: Page) {
  const expanded = page.getByTestId("qat-companion-rail");
  const collapsed = page.getByTestId("qat-companion-rail-collapsed");

  if (await collapsed.isVisible().catch(() => false)) {
    await page.getByTestId("qat-companion-expand").click();
  }

  await expect(expanded).toBeVisible();
}

test.describe("QAt Companion FTUE smoke", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "standard-user");
  });

  test("Toolbelt renders QAt Companion automation contract", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await page.goto("/app");

    const companion = page.getByTestId("qat-companion-rail");

    await expect(companion).toBeAttached();
    await expect(page.getByTestId("qat-companion-title")).toBeAttached();
    await expect(page.getByTestId("qat-action-ask-qat")).toBeAttached();
    await expect(page.getByTestId("qat-companion-minimize")).toBeAttached();
  });

  test("Project Brain shows setup companion checks and Ask QAt", async ({ page }) => {
    await page.goto("/brain");
    await openQAtCompanion(page);

    await expect(page.getByRole("heading", { name: /Project Brain/i })).toBeVisible();
    await expect(page.getByTestId("qat-companion-steps")).toBeVisible();
    await expect(page.getByTestId("qat-action-ask-qat")).toBeVisible();

    await page.getByTestId("qat-action-ask-qat").click();
    await expect(page.getByTestId("qat-companion-tip")).toBeVisible();
  });

  test("Integration settings switch QAt guidance between Jira and TestRail", async ({ page }) => {
    await page.goto("/jira/settings");
    await openQAtCompanion(page);

    await expect(page.getByRole("heading", { name: /Integration Settings/i })).toBeVisible();
    await expect(page.getByTestId("settings-tab-jira-integration")).toBeVisible();
    await expect(page.getByTestId("settings-tab-testrail-integration")).toBeVisible();
    await expect(page.getByTestId("qat-companion-steps")).toBeVisible();
    await expect(page.getByTestId("qat-step-config-saved")).toBeVisible();

    await page.getByTestId("settings-tab-testrail-integration").click();
    await expect(page.getByTestId("testrail-settings-panel")).toBeVisible();
    await expect(page.getByTestId("qat-signal-testrail")).toBeVisible();
    await expect(page.getByTestId("qat-step-project-suite")).toBeVisible();

    await page.getByTestId("qat-action-ask-qat").click();
    await expect(page.getByTestId("qat-companion-tip")).toBeVisible();
  });
});