import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptTestRailSecret, encryptTestRailSecret, maskSecret } from "@/lib/testrail-secret";

export type TestRailConfigPayload = {
  baseUrl: string;
  username: string;
  apiKey?: string;
  projectId: number;
  suiteId: number | null;
  defaultSectionId: number;
  milestoneId: number | null;
  runId: number | null;
  fieldMapping: Record<string, unknown>;
};

export type SafeTestRailConfig = {
  id: string;
  baseUrl: string;
  username: string;
  apiKeyMasked: string;
  projectId: number;
  suiteId: number | null;
  defaultSectionId: number;
  milestoneId: number | null;
  runId: number | null;
  fieldMapping: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type TestRailConfigStatus = {
  configured: boolean;
  missingFields: string[];
  config: SafeTestRailConfig | null;
};

function cleanBaseUrl(value: unknown) {
  const raw = String(value ?? "").trim().replace(/\/+$/, "");
  if (!raw) return "";
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const url = new URL(withProtocol);
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return raw;
  }
}

function cleanString(value: unknown) {
  return String(value ?? "").trim();
}

function positiveInt(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function safeFieldMapping(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function toJsonObject(value?: Record<string, unknown>): Prisma.InputJsonObject {
  return (value ?? {}) as Prisma.InputJsonObject;
}

export function normalizeTestRailConfigPayload(value: {
  baseUrl?: unknown;
  username?: unknown;
  apiKey?: unknown;
  projectId?: unknown;
  suiteId?: unknown;
  defaultSectionId?: unknown;
  milestoneId?: unknown;
  runId?: unknown;
  fieldMapping?: unknown;
}): TestRailConfigPayload {
  return {
    baseUrl: cleanBaseUrl(value.baseUrl),
    username: cleanString(value.username),
    apiKey: cleanString(value.apiKey) || undefined,
    projectId: positiveInt(value.projectId) ?? 0,
    suiteId: positiveInt(value.suiteId),
    defaultSectionId: positiveInt(value.defaultSectionId) ?? 0,
    milestoneId: positiveInt(value.milestoneId),
    runId: positiveInt(value.runId),
    fieldMapping: safeFieldMapping(value.fieldMapping),
  };
}

export function validateTestRailConfigPayload(payload: TestRailConfigPayload, options?: { requireApiKey?: boolean }) {
  const errors: string[] = [];

  if (!payload.baseUrl) errors.push("TestRail base URL is required.");
  if (payload.baseUrl && !/^https?:\/\//i.test(payload.baseUrl)) errors.push("TestRail base URL must be a valid http or https URL.");
  if (!payload.username) errors.push("TestRail username/email is required.");
  if (options?.requireApiKey && !payload.apiKey) errors.push("TestRail API key is required.");
  if (!payload.projectId) errors.push("TestRail project ID is required.");
  if (!payload.defaultSectionId) errors.push("Default TestRail section ID is required.");

  return errors;
}

function toSafeConfig(config: {
  id: string;
  baseUrl: string;
  username: string;
  encryptedApiKey: string;
  projectId: number;
  suiteId: number | null;
  defaultSectionId: number;
  milestoneId: number | null;
  runId: number | null;
  fieldMapping: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}): SafeTestRailConfig {
  return {
    id: config.id,
    baseUrl: config.baseUrl,
    username: config.username,
    apiKeyMasked: maskSecret(config.encryptedApiKey),
    projectId: config.projectId,
    suiteId: config.suiteId,
    defaultSectionId: config.defaultSectionId,
    milestoneId: config.milestoneId,
    runId: config.runId,
    fieldMapping: safeFieldMapping(config.fieldMapping),
    createdAt: config.createdAt.toISOString(),
    updatedAt: config.updatedAt.toISOString(),
  };
}

export async function getUserTestRailConfig(userId: string): Promise<SafeTestRailConfig | null> {
  if (!userId) return null;

  const config = await prisma.testRailConfig.findUnique({ where: { userId } });
  return config ? toSafeConfig(config) : null;
}

export async function getUserTestRailConfigWithSecret(userId: string) {
  if (!userId) return null;

  const config = await prisma.testRailConfig.findUnique({ where: { userId } });
  if (!config) return null;

  return {
    ...toSafeConfig(config),
    apiKey: decryptTestRailSecret(config.encryptedApiKey),
  };
}

export async function getUserTestRailConfigStatus(userId: string): Promise<TestRailConfigStatus> {
  const config = await getUserTestRailConfig(userId);
  const missingFields: string[] = [];

  if (!config?.baseUrl) missingFields.push("TestRail base URL");
  if (!config?.username) missingFields.push("Username/email");
  if (!config?.apiKeyMasked) missingFields.push("API key");
  if (!config?.projectId) missingFields.push("Project ID");
  if (!config?.defaultSectionId) missingFields.push("Default section ID");

  return {
    configured: missingFields.length === 0,
    missingFields,
    config,
  };
}

export async function saveUserTestRailConfig(userId: string, payload: TestRailConfigPayload) {
  const existing = userId ? await prisma.testRailConfig.findUnique({ where: { userId } }) : null;
  const errors = validateTestRailConfigPayload(payload, { requireApiKey: !existing });

  if (!userId) errors.push("User is required.");

  if (errors.length > 0) {
    return { ok: false as const, errors, config: null };
  }

  const encryptedApiKey = payload.apiKey ? encryptTestRailSecret(payload.apiKey) : existing?.encryptedApiKey;

  if (!encryptedApiKey) {
    return { ok: false as const, errors: ["TestRail API key is required."], config: null };
  }

  const config = await prisma.testRailConfig.upsert({
    where: { userId },
    update: {
      baseUrl: payload.baseUrl,
      username: payload.username,
      encryptedApiKey,
      projectId: payload.projectId,
      suiteId: payload.suiteId,
      defaultSectionId: payload.defaultSectionId,
      milestoneId: payload.milestoneId,
      runId: payload.runId,
      fieldMapping: toJsonObject(payload.fieldMapping),
    },
    create: {
      userId,
      baseUrl: payload.baseUrl,
      username: payload.username,
      encryptedApiKey,
      projectId: payload.projectId,
      suiteId: payload.suiteId,
      defaultSectionId: payload.defaultSectionId,
      milestoneId: payload.milestoneId,
      runId: payload.runId,
      fieldMapping: toJsonObject(payload.fieldMapping),
    },
  });

  return { ok: true as const, errors: [], config: toSafeConfig(config) };
}

export async function deleteUserTestRailConfig(userId: string) {
  if (!userId) return { ok: false as const, error: "User is required." };

  await prisma.testRailConfig.deleteMany({ where: { userId } });
  return { ok: true as const };
}
