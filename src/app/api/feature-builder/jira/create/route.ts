import { getServerSession } from "next-auth";
import { randomUUID } from "crypto";
import { apiError, apiOk, getErrorMessage, readJsonBody } from "@/lib/api-response";
import { authOptions } from "@/lib/auth";
import { normalizeJiraErrorMessage } from "@/lib/jira-error-normalizer";
import { getUserJiraConfigStatus, getUserJiraConfigWithSecret } from "@/lib/jira-config";
import { isInsufficientCreditsError, runPaidAction } from "@/lib/paid-action";
import { durationSince, nowMs, serverLog } from "@/lib/server-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FEATURE_JIRA_CHILD_ITEM_LIMIT = 10;

type FeatureBrief = {
  title?: string;
  summary?: string;
  userValue?: string;
  problemStatement?: string;
  targetUsers?: string[];
  inScope?: string[];
  outOfScope?: string[];
  userStories?: string[];
  acceptanceCriteria?: string[];
  qaRisks?: string[];
  testIdeas?: string[];
  analyticsOrTelemetry?: string[];
  dependencies?: string[];
  openQuestions?: string[];
  jiraReadyNotes?: string[];
};

type FeatureJiraOptions = {
  parentIssueType?: unknown;
  createChildTasks?: unknown;
  createQaTask?: unknown;
  childTaskMode?: unknown;
};

type JiraPreviewTask = {
  summary?: unknown;
  description?: unknown;
  source?: unknown;
};

type FeatureJiraPreview = {
  parentSummary?: unknown;
  parentDescription?: unknown;
  childTasks?: unknown;
  qaTask?: unknown;
};

type CreateFeatureJiraBody = {
  brief?: FeatureBrief;
  markdown?: unknown;
  preview?: FeatureJiraPreview;
  options?: FeatureJiraOptions;
};

type JiraCreatedIssue = {
  id: string;
  key: string;
  self: string;
  browseUrl: string;
  summary: string;
};

type JiraConfigWithSecret = {
  siteUrl: string;
  jiraEmail: string;
  jiraApiToken?: string;
  projectKey: string;
  defaultIssueType: string;
};

type JiraProjectIssueType = {
  id: string;
  name: string;
  subtask: boolean;
};

type JiraAdfTextNode = {
  type: "text";
  text: string;
  marks?: Array<{ type: "strong" | "em" | "code" }>;
};

type JiraAdfNode =
  | {
      type: "paragraph";
      content?: JiraAdfTextNode[];
    }
  | {
      type: "heading";
      attrs: { level: 2 | 3 };
      content: JiraAdfTextNode[];
    }
  | {
      type: "bulletList";
      content: Array<{
        type: "listItem";
        content: Array<{
          type: "paragraph";
          content?: JiraAdfTextNode[];
        }>;
      }>;
    }
  | {
      type: "orderedList";
      attrs: { order: number };
      content: Array<{
        type: "listItem";
        content: Array<{
          type: "paragraph";
          content?: JiraAdfTextNode[];
        }>;
      }>;
    }
  | {
      type: "rule";
    };

type JiraAdfDoc = {
  type: "doc";
  version: 1;
  content: JiraAdfNode[];
};

async function getSignedInUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

