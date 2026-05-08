import type { SafeJiraConfig } from "@/lib/jira-config";

export type JiraCreateIssueInput = {
  markdown?: unknown;
  sourceInput?: unknown;
  structuredData?: unknown;
};

export type JiraConfigWithSecret = SafeJiraConfig & {
  jiraApiToken?: string;
};

export type JiraIssueDraft = {
  summary: string;
  descriptionText: string;
  descriptionAdf: JiraAdfDoc;
  issueType: string;
  priorityName: string | null;
};

export type JiraCreatedIssue = {
  id: string;
  key: string;
  self: string;
  browseUrl: string;
};

type JiraAdfTextNode = {
  type: "text";
  text: string;
  marks?: Array<{ type: "strong" | "em" | "code" }>;
};

type JiraAdfParagraphNode = {
  type: "paragraph";
  content?: JiraAdfTextNode[];
};

type JiraAdfHeadingNode = {
  type: "heading";
  attrs: { level: 2 | 3 };
  content: JiraAdfTextNode[];
};

type JiraAdfListItemNode = {
  type: "listItem";
  content: JiraAdfParagraphNode[];
};

type JiraAdfBulletListNode = {
  type: "bulletList";
  content: JiraAdfListItemNode[];
};

type JiraAdfOrderedListNode = {
  type: "orderedList";
  attrs: { order: number };
  content: JiraAdfListItemNode[];
};

type JiraAdfRuleNode = {
  type: "rule";
};

type JiraAdfNode =
  | JiraAdfParagraphNode
  | JiraAdfHeadingNode
  | JiraAdfBulletListNode
  | JiraAdfOrderedListNode
  | JiraAdfRuleNode;

export type JiraAdfDoc = {
  type: "doc";
  version: 1;
  content: JiraAdfNode[];
};

type BugReportSections = {
  title: string;
  severity: string;
  priority: string;
  summary: string;
  environment: string[];
  stepsToReproduce: string[];
  expectedResult: string;
  actualResult: string;
  impact: string;
  missingInfo: string[];
  followUpQuestions: string[];
  qaNotes: string[];
  followUpHistory: string[];
  evidence: string[];
  logFindings: string[];
};

const SECTION_HEADINGS = [
  "Summary",
  "Environment",
  "Steps to Reproduce",
  "Expected Result",
  "Actual Result",
  "Impact",
  "Missing Info",
  "Follow-up Questions",
  "QA Notes",
  "Follow-up History",
  "Evidence",
  "Relevant Log Findings",
];

function asText(value: unknown) {
  return String(value ?? "").trim();
}

function stripMarkdown(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\r\n/g, "\n")
    .trim();
}

function cleanLine(value: string) {
  return value
    .replace(/^\s*[-*•]\s+/, "")
    .replace(/^\s*\d+[.)]\s+/, "")
    .trim();
}

function firstUsefulLine(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line && !/^[-*_]{3,}$/.test(line));
}

function findLabeledValue(text: string, labels: string[]) {
  const escaped = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const regex = new RegExp(`^\\s*(?:${escaped})\\s*[:\\-]\\s*(.+?)\\s*$`, "im");
  return text.match(regex)?.[1]?.trim() ?? "";
}

function getStructuredValue(value: unknown, keys: string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";

  const record = value as Record<string, unknown>;

  for (const key of keys) {
    const direct = record[key];
    if (typeof direct === "string" && direct.trim()) return direct.trim();
  }

  return "";
}

function getPriorityName(markdown: string, structuredData: unknown) {
  const structuredPriority = getStructuredValue(structuredData, [
    "priority",
    "prioritySuggestion",
    "suggestedPriority",
    "jiraPriority",
  ]);

  const raw =
    structuredPriority ||
    findLabeledValue(markdown, ["priority", "priority suggestion", "suggested priority", "jira priority"]);

  const normalized = raw.toLowerCase();

  if (normalized.includes("highest")) return "Highest";
  if (normalized.includes("high")) return "High";
  if (normalized.includes("medium")) return "Medium";
  if (normalized.includes("low")) return "Low";
  if (normalized.includes("lowest")) return "Lowest";

  return null;
}

function getSummary(markdown: string, structuredData: unknown) {
  const structuredSummary = getStructuredValue(structuredData, ["title", "summary", "bugTitle", "issueTitle"]);

  const labeled =
    structuredSummary ||
    findLabeledValue(markdown, ["title", "summary", "bug title", "issue title", "jira summary"]);

  if (labeled) return labeled.slice(0, 240);

  const firstLine = firstUsefulLine(markdown);
  if (firstLine) return firstLine.slice(0, 240);

  return "Bug created from QAtalyst";
}

