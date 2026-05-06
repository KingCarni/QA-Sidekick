"use client";

import { useEffect, useMemo, useState } from "react";

type FixtureKey = "project" | "source" | "credits" | "permissions";

type E2EPersonaStatus = {
  key: string;
  name: string;
  role: string;
};

type E2EReadinessStatus = {
  enabled: boolean;
  productionBlocked: boolean;
  environment: string;
  personas: E2EPersonaStatus[];
  fixtures?: Record<FixtureKey, boolean>;
  message?: string;
};

const DEFAULT_PERSONAS: E2EPersonaStatus[] = [
  { key: "standard-user", name: "Standard User", role: "Signed-in standard user" },
  { key: "admin-user", name: "Admin User", role: "Admin / privileged user" },
  { key: "limited-access-user", name: "Limited Access User", role: "Restricted or low-credit user" },
];

const FIXTURE_DEFINITIONS: Array<{
  key: FixtureKey;
  label: string;
  description: string;
  fixLabel: string;
}> = [
  {
    key: "project",
    label: "Project fixture",
    description: "Create the predictable project generated tests can select.",
    fixLabel: "Fix Project",
  },
  {
    key: "source",
    label: "Source fixture",
    description: "Create the predictable project source used by source-selection tests.",
    fixLabel: "Fix Source",
  },
  {
    key: "credits",
    label: "Credit fixture",
    description: "Seed credit/usage state for payment, limit, and deduction tests.",
    fixLabel: "Fix Credits",
  },
  {
    key: "permissions",
    label: "Permission fixture",
    description: "Seed admin and limited-access persona permissions.",
    fixLabel: "Fix Permissions",
  },
];

function statusTone(status: E2EReadinessStatus | null) {
  if (!status) return "unknown";
  if (status.productionBlocked) return "blocked";
  if (status.enabled) return "ready";
  return "disabled";
}

