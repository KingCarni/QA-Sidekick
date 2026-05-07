"use client";

import { useEffect, useMemo, useState } from "react";

type SaveState = "idle" | "loading" | "saving" | "saved" | "testing" | "error";

type SafeTestRailConfig = {
  baseUrl: string;
  username: string;
  apiKeyMasked: string;
  projectId: number;
  suiteId: number | null;
  defaultSectionId: number;
  milestoneId: number | null;
  runId: number | null;
  fieldMapping: Record<string, unknown>;
};

type TestRailConfigResponse = {
  ok?: boolean;
  error?: string;
  testrail?: {
    configured: boolean;
    missingFields: string[];
    config: SafeTestRailConfig | null;
  };
};

const DEFAULT_FIELD_MAPPING = {
  preconditionsField: "custom_preconds",
  stepsField: "custom_steps_separated",
  expectedField: "custom_expected",
  automationNoteField: "custom_automation_readiness",
  automationIdField: "custom_case_automation_id",
  priorityIds: {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  },
  typeIds: {
    functional: 1,
    regression: 2,
    smoke: 3,
  },
};

function optionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function numberString(value: number | null | undefined) {
  return value ? String(value) : "";
}

function getResultMessageClass(state: SaveState) {
  if (state === "saved") {
    return "testrail-settings-message testrail-settings-message-success";
  }

  if (state === "error") {
    return "testrail-settings-message testrail-settings-message-error";
  }

  return "testrail-settings-message";
}

