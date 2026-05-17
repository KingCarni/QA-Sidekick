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

async function expectCompanionAction(page: Page, actionTestId: string) {
  await openQAtCompanion(page);
  await expect(page.getByTestId(actionTestId)).toBeVisible();
}

test.describe("QAt Companion FTUE smoke", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "standard-user");
  });

    test.skip("Toolbelt shows QAt Companion and supports minimize/expand", async ({ page }) => {
    await page.goto("/app");
    await openQAtCompanion(page);

    await expect(page.getByTestId("qat-companion-title")).toBeVisible();
    await expect(page.getByTestId("qat-companion-actions")).toBeVisible();

    await page.getByTestId("qat-companion-minimize").click();
    await expect(page.getByTestId("qat-companion-rail-collapsed")).toBeVisible();

    await page.getByTestId("qat-companion-expand").click();
    await expect(page.getByTestId("qat-companion-rail")).toBeVisible();
  });

  test("Project Brain shows setup companion checks and Ask QAt", async ({ page }) => {
    await page.goto("/brain");
    await openQAtCompanion(page);

    await expect(page.getByRole("heading", { name: /Project Brain/i })).toBeVisible();
    await expect(page.getByTestId("qat-companion-steps")).toBeVisible();
    await expectCompanionAction(page, "qat-action-ask-qat");

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