import { expect, type Page } from "@playwright/test";

type AuthProfile = {
  emailEnv: string;
  passwordEnv: string;
};

export type AuthProfileKey = "standard-user" | "admin-user" | "limited-access-user";

const AUTH_PROFILES: Record<AuthProfileKey, AuthProfile> = {
  "standard-user": {
    emailEnv: "PROJECT_E2E_STANDARD_EMAIL",
    passwordEnv: "PROJECT_E2E_STANDARD_PASSWORD",
  },
  "admin-user": {
    emailEnv: "PROJECT_E2E_ADMIN_EMAIL",
    passwordEnv: "PROJECT_E2E_ADMIN_PASSWORD",
  },
  "limited-access-user": {
    emailEnv: "PROJECT_E2E_LIMITED_EMAIL",
    passwordEnv: "PROJECT_E2E_LIMITED_PASSWORD",
  },
};

function getAuthProfile(profileKey: string): AuthProfile {
  const profile = AUTH_PROFILES[profileKey as AuthProfileKey];

  if (!profile) {
    throw new Error(`Unknown auth profile "${profileKey}". Add it to tests/support/auth.ts.`);
  }

  return profile;
}

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required e2e env var: ${name}. See .env.e2e.example.`);
  }

  return value;
}

export async function loginAs(page: Page, profileKey: AuthProfileKey = "standard-user") {
  const profile = getAuthProfile(profileKey);
  const email = requiredEnv(profile.emailEnv);
  const password = requiredEnv(profile.passwordEnv);

  await page.goto("/login");

  await page.getByLabel(/email|username/i).or(page.getByPlaceholder(/email|username/i)).fill(email);
  await page.getByLabel(/password/i).or(page.getByPlaceholder(/password/i)).fill(password);
  await page.getByRole("button", { name: /log in|login|sign in/i }).click();

  await expect(page).toHaveURL(/\/(app|account|dashboard|home|settings|jira)(\/|$)?/i);
}
