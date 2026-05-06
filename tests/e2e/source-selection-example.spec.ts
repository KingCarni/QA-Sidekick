import { expect, test } from "@playwright/test";
import {
  expectSelectedSourceCount,
  expectSourceVisible,
  getSelectedSourceCount,
  openChooseSourcesPanel,
  openQATool,
} from "../support/app";

test.describe("Project source selection", () => {
  test.skip(
    !process.env.PROJECT_E2E_STANDARD_EMAIL || !process.env.PROJECT_E2E_STANDARD_PASSWORD,
    "Set e2e credentials and seed a project/source before running this generated example."
  );

  test.beforeEach(async ({ page }) => {
    await openQATool(page, {
      profileKey: "standard-user",
      projectName: "Project",
    });

    await openChooseSourcesPanel(page);
  });

  test("selects and deselects a project source", async ({ page }) => {
    const sourceName = "Project Product Overview";
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
  });
});
