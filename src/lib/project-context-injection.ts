export type ProjectContextSource = {
  id?: unknown;
  title?: unknown;
  name?: unknown;
  sourceType?: unknown;
  type?: unknown;
  tags?: unknown;
  body?: unknown;
  content?: unknown;
  text?: unknown;
  enabled?: unknown;
  selected?: unknown;
};

export type ProjectContextInput = {
  projectId?: unknown;
  projectName?: unknown;
  productType?: unknown;
  projectDescription?: unknown;
  sources?: ProjectContextSource[];
  selectedSourceIds?: string[];
  maxCharacters?: number;
};

export type ProjectContextPayload = {
  projectContextUsed: boolean;
  selectedProjectId: string;
  selectedProjectName: string;
  selectedProjectSourceIds: string[];
  projectContextSummary: string;
  projectContextBlock: string;
};

function safeString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function normalizeId(value: unknown): string {
  return safeString(value);
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(safeString).filter(Boolean);
  }

  return safeString(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function compactWhitespace(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function truncateAtWord(value: string, maxCharacters: number): string {
  const normalized = compactWhitespace(value);
  if (normalized.length <= maxCharacters) return normalized;

  const clipped = normalized.slice(0, maxCharacters);
  const lastSpace = clipped.lastIndexOf(" ");
  const safeClip = lastSpace > maxCharacters * 0.75 ? clipped.slice(0, lastSpace) : clipped;

  return `${safeClip.trim()}\n\n[Project context truncated for prompt size.]`;
}

function sourceTitle(source: ProjectContextSource): string {
  return safeString(source.title) || safeString(source.name) || "Untitled source";
}

function sourceType(source: ProjectContextSource): string {
  return safeString(source.sourceType) || safeString(source.type) || "Project Source";
}

function sourceBody(source: ProjectContextSource): string {
  return safeString(source.body) || safeString(source.content) || safeString(source.text);
}

function isSourceEnabled(source: ProjectContextSource): boolean {
  if (typeof source.enabled === "boolean") return source.enabled;
  if (typeof source.selected === "boolean") return source.selected;
  return true;
}

function selectSources(sources: ProjectContextSource[], selectedSourceIds: string[]): ProjectContextSource[] {
  const enabledSources = sources.filter(isSourceEnabled);

  if (selectedSourceIds.length === 0) {
    return enabledSources;
  }

  const selectedSet = new Set(selectedSourceIds);
  return enabledSources.filter((source) => selectedSet.has(normalizeId(source.id)));
}

export function buildProjectContextPayload(input: ProjectContextInput): ProjectContextPayload {
  const maxCharacters = input.maxCharacters ?? 12000;
  const projectId = normalizeId(input.projectId);
  const projectName = safeString(input.projectName);
  const productType = safeString(input.productType);
  const projectDescription = safeString(input.projectDescription);
  const selectedSourceIds = (input.selectedSourceIds ?? []).map(String).filter(Boolean);
  const selectedSources = selectSources(input.sources ?? [], selectedSourceIds);
  const sourceIdsUsed = selectedSources.map((source) => normalizeId(source.id)).filter(Boolean);

  const sourceBlocks = selectedSources
    .map((source, index) => {
      const title = sourceTitle(source);
      const type = sourceType(source);
      const tags = stringList(source.tags);
      const body = sourceBody(source);

      if (!body) return "";

      return [
        `### Source ${index + 1}: ${title}`,
        `Type: ${type}`,
        tags.length > 0 ? `Tags: ${tags.join(", ")}` : "",
        "",
        body,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .filter(Boolean);

  const hasProjectInfo = Boolean(projectName || productType || projectDescription);
  const hasSources = sourceBlocks.length > 0;
  const projectContextUsed = hasProjectInfo || hasSources;

  if (!projectContextUsed) {
    return {
      projectContextUsed: false,
      selectedProjectId: projectId,
      selectedProjectName: projectName,
      selectedProjectSourceIds: [],
      projectContextSummary: "No project context used.",
      projectContextBlock: "",
    };
  }

  const rawBlock = [
    "## PROJECT CONTEXT MEMORY",
    "",
    "Use this section as reusable product context only. It may inform terminology, platform assumptions, risk areas, and testing strategy.",
    "Do not treat project context as ticket-specific fact unless the current Jira/pasted source also supports it.",
    "Do not invent behavior, implementation details, evidence, repro steps, acceptance criteria, or user impact from project context alone.",
    "",
    projectName ? `Project: ${projectName}` : "",
    productType ? `Product Type: ${productType}` : "",
    projectDescription ? `Project Description:\n${projectDescription}` : "",
    hasSources ? "### Selected Project Sources" : "",
    ...sourceBlocks,
    "",
    "## END PROJECT CONTEXT MEMORY",
  ]
    .filter(Boolean)
    .join("\n");

  const projectContextBlock = truncateAtWord(rawBlock, maxCharacters);
  const projectContextSummary = [
    projectName ? projectName : "Selected project",
    hasSources ? `${sourceBlocks.length} source${sourceBlocks.length === 1 ? "" : "s"} used` : "project details only",
  ].join(" · ");

  return {
    projectContextUsed,
    selectedProjectId: projectId,
    selectedProjectName: projectName,
    selectedProjectSourceIds: sourceIdsUsed,
    projectContextSummary,
    projectContextBlock,
  };
}

export function appendProjectContextToInput(sourceInput: string, contextBlock?: string): string {
  const cleanSource = safeString(sourceInput);
  const cleanContext = safeString(contextBlock);

  if (!cleanContext) return cleanSource;

  return [
    cleanContext,
    "",
    "## CURRENT USER/JIRA SOURCE",
    "",
    "Use this section as the active source for this run. This is the source that should drive the generated QA artifact.",
    "",
    cleanSource || "[No pasted/Jira source provided.]",
  ].join("\n");
}

export function buildProjectContextPromptRules(): string {
  return [
    "PROJECT CONTEXT RULES:",
    "- Project context memory may inform terminology, known product areas, platform assumptions, and QA strategy.",
    "- The current pasted/Jira source remains the primary source for the generated artifact.",
    "- Do not invent ticket-specific facts from project context.",
    "- If project context suggests a useful risk or test area, phrase it as a recommendation or assumption unless the active source confirms it.",
    "- If selected project context is irrelevant to the active source, ignore it instead of forcing it into output.",
  ].join("\n");
}
