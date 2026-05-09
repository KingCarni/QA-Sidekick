import { getServerSession } from "next-auth";
import { apiError, apiOk, getErrorMessage } from "@/lib/api-response";
import { authOptions } from "@/lib/auth";
import { getUserJiraConfigStatus, getUserJiraConfigWithSecret } from "@/lib/jira-config";
import { normalizeJiraErrorMessage } from "@/lib/jira-error-normalizer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanSiteUrl(value: string) {
  return value.trim().replace(/\/+$/, "").replace(/\/jira$/i, "");
}

function getAuthHeader(config: { jiraEmail?: string; jiraApiToken?: string | null }) {
  const email = String(config.jiraEmail ?? "").trim();
  const token = String(config.jiraApiToken ?? "").trim();
  if (!email || !token) return "";
  return `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;
}

async function readJiraJson(response: Response) {
  return (await response.json().catch(() => null)) as Record<string, unknown> | null;
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return apiError(req, {
        status: 401,
        code: "UNAUTHORIZED",
        message: "Please sign in before testing Jira.",
      });
    }

    const status = await getUserJiraConfigStatus(userId);
    const config = await getUserJiraConfigWithSecret(userId);

    if (!status.configured || !config) {
      return apiError(req, {
        status: 400,
        code: "VALIDATION_ERROR",
        message:
          status.missingFields.length > 0
            ? `Jira config is missing: ${status.missingFields.join(", ")}.`
            : "Jira is not configured.",
      });
    }

    const authHeader = getAuthHeader(config);
    if (!authHeader) {
      return apiError(req, {
        status: 400,
        code: "VALIDATION_ERROR",
        message: "Jira API credentials are not configured. Add Jira username/email and API token in Jira Integration settings.",
      });
    }

    const baseUrl = cleanSiteUrl(config.siteUrl);
    const accountResponse = await fetch(`${baseUrl}/rest/api/3/myself`, {
      headers: {
        Accept: "application/json",
        Authorization: authHeader,
      },
      cache: "no-store",
    });

    const accountPayload = await readJiraJson(accountResponse);

    if (!accountResponse.ok) {
      return apiError(req, {
        status: accountResponse.status >= 400 && accountResponse.status < 600 ? accountResponse.status : 502,
        code: "UPSTREAM_ERROR",
        message: normalizeJiraErrorMessage(accountPayload ?? accountResponse.statusText),
        details: { jira: accountPayload },
      });
    }

    let projectVisible = false;
    let canCreateIssues = false;
    let canEditIssues = false;
    let canLinkIssues = false;
    const projectKey = String(config.projectKey ?? "").trim().toUpperCase();

    if (projectKey) {
      const projectResponse = await fetch(`${baseUrl}/rest/api/3/project/${encodeURIComponent(projectKey)}`, {
        headers: {
          Accept: "application/json",
          Authorization: authHeader,
        },
        cache: "no-store",
      });

      projectVisible = projectResponse.ok;

      if (projectVisible) {
        const permissionsResponse = await fetch(
          `${baseUrl}/rest/api/3/mypermissions?projectKey=${encodeURIComponent(projectKey)}&permissions=BROWSE_PROJECTS,CREATE_ISSUES,EDIT_ISSUES,LINK_ISSUES`,
          {
            headers: {
              Accept: "application/json",
              Authorization: authHeader,
            },
            cache: "no-store",
          }
        );
        const permissionsPayload = await readJiraJson(permissionsResponse);
        const permissions = permissionsPayload?.permissions as Record<string, { havePermission?: boolean }> | undefined;
        canCreateIssues = Boolean(permissions?.CREATE_ISSUES?.havePermission);
        canEditIssues = Boolean(permissions?.EDIT_ISSUES?.havePermission);
        canLinkIssues = Boolean(permissions?.LINK_ISSUES?.havePermission);
      }
    }

    if (!projectVisible) {
      return apiError(req, {
        status: 400,
        code: "UPSTREAM_ERROR",
        message: `Jira authenticated successfully, but project ${projectKey || "the selected project"} is not visible to this account.`,
        details: {
          connected: true,
          authenticated: true,
          projectVisible: false,
          status: "project_not_visible",
        },
      });
    }

    if (!canCreateIssues) {
      return apiError(req, {
        status: 403,
        code: "FORBIDDEN",
        message: `Jira is connected, but this account does not have permission to create issues in project ${projectKey}.`,
        details: {
          connected: true,
          authenticated: true,
          projectVisible: true,
          canCreateIssues,
          canEditIssues,
          canLinkIssues,
          status: "missing_create_permission",
        },
      });
    }

    return apiOk(req, {
      connected: true,
      authenticated: true,
      accountEmail: String(accountPayload?.emailAddress ?? config.jiraEmail ?? ""),
      displayName: String(accountPayload?.displayName ?? ""),
      projectKey,
      projectVisible,
      canCreateIssues,
      canEditIssues,
      canLinkIssues,
      status: "ready",
      message: `Connected to Jira. Project ${projectKey} is visible and issue creation is allowed.`,
    });
  } catch (error) {
    return apiError(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      message: normalizeJiraErrorMessage(error, getErrorMessage(error, "Could not test Jira connection.")),
    });
  }
}