function asText(value: unknown) {
  return String(value ?? "").trim();
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function cleanLine(value: string) {
  return value
    .replace(/^#{1,6}\s+/, "")
    .replace(/^[-*•]\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .trim();
}

function safeIssueType(value: unknown, fallback: string) {
  const text = asText(value);
  return text || fallback || "Task";
}

function cleanSiteUrl(value: string) {
  return value.trim().replace(/\/+$/, "").replace(/\/jira$/i, "");
}

function makeText(text: string, marks?: JiraAdfTextNode["marks"]): JiraAdfTextNode {
  return { type: "text", text, ...(marks?.length ? { marks } : {}) };
}

function paragraph(text: string): JiraAdfNode {
  return {
    type: "paragraph",
    content: text ? [makeText(text)] : [],
  };
}

function heading(text: string, level: 2 | 3 = 3): JiraAdfNode {
  return {
    type: "heading",
    attrs: { level },
    content: [makeText(text)],
  };
}

function bulletList(items: string[]): JiraAdfNode | null {
  const cleanItems = items.map(cleanLine).filter(Boolean);
  if (!cleanItems.length) return null;

  return {
    type: "bulletList",
    content: cleanItems.map((item) => ({
      type: "listItem",
      content: [
        {
          type: "paragraph",
          content: [makeText(item)],
        },
      ],
    })),
  };
}

function markdownToAdf(markdown: string): JiraAdfDoc {
  const content: JiraAdfNode[] = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let pendingBullets: string[] = [];

  function flushBullets() {
    const list = bulletList(pendingBullets);
    if (list) content.push(list);
    pendingBullets = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushBullets();
      continue;
    }

    if (/^---+$/.test(line)) {
      flushBullets();
      content.push({ type: "rule" });
      continue;
    }

    if (/^#{1,6}\s+/.test(line)) {
      flushBullets();
      const text = cleanLine(line);
      content.push(heading(text, line.startsWith("##") ? 3 : 2));
      continue;
    }

    if (/^[-*•]\s+/.test(line)) {
      pendingBullets.push(cleanLine(line));
      continue;
    }

    flushBullets();
    content.push(paragraph(line.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1")));
  }

  flushBullets();

  if (!content.length) {
    content.push(paragraph("Created from QAtalyst Feature Builder."));
  }

  return {
    type: "doc",
    version: 1,
    content,
  };
}

function getJiraErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;

  const record = payload as {
    errorMessages?: unknown;
    errors?: Record<string, unknown>;
  };

  if (Array.isArray(record.errorMessages) && typeof record.errorMessages[0] === "string") {
    return record.errorMessages[0];
  }

  if (record.errors?.issuetype) {
    return `Invalid Jira issue type. Jira said: ${String(record.errors.issuetype)}`;
  }

  if (record.errors?.parent) {
    return `Invalid Jira parent/subtask relationship. Jira said: ${String(record.errors.parent)}`;
  }

  if (record.errors?.summary) {
    return String(record.errors.summary);
  }

  if (record.errors?.project) {
    return String(record.errors.project);
  }

  return fallback;
}

function getAuthHeader(config: JiraConfigWithSecret) {
  const email = config.jiraEmail?.trim();
  const token = config.jiraApiToken?.trim();

  if (!email || !token) {
    return null;
  }

  return `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;
}

async function createRawJiraIssue(args: {
  config: JiraConfigWithSecret;
  authHeader: string;
  summary: string;
  descriptionMarkdown: string;
  issueType: string;
  issueTypeId?: string;
  parentKey?: string;
}): Promise<
  | { ok: true; issue: JiraCreatedIssue }
  | { ok: false; status: number; error: string; details?: unknown }
> {
  const siteUrl = cleanSiteUrl(args.config.siteUrl);
  const endpoint = `${siteUrl}/rest/api/3/issue`;
  const summary = args.summary.trim().slice(0, 240) || "Feature work from QAtalyst";

  const fields: Record<string, unknown> = {
    project: { key: args.config.projectKey },
    summary,
    description: markdownToAdf(args.descriptionMarkdown),
    issuetype: args.issueTypeId ? { id: args.issueTypeId } : { name: args.issueType },
  };

  if (args.parentKey) {
    fields.parent = { key: args.parentKey };
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: args.authHeader,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: getJiraErrorMessage(payload, "Jira issue creation failed."),
      details: payload,
    };
  }

  const key = String(payload?.key ?? "");
  const id = String(payload?.id ?? "");
  const self = String(payload?.self ?? "");

  if (!key) {
    return {
      ok: false,
      status: 502,
      error: "Jira created an issue but did not return an issue key.",
      details: payload,
    };
  }

  return {
    ok: true,
    issue: {
      id,
      key,
      self,
      summary,
      browseUrl: `${siteUrl}/browse/${key}`,
    },
  };
}

async function loadProjectIssueTypes(args: {
  config: JiraConfigWithSecret;
  authHeader: string;
}): Promise<JiraProjectIssueType[]> {
  const siteUrl = cleanSiteUrl(args.config.siteUrl);
  const endpoint = `${siteUrl}/rest/api/3/project/${encodeURIComponent(args.config.projectKey)}?expand=issueTypes`;

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: args.authHeader,
      Accept: "application/json",
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    serverLog.warn("Could not load Jira project issue types for Feature Builder.", {
      route: "/api/feature-builder/jira/create",
      status: response.status,
      meta: {
        projectKey: args.config.projectKey,
        error: getJiraErrorMessage(payload, "Could not load Jira issue types."),
      },
    });

    return [];
  }

  const rawIssueTypes: unknown[] = Array.isArray(payload?.issueTypes) ? payload.issueTypes : [];

  return rawIssueTypes
    .map((item) => {
      const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      return {
        id: String(record.id ?? ""),
        name: String(record.name ?? ""),
        subtask: Boolean(record.subtask),
      };
    })
    .filter((item) => item.id && item.name);
}

function getSubtaskIssueType(issueTypes: JiraProjectIssueType[]) {
  return (
    issueTypes.find((type) => type.subtask) ||
    issueTypes.find((type) => type.name.toLowerCase() === "subtask") ||
    issueTypes.find((type) => type.name.toLowerCase() === "sub-task") ||
    null
  );
}

async function linkIssues(args: {
  config: JiraConfigWithSecret;
  authHeader: string;
  inwardIssue: string;
  outwardIssue: string;
}) {
  const siteUrl = cleanSiteUrl(args.config.siteUrl);
  const endpoint = `${siteUrl}/rest/api/3/issueLink`;

  await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: args.authHeader,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: { name: "Relates" },
      inwardIssue: { key: args.inwardIssue },
      outwardIssue: { key: args.outwardIssue },
      comment: {
        body: markdownToAdf("Linked by QAtalyst Feature Builder."),
      },
    }),
  }).catch(() => null);
}

function makeParentDescription(brief: FeatureBrief, fallbackMarkdown: string, preview: FeatureJiraPreview) {
  const parentDescription = asText(preview.parentDescription);
  if (parentDescription) return parentDescription;

  const title = asText(brief.title) || "Feature Brief";

  return [
    `# ${title}`,
    "",
    "## Summary",
    asText(brief.summary) || "Not specified.",
    "",
    "## User Value",
    asText(brief.userValue) || "Not specified.",
    "",
    "## Problem",
    asText(brief.problemStatement) || "Not specified.",
    "",
    fallbackMarkdown || "Created from QAtalyst Feature Builder.",
  ].join("\n");
}

function getPreviewChildTasks(preview: FeatureJiraPreview): JiraPreviewTask[] {
  if (!Array.isArray(preview.childTasks)) return [];

  return preview.childTasks
    .map((item) => {
      const record = item && typeof item === "object" ? (item as JiraPreviewTask) : {};
      return {
        summary: asText(record.summary),
        description: asText(record.description),
        source: asText(record.source),
      };
    })
    .filter((item) => item.summary && item.description)
    .slice(0, 8);
}

function getPreviewQaTask(preview: FeatureJiraPreview): JiraPreviewTask | null {
  const value = preview.qaTask;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const record = value as JiraPreviewTask;
  const summary = asText(record.summary);
  const description = asText(record.description);

  if (!summary || !description) return null;

  return {
    summary,
    description,
    source: "qa",
  };
}

export async function POST(req: Request): Promise<Response> {
  const startedAt = nowMs();
  const route = "/api/feature-builder/jira/create";

  try {
    const userId = await getSignedInUserId();

    if (!userId) {
      return apiError(req, {
        status: 401,
        code: "UNAUTHORIZED",
        message: "Please sign in before creating Jira work.",
      });
    }

    const body = await readJsonBody<CreateFeatureJiraBody>(req);
    const brief = body.brief ?? {};
    const markdown = asText(body.markdown);
    const preview = body.preview ?? {};
    const options = body.options ?? {};

    if (!brief.title && !markdown) {
      return apiError(req, {
        status: 400,
        code: "VALIDATION_ERROR",
        message: "Generate a feature brief before creating Jira work.",
      });
    }

    const jiraStatus = await getUserJiraConfigStatus(userId);

    if (!jiraStatus.configured || !jiraStatus.config) {
      return apiError(req, {
        status: 400,
        code: "VALIDATION_ERROR",
        message:
          jiraStatus.missingFields.length > 0
            ? `Jira config is missing: ${jiraStatus.missingFields.join(", ")}.`
            : "Jira is not configured.",
      });
    }

    const jiraConfig = jiraStatus.config;

    const jiraConfigWithSecret = await getUserJiraConfigWithSecret(userId);

    if (!jiraConfigWithSecret?.jiraApiToken) {
      return apiError(req, {
        status: 400,
        code: "VALIDATION_ERROR",
        message: "Jira API credentials are not configured. Add Jira username/email and API token in Jira Integration settings.",
      });
    }

    const authHeader = getAuthHeader(jiraConfigWithSecret);

    if (!authHeader) {
      return apiError(req, {
        status: 400,
        code: "VALIDATION_ERROR",
        message: "Jira API credentials are not configured. Add Jira username/email and API token in Jira Integration settings.",
      });
    }

    const paidResult = await runPaidAction({
      userId,
      action: "feature_builder_jira_create",
      requestId: req.headers.get("x-request-id") || randomUUID(),
      meta: { route },
      work: async () => {
    const parentIssueType = safeIssueType(options.parentIssueType, jiraConfig.defaultIssueType || "Story");
    const parentSummary = asText(preview.parentSummary) || asText(brief.title) || "Feature work from QAtalyst";
    const parentDescription = makeParentDescription(brief, markdown, preview);

    const parentResult = await createRawJiraIssue({
      config: jiraConfigWithSecret,
      authHeader,
      summary: parentSummary,
      descriptionMarkdown: parentDescription,
      issueType: parentIssueType,
    });

    if (!parentResult.ok) {
      throw new Error(normalizeJiraErrorMessage(parentResult.error));
    }

    const childIssues: JiraCreatedIssue[] = [];
    const failedChildIssues: Array<{ summary: string; error: string; status: number }> = [];
    const createChildTasks = Boolean(options.createChildTasks);
    const childTaskMode = asText(options.childTaskMode) === "subtask" ? "subtask" : "task";
    const projectIssueTypes = await loadProjectIssueTypes({
      config: jiraConfigWithSecret,
      authHeader,
    });
    const subtaskIssueType = getSubtaskIssueType(projectIssueTypes);
    const childIssueType =
      childTaskMode === "subtask"
        ? subtaskIssueType?.name || "Subtask"
        : jiraConfig.defaultIssueType || "Task";
    const childIssueTypeId = childTaskMode === "subtask" ? subtaskIssueType?.id : undefined;

    if (createChildTasks) {
      const allChildTasks = getPreviewChildTasks(preview);
      const childTasks = allChildTasks.slice(0, FEATURE_JIRA_CHILD_ITEM_LIMIT);

      for (const task of childTasks) {
        const result = await createRawJiraIssue({
          config: jiraConfigWithSecret,
          authHeader,
          summary: task.summary ? String(task.summary) : "Feature child task",
          descriptionMarkdown: [
            asText(task.description),
            "",
            childTaskMode === "task" ? `Parent feature issue: ${parentResult.issue.key}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
          issueType: childIssueType,
          issueTypeId: childIssueTypeId,
          parentKey: childTaskMode === "subtask" ? parentResult.issue.key : undefined,
        });

        if (result.ok) {
          childIssues.push(result.issue);

          if (childTaskMode === "task") {
            await linkIssues({
              config: jiraConfigWithSecret,
              authHeader,
              inwardIssue: parentResult.issue.key,
              outwardIssue: result.issue.key,
            });
          }
        } else {
          failedChildIssues.push({
            summary: task.summary ? String(task.summary) : "Feature child task",
            error: normalizeJiraErrorMessage(result.error),
            status: result.status,
          });

          serverLog.warn("Feature Builder child Jira work creation failed.", {
            route,
            userId,
            status: result.status,
            durationMs: durationSince(startedAt),
            meta: {
              parentIssueKey: parentResult.issue.key,
              childIssueType,
              error: result.error,
            },
          });
        }
      }
    }

    let qaIssue: JiraCreatedIssue | null = null;
    const createQaTask = Boolean(options.createQaTask);
    const qaTask = getPreviewQaTask(preview);

    if (createQaTask && qaTask) {
      const result = await createRawJiraIssue({
        config: jiraConfigWithSecret,
        authHeader,
        summary: qaTask.summary ? String(qaTask.summary) : `QA Review: ${parentResult.issue.key}`,
        descriptionMarkdown: [asText(qaTask.description), "", `Parent feature issue: ${parentResult.issue.key}`]
          .filter(Boolean)
          .join("\n"),
        issueType: jiraConfig.defaultIssueType || "Task",
      });

      if (result.ok) {
        qaIssue = result.issue;
        await linkIssues({
          config: jiraConfigWithSecret,
          authHeader,
          inwardIssue: parentResult.issue.key,
          outwardIssue: result.issue.key,
        });
      } else {
        serverLog.warn("Feature Builder QA Jira work creation failed.", {
          route,
          userId,
          status: result.status,
          durationMs: durationSince(startedAt),
          meta: {
            parentIssueKey: parentResult.issue.key,
            error: result.error,
          },
        });
      }
    }

    serverLog.info("Feature Builder Jira work created.", {
      route,
      userId,
      status: 200,
      durationMs: durationSince(startedAt),
      meta: {
        parentIssueKey: parentResult.issue.key,
        childIssueCount: childIssues.length,
        qaIssueKey: qaIssue?.key ?? null,
      },
    });

    return {
      parentIssue: parentResult.issue,
      childIssues,
      qaIssue,
      warning:
        failedChildIssues.length > 0
          ? `Parent issue was created, but ${failedChildIssues.length} child work item(s) failed to create. ${failedChildIssues[0]?.error || "Check Jira issue type and subtask permissions."}`
          : null,
      failedChildIssues,
      childWorkLimit: FEATURE_JIRA_CHILD_ITEM_LIMIT,
      childWorkCreatedCount: childIssues.length,
      childWorkTruncated: getPreviewChildTasks(preview).length > FEATURE_JIRA_CHILD_ITEM_LIMIT,
    };
      },
    });

    return apiOk(req, {
      parentIssue: paidResult.parentIssue,
      childIssues: paidResult.childIssues,
      qaIssue: paidResult.qaIssue,
      warning: paidResult.warning,
      failedChildIssues: paidResult.failedChildIssues,
      childWorkLimit: paidResult.childWorkLimit,
      childWorkCreatedCount: paidResult.childWorkCreatedCount,
      childWorkTruncated: paidResult.childWorkTruncated,
      credits: {
        action: paidResult.creditSpend.action,
        cost: paidResult.creditSpend.cost,
        balanceAfter: paidResult.creditSpend.balanceAfter,
        spendRef: paidResult.creditSpend.ref,
      },
    });
  } catch (error) {
    if (isInsufficientCreditsError(error)) {
      return apiError(req, {
        status: 402,
        code: "INSUFFICIENT_CREDITS",
        message: error.message,
        details: {
          action: error.action,
          cost: error.required,
          balance: error.balance,
          required: error.required,
        },
      });
    }

    serverLog.error("Feature Builder Jira create route failed.", {
      route,
      status: 500,
      durationMs: durationSince(startedAt),
      error,
    });

    return apiError(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      message: normalizeJiraErrorMessage(error, getErrorMessage(error, "Could not create Jira feature work.")),
    });
  }
}