function getSection(markdown: string, heading: string) {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const nextHeadings = SECTION_HEADINGS.filter((item) => item !== heading)
    .map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");

  const regex = new RegExp(
    `^\\s*${escapedHeading}\\s*$([\\s\\S]*?)(?=^\\s*(?:${nextHeadings})\\s*$|\\z)`,
    "im"
  );

  return markdown.match(regex)?.[1]?.trim() ?? "";
}

function linesFromSection(value: string) {
  return value
    .split("\n")
    .map(cleanLine)
    .filter(Boolean)
    .filter((line) => !/^not specified\.?$/i.test(line));
}

function parseBugReportSections(markdown: string, summaryFallback: string): BugReportSections {
  const clean = stripMarkdown(markdown);
  const lines = clean
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const title = lines[0] && !SECTION_HEADINGS.includes(lines[0]) ? lines[0] : summaryFallback;
  const severity = findLabeledValue(clean, ["severity"]) || "Not specified";
  const priority = findLabeledValue(clean, ["priority"]) || "Not specified";

  return {
    title,
    severity,
    priority,
    summary: getSection(clean, "Summary") || summaryFallback,
    environment: linesFromSection(getSection(clean, "Environment")),
    stepsToReproduce: linesFromSection(getSection(clean, "Steps to Reproduce")),
    expectedResult: getSection(clean, "Expected Result"),
    actualResult: getSection(clean, "Actual Result"),
    impact: getSection(clean, "Impact"),
    missingInfo: linesFromSection(getSection(clean, "Missing Info")),
    followUpQuestions: linesFromSection(getSection(clean, "Follow-up Questions")),
    qaNotes: linesFromSection(getSection(clean, "QA Notes")),
    followUpHistory: linesFromSection(getSection(clean, "Follow-up History")),
    evidence: linesFromSection(getSection(clean, "Evidence")),
    logFindings: linesFromSection(getSection(clean, "Relevant Log Findings")),
  };
}

function makeText(text: string, marks?: JiraAdfTextNode["marks"]): JiraAdfTextNode {
  return { type: "text", text, ...(marks?.length ? { marks } : {}) };
}

function paragraph(text: string, marks?: JiraAdfTextNode["marks"]): JiraAdfParagraphNode {
  return {
    type: "paragraph",
    content: text ? [makeText(text, marks)] : [],
  };
}

function heading(text: string, level: 2 | 3 = 3): JiraAdfHeadingNode {
  return {
    type: "heading",
    attrs: { level },
    content: [makeText(text)],
  };
}

function bulletList(items: string[]): JiraAdfBulletListNode | null {
  const cleanItems = items.map(cleanLine).filter(Boolean);
  if (cleanItems.length === 0) return null;

  return {
    type: "bulletList",
    content: cleanItems.map((item) => ({
      type: "listItem",
      content: [paragraph(item)],
    })),
  };
}

function orderedList(items: string[]): JiraAdfOrderedListNode | null {
  const cleanItems = items.map(cleanLine).filter(Boolean);
  if (cleanItems.length === 0) return null;

  return {
    type: "orderedList",
    attrs: { order: 1 },
    content: cleanItems.map((item) => ({
      type: "listItem",
      content: [paragraph(item)],
    })),
  };
}

function pushParagraphIfPresent(content: JiraAdfNode[], title: string, value: string) {
  const clean = value.trim();
  if (!clean) return;

  content.push(heading(title));
  content.push(paragraph(clean));
}

function pushListIfPresent(content: JiraAdfNode[], title: string, items: string[], ordered = false) {
  const list = ordered ? orderedList(items) : bulletList(items);
  if (!list) return;

  content.push(heading(title));
  content.push(list);
}

