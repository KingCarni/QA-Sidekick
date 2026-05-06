import { test, expect } from "@playwright/test";
import {
  expectSelectedSourceCount,
  expectSourceVisible,
  getSelectedSourceCount,
  openChooseSourcesPanel,
  openQATool,
} from "../support/app";

test.describe("Project source selection selector contract", () => {
  test.beforeEach(async ({ page }) => {
    await openQATool(page, {
      profileKey: "standard-user",
      projectName: "Project",
    });

    await openChooseSourcesPanel(page);
  });

  test("selects and deselects a seeded project source using stable selectors", async ({ page }) => {
    const sourceName = "Project Product Overview";
    const source = await expectSourceVisible(page, sourceName);

    if (await source.isChecked()) {
      await source.uncheck();
    }

    const initialCount = await getSelectedSourceCount(page);

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
  });
});
