import { test, expect } from "@playwright/test";
import { openQATool } from "../support/app";

test.describe("Generate QA Output with Selected Sources", () => {
  test.beforeEach(async ({ page }) => {
    // Preconditions: User has selected one or more project sources., User has pasted a Jira ticket input.
    // TODO: seed data, auth state, and app route.
    await openQATool(page, { requireAuth: false });
  });

  test("validates expected behavior", async ({ page }) => {
  // Step: Click on the 'Generate' button.
    // TODO: translate this step into a stable Playwright action.
  // Step: Wait for the QA output to be generated.
    // TODO: translate this step into a stable Playwright action.

    // Expected Result: The generated QA output includes the selected project sources without leaking unrelated project context.
    // TODO: replace with a specific app assertion.
    await expect(page.getByTestId("qa-output")).toBeVisible();
  });
});