function buildDescriptionAdf(input: JiraCreateIssueInput, summary: string): JiraAdfDoc {
  const markdown = stripMarkdown(asText(input.markdown));
  const sourceInput = stripMarkdown(asText(input.sourceInput));
  const bug = parseBugReportSections(markdown, summary);
  const content: JiraAdfNode[] = [];

  content.push(heading("Created from QAtalyst Bug Writer", 2));
  content.push(paragraph(`Summary: ${summary}`));
  content.push(paragraph(`Severity: ${bug.severity}`));
  content.push(paragraph(`Priority: ${bug.priority}`));
  content.push({ type: "rule" });

  pushParagraphIfPresent(content, "Bug Summary", bug.summary);
  pushListIfPresent(
    content,
    "Environment",
    bug.environment.length > 0 ? bug.environment : ["Not provided. Add device, OS/browser, app version, build, and repro rate."],
    false
  );
  pushListIfPresent(content, "Steps to Reproduce", bug.stepsToReproduce, true);
  pushParagraphIfPresent(content, "Expected Result", bug.expectedResult);
  pushParagraphIfPresent(content, "Actual Result", bug.actualResult);
  pushParagraphIfPresent(content, "Impact", bug.impact);
  pushListIfPresent(content, "Missing Info", bug.missingInfo, false);
  pushListIfPresent(content, "Follow-up Questions", bug.followUpQuestions, false);
  pushListIfPresent(content, "QA Notes", bug.qaNotes, false);
  pushListIfPresent(content, "Follow-up History", bug.followUpHistory, false);

  content.push(heading("Evidence / Attachments"));
  if (bug.evidence.length > 0) {
    const evidenceList = bulletList(bug.evidence);
    if (evidenceList) content.push(evidenceList);
  } else {
    content.push(paragraph("No evidence attached or referenced."));
  }

  pushListIfPresent(content, "Relevant Log Findings", bug.logFindings, false);

  if (sourceInput) {
    content.push({ type: "rule" });
    content.push(heading("Original Source Input"));
    content.push(paragraph(sourceInput));
  }

  content.push({ type: "rule" });
  content.push(paragraph("QA note: Review the generated report before treating this as release evidence."));

  return {
    type: "doc",
    version: 1,
    content,
  };
}

function adfToPlainText(doc: JiraAdfDoc) {
  const lines: string[] = [];

  for (const node of doc.content) {
    if (node.type === "heading") {
      lines.push(node.content.map((item) => item.text).join(""));
    }

    if (node.type === "paragraph") {
      lines.push(node.content?.map((item) => item.text).join("") ?? "");
    }

    if (node.type === "bulletList" || node.type === "orderedList") {
      node.content.forEach((item, index) => {
        const text = item.content
          .flatMap((paragraphNode) => paragraphNode.content ?? [])
          .map((textNode) => textNode.text)
          .join("");
        lines.push(node.type === "orderedList" ? `${index + 1}. ${text}` : `- ${text}`);
      });
    }

    if (node.type === "rule") {
      lines.push("");
    }
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function buildJiraIssueDraft(input: JiraCreateIssueInput, config: SafeJiraConfig): JiraIssueDraft {
  const markdown = stripMarkdown(asText(input.markdown));
  const summary = getSummary(markdown, input.structuredData);
  const priorityName = getPriorityName(markdown, input.structuredData);
  const descriptionAdf = buildDescriptionAdf(input, summary);

  return {
    summary,
    descriptionText: adfToPlainText(descriptionAdf),
    descriptionAdf,
    issueType: config.defaultBugIssueType || config.defaultIssueType || "Task",
    priorityName,
  };
}

function getJiraAuth(config: JiraConfigWithSecret) {
  const email = config.jiraEmail?.trim();
  const token = config.jiraApiToken?.trim();

  if (!email || !token) {
    return {
      ok: false as const,
      error: "Jira API credentials are not configured. Add Jira username/email and API token in Jira Integration settings.",
    };
  }

  return {
    ok: true as const,
    header: `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`,
  };
}

function cleanSiteUrl(value: string) {
  return value.trim().replace(/\/+$/, "").replace(/\/jira$/i, "");
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
    return `Invalid Jira issue type. This project may not support the configured bug issue type. Choose a supported type in Settings, such as Task, Story, or Bug if enabled. Jira said: ${String(record.errors.issuetype)}`;
  }

  if (record.errors?.priority) {
    return `Invalid Jira priority for this project. Jira said: ${String(record.errors.priority)}`;
  }

  if (record.errors?.summary) {
    return String(record.errors.summary);
  }

  if (record.errors?.project) {
    return String(record.errors.project);
  }

  return fallback;
}

export async function createJiraIssue(config: JiraConfigWithSecret, draft: JiraIssueDraft): Promise<
  | { ok: true; issue: JiraCreatedIssue }
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
  const endpoint = `${siteUrl}/rest/api/3/issue`;

  const fields: Record<string, unknown> = {
    project: { key: config.projectKey },
    summary: draft.summary,
    description: draft.descriptionAdf,
    issuetype: { name: draft.issueType },
  };

  if (draft.priorityName) {
    fields.priority = { name: draft.priorityName };
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: auth.header,
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
      browseUrl: `${siteUrl}/browse/${key}`,
    },
  };
}
