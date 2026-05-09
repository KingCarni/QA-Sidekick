import type { SafeJiraConfig } from "@/lib/jira-config";

export type JiraIssueTypeOption = {
  id: string;
  name: string;
  description: string;
  subtask: boolean;
};

function cleanSiteUrl(value: string) {
  return value.trim().replace(/\/+$/, "").replace(/\/jira$/i, "");
}

function getJiraAuth(config?: { jiraEmail?: string; jiraApiToken?: string }) {
  const email = config?.jiraEmail || process.env.JIRA_API_EMAIL || process.env.ATLASSIAN_EMAIL || process.env.JIRA_EMAIL;
  const token = config?.jiraApiToken || process.env.JIRA_API_TOKEN || process.env.ATLASSIAN_API_TOKEN;

  if (!email || !token) {
    return {
      ok: false as const,
      error: "Jira API credentials are not configured. Add Jira username/email and API token.",
    };
  }

  return {
    ok: true as const,
    header: `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`,
  };
}

async function readJiraJson(response: Response) {
  return response.json().catch(() => null);
}

export async function listJiraProjectIssueTypes(config: SafeJiraConfig & { jiraApiToken?: string }): Promise<
  | { ok: true; issueTypes: JiraIssueTypeOption[] }
  | { ok: false; status: number; error: string; details?: unknown }
> {
  const auth = getJiraAuth(config);

  if (!auth.ok) {
    return {
      ok: false,
      status: 500,
      error: auth.error,
    };
  }

  const siteUrl = cleanSiteUrl(config.siteUrl);
  const projectEndpoint = `${siteUrl}/rest/api/3/project/${encodeURIComponent(config.projectKey)}?expand=issueTypes`;

  const projectResponse = await fetch(projectEndpoint, {
    method: "GET",
    headers: {
      Authorization: auth.header,
      Accept: "application/json",
    },
  });

  const projectPayload = await readJiraJson(projectResponse);

  if (!projectResponse.ok) {
    return {
      ok: false,
      status: projectResponse.status,
      error:
        projectPayload?.errorMessages?.[0] ||
        projectPayload?.errors?.project ||
        `Could not load Jira project ${config.projectKey}.`,
      details: projectPayload,
    };
  }

  const rawIssueTypes: unknown[] = Array.isArray(projectPayload?.issueTypes) ? projectPayload.issueTypes : [];

  const issueTypes = rawIssueTypes
    .map((item) => {
      const issueType = item && typeof item === "object" ? (item as Record<string, unknown>) : {};

      return {
        id: String(issueType.id ?? ""),
        name: String(issueType.name ?? ""),
        description: String(issueType.description ?? ""),
        subtask: Boolean(issueType.subtask),
      };
    })
    .filter((item) => item.id && item.name)
    .filter((item) => !item.subtask);

  return {
    ok: true,
    issueTypes,
  };
}
