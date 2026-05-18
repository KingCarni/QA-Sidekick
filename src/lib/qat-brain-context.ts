import { prisma } from "@/lib/prisma";
import { buildProjectSourceContextBlock, listProjectSources } from "@/lib/project-sources";

export type QAtBrainContextItem = {
  kind: "source" | "rule" | "term" | "risk" | "feature";
  id?: string;
  title: string;
  type?: string;
  text: string;
};

export type QAtBrainContextResult = {
  contextBlock: string;
  usedItems: QAtBrainContextItem[];
  missingContext: string[];
  totalEnabledItems: number;
};

function normalizeWords(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 4);
}

function scoreItem(questionWords: string[], item: QAtBrainContextItem): number {
  if (!questionWords.length) return 0;

  const haystack = `${item.title}\n${item.type ?? ""}\n${item.text}`.toLowerCase();

  return questionWords.reduce(
    (score, word) => score + (haystack.includes(word) ? 1 : 0),
    0
  );
}

function takeBoundedBlocks(
  items: QAtBrainContextItem[],
  maxCharacters: number
): QAtBrainContextItem[] {
  const selected: QAtBrainContextItem[] = [];
  let used = 0;

  for (const item of items) {
    const blockLength = item.text.length + item.title.length + 80;

    if (selected.length && used + blockLength > maxCharacters) {
      continue;
    }

    selected.push(item);
    used += blockLength;

    if (used >= maxCharacters) break;
  }

  return selected;
}

function sourceItemsFromContext(
  contextBlock: string,
  sources: Array<{ id: string; title: string; sourceType: string }>
): QAtBrainContextItem[] {
  const blocks = contextBlock.split("\n\n---\n\n").filter(Boolean);

  return blocks.map((block, index) => {
    const source = sources[index];

    return {
      kind: "source",
      id: source?.id,
      title: source?.title ?? `Source ${index + 1}`,
      type: source?.sourceType ?? "source",
      text: block,
    };
  });
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item)).filter(Boolean)
    : [];
}

export async function buildQAtBrainContext({
  userId,
  projectId,
  question,
  maxCharacters = 14000,
}: {
  userId: string;
  projectId: string;
  question: string;
  maxCharacters?: number;
}): Promise<QAtBrainContextResult> {
  const sources = await listProjectSources(userId, projectId);

  const enabledSources = sources.filter((source) => source.isEnabled);

  const sourceContextBlock = buildProjectSourceContextBlock(
    enabledSources,
    8000
  );

  const [rules, terms, risks, features] = await Promise.all([
    prisma.qAProjectRule
      .findMany({
        where: { projectId, isEnabled: true },
        orderBy: { updatedAt: "desc" },
        take: 20,
      })
      .catch(() => []),

    prisma.qAProjectTerm
      .findMany({
        where: { projectId, isEnabled: true },
        orderBy: { updatedAt: "desc" },
        take: 20,
      })
      .catch(() => []),

    prisma.qAProjectRisk
      .findMany({
        where: { projectId, isEnabled: true },
        orderBy: { updatedAt: "desc" },
        take: 20,
      })
      .catch(() => []),

    prisma.qAProjectFeature
      .findMany({
        where: { projectId, isEnabled: true },
        orderBy: { updatedAt: "desc" },
        take: 20,
      })
      .catch(() => []),
  ]);

  const sourceItems = sourceItemsFromContext(
    sourceContextBlock,
    enabledSources.map((source) => ({
      id: source.id,
      title: source.title,
      sourceType: source.sourceType,
    }))
  );

  const ruleItems: QAtBrainContextItem[] = rules.map((rule) => ({
    kind: "rule",
    id: rule.id,
    title: rule.title,
    type: `${rule.category} · ${rule.severity}`,
    text: [
      `QA Rule: ${rule.title}`,
      `Category: ${rule.category}`,
      `Severity: ${rule.severity}`,
      `Applies to: ${asStringArray(rule.appliesTo).join(", ")}`,
      "",
      rule.body,
    ].join("\n"),
  }));

  const termItems: QAtBrainContextItem[] = terms.map((term) => ({
    kind: "term",
    id: term.id,
    title: term.term,
    type: term.category,
    text: [
      `Terminology: ${term.term}`,
      `Category: ${term.category}`,
      asStringArray(term.aliases).length
        ? `Aliases: ${asStringArray(term.aliases).join(", ")}`
        : "",
      term.preferredUsage
        ? `Preferred usage: ${term.preferredUsage}`
        : "",
      "",
      term.definition,
    ]
      .filter(Boolean)
      .join("\n"),
  }));

  const riskItems: QAtBrainContextItem[] = risks.map((risk) => ({
    kind: "risk",
    id: risk.id,
    title: risk.title,
    type: `${risk.riskType} · ${risk.severity}`,
    text: [
      `Risk / Hotspot: ${risk.title}`,
      `Area: ${risk.area}`,
      `Risk type: ${risk.riskType}`,
      `Severity: ${risk.severity}`,
      `Likelihood: ${risk.likelihood}`,
      asStringArray(risk.relatedTags).length
        ? `Tags: ${asStringArray(risk.relatedTags).join(", ")}`
        : "",
      "",
      risk.description,
      risk.testingGuidance
        ? `Testing guidance: ${risk.testingGuidance}`
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
  }));

  const featureItems: QAtBrainContextItem[] = features.map((feature) => ({
    kind: "feature",
    id: feature.id,
    title: feature.name,
    type: feature.lifecycleState,
    text: [
      `Feature: ${feature.name}`,
      `Area: ${feature.area}`,
      `Lifecycle: ${feature.lifecycleState}`,
      asStringArray(feature.dependencies).length
        ? `Dependencies: ${asStringArray(feature.dependencies).join(", ")}`
        : "",
      asStringArray(feature.relatedTags).length
        ? `Tags: ${asStringArray(feature.relatedTags).join(", ")}`
        : "",
      "",
      feature.description,
    ]
      .filter(Boolean)
      .join("\n"),
  }));

  const allItems = [
    ...sourceItems,
    ...ruleItems,
    ...termItems,
    ...riskItems,
    ...featureItems,
  ];

  const questionWords = normalizeWords(question);

  const ranked = allItems
    .map((item, index) => ({
      item,
      index,
      score: scoreItem(questionWords, item),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const relevant = ranked.some((entry) => entry.score > 0)
    ? ranked.filter((entry) => entry.score > 0).map((entry) => entry.item)
    : ranked.map((entry) => entry.item);

  const usedItems = takeBoundedBlocks(relevant, maxCharacters);

  const missingContext: string[] = [];

  if (!enabledSources.length) {
    missingContext.push("Enabled Source Vault context");
  }

  if (!ruleItems.length) {
    missingContext.push("Enabled QA rules");
  }

  if (!termItems.length) {
    missingContext.push("Enabled terminology");
  }

  if (!riskItems.length) {
    missingContext.push("Enabled risks/hotspots");
  }

  if (!featureItems.length) {
    missingContext.push("Enabled feature registry items");
  }

  return {
    contextBlock: usedItems
      .map((item) =>
        [
          `[${item.kind.toUpperCase()}] ${item.title}`,
          item.type ? `Type: ${item.type}` : "",
          "",
          item.text,
        ]
          .filter(Boolean)
          .join("\n")
      )
      .join("\n\n---\n\n"),

    usedItems,
    missingContext,
    totalEnabledItems: allItems.length,
  };
}