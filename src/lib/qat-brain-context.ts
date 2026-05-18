import { buildProjectSourceContextBlock, listProjectSources } from "@/lib/project-sources";

export type QAtBrainContextItemKind = "source" | "rule" | "term" | "risk" | "feature";

export type QAtBrainContextItem = {
  kind: QAtBrainContextItemKind;
  id?: string;
  title: string;
  type?: string;
  text: string;
  score: number;
};

export type QAtBrainContextResult = {
  contextBlock: string;
  usedItems: Array<{ kind: QAtBrainContextItemKind; id?: string; title: string; type?: string }>;
  missingContext: string[];
  totalEnabledItems: number;
};

type BuildQAtBrainContextInput = {
  userId: string;
  projectId: string;
  question: string;
  maxCharacters?: number;
};

type MaybeBrainCollection = {
  ok?: boolean;
  rules?: unknown[];
  terms?: unknown[];
  risks?: unknown[];
  features?: unknown[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => asString(item)).filter(Boolean);
  return asString(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isEnabled(value: Record<string, unknown>): boolean {
  return typeof value.isEnabled === "boolean" ? value.isEnabled : true;
}

function questionTerms(question: string): string[] {
  const stopWords = new Set([
    "about",
    "after",
    "again",
    "also",
    "because",
    "before",
    "could",
    "from",
    "have",
    "into",
    "know",
    "like",
    "need",
    "project",
    "qat",
    "qatalyst",
    "should",
    "that",
    "their",
    "there",
    "this",
    "what",
    "when",
    "where",
    "which",
    "with",
    "would",
    "your",
  ]);

  return Array.from(
    new Set(
      question
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .map((word) => word.trim())
        .filter((word) => word.length >= 3 && !stopWords.has(word))
    )
  ).slice(0, 24);
}

function scoreText(text: string, terms: string[]): number {
  const normalized = text.toLowerCase();
  return terms.reduce((score, term) => score + (normalized.includes(term) ? 4 : 0), 0);
}

function truncate(value: string, max: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 1)).trim()}…`;
}

function itemBlock(item: QAtBrainContextItem): string {
  return [`${item.kind.toUpperCase()}: ${item.title}`, item.type ? `Type: ${item.type}` : "", "", item.text]
    .filter(Boolean)
    .join("\n");
}

async function fetchLocalJson(path: string): Promise<MaybeBrainCollection | null> {
  try {
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const response = await fetch(`${baseUrl}${path}`, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json().catch(() => null)) as MaybeBrainCollection | null;
  } catch {
    return null;
  }
}

function rulesToItems(values: unknown[], terms: string[]): QAtBrainContextItem[] {
  return values
    .map(asRecord)
    .filter(isEnabled)
    .map((rule) => {
      const title = asString(rule.title) || "QA rule";
      const category = asString(rule.category);
      const severity = asString(rule.severity);
      const appliesTo = asStringArray(rule.appliesTo);
      const body = asString(rule.body);
      const text = [`Category: ${category}`, `Severity: ${severity}`, appliesTo.length ? `Applies to: ${appliesTo.join(", ")}` : "", body]
        .filter(Boolean)
        .join("\n");
      const searchable = [title, category, severity, appliesTo.join(" "), body].join(" ");
      return { kind: "rule" as const, id: asString(rule.id), title, type: category || severity, text, score: 2 + scoreText(searchable, terms) };
    });
}

function termsToItems(values: unknown[], terms: string[]): QAtBrainContextItem[] {
  return values
    .map(asRecord)
    .filter(isEnabled)
    .map((term) => {
      const title = asString(term.term) || "Terminology";
      const category = asString(term.category);
      const aliases = asStringArray(term.aliases);
      const definition = asString(term.definition);
      const preferredUsage = asString(term.preferredUsage);
      const text = [category ? `Category: ${category}` : "", aliases.length ? `Aliases: ${aliases.join(", ")}` : "", definition, preferredUsage ? `Preferred usage: ${preferredUsage}` : ""]
        .filter(Boolean)
        .join("\n");
      const searchable = [title, category, aliases.join(" "), definition, preferredUsage].join(" ");
      return { kind: "term" as const, id: asString(term.id), title, type: category, text, score: 2 + scoreText(searchable, terms) };
    });
}

function risksToItems(values: unknown[], terms: string[]): QAtBrainContextItem[] {
  return values
    .map(asRecord)
    .filter(isEnabled)
    .map((risk) => {
      const title = asString(risk.title) || "Risk / hotspot";
      const area = asString(risk.area);
      const riskType = asString(risk.riskType);
      const severity = asString(risk.severity);
      const likelihood = asString(risk.likelihood);
      const description = asString(risk.description);
      const testingGuidance = asString(risk.testingGuidance);
      const tags = asStringArray(risk.relatedTags);
      const text = [
        area ? `Area: ${area}` : "",
        riskType ? `Risk type: ${riskType}` : "",
        severity ? `Severity: ${severity}` : "",
        likelihood ? `Likelihood: ${likelihood}` : "",
        tags.length ? `Tags: ${tags.join(", ")}` : "",
        description,
        testingGuidance ? `Testing guidance: ${testingGuidance}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      const searchable = [title, area, riskType, severity, likelihood, tags.join(" "), description, testingGuidance].join(" ");
      return { kind: "risk" as const, id: asString(risk.id), title, type: riskType || severity, text, score: 2 + scoreText(searchable, terms) };
    });
}

