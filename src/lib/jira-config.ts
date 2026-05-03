import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type JiraConfigPayload = {
  siteUrl: string;
  projectKey: string;
  defaultIssueType: string;
  defaultBugIssueType: string;
  fieldMapping?: Record<string, unknown>;
};

export type SafeJiraConfig = {
  id: string;
  siteUrl: string;
  projectKey: string;
  defaultIssueType: string;
  defaultBugIssueType: string;
  fieldMapping: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type JiraConfigStatus = {
  configured: boolean;
  missingFields: string[];
  config: SafeJiraConfig | null;
};

function toJsonObject(value?: Record<string, unknown>): Prisma.InputJsonObject {
  return (value ?? {}) as Prisma.InputJsonObject;
}

function normalizeUrl(value: unknown) {
  const raw = String(value ?? "").trim();

  if (!raw) return "";

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const url = new URL(withProtocol);
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return raw.replace(/\/+$/, "");
  }
}

function normalizeProjectKey(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "");
}

function normalizeIssueType(value: unknown, fallback: string) {
  const normalized = String(value ?? "").trim();

  return normalized || fallback;
}

function safeFieldMapping(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return value as Record<string, unknown>;
}

export function normalizeJiraConfigPayload(value: {
  siteUrl?: unknown;
  projectKey?: unknown;
  defaultIssueType?: unknown;
  defaultBugIssueType?: unknown;
  fieldMapping?: unknown;
}): JiraConfigPayload {
  return {
    siteUrl: normalizeUrl(value.siteUrl),
    projectKey: normalizeProjectKey(value.projectKey),
    defaultIssueType: normalizeIssueType(value.defaultIssueType, "Task"),
    defaultBugIssueType: normalizeIssueType(value.defaultBugIssueType, "Bug"),
    fieldMapping: safeFieldMapping(value.fieldMapping),
  };
}

export function validateJiraConfigPayload(payload: JiraConfigPayload) {
  const errors: string[] = [];

  if (!payload.siteUrl) {
    errors.push("Jira site URL is required.");
  } else if (!/^https?:\/\//i.test(payload.siteUrl)) {
    errors.push("Jira site URL must be a valid http or https URL.");
  }

  if (!payload.projectKey) {
    errors.push("Jira project key is required.");
  }

  if (payload.projectKey && payload.projectKey.length > 20) {
    errors.push("Jira project key looks too long.");
  }

  if (!payload.defaultIssueType) {
    errors.push("Default issue type is required.");
  }

  if (!payload.defaultBugIssueType) {
    errors.push("Default bug issue type is required.");
  }

  return errors;
}

function toSafeConfig(config: {
  id: string;
  siteUrl: string;
  projectKey: string;
  defaultIssueType: string;
  defaultBugIssueType: string;
  fieldMapping: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}): SafeJiraConfig {
  return {
    id: config.id,
    siteUrl: config.siteUrl,
    projectKey: config.projectKey,
    defaultIssueType: config.defaultIssueType,
    defaultBugIssueType: config.defaultBugIssueType,
    fieldMapping: safeFieldMapping(config.fieldMapping),
    createdAt: config.createdAt.toISOString(),
    updatedAt: config.updatedAt.toISOString(),
  };
}

export async function getUserJiraConfig(userId: string): Promise<SafeJiraConfig | null> {
  if (!userId) return null;

  const config = await prisma.jiraConfig.findUnique({
    where: { userId },
  });

  return config ? toSafeConfig(config) : null;
}

export async function getUserJiraConfigStatus(userId: string): Promise<JiraConfigStatus> {
  const config = await getUserJiraConfig(userId);

  const missingFields: string[] = [];

  if (!config?.siteUrl) missingFields.push("Jira site URL");
  if (!config?.projectKey) missingFields.push("Project key");
  if (!config?.defaultIssueType) missingFields.push("Default issue type");
  if (!config?.defaultBugIssueType) missingFields.push("Default bug issue type");

  return {
    configured: missingFields.length === 0,
    missingFields,
    config,
  };
}

export async function saveUserJiraConfig(userId: string, payload: JiraConfigPayload) {
  const errors = validateJiraConfigPayload(payload);

  if (!userId) {
    errors.push("User is required.");
  }

  if (errors.length > 0) {
    return {
      ok: false as const,
      errors,
      config: null,
    };
  }

  const config = await prisma.jiraConfig.upsert({
    where: { userId },
    update: {
      siteUrl: payload.siteUrl,
      projectKey: payload.projectKey,
      defaultIssueType: payload.defaultIssueType,
      defaultBugIssueType: payload.defaultBugIssueType,
      fieldMapping: toJsonObject(payload.fieldMapping),
    },
    create: {
      userId,
      siteUrl: payload.siteUrl,
      projectKey: payload.projectKey,
      defaultIssueType: payload.defaultIssueType,
      defaultBugIssueType: payload.defaultBugIssueType,
      fieldMapping: toJsonObject(payload.fieldMapping),
    },
  });

  return {
    ok: true as const,
    errors: [],
    config: toSafeConfig(config),
  };
}

export async function deleteUserJiraConfig(userId: string) {
  if (!userId) {
    return { ok: false as const, error: "User is required." };
  }

  await prisma.jiraConfig.deleteMany({
    where: { userId },
  });

  return { ok: true as const };
}

export function getJiraCreateIssueReadiness(status: JiraConfigStatus) {
  if (status.configured) {
    return {
      ready: true,
      message: "Jira is configured.",
    };
  }

  return {
    ready: false,
    message:
      status.missingFields.length > 0
        ? `Jira config is missing: ${status.missingFields.join(", ")}.`
        : "Jira is not configured.",
  };
}
