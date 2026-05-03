export type LinkedJiraTicket = {
  key: string;
  siteUrl: string;
  projectKey: string;
  browseUrl: string;
  source: "url";
};

export type ParsedJiraTicket = {
  key: string;
  summary: string;
  description: string;
  acceptanceCriteria: string[];
  priority: string;
  status: string;
  labels: string[];
  reporter: string;
  assignee: string;
  issueType: string;
  rawText: string;
  normalizedText: string;
  confidence: "high" | "medium" | "low";
  missingFields: string[];
  linkedTicket: LinkedJiraTicket | null;
};

type FieldMatch = { label: string; value: string };

const FIELD_LABELS = [
  "key", "issue key", "summary", "title", "description", "acceptance criteria",
  "acceptance", "criteria", "priority", "status", "labels", "label",
  "reporter", "assignee", "issue type", "type",
];

function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ \u00a0]+/g, " ")
    .trim();
}

function cleanLine(value: string) {
  return value.replace(/^\s*[-*•]\s+/, "").replace(/^\s*\d+[.)]\s+/, "").trim();
}

function normalizeLabel(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function getFieldRegex(label: string) {
  return new RegExp(`^\\s*(?:${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\\s*[:\\-]\\s*(.+?)\\s*$`, "i");
}

function findInlineField(text: string, labels: string[]): FieldMatch | null {
  for (const line of text.split("\n")) {
    for (const label of labels) {
      const match = line.match(getFieldRegex(label));
      if (match?.[1]?.trim()) return { label, value: match[1].trim() };
    }
  }
  return null;
}

export function parseJiraUrl(value: unknown): LinkedJiraTicket | null {
  const text = cleanText(value);
  const match = text.match(/https?:\/\/[^\s)]+\/browse\/([A-Z][A-Z0-9]+-\d+)/i);
  if (!match?.[0] || !match[1]) return null;

  try {
    const url = new URL(match[0]);
    const key = match[1].toUpperCase();
    const projectKey = key.split("-")[0] ?? "";
    const siteUrl = `${url.protocol}//${url.host}`;
    return { key, siteUrl, projectKey, browseUrl: `${siteUrl}/browse/${key}`, source: "url" };
  } catch {
    return null;
  }
}

function findTicketKey(text: string) {
  const linkedTicket = parseJiraUrl(text);
  if (linkedTicket?.key) return linkedTicket.key;

  const explicit = findInlineField(text, ["key", "issue key"]);
  if (explicit?.value) return explicit.value.toUpperCase();

  const match = text.match(/\b([A-Z][A-Z0-9]+-\d+)\b/);
  return match?.[1]?.toUpperCase() ?? "";
}

function findSection(text: string, labels: string[]) {
  const lines = text.split("\n");
  const normalizedLabels = labels.map(normalizeLabel);
  let startIndex = -1;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    const labelCandidate = normalizeLabel(line.replace(/[:\-]\s*$/, ""));

    if (normalizedLabels.includes(labelCandidate)) {
      startIndex = index + 1;
      break;
    }

    for (const label of labels) {
      const inlineMatch = line.match(getFieldRegex(label));
      if (inlineMatch?.[1]?.trim()) return inlineMatch[1].trim();
    }
  }

  if (startIndex < 0) return "";

  const bodyLines: string[] = [];
  const normalizedFieldLabels = FIELD_LABELS.map(normalizeLabel);

  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index];
    const normalized = normalizeLabel(line.trim().replace(/[:\-]\s*$/, ""));
    if (normalizedFieldLabels.includes(normalized)) break;
    if (FIELD_LABELS.some((label) => getFieldRegex(label).test(line))) break;
    bodyLines.push(line);
  }

  return bodyLines.join("\n").trim();
}

function findSummary(text: string) {
  const explicit = findInlineField(text, ["summary", "title"]);
  if (explicit?.value) return explicit.value;

  const linkedTicket = parseJiraUrl(text);
  if (linkedTicket && text.trim() === linkedTicket.browseUrl) {
    return `Linked Jira ticket ${linkedTicket.key}`;
  }

  const key = findTicketKey(text);
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);

  if (key) {
    const keyLine = lines.find((line) => line.includes(key));
    if (keyLine) {
      const stripped = keyLine
        .replace(linkedTicket?.browseUrl ?? "", "")
        .replace(key, "")
        .replace(/^[:\-\s]+/, "")
        .trim();
      if (stripped) return stripped;
    }
  }

  return lines.find((line) => !/^https?:\/\//i.test(line) && !FIELD_LABELS.some((label) => getFieldRegex(label).test(line))) ?? "";
}

function parseList(value: string) {
  return value.split(/\n|,/).map(cleanLine).filter(Boolean);
}

function findLabels(text: string) {
  const explicit = findInlineField(text, ["labels", "label"]);
  return explicit?.value ? explicit.value.split(/[,;]/).map((label) => label.trim()).filter(Boolean) : [];
}

