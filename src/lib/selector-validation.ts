export type SelectorValidationIssue = {
  pattern: string;
  severity: "warning" | "error";
  message: string;
};

const UNSTABLE_SELECTOR_RULES: Array<{
  pattern: string;
  severity: "warning" | "error";
  message: string;
}> = [
  { pattern: ".nth(", severity: "warning", message: "Avoid nth() selectors in generated automation. Prefer stable data-testid hooks." },
  { pattern: "locator(\"button\")", severity: "warning", message: "Avoid generic button locators. Prefer getByTestId() or accessible role with stable name only when no test id exists." },
  { pattern: "locator('button')", severity: "warning", message: "Avoid generic button locators. Prefer getByTestId() or accessible role with stable name only when no test id exists." },
  { pattern: "getByText(", severity: "warning", message: "Avoid visible text matching for app controls. Prefer getByTestId() for generated skeletons." },
  { pattern: "text=", severity: "warning", message: "Avoid Playwright text selectors for app controls. Prefer stable data-testid hooks." },
  { pattern: "css=", severity: "warning", message: "Avoid CSS selector dependency in generated automation unless testing styling specifically." },
];

export function validateGeneratedSelectors(code: string): SelectorValidationIssue[] {
  return UNSTABLE_SELECTOR_RULES.filter((rule) => code.includes(rule.pattern)).map((rule) => ({
    pattern: rule.pattern,
    severity: rule.severity,
    message: rule.message,
  }));
}

export function hasSelectorValidationWarnings(code: string) {
  return validateGeneratedSelectors(code).length > 0;
}

export function formatSelectorValidationWarning(code: string) {
  const issues = validateGeneratedSelectors(code);
  if (!issues.length) return "";
  return [
    "Generated automation selector warnings:",
    ...issues.map((issue) => `- ${issue.severity.toUpperCase()}: ${issue.message} (${issue.pattern})`),
  ].join("\n");
}
