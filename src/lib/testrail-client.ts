export type TestRailClientConfig = {
  baseUrl: string;
  username: string;
  apiKey: string;
};

export type TestRailCasePayload = {
  title: string;
  refs?: string;
  type_id?: number;
  priority_id?: number;
  milestone_id?: number;
  custom_preconds?: string;
  custom_steps?: string;
  custom_steps_separated?: Array<{ content: string; expected?: string }>;
  custom_expected?: string;
  [key: string]: unknown;
};

function cleanBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function encodeAuth(username: string, apiKey: string) {
  return Buffer.from(`${username}:${apiKey}`).toString("base64");
}

export class TestRailClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;

  constructor(config: TestRailClientConfig) {
    this.baseUrl = cleanBaseUrl(config.baseUrl);
    this.authHeader = `Basic ${encodeAuth(config.username, config.apiKey)}`;
  }

  private endpoint(path: string) {
    const cleanPath = path.startsWith("/") ? path.slice(1) : path;
    return `${this.baseUrl}/index.php?/api/v2/${cleanPath}`;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(this.endpoint(path), {
      ...options,
      headers: {
        "content-type": "application/json",
        Authorization: this.authHeader,
        ...(options.headers ?? {}),
      },
      cache: "no-store",
    });

    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const message =
        typeof payload?.error === "string"
          ? payload.error
          : `TestRail request failed with status ${response.status}.`;
      throw new Error(message);
    }

    return payload as T;
  }

  getProject(projectId: number) {
    return this.request<Record<string, unknown>>(`get_project/${projectId}`);
  }

  getSuite(suiteId: number) {
    return this.request<Record<string, unknown>>(`get_suite/${suiteId}`);
  }

  getSections(projectId: number, suiteId?: number | null) {
    const query = suiteId ? `&suite_id=${suiteId}` : "";
    return this.request<{ sections?: unknown[] } | unknown[]>(`get_sections/${projectId}${query}`);
  }

  getCaseTypes() {
    return this.request<unknown[]>("get_case_types");
  }

  getPriorities() {
    return this.request<unknown[]>("get_priorities");
  }

  addCase(sectionId: number, payload: TestRailCasePayload) {
    return this.request<Record<string, unknown>>(`add_case/${sectionId}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  updateCase(caseId: number, payload: TestRailCasePayload) {
    return this.request<Record<string, unknown>>(`update_case/${caseId}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }
}

export function getTestRailId(value: Record<string, unknown>) {
  const id = Number(value.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}
