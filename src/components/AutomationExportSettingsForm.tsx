"use client";

import { type AutomationProjectConfig } from "@/lib/automation-project-config";

type AutomationExportSettingsFormProps = {
  value: AutomationProjectConfig;
  onChange: (value: AutomationProjectConfig) => void;
};

function updateField<K extends keyof AutomationProjectConfig>(
  value: AutomationProjectConfig,
  key: K,
  nextValue: AutomationProjectConfig[K]
): AutomationProjectConfig {
  return { ...value, [key]: nextValue };
}

export default function AutomationExportSettingsForm({ value, onChange }: AutomationExportSettingsFormProps) {
  return (
    <section className="automation-export-settings-card" data-testid="automation-export-settings-panel">
      <div className="automation-export-settings-header">
        <div>
          <p className="report-kicker">Automation Export Settings</p>
          <h2>User project export defaults</h2>
          <p>
            Configure the routes, selectors, personas, and fixture names QAtalyst should use when exporting
            automation skeletons for this project.
          </p>
        </div>
      </div>

      <div className="automation-export-settings-grid">
        <label>
          Base URL
          <input data-testid="automation-config-base-url" value={value.baseUrl} onChange={(event) => onChange(updateField(value, "baseUrl", event.target.value))} placeholder="https://your-app.example.com" />
        </label>

        <label>
          App Route
          <input data-testid="automation-config-app-route" value={value.appRoute} onChange={(event) => onChange(updateField(value, "appRoute", event.target.value))} placeholder="/dashboard" />
        </label>

        <label>
          Login Route
          <input data-testid="automation-config-login-route" value={value.loginRoute} onChange={(event) => onChange(updateField(value, "loginRoute", event.target.value))} placeholder="/login" />
        </label>

        <label>
          Post-login Route
          <input data-testid="automation-config-post-login-route" value={value.postLoginRoute} onChange={(event) => onChange(updateField(value, "postLoginRoute", event.target.value))} placeholder="/dashboard" />
        </label>

        <label>
          Test ID Attribute
          <input data-testid="automation-config-testid-attribute" value={value.testIdAttribute} onChange={(event) => onChange(updateField(value, "testIdAttribute", event.target.value))} placeholder="data-testid" />
        </label>

        <label>
          Selector Strategy
          <select
            data-testid="automation-config-selector-strategy"
            value={value.selectorStrategy}
            onChange={(event) => onChange(updateField(value, "selectorStrategy", event.target.value as AutomationProjectConfig["selectorStrategy"]))}
          >
            <option value="test-id">Test IDs first</option>
            <option value="role">Accessible roles first</option>
            <option value="mixed">Mixed</option>
          </select>
        </label>

        <label>
          Default Persona
          <input data-testid="automation-config-default-persona" value={value.defaultPersonaKey} onChange={(event) => onChange(updateField(value, "defaultPersonaKey", event.target.value))} placeholder="standard-user" />
        </label>

        <label>
          Project Fixture Name
          <input data-testid="automation-config-project-fixture" value={value.projectFixtureName} onChange={(event) => onChange(updateField(value, "projectFixtureName", event.target.value))} placeholder="Seeded Customer Account" />
        </label>

        <label>
          Source Fixture Name
          <input data-testid="automation-config-source-fixture" value={value.sourceFixtureName} onChange={(event) => onChange(updateField(value, "sourceFixtureName", event.target.value))} placeholder="Seeded Product Overview" />
        </label>
      </div>

      <label className="automation-export-settings-wide">
        Selector Notes
        <textarea data-testid="automation-config-selector-notes" value={value.selectorNotes} onChange={(event) => onChange(updateField(value, "selectorNotes", event.target.value))} placeholder="Example: all stable selectors use data-testid and kebab-case." />
      </label>

      <label className="automation-export-settings-wide">
        Fixture / Setup Notes
        <textarea data-testid="automation-config-fixture-notes" value={value.fixtureNotes} onChange={(event) => onChange(updateField(value, "fixtureNotes", event.target.value))} placeholder="Example: seed a standard user, one project, and one saved source before running generated tests." />
      </label>
    </section>
  );
}
