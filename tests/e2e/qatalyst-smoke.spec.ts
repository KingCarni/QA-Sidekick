import { expect, test } from "@playwright/test";

test("QAtalyst app shell loads", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/QAtalyst|QA|Sidekick/i);
  await expect(page.getByText(/QAtalyst|QA Sidekick|release-ready QA/i).first()).toBeVisible();
});
