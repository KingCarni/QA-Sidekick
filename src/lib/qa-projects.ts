import { prisma } from "@/lib/prisma";

export type ProjectKind = "web-app" | "mobile-app" | "game" | "api" | "saas" | "other";

export type QAProjectPayload = {
  name: string;
  description?: string;
  productType?: ProjectKind | string;
};

export type SafeQAProject = {
  id: string;
  name: string;
  description: string;
  productType: string;
  createdAt: string;
  updatedAt: string;
};

function normalizeProjectName(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

function normalizeDescription(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\r\n/g, "\n")
    .slice(0, 1200);
}

function normalizeProductType(value: unknown): string {
  const normalized = String(value ?? "other")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "other";
}

export function normalizeQAProjectPayload(value: {
  name?: unknown;
  description?: unknown;
  productType?: unknown;
}): QAProjectPayload {
  return {
    name: normalizeProjectName(value.name),
    description: normalizeDescription(value.description),
    productType: normalizeProductType(value.productType),
  };
}

export function validateQAProjectPayload(payload: QAProjectPayload): string[] {
  const errors: string[] = [];

  if (!payload.name) {
    errors.push("Project name is required.");
  }

  if (payload.name && payload.name.length < 2) {
    errors.push("Project name must be at least 2 characters.");
  }

  if (payload.name && payload.name.length > 80) {
    errors.push("Project name must be 80 characters or less.");
  }

  if ((payload.description ?? "").length > 1200) {
    errors.push("Project description must be 1200 characters or less.");
  }

  return errors;
}

function toSafeProject(project: {
  id: string;
  name: string;
  description: string | null;
  productType?: string | null;
  createdAt: Date;
  updatedAt: Date;
}): SafeQAProject {
  return {
    id: project.id,
    name: project.name,
    description: project.description ?? "",
    productType: project.productType ?? "other",
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

export async function listUserQAProjects(userId: string): Promise<SafeQAProject[]> {
  if (!userId) return [];

  const projects = await prisma.qAProject.findMany({
    where: { userId },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  return projects.map(toSafeProject);
}

export async function getUserQAProject(userId: string, projectId: string): Promise<SafeQAProject | null> {
  if (!userId || !projectId) return null;

  const project = await prisma.qAProject.findFirst({
    where: {
      id: projectId,
      userId,
    },
  });

  return project ? toSafeProject(project) : null;
}

export async function saveUserQAProject(userId: string, projectId: string | null, payload: QAProjectPayload) {
  const errors = validateQAProjectPayload(payload);

  if (!userId) {
    errors.push("User is required.");
  }

  if (errors.length > 0) {
    return {
      ok: false as const,
      errors,
      project: null,
    };
  }

  const projectData = {
    name: payload.name,
    description: payload.description ?? "",
    productType: payload.productType ?? "other",
  };

  if (projectId) {
    const existing = await prisma.qAProject.findFirst({
      where: {
        id: projectId,
        userId,
      },
    });

    if (!existing) {
      return {
        ok: false as const,
        errors: ["Project not found."],
        project: null,
      };
    }

    const updated = await prisma.qAProject.update({
      where: { id: projectId },
      data: projectData,
    });

    return {
      ok: true as const,
      errors: [],
      project: toSafeProject(updated),
    };
  }

  const created = await prisma.qAProject.create({
    data: {
      userId,
      ...projectData,
    },
  });

  return {
    ok: true as const,
    errors: [],
    project: toSafeProject(created),
  };
}

export async function deleteUserQAProject(userId: string, projectId: string) {
  if (!userId) {
    return { ok: false as const, error: "User is required." };
  }

  if (!projectId) {
    return { ok: false as const, error: "Project is required." };
  }

  const existing = await prisma.qAProject.findFirst({
    where: {
      id: projectId,
      userId,
    },
  });

  if (!existing) {
    return { ok: false as const, error: "Project not found." };
  }

  await prisma.qAProject.delete({
    where: { id: projectId },
  });

  return { ok: true as const };
}

export function buildProjectContextSummary(project: SafeQAProject | null): string {
  if (!project) return "";

  return [
    `Active Project: ${project.name}`,
    project.productType ? `Product Type: ${project.productType}` : "",
    project.description ? `Project Description: ${project.description}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
