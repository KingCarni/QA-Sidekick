export type AutomationFramework = "playwright";

export type SelectorStrategy = "test-id" | "role" | "mixed";

export type AutomationProjectConfig = {
  framework: AutomationFramework;
  baseUrl: string;
  appRoute: string;
  loginRoute: string;
  postLoginRoute: string;
  testIdAttribute: string;
  selectorStrategy: SelectorStrategy;
  defaultPersonaKey: string;
  personas: string[];
  projectFixtureName: string;
  sourceFixtureName: string;
  selectorNotes: string;
  fixtureNotes: string;
};

export const DEFAULT_AUTOMATION_PROJECT_CONFIG: AutomationProjectConfig = {
  framework: "playwright",
  baseUrl: "BASE_URL",
  appRoute: "APP_ROUTE",
  loginRoute: "LOGIN_ROUTE",
  postLoginRoute: "POST_LOGIN_ROUTE",
  testIdAttribute: "data-testid",
  selectorStrategy: "test-id",
  defaultPersonaKey: "standard-user",
  personas: ["standard-user"],
  projectFixtureName: "YOUR_PROJECT_FIXTURE",
  sourceFixtureName: "YOUR_SOURCE_FIXTURE",
  selectorNotes: "Replace YOUR_STABLE_SELECTOR with selectors from your application.",
  fixtureNotes: "Create or seed the app data needed by this generated test before running it.",
};

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => safeString(item)).filter(Boolean);
  return safeString(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeAutomationProjectConfig(input?: Partial<AutomationProjectConfig> | null): AutomationProjectConfig {
  const source = input ?? {};

  return {
    framework: source.framework === "playwright" ? source.framework : DEFAULT_AUTOMATION_PROJECT_CONFIG.framework,
    baseUrl: safeString(source.baseUrl) || DEFAULT_AUTOMATION_PROJECT_CONFIG.baseUrl,
    appRoute: safeString(source.appRoute) || DEFAULT_AUTOMATION_PROJECT_CONFIG.appRoute,
    loginRoute: safeString(source.loginRoute) || DEFAULT_AUTOMATION_PROJECT_CONFIG.loginRoute,
    postLoginRoute: safeString(source.postLoginRoute) || DEFAULT_AUTOMATION_PROJECT_CONFIG.postLoginRoute,
    testIdAttribute: safeString(source.testIdAttribute) || DEFAULT_AUTOMATION_PROJECT_CONFIG.testIdAttribute,
    selectorStrategy:
      source.selectorStrategy === "role" || source.selectorStrategy === "mixed" || source.selectorStrategy === "test-id"
        ? source.selectorStrategy
        : DEFAULT_AUTOMATION_PROJECT_CONFIG.selectorStrategy,
    defaultPersonaKey: safeString(source.defaultPersonaKey) || DEFAULT_AUTOMATION_PROJECT_CONFIG.defaultPersonaKey,
    personas: stringList(source.personas).length ? stringList(source.personas) : DEFAULT_AUTOMATION_PROJECT_CONFIG.personas,
    projectFixtureName: safeString(source.projectFixtureName) || DEFAULT_AUTOMATION_PROJECT_CONFIG.projectFixtureName,
    sourceFixtureName: safeString(source.sourceFixtureName) || DEFAULT_AUTOMATION_PROJECT_CONFIG.sourceFixtureName,
    selectorNotes: safeString(source.selectorNotes) || DEFAULT_AUTOMATION_PROJECT_CONFIG.selectorNotes,
    fixtureNotes: safeString(source.fixtureNotes) || DEFAULT_AUTOMATION_PROJECT_CONFIG.fixtureNotes,
  };
}

export function automationConfigHasPlaceholders(config: AutomationProjectConfig): string[] {
  const placeholders: string[] = [];

  if (config.baseUrl === "BASE_URL") placeholders.push("baseUrl");
  if (config.appRoute === "APP_ROUTE") placeholders.push("appRoute");
  if (config.loginRoute === "LOGIN_ROUTE") placeholders.push("loginRoute");
  if (config.postLoginRoute === "POST_LOGIN_ROUTE") placeholders.push("postLoginRoute");
  if (config.projectFixtureName === "YOUR_PROJECT_FIXTURE") placeholders.push("projectFixtureName");
  if (config.sourceFixtureName === "YOUR_SOURCE_FIXTURE") placeholders.push("sourceFixtureName");

  return placeholders;
}

export function buildAutomationEnvExample(config: AutomationProjectConfig) {
  return [
    "# QAtalyst generated automation config",
    "# Fill these values for your own application.",
    "",
    `BASE_URL=${config.baseUrl === "BASE_URL" ? "" : config.baseUrl}`,
    `APP_ROUTE=${config.appRoute === "APP_ROUTE" ? "" : config.appRoute}`,
    `LOGIN_ROUTE=${config.loginRoute === "LOGIN_ROUTE" ? "" : config.loginRoute}`,
    `POST_LOGIN_ROUTE=${config.postLoginRoute === "POST_LOGIN_ROUTE" ? "" : config.postLoginRoute}`,
    "",
    "# Optional auth/profile values",
    "PROJECT_E2E_STANDARD_EMAIL=",
    "PROJECT_E2E_STANDARD_PASSWORD=",
  ].join("\n");
}
