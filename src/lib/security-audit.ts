import { prisma } from "@/lib/prisma";

type AuditMetaValue = string | number | boolean | null | AuditMetaValue[] | { [key: string]: AuditMetaValue };

type SecurityAuditInput = {
  userId?: string | null;
  type: string;
  meta?: Record<string, AuditMetaValue | undefined>;
};

const SENSITIVE_KEY_PATTERN = /(token|secret|password|credential|apiKey|api_key|authorization|cookie|session|body|markdown|sourceInput|structuredData|dataUrl|screenshot)/i;

function sanitizeValue(value: unknown): AuditMetaValue | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "string") return value.slice(0, 240);
  if (typeof value === "number" || typeof value === "boolean") return value;

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeValue(item) ?? null);
  }

  if (typeof value === "object") {
    const safeObject: Record<string, AuditMetaValue> = {};

    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        safeObject[key] = "[redacted]";
        continue;
      }

      const sanitized = sanitizeValue(nestedValue);
      if (sanitized !== undefined) safeObject[key] = sanitized;
    }

    return safeObject;
  }

  return String(value).slice(0, 240);
}

function sanitizeMeta(meta: SecurityAuditInput["meta"]): Record<string, AuditMetaValue> {
  const safeMeta: Record<string, AuditMetaValue> = {};

  for (const [key, value] of Object.entries(meta ?? {})) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      safeMeta[key] = "[redacted]";
      continue;
    }

    const sanitized = sanitizeValue(value);
    if (sanitized !== undefined) safeMeta[key] = sanitized;
  }

  return safeMeta;
}

export async function recordSecurityAuditEvent(input: SecurityAuditInput): Promise<void> {
  try {
    await prisma.event.create({
      data: {
        userId: input.userId ?? null,
        type: input.type,
        metaJson: sanitizeMeta(input.meta),
      },
    });
  } catch (error) {
    console.warn("Security audit event failed", {
      type: input.type,
      userId: input.userId ?? null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export const SECURITY_EVENTS = {
  BLOCKED_PROJECT_SOURCE_LIST: "security.blocked_project_source_list",
  PROJECT_SOURCE_LISTED: "security.project_source_listed",
  PROJECT_SOURCE_SAVE_BLOCKED: "security.project_source_save_blocked",
  PROJECT_SOURCE_SAVED: "security.project_source_saved",
  AI_PROJECT_CONTEXT_USED: "security.ai_project_context_used",
  AI_PROJECT_CONTEXT_BLOCKED: "security.ai_project_context_blocked",
  JIRA_CONFIG_VIEWED: "security.jira_config_viewed",
  JIRA_CONFIG_SAVE_BLOCKED: "security.jira_config_save_blocked",
  JIRA_CONFIG_SAVED: "security.jira_config_saved",
  JIRA_CONFIG_DELETED: "security.jira_config_deleted",
  TESTRAIL_CONFIG_VIEWED: "security.testrail_config_viewed",
  TESTRAIL_CONFIG_SAVE_BLOCKED: "security.testrail_config_save_blocked",
  TESTRAIL_CONFIG_SAVED: "security.testrail_config_saved",
  TESTRAIL_CONFIG_DELETED: "security.testrail_config_deleted",
  REPORT_ACCESS_BLOCKED: "security.report_access_blocked",
  REPORT_DELETED: "security.report_deleted",
  BUG_COLLECTION_ACCESS_BLOCKED: "security.bug_collection_access_blocked",
  BUG_COLLECTION_DELETED: "security.bug_collection_deleted",
} as const;
