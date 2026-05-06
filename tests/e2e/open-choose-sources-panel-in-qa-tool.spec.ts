import { test, expect } from "@playwright/test";
import {
  expectSelectedSourceCount,
  expectSourceVisible,
  getSelectedSourceCount,
  openChooseSourcesPanel,
  openQATool,
} from "../support/app";

test.describe("Open Choose Sources Panel in QA Tool", () => {
  test.beforeEach(async ({ page }) => {
    // Preconditions: User is logged into QAtalyst, User has access to the QA generation tool
    await openQATool(page, {
      profileKey: "standard-user",
      projectName: "Project", // TODO: replace with your project fixture.
    });

    await openChooseSourcesPanel(page);
  });

  test("validates source selection updates", async ({ page }) => {
    const sourceName = "Project Product Overview"; // TODO: replace with a seeded project source name.
    const initialCount = await getSelectedSourceCount(page);
    const source = await expectSourceVisible(page, sourceName);

    await source.check();
    await expect(source).toBeChecked();

    if (initialCount !== null) {
      await expectSelectedSourceCount(page, initialCount + 1);
    }

    await source.uncheck();
    await expect(source).not.toBeChecked();

    if (initialCount !== null) {
      await expectSelectedSourceCount(page, initialCount);
    }

    // Expected Result: The 'Choose Sources' panel opens, displaying a list of enabled project sources for the selected project.
  });
});