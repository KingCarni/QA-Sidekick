import type { SafeProjectSource } from "@/lib/project-sources";

export type SourceRelevanceSignal = {
  term: string;
  weight: number;
};

export type RankedProjectSource = SafeProjectSource & {
  relevanceScore: number;
  matchedTerms: string[];
  relevanceReason: string;
  isSuggested: boolean;
};

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "when", "then", "than", "have", "has",
  "user", "users", "should", "would", "could", "about", "there", "their", "them", "they", "your",
  "test", "tests", "case", "cases", "qa", "qatalyst", "jira", "issue", "ticket", "source", "context",
]);

function normalizeText(value: unknown): string {
  return String(value ?? "").toLowerCase();
}

function tokenize(value: unknown): string[] {
  return normalizeText(value)
    .replace(/[^a-z0-9#-]+/g, " ")
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3)
    .filter((term) => !STOP_WORDS.has(term));
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values));
}

function buildSignals(input: string, toolId = ""): SourceRelevanceSignal[] {
  const rawTerms = tokenize(input);
  const termCounts = new Map<string, number>();

  rawTerms.forEach((term) => {
    termCounts.set(term, (termCounts.get(term) ?? 0) + 1);
  });

  const signals: SourceRelevanceSignal[] = Array.from(termCounts.entries()).map(([term, count]) => ({
    term,
    weight: Math.min(5, 1 + count),
  }));

  const normalizedTool = normalizeText(toolId);

  if (normalizedTool.includes("bug")) {
    signals.push(
      { term: "bug", weight: 4 },
      { term: "repro", weight: 3 },
      { term: "environment", weight: 3 },
      { term: "logs", weight: 2 },
      { term: "evidence", weight: 2 }
    );
  }

  if (normalizedTool.includes("risk")) {
    signals.push(
      { term: "risk", weight: 4 },
      { term: "regression", weight: 3 },
      { term: "failure", weight: 3 },
      { term: "requirements", weight: 2 }
    );
  }

  if (normalizedTool.includes("tests") || normalizedTool.includes("test")) {
    signals.push(
      { term: "acceptance", weight: 3 },
      { term: "criteria", weight: 3 },
      { term: "workflow", weight: 2 },
      { term: "regression", weight: 2 }
    );
  }

  if (normalizedTool.includes("improve")) {
    signals.push(
      { term: "coverage", weight: 3 },
      { term: "assertions", weight: 3 },
      { term: "gaps", weight: 2 }
    );
  }

  return signals;
}

function scoreSource(source: SafeProjectSource, signals: SourceRelevanceSignal[]) {
  const sourceTitle = tokenize(source.title);
  const sourceType = tokenize(source.sourceType);
  const sourceTags = source.tags.flatMap(tokenize);
  const sourceBody = tokenize(source.body);

  const titleSet = new Set(sourceTitle);
  const typeSet = new Set(sourceType);
  const tagSet = new Set(sourceTags);
  const bodySet = new Set(sourceBody);

  let score = 0;
  const matchedTerms: string[] = [];

  signals.forEach((signal) => {
    let matched = false;

    if (titleSet.has(signal.term)) {
      score += signal.weight * 8;
      matched = true;
    }

    if (tagSet.has(signal.term)) {
      score += signal.weight * 6;
      matched = true;
    }

    if (typeSet.has(signal.term)) {
      score += signal.weight * 4;
      matched = true;
    }

    if (bodySet.has(signal.term)) {
      score += signal.weight * 2;
      matched = true;
    }

    if (matched) {
      matchedTerms.push(signal.term);
    }
  });

  // Broad product overview / QA standards are useful defaults, but should not drown out specific sources.
  if (/overview|standards|strategy|rules/i.test(source.sourceType) || /overview|standards|strategy|rules/i.test(source.title)) {
    score += 8;
  }

  return {
    score,
    matchedTerms: uniqueValues(matchedTerms).slice(0, 10),
  };
}

export function rankProjectSourcesForInput(
  sources: SafeProjectSource[],
  input: string,
  toolId = "",
  maxSuggested = 4
): RankedProjectSource[] {
  const enabledSources = sources.filter((source) => source.isEnabled);
  const signals = buildSignals(input, toolId);

  return enabledSources
    .map((source) => {
      const scored = scoreSource(source, signals);
      const matchedCount = scored.matchedTerms.length;
      const isSuggested = scored.score >= 10 || matchedCount >= 2;

      return {
        ...source,
        relevanceScore: Math.round(scored.score),
        matchedTerms: scored.matchedTerms,
        isSuggested,
        relevanceReason:
          matchedCount > 0
            ? `Matched ${matchedCount} source term${matchedCount === 1 ? "" : "s"}: ${scored.matchedTerms.join(", ")}.`
            : "Useful enabled project source, but no strong term match was detected.",
      };
    })
    .sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
      return a.title.localeCompare(b.title);
    })
    .map((source, index) => ({
      ...source,
      isSuggested: source.isSuggested || index < Math.min(maxSuggested, enabledSources.length),
    }));
}

export function buildSelectedProjectContextBlock(
  projectContextBlock: string,
  rankedSources: RankedProjectSource[],
  selectedSourceIds: string[],
  maxCharacters = 14000
): string {
  if (selectedSourceIds.length === 0) return "";

  const selected = rankedSources.filter((source) => selectedSourceIds.includes(source.id));

  const selectedBlock = selected
    .map((source) =>
      [
        `Source: ${source.title}`,
        `Type: ${source.sourceType}`,
        source.tags.length ? `Tags: ${source.tags.join(", ")}` : "",
        source.matchedTerms.length ? `Matched Terms: ${source.matchedTerms.join(", ")}` : "",
        "",
        source.body,
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n\n---\n\n");

  const rulesStart = projectContextBlock.indexOf("PROJECT CONTEXT RULES");
  const rules = rulesStart >= 0 ? projectContextBlock.slice(rulesStart) : "";

  return [
    "PROJECT CONTEXT MEMORY",
    "",
    "SELECTED PROJECT SOURCES",
    "",
    selectedBlock,
    "",
    rules,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, maxCharacters);
}