function featuresToItems(values: unknown[], terms: string[]): QAtBrainContextItem[] {
  return values
    .map(asRecord)
    .filter(isEnabled)
    .map((feature) => {
      const title = asString(feature.name) || "Feature";
      const area = asString(feature.area);
      const lifecycleState = asString(feature.lifecycleState);
      const description = asString(feature.description);
      const dependencies = asStringArray(feature.dependencies);
      const tags = asStringArray(feature.relatedTags);
      const text = [
        area ? `Area: ${area}` : "",
        lifecycleState ? `Lifecycle state: ${lifecycleState}` : "",
        dependencies.length ? `Dependencies: ${dependencies.join(", ")}` : "",
        tags.length ? `Tags: ${tags.join(", ")}` : "",
        description,
      ]
        .filter(Boolean)
        .join("\n");
      const searchable = [title, area, lifecycleState, dependencies.join(" "), tags.join(" "), description].join(" ");
      return { kind: "feature" as const, id: asString(feature.id), title, type: lifecycleState || area, text, score: 2 + scoreText(searchable, terms) };
    });
}

export async function buildQAtBrainContext({ userId, projectId, question, maxCharacters = 14000 }: BuildQAtBrainContextInput): Promise<QAtBrainContextResult> {
  const terms = questionTerms(question);
  const missingContext: string[] = [];
  const items: QAtBrainContextItem[] = [];

  const sources = await listProjectSources(userId, projectId);
  const enabledSources = sources.filter((source) => source.isEnabled);
  const sourceContext = buildProjectSourceContextBlock(enabledSources, Math.min(8000, maxCharacters));

  for (const source of enabledSources) {
    const text = truncate(source.body, 1400);
    const searchable = [source.title, source.sourceType, source.tags.join(" "), source.body].join(" ");
    items.push({ kind: "source", id: source.id, title: source.title, type: source.sourceType, text, score: 3 + scoreText(searchable, terms) });
  }

  if (!sources.length) missingContext.push("Source Vault entries");
  else if (!enabledSources.length || !sourceContext.trim()) missingContext.push("Enabled Source Vault context");

  const [rulesPayload, termsPayload, risksPayload, featuresPayload] = await Promise.all([
    fetchLocalJson(`/api/projects/${encodeURIComponent(projectId)}/rules`),
    fetchLocalJson(`/api/projects/${encodeURIComponent(projectId)}/terms`),
    fetchLocalJson(`/api/projects/${encodeURIComponent(projectId)}/risks`),
    fetchLocalJson(`/api/projects/${encodeURIComponent(projectId)}/features`),
  ]);

  const ruleItems = rulesToItems(rulesPayload?.rules ?? [], terms);
  const termItems = termsToItems(termsPayload?.terms ?? [], terms);
  const riskItems = risksToItems(risksPayload?.risks ?? [], terms);
  const featureItems = featuresToItems(featuresPayload?.features ?? [], terms);

  if (!ruleItems.length) missingContext.push("Enabled QA rules");
  if (!termItems.length) missingContext.push("Enabled terminology");
  if (!riskItems.length) missingContext.push("Enabled risks / hotspots");
  if (!featureItems.length) missingContext.push("Enabled feature registry items");

  items.push(...ruleItems, ...termItems, ...riskItems, ...featureItems);

  const rankedItems = items.sort((a, b) => b.score - a.score).slice(0, 10);
  const blocks: string[] = [];
  let used = 0;

  for (const item of rankedItems) {
    const block = itemBlock(item);
    if (used + block.length > maxCharacters) break;
    blocks.push(block);
    used += block.length;
  }

  return {
    contextBlock: blocks.join("\n\n---\n\n"),
    usedItems: rankedItems.slice(0, blocks.length).map((item) => ({ kind: item.kind, id: item.id, title: item.title, type: item.type })),
    missingContext: Array.from(new Set(missingContext)),
    totalEnabledItems: items.length,
  };
}
