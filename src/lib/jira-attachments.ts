import type { SafeJiraConfig } from "@/lib/jira-config";

type JiraConfigWithSecret = SafeJiraConfig & {
  jiraApiToken: string;
};

export type JiraAttachmentUploadResult = {
  filename: string;
  ok: boolean;
  id?: string;
  content?: string;
  size?: number;
  error?: string;
};

function cleanSiteUrl(value: string) {
  return value.trim().replace(/\/+$/, "").replace(/\/jira$/i, "");
}

function getJiraAuth(config: JiraConfigWithSecret) {
  const email = config.jiraEmail?.trim();
  const token = config.jiraApiToken?.trim();

  if (!email || !token) {
    return {
      ok: false as const,
      error: "Jira API credentials are not configured. Add Jira username/email and API token in Jira settings.",
    };
  }

  return {
    ok: true as const,
    header: `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`,
  };
}

function getJiraErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;

  const record = payload as {
    errorMessages?: unknown;
    errors?: Record<string, unknown>;
    message?: unknown;
  };

  if (typeof record.message === "string") return record.message;

  if (Array.isArray(record.errorMessages) && typeof record.errorMessages[0] === "string") {
    return record.errorMessages[0];
  }

  if (record.errors) {
    const firstError = Object.values(record.errors).find((value) => typeof value === "string");
    if (firstError) return String(firstError);
  }

  return fallback;
}

export async function uploadJiraIssueAttachments(params: {
  config: JiraConfigWithSecret;
  issueKey: string;
  files: File[];
}): Promise<
  | { ok: true; attachments: JiraAttachmentUploadResult[] }
  | { ok: false; status: number; error: string; details?: unknown; attachments?: JiraAttachmentUploadResult[] }
> {
  const auth = getJiraAuth(params.config);

  if (!auth.ok) {
    return {
      ok: false,
      status: 500,
      error: auth.error,
    };
  }

  const issueKey = params.issueKey.trim();

  if (!issueKey) {
    return {
      ok: false,
      status: 400,
      error: "Missing Jira issue key.",
    };
  }

  if (params.files.length === 0) {
    return {
      ok: true,
      attachments: [],
    };
  }

  const siteUrl = cleanSiteUrl(params.config.siteUrl);
  const endpoint = `${siteUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}/attachments`;
  const formData = new FormData();

  for (const file of params.files) {
    formData.append("file", file, file.name);
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: auth.header,
      Accept: "application/json",
      "X-Atlassian-Token": "no-check",
    },
    body: formData,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: getJiraErrorMessage(payload, "Jira attachment upload failed."),
      details: payload,
      attachments: params.files.map((file) => ({
        filename: file.name,
        ok: false,
        size: file.size,
        error: "Upload failed.",
      })),
    };
  }

  const rawAttachments = Array.isArray(payload) ? payload : [];

  return {
    ok: true,
    attachments: rawAttachments.map((item, index) => ({
      filename: String(item?.filename ?? params.files[index]?.name ?? "attachment"),
      ok: true,
      id: String(item?.id ?? ""),
      content: String(item?.content ?? ""),
      size: Number(item?.size ?? params.files[index]?.size ?? 0),
    })),
  };
}
