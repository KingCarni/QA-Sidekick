import { expect, test } from "@playwright/test";
import { loginAs } from "../support/auth";

test.describe("E2E dev auth", () => {
  test("logs in as standard user through dev/test auth mode", async ({ page }) => {
    test.skip(process.env.ENABLE_E2E_AUTH !== "true", "ENABLE_E2E_AUTH is not enabled.");

    await loginAs(page, "standard-user");

    await expect(page).toHaveURL(/\/(app|account|dashboard|home|settings|jira)(\/|$)?/i);
  });
});
