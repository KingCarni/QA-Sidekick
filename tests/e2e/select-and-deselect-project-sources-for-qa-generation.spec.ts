import { test, expect } from "@playwright/test";
import {
  expectSelectedSourceCount,
  expectSourceVisible,
  getSelectedSourceCount,
  openChooseSourcesPanel,
  openQATool,
} from "../support/app";

test.describe("Select and Deselect Project Sources for QA Generation", () => {
  test.beforeEach(async ({ page }) => {
    // Preconditions: User has opened the 'Choose Sources' panel., At least one project source is available.
    await openQATool(page, {
      profileKey: "standard-user",
      projectName: "Project", // TODO: replace with your project fixture.
    });

    await openChooseSourcesPanel(page);
  });

  test("validates source selection updates", async ({ page }) => {
    const sourceName = "Project Product Overview"; // TODO: replace with a seeded project source name.
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

    // Expected Result: The selected sources are included in the generation context, and the generated output reflects the selected sources accurately.
  });
});