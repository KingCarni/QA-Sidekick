import { getServerSession } from "next-auth";
import { apiError, apiOk, getErrorMessage } from "@/lib/api-response";
import { authOptions } from "@/lib/auth";
import { TestRailClient, getTestRailId } from "@/lib/testrail-client";
import { getUserTestRailConfigWithSecret } from "@/lib/testrail-config";
import { durationSince, nowMs, serverLog } from "@/lib/server-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TargetOption = {
  id: number;
  name: string;
  parentId: number | null;
  suiteId: number | null;
  raw: Record<string, unknown>;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRecordList(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item));
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;

    for (const key of ["projects", "suites", "sections"]) {
      const nested = record[key];
      if (Array.isArray(nested)) {
        return nested.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item));
      }
    }
  }

  return [];
}

function toOption(item: Record<string, unknown>): TargetOption | null {
  const id = getTestRailId(item);
  if (!id) return null;

  const name = cleanText(item.name) || cleanText(item.title) || `ID ${id}`;

  return {
    id,
    name,
    parentId: Number.isInteger(Number(item.parent_id)) && Number(item.parent_id) > 0 ? Number(item.parent_id) : null,
    suiteId: Number.isInteger(Number(item.suite_id)) && Number(item.suite_id) > 0 ? Number(item.suite_id) : null,
    raw: item,
  };
}

function toOptions(value: unknown): TargetOption[] {
  return normalizeRecordList(value).map(toOption).filter((item): item is TargetOption => Boolean(item));
}

function numberParam(req: Request, key: string) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get(key);
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function addFallbackOption(options: TargetOption[], fallback: TargetOption | null) {
  if (!fallback) return options;

  if (options.some((option) => option.id === fallback.id)) {
    return options;
  }

  return [fallback, ...options];
}

function fallbackOption(id: number | null | undefined, name: string, extra?: Partial<TargetOption>): TargetOption | null {
  if (!id || !Number.isInteger(Number(id)) || Number(id) <= 0) return null;

  return {
    id: Number(id),
    name,
    parentId: extra?.parentId ?? null,
    suiteId: extra?.suiteId ?? null,
    raw: extra?.raw ?? { id, name },
  };
}

export async function GET(req: Request): Promise<Response> {
  const startedAt = nowMs();
  const route = "/api/testrail/options";

  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return apiError(req, { status: 401, code: "UNAUTHORIZED", message: "Please sign in before loading TestRail targets." });
    }

    const config = await getUserTestRailConfigWithSecret(userId);

    if (!config) {
      return apiError(req, { status: 400, code: "CONFIG_ERROR", message: "Save TestRail config before loading TestRail targets." });
    }

    const client = new TestRailClient({ baseUrl: config.baseUrl, username: config.username, apiKey: config.apiKey });

    const projectId = numberParam(req, "projectId") ?? config.projectId ?? null;
    const suiteId = numberParam(req, "suiteId") ?? config.suiteId ?? null;

    const [rawProjects, rawProject, rawSuites, rawSuite, rawSections] = await Promise.all([
      client.getProjects().catch(() => []),
      projectId ? client.getProject(projectId).catch(() => null) : Promise.resolve(null),
      projectId ? client.getSuites(projectId).catch(() => []) : Promise.resolve([]),
      suiteId ? client.getSuite(suiteId).catch(() => null) : Promise.resolve(null),
      projectId ? client.getSections(projectId, suiteId).catch(() => []) : Promise.resolve([]),
    ]);

    let projects = toOptions(rawProjects);
    let suites = toOptions(rawSuites);
    let sections = toOptions(rawSections);

    const projectName =
      rawProject && typeof rawProject === "object" && !Array.isArray(rawProject)
        ? cleanText((rawProject as Record<string, unknown>).name) || `Project ${projectId}`
        : `Project ${projectId}`;

    const suiteName =
      rawSuite && typeof rawSuite === "object" && !Array.isArray(rawSuite)
        ? cleanText((rawSuite as Record<string, unknown>).name) || `Suite ${suiteId}`
        : `Suite ${suiteId}`;

    projects = addFallbackOption(projects, fallbackOption(projectId, projectName));
    suites = addFallbackOption(suites, fallbackOption(suiteId, suiteName));
    sections = addFallbackOption(
      sections,
      fallbackOption(config.defaultSectionId, `Configured section ${config.defaultSectionId}`, {
        suiteId,
      })
    );

    serverLog.info("Loaded TestRail target options.", {
      route,
      userId,
      status: 200,
      durationMs: durationSince(startedAt),
      meta: {
        projectCount: projects.length,
        suiteCount: suites.length,
        sectionCount: sections.length,
        projectId,
        suiteId,
      },
    });

    return apiOk(req, {
      ok: true,
      testrail: {
        selected: {
          projectId,
          suiteId,
          defaultSectionId: config.defaultSectionId ?? null,
        },
        projects,
        suites,
        sections,
      },
    });
  } catch (error) {
    serverLog.error("Could not load TestRail target options.", { route, status: 500, durationMs: durationSince(startedAt), error });
    return apiError(req, { status: 500, code: "UPSTREAM_ERROR", message: getErrorMessage(error, "Could not load TestRail targets.") });
  }
}