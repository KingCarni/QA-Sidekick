import type { SafeJiraConfig } from "@/lib/jira-config";
import { parseJiraTicket, type ParsedJiraTicket } from "@/lib/jira-ticket";

export type JiraFetchedIssue = {
  key: string;
  browseUrl: string;
  normalizedText: string;
  parsedTicket: ParsedJiraTicket;
  raw: {
    id: string;
    key: string;
    self: string;
    fields: unknown;
  };
};

type JiraAdfNode = {
  type?: string;
  text?: string;
  content?: JiraAdfNode[];
  attrs?: Record<string, unknown>;
};

function cleanSiteUrl(value: string) {
  return value.trim().replace(/\/+$/, "").replace(/\/jira$/i, "");
}

function normalizeIssueKey(value: unknown) {
  const raw = String(value ?? "").trim();

  const urlKey = raw.match(/\/browse\/([A-Z][A-Z0-9]+-\d+)/i)?.[1];
  const directKey = raw.match(/\b([A-Z][A-Z0-9]+-\d+)\b/i)?.[1];

  return String(urlKey || directKey || "")
    .trim()
    .toUpperCase();
}

function getJiraAuth() {
  const email = process.env.JIRA_API_EMAIL || process.env.ATLASSIAN_EMAIL || process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN || process.env.ATLASSIAN_API_TOKEN;

  if (!email || !token) {
    return {
      ok: false as const,
      error: "Jira API credentials are not configured. Add JIRA_API_EMAIL and JIRA_API_TOKEN.",
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

function adfToText(value: unknown): string {
  if (!value) return "";

  if (typeof value === "string") return value;

  if (Array.isArray(value)) {
    return value.map(adfToText).filter(Boolean).join("\n");
  }

  if (typeof value !== "object") return "";

  const node = value as JiraAdfNode;

  if (node.type === "text") return node.text ?? "";
  if (!Array.isArray(node.content)) return "";

  const childText = node.content.map(adfToText).filter(Boolean);

  if (["paragraph", "heading"].includes(node.type ?? "")) {
    return childText.join("");
  }

  if (node.type === "listItem") {
    return childText.join("\n");
  }

  if (node.type === "bulletList") {
    return childText
      .flatMap((text) => text.split("\n"))
      .filter(Boolean)
      .map((text) => `- ${text.replace(/^- /, "")}`)
      .join("\n");
  }

  if (node.type === "orderedList") {
    return childText
      .flatMap((text) => text.split("\n"))
      .filter(Boolean)
      .map((text, index) => `${index + 1}. ${text.replace(/^\d+\. /, "")}`)
      .join("\n");
  }

  return childText.join("\n");
}

function userDisplayName(value: unknown) {
  if (!value || typeof value !== "object") return "";

  const record = value as {
    displayName?: unknown;
    emailAddress?: unknown;
    accountId?: unknown;
  };

  return String(record.displayName || record.emailAddress || record.accountId || "").trim();
}

function readString(value: unknown) {
  return String(value ?? "").trim();
}

function readName(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const record = value as { name?: unknown; value?: unknown };
  return String(record.name || record.value || "").trim();
}

function readLabels(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function formatComments(value: unknown) {
  if (!value || typeof value !== "object") return "";

  const record = value as {
    comments?: unknown;
  };

  if (!Array.isArray(record.comments)) return "";

  const comments = record.comments
    .slice(0, 10)
    .map((comment) => {
      if (!comment || typeof comment !== "object") return "";

      const item = comment as {
        author?: unknown;
        created?: unknown;
        body?: unknown;
      };

      const author = userDisplayName(item.author) || "Unknown";
      const created = readString(item.created);
      const body = adfToText(item.body).trim();

      if (!body) return "";

      return [`Comment by ${author}${created ? ` (${created})` : ""}:`, body].join("\n");
    })
    .filter(Boolean);

  return comments.join("\n\n");
}

function findAcceptanceCriteria(description: string) {
  const lines = description
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const acStart = lines.findIndex((line) => /^acceptance criteria[:\s]*$/i.test(line));

  if (acStart >= 0) {
    const criteria: string[] = [];

    for (let index = acStart + 1; index < lines.length; index += 1) {
      const line = lines[index];

      if (/^(description|scope|out of scope|notes|implementation|qa notes)[:\s]*$/i.test(line)) break;

      const cleaned = line.replace(/^\s*[-*•]\s+/, "").replace(/^\d+[.)]\s+/, "").trim();
      if (cleaned) criteria.push(cleaned);
    }

    return criteria;
  }

  return lines
    .filter((line) => /^(given|when|then|must|should|user can|system should|verify|ensure)\b/i.test(line))
    .map((line) => line.replace(/^\s*[-*•]\s+/, "").replace(/^\d+[.)]\s+/, "").trim());
}

function buildNormalizedText(params: {
  key: string;
  issueType: string;
  summary: string;
  status: string;
  priority: string;
  labels: string[];
  reporter: string;
  assignee: string;
  description: string;
  acceptanceCriteria: string[];
  comments: string;
  browseUrl: string;
}) {
  const acceptance = params.acceptanceCriteria.length
    ? params.acceptanceCriteria.map((item) => `- ${item}`).join("\n")
    : "- Not provided.";

  const comments = params.comments.trim() || "No comments fetched.";

  return [
    `Linked Jira Ticket: ${params.key}`,
    `Jira URL: ${params.browseUrl}`,
    "",
    `Jira Key: ${params.key}`,
    `Issue Type: ${params.issueType || "Not provided."}`,
    `Summary: ${params.summary || "Not provided."}`,
    `Status: ${params.status || "Not provided."}`,
    `Priority: ${params.priority || "Not provided."}`,
    `Labels: ${params.labels.length ? params.labels.join(", ") : "Not provided."}`,
    `Reporter: ${params.reporter || "Not provided."}`,
    `Assignee: ${params.assignee || "Not provided."}`,
    "",
    "Description:",
    params.description || "Not provided.",
    "",
    "Acceptance Criteria:",
    acceptance,
    "",
    "Jira Comments:",
    comments,
  ].join("\n");
}

export async function fetchJiraIssueByKey(params: {
  config: SafeJiraConfig;
  issueKeyOrUrl: string;
}): Promise<
  | { ok: true; issue: JiraFetchedIssue }
  | { ok: false; status: number; error: string; details?: unknown }
> {
  const auth = getJiraAuth();

  if (!auth.ok) {
    return {
      ok: false,
      status: 500,
      error: auth.error,
    };
  }

  const issueKey = normalizeIssueKey(params.issueKeyOrUrl);

  if (!issueKey) {
    return {
      ok: false,
      status: 400,
      error: "Enter a Jira issue key or Jira issue URL.",
    };
  }

  const siteUrl = cleanSiteUrl(params.config.siteUrl);
  const endpoint = new URL(`${siteUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}`);

  endpoint.searchParams.set(
    "fields",
    [
      "summary",
      "description",
      "issuetype",
      "status",
      "priority",
      "labels",
      "reporter",
      "assignee",
      "comment",
    ].join(",")
  );

  const response = await fetch(endpoint.toString(), {
    method: "GET",
    headers: {
      Authorization: auth.header,
      Accept: "application/json",
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: getJiraErrorMessage(payload, "Could not fetch Jira issue."),
      details: payload,
    };
  }

  const record = payload as {
    id?: unknown;
    key?: unknown;
    self?: unknown;
    fields?: Record<string, unknown>;
  };

  const fields = record.fields ?? {};
  const key = readString(record.key) || issueKey;
  const browseUrl = `${siteUrl}/browse/${key}`;

  const summary = readString(fields.summary);
  const description = adfToText(fields.description).trim();
  const comments = formatComments(fields.comment);
  const acceptanceCriteria = findAcceptanceCriteria(description);

  const normalizedText = buildNormalizedText({
    key,
    issueType: readName(fields.issuetype),
    summary,
    status: readName(fields.status),
    priority: readName(fields.priority),
    labels: readLabels(fields.labels),
    reporter: userDisplayName(fields.reporter),
    assignee: userDisplayName(fields.assignee),
    description,
    acceptanceCriteria,
    comments,
    browseUrl,
  });

  return {
    ok: true,
    issue: {
      key,
      browseUrl,
      normalizedText,
      parsedTicket: parseJiraTicket(normalizedText),
      raw: {
        id: readString(record.id),
        key,
        self: readString(record.self),
        fields,
      },
    },
  };
}