function findAcceptanceCriteria(text: string) {
  const section = findSection(text, ["acceptance criteria", "acceptance", "criteria"]);
  if (section) return parseList(section);

  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /^(given|when|then|must|should|user can|system should|verify|ensure)\b/i.test(cleanLine(line)))
    .map(cleanLine);
}

function findDescription(text: string) {
  const explicit = findSection(text, ["description"]);
  if (explicit) return explicit;

  const linkedTicket = parseJiraUrl(text);
  if (linkedTicket && text.trim() === linkedTicket.browseUrl) {
    return [
      `Linked Jira ticket: ${linkedTicket.key}`,
      `Jira URL: ${linkedTicket.browseUrl}`,
      "",
      "QAtalyst has the ticket link but has not fetched live Jira fields yet.",
      "Use the linked ticket as context, or paste the full Jira description for richer analysis.",
    ].join("\n");
  }

  const summary = findSummary(text);
  const key = findTicketKey(text);

  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line !== summary && line !== key)
    .filter((line) => !FIELD_LABELS.some((label) => getFieldRegex(label).test(line)))
    .slice(0, 12)
    .join("\n");
}

function findSimpleField(text: string, labels: string[]) {
  return findInlineField(text, labels)?.value ?? "";
}

function buildNormalizedText(ticket: Omit<ParsedJiraTicket, "normalizedText" | "missingFields" | "confidence">) {
  const acceptance = ticket.acceptanceCriteria.length
    ? ticket.acceptanceCriteria.map((item) => `- ${item}`).join("\n")
    : "- Not provided.";

  const linkedBlock = ticket.linkedTicket
    ? `Linked Jira Ticket: ${ticket.linkedTicket.key}\nJira URL: ${ticket.linkedTicket.browseUrl}\nJira Project: ${ticket.linkedTicket.projectKey}\n\n`
    : "";

  return [
    linkedBlock,
    ticket.key ? `Jira Key: ${ticket.key}` : "Jira Key: Not provided.",
    `Issue Type: ${ticket.issueType || "Not provided."}`,
    `Summary: ${ticket.summary || "Not provided."}`,
    `Status: ${ticket.status || "Not provided."}`,
    `Priority: ${ticket.priority || "Not provided."}`,
    `Labels: ${ticket.labels.length ? ticket.labels.join(", ") : "Not provided."}`,
    `Reporter: ${ticket.reporter || "Not provided."}`,
    `Assignee: ${ticket.assignee || "Not provided."}`,
    "",
    "Description:",
    ticket.description || "Not provided.",
    "",
    "Acceptance Criteria:",
    acceptance,
  ].filter(Boolean).join("\n");
}

function calculateMissingFields(ticket: Omit<ParsedJiraTicket, "normalizedText" | "missingFields" | "confidence">) {
  const missing: string[] = [];
  if (!ticket.key) missing.push("Jira key");
  if (!ticket.summary) missing.push("Summary");
  if (!ticket.description) missing.push("Description");
  if (ticket.acceptanceCriteria.length === 0) missing.push("Acceptance criteria");
  if (!ticket.priority) missing.push("Priority");

  if (ticket.linkedTicket) {
    return missing.filter((field) => !["Jira key", "Summary", "Description"].includes(field));
  }

  return missing;
}

function calculateConfidence(missingFields: string[], linkedTicket: LinkedJiraTicket | null): ParsedJiraTicket["confidence"] {
  if (linkedTicket && missingFields.length <= 2) return "medium";
  if (missingFields.length <= 1) return "high";
  if (missingFields.length <= 3) return "medium";
  return "low";
}

export function parseJiraTicket(rawValue: unknown): ParsedJiraTicket {
  const rawText = cleanText(rawValue);
  const normalizedRaw = rawText.replace(/\n{3,}/g, "\n\n");
  const linkedTicket = parseJiraUrl(normalizedRaw);

  const partial = {
    key: findTicketKey(normalizedRaw),
    summary: findSummary(normalizedRaw),
    description: findDescription(normalizedRaw),
    acceptanceCriteria: findAcceptanceCriteria(normalizedRaw),
    priority: findSimpleField(normalizedRaw, ["priority"]),
    status: findSimpleField(normalizedRaw, ["status"]),
    labels: findLabels(normalizedRaw),
    reporter: findSimpleField(normalizedRaw, ["reporter"]),
    assignee: findSimpleField(normalizedRaw, ["assignee"]),
    issueType: findSimpleField(normalizedRaw, ["issue type", "type"]),
    rawText: normalizedRaw,
    linkedTicket,
  };

  const missingFields = calculateMissingFields(partial);
  const confidence = calculateConfidence(missingFields, linkedTicket);
  const normalizedText = buildNormalizedText(partial);

  return { ...partial, normalizedText, missingFields, confidence };
}

export function getJiraImportSummary(ticket: ParsedJiraTicket) {
  if (ticket.linkedTicket) {
    return `${ticket.linkedTicket.key} • linked by URL • ${ticket.confidence} confidence`;
  }

  return [
    ticket.key || "No key",
    ticket.summary || "No summary",
    `${ticket.acceptanceCriteria.length} acceptance criteria`,
    `${ticket.confidence} confidence`,
  ].join(" • ");
}
