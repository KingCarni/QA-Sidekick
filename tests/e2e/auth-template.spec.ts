import { expect, test } from "@playwright/test";
import { loginAs } from "../support/auth";

const hasStandardCredentials =
  Boolean(process.env.PROJECT_E2E_STANDARD_EMAIL) &&
  Boolean(process.env.PROJECT_E2E_STANDARD_PASSWORD);

test.describe("generated auth skeleton template", () => {
  test.skip(!hasStandardCredentials, "Set PROJECT_E2E_STANDARD_EMAIL and PROJECT_E2E_STANDARD_PASSWORD to run auth templates.");

  test("logs in with the standard-user profile", async ({ page }) => {
    await loginAs(page, "standard-user");

    await expect(page).toHaveURL(/\/(app|account|dashboard|home|settings|jira)(\/|$)?/i);
  });
});
