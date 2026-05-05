import { prisma } from "@/lib/prisma";

export type ProjectSourcePayload = {
  title: string;
  sourceType: string;
  body: string;
  tags: string[];
  isEnabled: boolean;
};

export type SafeProjectSource = {
  id: string;
  projectId: string;
  title: string;
  sourceType: string;
  body: string;
  tags: string[];
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

function cleanText(value: unknown, max = 24000): string {
  return String(value ?? "").trim().replace(/\r\n/g, "\n").slice(0, max);
}

function cleanSlug(value: unknown): string {
  return String(value ?? "other")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "other";
}

function cleanTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((tag) => String(tag ?? "").trim().toLowerCase()).filter(Boolean).slice(0, 12);
  }

  return String(value ?? "")
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 12);
}

export function normalizeProjectSourcePayload(value: {
  title?: unknown;
  sourceType?: unknown;
  body?: unknown;
  tags?: unknown;
  isEnabled?: unknown;
}): ProjectSourcePayload {
  return {
    title: cleanText(value.title, 120).replace(/\s+/g, " "),
    sourceType: cleanSlug(value.sourceType),
    body: cleanText(value.body, 24000),
    tags: cleanTags(value.tags),
    isEnabled: typeof value.isEnabled === "boolean" ? value.isEnabled : true,
  };
}

export function validateProjectSourcePayload(payload: ProjectSourcePayload): string[] {
  const errors: string[] = [];

  if (!payload.title) errors.push("Source title is required.");
  if (payload.title && payload.title.length < 2) errors.push("Source title must be at least 2 characters.");
  if (!payload.body) errors.push("Source body is required.");
  if (payload.body && payload.body.length < 20) errors.push("Source body should be at least 20 characters.");
  if (payload.body.length > 24000) errors.push("Source body must be 24000 characters or less.");

  return errors;
}

function toSafeSource(source: {
  id: string;
  projectId: string;
  title: string;
  sourceType: string;
  body: string;
  tags: string[];
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}): SafeProjectSource {
  return {
    id: source.id,
    projectId: source.projectId,
    title: source.title,
    sourceType: source.sourceType,
    body: source.body,
    tags: source.tags,
    isEnabled: source.isEnabled,
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
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

export async function listProjectSources(userId: string, projectId: string): Promise<SafeProjectSource[]> {
  if (!(await userOwnsProject(userId, projectId))) return [];

  const sources = await prisma.qAProjectSource.findMany({
    where: { projectId },
    orderBy: [{ isEnabled: "desc" }, { updatedAt: "desc" }],
  });

  return sources.map(toSafeSource);
}

export async function saveProjectSource(
  userId: string,
  projectId: string,
  sourceId: string | null,
  payload: ProjectSourcePayload
) {
  const errors = validateProjectSourcePayload(payload);

  if (!userId) errors.push("User is required.");
  if (!projectId) errors.push("Project is required.");

  const ownsProject = await userOwnsProject(userId, projectId);
  if (!ownsProject) errors.push("Project not found.");

  if (errors.length > 0) {
    return { ok: false as const, errors, source: null };
  }

  const data = {
    title: payload.title,
    sourceType: payload.sourceType,
    body: payload.body,
    tags: payload.tags,
    isEnabled: payload.isEnabled,
  };

  if (sourceId) {
    const existing = await prisma.qAProjectSource.findFirst({
      where: { id: sourceId, projectId, project: { userId } },
      select: { id: true },
    });

    if (!existing) {
      return { ok: false as const, errors: ["Source not found."], source: null };
    }

    const updated = await prisma.qAProjectSource.update({
      where: { id: sourceId },
      data,
    });

    return { ok: true as const, errors: [], source: toSafeSource(updated) };
  }

  const created = await prisma.qAProjectSource.create({
    data: { projectId, ...data },
  });

  return { ok: true as const, errors: [], source: toSafeSource(created) };
}

export async function deleteProjectSource(userId: string, sourceId: string) {
  if (!userId) return { ok: false as const, error: "User is required." };
  if (!sourceId) return { ok: false as const, error: "Source is required." };

  const existing = await prisma.qAProjectSource.findFirst({
    where: { id: sourceId, project: { userId } },
    select: { id: true },
  });

  if (!existing) return { ok: false as const, error: "Source not found." };

  await prisma.qAProjectSource.delete({ where: { id: sourceId } });
  return { ok: true as const };
}

export async function setProjectSourceEnabled(userId: string, sourceId: string, isEnabled: boolean) {
  const existing = await prisma.qAProjectSource.findFirst({
    where: { id: sourceId, project: { userId } },
    select: { id: true },
  });

  if (!existing) return { ok: false as const, error: "Source not found.", source: null };

  const updated = await prisma.qAProjectSource.update({
    where: { id: sourceId },
    data: { isEnabled },
  });

  return { ok: true as const, error: "", source: toSafeSource(updated) };
}

export function buildProjectSourceContextBlock(sources: SafeProjectSource[], maxCharacters = 12000): string {
  const enabledSources = sources.filter((source) => source.isEnabled);
  const blocks: string[] = [];
  let used = 0;

  for (const source of enabledSources) {
    const block = [
      `Source: ${source.title}`,
      `Type: ${source.sourceType}`,
      source.tags.length ? `Tags: ${source.tags.join(", ")}` : "",
      "",
      source.body,
    ].filter(Boolean).join("\n");

    if (used + block.length > maxCharacters) break;

    blocks.push(block);
    used += block.length;
  }

  return blocks.join("\n\n---\n\n");
}
