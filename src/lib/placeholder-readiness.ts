export type PlaceholderReadinessResult = {
  placeholders: string[];
  scorePenalty: number;
  warnings: string[];
};

const PLACEHOLDERS = [
  "BASE_URL",
  "APP_ROUTE",
  "LOGIN_ROUTE",
  "POST_LOGIN_ROUTE",
  "YOUR_PROJECT_FIXTURE",
  "YOUR_SOURCE_FIXTURE",
  "YOUR_STABLE_SELECTOR",
];

export function analyzeAutomationPlaceholders(content: string): PlaceholderReadinessResult {
  const placeholders = PLACEHOLDERS.filter((placeholder) => content.includes(placeholder));

  return {
    placeholders,
    scorePenalty: Math.min(30, placeholders.length * 5),
    warnings: placeholders.map((placeholder) => `Replace ${placeholder} before this automation is fully runnable.`),
  };
}
