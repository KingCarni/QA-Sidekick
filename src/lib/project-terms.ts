import { prisma } from "@/lib/prisma";

export type ProjectTermPayload = {
  term: string;
  definition: string;
  aliases: string[];
  preferredUsage: string;
  category: string;
  isEnabled: boolean;
};

export type SafeProjectTerm = {
  id: string;
  projectId: string;
  term: string;
  definition: string;
  aliases: string[];
  preferredUsage: string | null;
  category: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export const PROJECT_TERM_CATEGORIES = [
  "product",
  "feature",
  "role",
  "acronym",
  "system",
  "integration",
  "workflow",
  "qa-language",
  "business-domain",
  "other",
] as const;

const CATEGORY_SET = new Set<string>(PROJECT_TERM_CATEGORIES);

function cleanText(value: unknown, max = 2400): string {
  return String(value ?? "").trim().replace(/\r\n/g, "\n").slice(0, max);
}

function cleanSlug(value: unknown, fallback: string): string {
  return String(value ?? fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || fallback;
}

function normalizeAliases(value: unknown): string[] {
  const rawValues = Array.isArray(value)
    ? value
    : String(value ?? "")
        .split(",")
        .map((item) => item.trim());

  return Array.from(
    new Set(
      rawValues
        .map((item) => cleanText(item, 80).replace(/\s+/g, " "))
        .filter(Boolean)
    )
  ).slice(0, 12);
}

export function normalizeProjectTermPayload(value: {
  term?: unknown;
  definition?: unknown;
  aliases?: unknown;
  preferredUsage?: unknown;
  category?: unknown;
  isEnabled?: unknown;
}): ProjectTermPayload {
  const category = cleanSlug(value.category, "product");

  return {
    term: cleanText(value.term, 120).replace(/\s+/g, " "),
    definition: cleanText(value.definition, 2400),
    aliases: normalizeAliases(value.aliases),
    preferredUsage: cleanText(value.preferredUsage, 800),
    category: CATEGORY_SET.has(category) ? category : "other",
    isEnabled: typeof value.isEnabled === "boolean" ? value.isEnabled : true,
  };
}

export function validateProjectTermPayload(payload: ProjectTermPayload): string[] {
  const errors: string[] = [];

  if (!payload.term) errors.push("Term is required.");
  if (payload.term && payload.term.length < 2) errors.push("Term must be at least 2 characters.");
  if (!payload.definition) errors.push("Definition is required.");
  if (payload.definition && payload.definition.length < 8) errors.push("Definition should be at least 8 characters.");
  if (payload.definition.length > 2400) errors.push("Definition must be 2400 characters or less.");
  if (payload.preferredUsage.length > 800) errors.push("Preferred usage must be 800 characters or less.");
  if (!CATEGORY_SET.has(payload.category)) errors.push("Term category is invalid.");

  return errors;
}

function toSafeTerm(term: {
  id: string;
  projectId: string;
  term: string;
  definition: string;
  aliases: string[];
  preferredUsage: string | null;
  category: string;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}): SafeProjectTerm {
  return {
    id: term.id,
    projectId: term.projectId,
    term: term.term,
    definition: term.definition,
    aliases: term.aliases,
    preferredUsage: term.preferredUsage,
    category: term.category,
    isEnabled: term.isEnabled,
    createdAt: term.createdAt.toISOString(),
    updatedAt: term.updatedAt.toISOString(),
  };
}

async function userOwnsProject(userId: string, projectId: string): Promise<boolean> {
  if (!userId || !projectId) return false;

  const project = await prisma.qAProject.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });

  return Boolean(project);
}

export async function listProjectTerms(userId: string, projectId: string): Promise<SafeProjectTerm[]> {
  if (!(await userOwnsProject(userId, projectId))) return [];

  const terms = await prisma.qAProjectTerm.findMany({
    where: { projectId },
    orderBy: [{ isEnabled: "desc" }, { category: "asc" }, { term: "asc" }],
  });

  return terms.map(toSafeTerm);
}

export async function saveProjectTerm(
  userId: string,
  projectId: string,
  termId: string | null,
  payload: ProjectTermPayload
) {
  const errors = validateProjectTermPayload(payload);

  if (!userId) errors.push("User is required.");
  if (!projectId) errors.push("Project is required.");

  const ownsProject = await userOwnsProject(userId, projectId);
  if (!ownsProject) errors.push("Project not found.");

  if (errors.length > 0) {
    return { ok: false as const, errors, term: null };
  }

  const data = {
    term: payload.term,
    definition: payload.definition,
    aliases: payload.aliases,
    preferredUsage: payload.preferredUsage || null,
    category: payload.category,
    isEnabled: payload.isEnabled,
  };

  if (termId) {
    const existing = await prisma.qAProjectTerm.findFirst({
      where: { id: termId, projectId, project: { userId } },
      select: { id: true },
    });

    if (!existing) {
      return { ok: false as const, errors: ["Term not found."], term: null };
    }

    const updated = await prisma.qAProjectTerm.update({
      where: { id: termId },
      data,
    });

    return { ok: true as const, errors: [], term: toSafeTerm(updated) };
  }

  const created = await prisma.qAProjectTerm.create({
    data: { projectId, ...data },
  });

  return { ok: true as const, errors: [], term: toSafeTerm(created) };
}

export async function deleteProjectTerm(userId: string, termId: string) {
  if (!userId) return { ok: false as const, error: "User is required." };
  if (!termId) return { ok: false as const, error: "Term is required." };

  const existing = await prisma.qAProjectTerm.findFirst({
    where: { id: termId, project: { userId } },
    select: { id: true },
  });

  if (!existing) return { ok: false as const, error: "Term not found." };

  await prisma.qAProjectTerm.delete({ where: { id: termId } });
  return { ok: true as const };
}

export async function setProjectTermEnabled(userId: string, termId: string, isEnabled: boolean) {
  const existing = await prisma.qAProjectTerm.findFirst({
    where: { id: termId, project: { userId } },
    select: { id: true },
  });

  if (!existing) return { ok: false as const, error: "Term not found.", term: null };

  const updated = await prisma.qAProjectTerm.update({
    where: { id: termId },
    data: { isEnabled },
  });

  return { ok: true as const, error: "", term: toSafeTerm(updated) };
}

export function buildProjectTerminologyBlock(terms: SafeProjectTerm[], maxCharacters = 8000): string {
  const enabledTerms = terms.filter((term) => term.isEnabled);
  const blocks: string[] = [];
  let used = 0;

  for (const term of enabledTerms) {
    const block = [
      `Term: ${term.term}`,
      `Category: ${term.category}`,
      term.aliases.length ? `Aliases: ${term.aliases.join(", ")}` : "",
      term.preferredUsage ? `Preferred usage: ${term.preferredUsage}` : "",
      "Definition:",
      term.definition,
    ].filter(Boolean).join("\n");

    if (used + block.length > maxCharacters) break;

    blocks.push(block);
    used += block.length;
  }

  if (blocks.length === 0) return "";

  return [
    "## PROJECT TERMINOLOGY / GLOSSARY",
    "",
    "TERMINOLOGY RULES:",
    "- Use these project terms consistently when they are relevant to the user's input.",
    "- Treat definitions as project context, not as proof that a feature exists unless the source input supports it.",
    "- Do not invent definitions for unknown acronyms or feature names. Ask a follow-up question when a term is ambiguous.",
    "- Prefer the provided usage language over generic replacements.",
    "",
    ...blocks,
    "",
    "## END PROJECT TERMINOLOGY / GLOSSARY",
  ].join("\n");
}
