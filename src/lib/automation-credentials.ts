export type AutomationCredentialProfile = {
  id?: string;
  key: string;
  name: string;
  role?: string;
  environment?: string;
  emailEnvVar?: string;
  passwordEnvVar?: string;
  usernameEnvVar?: string;
  notes?: string;
  isDefault?: boolean;
  enabled?: boolean;
};

export type AutomationCredentialPayload = {
  credentialsUsed: boolean;
  defaultProfileKey: string;
  profiles: SafeAutomationCredentialProfile[];
  promptBlock: string;
  envExample: string;
};

export type SafeAutomationCredentialProfile = {
  key: string;
  name: string;
  role: string;
  environment: string;
  emailEnvVar: string;
  passwordEnvVar: string;
  usernameEnvVar: string;
  notes: string;
  isDefault: boolean;
};

function safeString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return String(value);
}

export function normalizeCredentialKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function envKeyFromProfile(key: string, suffix: "EMAIL" | "USERNAME" | "PASSWORD"): string {
  const normalized = key
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `PROJECT_E2E_${normalized}_${suffix}`;
}

export function sanitizeCredentialProfile(profile: AutomationCredentialProfile): SafeAutomationCredentialProfile {
  const key = normalizeCredentialKey(safeString(profile.key || profile.name || "standard-user")) || "standard-user";

  return {
    key,
    name: safeString(profile.name) || key,
    role: safeString(profile.role) || "Standard User",
    environment: safeString(profile.environment) || "local/staging",
    emailEnvVar: safeString(profile.emailEnvVar) || envKeyFromProfile(key, "EMAIL"),
    usernameEnvVar: safeString(profile.usernameEnvVar),
    passwordEnvVar: safeString(profile.passwordEnvVar) || envKeyFromProfile(key, "PASSWORD"),
    notes: safeString(profile.notes),
    isDefault: Boolean(profile.isDefault),
  };
}

export function buildAutomationCredentialPayload(
  profiles: AutomationCredentialProfile[] | undefined
): AutomationCredentialPayload {
  const safeProfiles = (profiles ?? [])
    .filter((profile) => profile.enabled !== false)
    .map(sanitizeCredentialProfile);

  const defaultProfile =
    safeProfiles.find((profile) => profile.isDefault) ??
    safeProfiles.find((profile) => /standard|default|user/i.test(`${profile.key} ${profile.name} ${profile.role}`)) ??
    safeProfiles[0];

  const credentialsUsed = safeProfiles.length > 0;

  const promptBlock = credentialsUsed
    ? [
        "## AUTOMATION CREDENTIAL PROFILES",
        "",
        "Use these profiles as safe automation setup references. Do not output raw secrets. Do not ask the AI model to know or infer real passwords.",
        "Generated automation should reference profile keys, helper fixtures, or environment variable names only.",
        "",
        ...safeProfiles.map((profile) =>
          [
            `### ${profile.name}`,
            `Profile Key: ${profile.key}`,
            `Role/Persona: ${profile.role}`,
            `Environment: ${profile.environment}`,
            profile.emailEnvVar ? `Email Env Var: ${profile.emailEnvVar}` : "",
            profile.usernameEnvVar ? `Username Env Var: ${profile.usernameEnvVar}` : "",
            profile.passwordEnvVar ? `Password Env Var: ${profile.passwordEnvVar}` : "",
            profile.notes ? `Setup Notes: ${profile.notes}` : "",
          ]
            .filter(Boolean)
            .join("\n")
        ),
        "",
        "## END AUTOMATION CREDENTIAL PROFILES",
      ].join("\n")
    : "";

  const envExample = safeProfiles
    .flatMap((profile) => [
      profile.emailEnvVar ? `${profile.emailEnvVar}=` : "",
      profile.usernameEnvVar ? `${profile.usernameEnvVar}=` : "",
      profile.passwordEnvVar ? `${profile.passwordEnvVar}=` : "",
    ])
    .filter(Boolean)
    .join("\n");

  return {
    credentialsUsed,
    defaultProfileKey: defaultProfile?.key ?? "",
    profiles: safeProfiles,
    promptBlock,
    envExample,
  };
}

export function findCredentialProfileForText(
  text: string,
  profiles: SafeAutomationCredentialProfile[]
): SafeAutomationCredentialProfile | null {
  const lower = text.toLowerCase();

  const roleMatch = profiles.find((profile) => {
    const haystack = `${profile.key} ${profile.name} ${profile.role} ${profile.notes}`.toLowerCase();

    if (lower.includes("admin") && haystack.includes("admin")) return true;
    if ((lower.includes("limited credit") || lower.includes("insufficient credit")) && haystack.includes("credit")) return true;
    if ((lower.includes("standard user") || lower.includes("logged in") || lower.includes("login") || lower.includes("auth")) && haystack.includes("standard")) return true;
    if ((lower.includes("signed out") || lower.includes("logged out")) && haystack.includes("logged-out")) return true;

    return false;
  });

  return roleMatch ?? profiles.find((profile) => profile.isDefault) ?? profiles[0] ?? null;
}

export function buildAutomationCredentialPromptRules(): string {
  return [
    "AUTOMATION CREDENTIAL RULES:",
    "- If an automation credential profile fits the case, use its profile key or env var names in generated skeletons.",
    "- Never include raw passwords or secret values in generated output.",
    "- Prefer helper-style setup such as loginAs(page, \"standard-user\") when a profile key exists.",
    "- If writing direct login steps, fill credentials from environment variables only.",
    "- Exported bundles may include .env.example variable names but no real values.",
  ].join("\n");
}
