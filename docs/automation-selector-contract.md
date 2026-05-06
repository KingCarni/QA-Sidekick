# Automation Selector Contract

QAtalyst-generated Playwright tests should use stable `data-testid` selectors instead of brittle UI text, layout, or CSS selectors.

## Rules

- Use kebab-case only.
- Prefer `page.getByTestId()`.
- Do not rely on visual button text for generated skeletons.
- Do not rely on `.nth()`.
- Do not rely on CSS structure selectors unless testing CSS specifically.
- Selector names should survive visual redesigns.
- Dynamic selectors must be deterministic.

## Good selectors

```text
qa-tool
project-picker
jira-ticket-input
fetch-jira-ticket-button
choose-sources-button
choose-sources-panel
selected-source-count
source-checkbox-project-product-overview
test-case-card-1
automation-fit-1
generate-skeleton-1
automation-export-panel
download-automation-files-button
```

## Avoid

```ts
await page.getByRole("button", { name: "Choose Sources" }).click();
await page.getByText("Project Product Overview").click();
await page.locator("button").nth(2).click();
```

## Fixture assumptions

Local generated skeletons assume QAS-80 fixture setup can create:

- Project: `Project`
- Source: `Project Product Overview`
- E2E persona: `standard-user`

When adding a new automation-relevant UI control, add a stable `data-testid` at the same time.