export default function E2EAutomationReadinessPanel() {
  const [status, setStatus] = useState<E2EReadinessStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [workingFixture, setWorkingFixture] = useState<FixtureKey | "all" | null>(null);
  const [lastAction, setLastAction] = useState("");
  const [error, setError] = useState("");

  const tone = statusTone(status);
  const personas = status?.personas?.length ? status.personas : DEFAULT_PERSONAS;
  const canSeed = Boolean(status?.enabled && !status.productionBlocked);

  const envSnippet = useMemo(
    () =>
      [
        "ENABLE_E2E_AUTH=true",
        "",
        "# Optional fallback UI-login credentials",
        "PROJECT_E2E_STANDARD_EMAIL=",
        "PROJECT_E2E_STANDARD_PASSWORD=",
      ].join("\n"),
    []
  );

  async function loadStatus() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/e2e/auth", { method: "GET" });
      const payload = await response.json().catch(() => ({}));

      setStatus({
        enabled: Boolean(payload?.enabled && response.ok),
        productionBlocked: Boolean(payload?.productionBlocked || response.status === 403),
        environment: String(payload?.environment || "local"),
        personas: Array.isArray(payload?.personas)
          ? payload.personas.map((persona: unknown) => {
              if (typeof persona === "string") {
                return { key: persona, name: persona, role: "E2E test persona" };
              }

              const value = persona as Partial<E2EPersonaStatus>;
              return {
                key: String(value.key || "persona"),
                name: String(value.name || value.key || "Persona"),
                role: String(value.role || "E2E test persona"),
              };
            })
          : DEFAULT_PERSONAS,
        fixtures: payload?.fixtures,
        message: payload?.message || (!response.ok ? payload?.error : undefined),
      });
    } catch (loadError) {
      setStatus({
        enabled: false,
        productionBlocked: false,
        environment: "unknown",
        personas: DEFAULT_PERSONAS,
        fixtures: { project: false, source: false, credits: false, permissions: false },
        message: "Could not reach E2E auth status endpoint.",
      });
      setError(loadError instanceof Error ? loadError.message : "Could not load E2E status.");
    } finally {
      setLoading(false);
    }
  }

  async function seedFixtures(target: FixtureKey | "all") {
    if (!canSeed) return;

    setWorkingFixture(target);
    setLastAction("");
    setError("");

    try {
      const response = await fetch("/api/e2e/fixtures", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "Could not seed E2E fixtures.");
      }

      setLastAction(payload?.message || `${target === "all" ? "Fixtures" : "Fixture"} refreshed.`);
      await loadStatus();
    } catch (seedError) {
      setError(seedError instanceof Error ? seedError.message : "Could not seed E2E fixtures.");
    } finally {
      setWorkingFixture(null);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  const label = loading
    ? "Checking"
    : status?.productionBlocked
      ? "Production blocked"
      : status?.enabled
        ? "Enabled"
        : "Disabled";

  const description = !status
    ? "Checking local E2E automation readiness."
    : status.productionBlocked
      ? "Dev/test auth is blocked in production. This is expected and required for safety."
      : status.enabled
        ? "Generated Playwright skeletons can use dev/test auth personas through loginAs(page, profileKey)."
        : "Generated skeletons need normal UI login credentials or storage state until E2E auth is enabled locally.";

  return (
    <section className="e2e-readiness-shell" data-testid="e2e-readiness-panel">
      <div className={`e2e-readiness-hero e2e-readiness-hero-${tone}`}>
        <div>
          <p className="report-kicker">E2E Automation Readiness</p>
          <h2>Playwright dev/test setup</h2>
          <p>{description}</p>
        </div>

        <div className={`e2e-status-badge e2e-status-badge-${tone}`}>
          <span>{label}</span>
          <strong>{status?.environment || "local"}</strong>
        </div>
      </div>

      {error ? <div className="e2e-readiness-alert e2e-readiness-alert-error">{error}</div> : null}
      {status?.message ? <div className="e2e-readiness-alert">{status.message}</div> : null}
      {lastAction ? <div className="e2e-readiness-alert e2e-readiness-alert-success">{lastAction}</div> : null}

      <div className="e2e-readiness-grid">
        <article className="e2e-readiness-card">
          <p className="report-kicker">Personas</p>
          <h3>Generated tests can target these users</h3>

          <div className="e2e-persona-list">
            {personas.map((persona) => (
              <div className="e2e-persona-row" key={persona.key}>
                <strong>{persona.key}</strong>
                <span>{persona.role || persona.name}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="e2e-readiness-card">
          <div className="e2e-readiness-card-header">
            <div>
              <p className="report-kicker">Fixture Readiness</p>
              <h3>Local data generated tests expect</h3>
            </div>

            <button
              type="button"
              className="secondary-button e2e-action-button"
              data-testid="seed-all-fixtures-button"
              onClick={() => void seedFixtures("all")}
              disabled={!canSeed || workingFixture !== null}
            >
              {workingFixture === "all" ? "Seeding..." : "Seed All Fixtures"}
            </button>
          </div>

          <div className="e2e-fixture-list">
            {FIXTURE_DEFINITIONS.map((fixture) => {
              const ready = Boolean(status?.fixtures?.[fixture.key]);
              const isWorking = workingFixture === fixture.key;

              return (
                <div className={`e2e-fixture-row ${ready ? "e2e-fixture-row-ready" : ""}`} data-testid={`fixture-row-${fixture.key}`} key={fixture.key}>
                  <div className="e2e-fixture-copy">
                    <strong>{fixture.label}</strong>
                    <span>{fixture.description}</span>
                  </div>

                  <div className="e2e-fixture-actions">
                    <em>{ready ? "Ready" : "Missing"}</em>
                    {!ready ? (
                      <button
                        type="button"
                        className="e2e-fix-button"
                        data-testid={`fix-${fixture.key}-fixture-button`}
                        onClick={() => void seedFixtures(fixture.key)}
                        disabled={!canSeed || workingFixture !== null}
                      >
                        {isWorking ? "Fixing..." : fixture.fixLabel}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {!canSeed ? (
            <p className="e2e-readiness-note e2e-readiness-note-muted">
              Enable local E2E auth before fixture setup actions become available.
            </p>
          ) : null}
        </article>
      </div>

      <article className="e2e-readiness-card e2e-readiness-env-card">
        <div>
          <p className="report-kicker">Local Env</p>
          <h3>Use this in .env.e2e</h3>
          <p>
            E2E auth avoids real credentials locally. Fallback credential variables are optional unless
            dev/test auth is disabled.
          </p>
        </div>

        <pre>{envSnippet}</pre>
      </article>

      <article className="e2e-readiness-contract-card">
        <p className="report-kicker">Generated Test Contract</p>
        <p>
          Generated skeletons should call <code>loginAs(page, "standard-user")</code>. The helper decides
          whether to use dev/test auth or fallback UI login.
        </p>
      </article>
    </section>
  );
}
