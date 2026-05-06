export type E2EPersonaKey = "standard-user" | "admin-user" | "limited-access-user";

export type E2EPersona = {
  key: E2EPersonaKey;
  email: string;
  name: string;
  role: "standard" | "admin" | "limited";
  credits: number;
};

export const E2E_PERSONAS: Record<E2EPersonaKey, E2EPersona> = {
  "standard-user": {
    key: "standard-user",
    email: "e2e.standard@example.test",
    name: "E2E Standard User",
    role: "standard",
    credits: 100,
  },
  "admin-user": {
    key: "admin-user",
    email: "e2e.admin@example.test",
    name: "E2E Admin User",
    role: "admin",
    credits: 500,
  },
  "limited-access-user": {
    key: "limited-access-user",
    email: "e2e.limited@example.test",
    name: "E2E Limited Access User",
    role: "limited",
    credits: 0,
  },
};

export function isE2EAuthEnabled() {
  return process.env.ENABLE_E2E_AUTH === "true" && process.env.NODE_ENV !== "production";
}

export function getE2EPersona(value: unknown): E2EPersona | null {
  const key = typeof value === "string" ? value : "";
  return E2E_PERSONAS[key as E2EPersonaKey] ?? null;
}