export default function TestRailSettingsForm() {
  const [baseUrl, setBaseUrl] = useState("");
  const [username, setUsername] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiKeyMasked, setApiKeyMasked] = useState("");
  const [projectId, setProjectId] = useState("");
  const [suiteId, setSuiteId] = useState("");
  const [defaultSectionId, setDefaultSectionId] = useState("");
  const [milestoneId, setMilestoneId] = useState("");
  const [runId, setRunId] = useState("");
  const [fieldMappingJson, setFieldMappingJson] = useState(() => JSON.stringify(DEFAULT_FIELD_MAPPING, null, 2));
  const [state, setState] = useState<SaveState>("loading");
  const [message, setMessage] = useState("");
  const [configured, setConfigured] = useState(false);

  const statusLabel = useMemo(() => {
    if (state === "loading") return "Checking";
    if (configured) return "Configured";
    return "Not configured";
  }, [configured, state]);

  async function loadConfig() {
    setState("loading");
    setMessage("");

    try {
      const response = await fetch("/api/testrail/config", { method: "GET" });
      const payload = (await response.json().catch(() => null)) as TestRailConfigResponse | null;

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || "Could not load TestRail config.");
      }

      const config = payload?.testrail?.config;
      setConfigured(Boolean(payload?.testrail?.configured));

      if (config) {
        setBaseUrl(config.baseUrl ?? "");
        setUsername(config.username ?? "");
        setApiKey("");
        setApiKeyMasked(config.apiKeyMasked ?? "");
        setProjectId(numberString(config.projectId));
        setSuiteId(numberString(config.suiteId));
        setDefaultSectionId(numberString(config.defaultSectionId));
        setMilestoneId(numberString(config.milestoneId));
        setRunId(numberString(config.runId));
        setFieldMappingJson(JSON.stringify(config.fieldMapping || DEFAULT_FIELD_MAPPING, null, 2));
      }

      setState("idle");
      setMessage(payload?.testrail?.configured ? "TestRail config loaded." : "Add TestRail settings to enable preview-first sync.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not load TestRail config.");
    }
  }

  async function saveConfig() {
    setState("saving");
    setMessage("");

    try {
      let fieldMapping: Record<string, unknown> = DEFAULT_FIELD_MAPPING;

      try {
        const parsed = JSON.parse(fieldMappingJson || "{}");
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          fieldMapping = parsed;
        }
      } catch {
        throw new Error("Field mapping must be valid JSON.");
      }

      const response = await fetch("/api/testrail/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          baseUrl,
          username,
          apiKey: apiKey.trim() || undefined,
          projectId: optionalNumber(projectId),
          suiteId: optionalNumber(suiteId),
          defaultSectionId: optionalNumber(defaultSectionId),
          milestoneId: optionalNumber(milestoneId),
          runId: optionalNumber(runId),
          fieldMapping,
        }),
      });
      const payload = (await response.json().catch(() => null)) as TestRailConfigResponse | null;

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || "Could not save TestRail config.");
      }

      const config = payload?.testrail?.config;
      setConfigured(Boolean(payload?.testrail?.configured));
      setApiKey("");
      setApiKeyMasked(config?.apiKeyMasked ?? "••••••••");
      setState("saved");
      setMessage("TestRail config saved. API key is stored encrypted and never returned to the client.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not save TestRail config.");
    }
  }

  async function testConnection() {
    setState("testing");
    setMessage("");

    try {
      const response = await fetch("/api/testrail/test-connection", { method: "POST" });
      const payload = await response.json().catch(() => null);

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || "Could not connect to TestRail.");
      }

      setState("saved");
      setMessage(
        `${payload?.message || "TestRail connection succeeded."} Project: ${payload?.project?.name || projectId}. Priorities: ${payload?.priorityCount ?? 0}. Case types: ${payload?.caseTypeCount ?? 0}.`
      );
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not connect to TestRail.");
    }
  }

  async function removeConfig() {
    const confirmed = window.confirm("Remove TestRail configuration? This will not delete anything from TestRail.");
    if (!confirmed) return;

    setState("saving");
    setMessage("");

    try {
      const response = await fetch("/api/testrail/config", { method: "DELETE" });
      const payload = await response.json().catch(() => null);

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || "Could not remove TestRail config.");
      }

      setBaseUrl("");
      setUsername("");
      setApiKey("");
      setApiKeyMasked("");
      setProjectId("");
      setSuiteId("");
      setDefaultSectionId("");
      setMilestoneId("");
      setRunId("");
      setFieldMappingJson(JSON.stringify(DEFAULT_FIELD_MAPPING, null, 2));
      setConfigured(false);
      setState("saved");
      setMessage("TestRail config removed.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not remove TestRail config.");
    }
  }

  useEffect(() => {
    void loadConfig();
  }, []);

  return (
    <section className="testrail-settings-card" data-testid="testrail-settings-panel">
      <div className="testrail-settings-status-row">
        <div>
          <p className="report-kicker">TestRail Connection</p>
          <h2>{configured ? "TestRail project ready" : "Connect TestRail"}</h2>
          <p>
            Save the TestRail project defaults QAtalyst should use for preview-first sync. QAtalyst will not
            create or update cases until you approve a sync preview.
          </p>
        </div>

        <span className={configured ? "testrail-status-pill testrail-status-ready" : "testrail-status-pill testrail-status-missing"}>
          {statusLabel}
        </span>
      </div>

      <div className="testrail-settings-grid">
        <label>
          <span>Base URL</span>
          <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://yourcompany.testrail.io" />
        </label>

        <label>
          <span>Username / Email</span>
          <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="qa@example.com" />
        </label>

        <label>
          <span>API Key</span>
          <input value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={apiKeyMasked || "Paste API key"} type="password" />
        </label>

        <label>
          <span>Project ID</span>
          <input value={projectId} onChange={(event) => setProjectId(event.target.value)} placeholder="1" inputMode="numeric" />
        </label>

        <label>
          <span>Suite ID optional</span>
          <input value={suiteId} onChange={(event) => setSuiteId(event.target.value)} placeholder="1" inputMode="numeric" />
        </label>

        <label>
          <span>Default Section ID</span>
          <input value={defaultSectionId} onChange={(event) => setDefaultSectionId(event.target.value)} placeholder="10" inputMode="numeric" />
        </label>

        <label>
          <span>Milestone ID optional</span>
          <input value={milestoneId} onChange={(event) => setMilestoneId(event.target.value)} placeholder="" inputMode="numeric" />
        </label>

        <label>
          <span>Run ID optional</span>
          <input value={runId} onChange={(event) => setRunId(event.target.value)} placeholder="" inputMode="numeric" />
        </label>
      </div>

      <label className="testrail-settings-wide">
        <span>Field Mapping JSON</span>
        <textarea value={fieldMappingJson} onChange={(event) => setFieldMappingJson(event.target.value)} />
      </label>

      <div className="testrail-safe-sync-note">
        <strong>Safe sync rule:</strong> Generate → review → preview sync → approve → create/update TestRail cases.
        No silent writes.
      </div>

      <div className="testrail-settings-actions">
        <button className="copy-all-button" disabled={state === "saving" || state === "testing"} onClick={saveConfig} type="button">
          {state === "saving" ? "Saving..." : "Save TestRail Config"}
        </button>
        <button
          className="testrail-test-connection-button"
          disabled={!configured || state === "testing" || state === "saving"}
          onClick={testConnection}
          type="button"
        >
          {state === "testing" ? "Testing..." : "Test Connection"}
        </button>
        <button className="secondary-action-button jira-danger-action" disabled={state === "saving" || state === "testing"} onClick={removeConfig} type="button">
          Remove Config
        </button>
      </div>

      {message ? <p className={getResultMessageClass(state)}>{message}</p> : null}
    </section>
  );
}
