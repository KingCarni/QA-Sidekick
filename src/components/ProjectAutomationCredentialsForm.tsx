"use client";

import { useMemo, useState } from "react";
import {
  normalizeCredentialKey,
  type AutomationCredentialProfile,
} from "@/lib/automation-credentials";

type ProjectAutomationCredentialsFormProps = {
  profiles: AutomationCredentialProfile[];
  onChange: (profiles: AutomationCredentialProfile[]) => void;
};

const DEFAULT_PROFILES: AutomationCredentialProfile[] = [
  {
    key: "standard-user",
    name: "Standard User",
    role: "Signed-in standard user",
    environment: "local/staging",
    emailEnvVar: "PROJECT_E2E_STANDARD_EMAIL",
    passwordEnvVar: "PROJECT_E2E_STANDARD_PASSWORD",
    notes: "Default signed-in user for normal product flows.",
    isDefault: true,
    enabled: true,
  },
  {
    key: "admin-user",
    name: "Admin User",
    role: "Admin or privileged user",
    environment: "local/staging",
    emailEnvVar: "PROJECT_E2E_ADMIN_EMAIL",
    passwordEnvVar: "PROJECT_E2E_ADMIN_PASSWORD",
    notes: "Use for admin-only settings, project management, and permission tests.",
    enabled: true,
  },
  {
    key: "limited-access-user",
    name: "Limited Access User",
    role: "Signed-in user with restricted access",
    environment: "local/staging",
    emailEnvVar: "PROJECT_E2E_LIMITED_EMAIL",
    passwordEnvVar: "PROJECT_E2E_LIMITED_PASSWORD",
    notes: "Use for permission, limit, quota, or blocked-action flows.",
    enabled: true,
  },
];

function emptyProfile(): AutomationCredentialProfile {
  return {
    key: "",
    name: "",
    role: "",
    environment: "local/staging",
    emailEnvVar: "",
    usernameEnvVar: "",
    passwordEnvVar: "",
    notes: "",
    enabled: true,
  };
}

function toEnvSlug(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function withGeneratedFields(profile: AutomationCredentialProfile): AutomationCredentialProfile {
  const key = normalizeCredentialKey(profile.key || profile.name || "");
  const envSlug = toEnvSlug(key);

  if (!key || !envSlug) return profile;

  return {
    ...profile,
    key,
    emailEnvVar: profile.emailEnvVar || `PROJECT_E2E_${envSlug}_EMAIL`,
    passwordEnvVar: profile.passwordEnvVar || `PROJECT_E2E_${envSlug}_PASSWORD`,
  };
}

function profileSummary(profile: AutomationCredentialProfile): string {
  const parts = [
    profile.role || "Automation persona",
    profile.environment || "environment not set",
    profile.isDefault ? "default" : "",
  ].filter(Boolean);

  return parts.join(" · ");
}

export default function ProjectAutomationCredentialsForm({
  profiles,
  onChange,
}: ProjectAutomationCredentialsFormProps) {
  const [draft, setDraft] = useState<AutomationCredentialProfile>(emptyProfile());

  const safeProfiles = useMemo(() => profiles ?? [], [profiles]);

  function updateProfile(index: number, patch: Partial<AutomationCredentialProfile>) {
    onChange(
      safeProfiles.map((profile, currentIndex) => {
        if (currentIndex !== index) return profile;

        const next = { ...profile, ...patch };

        if (patch.name && !profile.key) {
          return withGeneratedFields(next);
        }

        return next;
      })
    );
  }

  function addDraft() {
    const normalized = withGeneratedFields(draft);

    if (!normalized.name?.trim()) return;

    onChange([...safeProfiles, normalized]);
    setDraft(emptyProfile());
  }

  function removeProfile(index: number) {
    onChange(safeProfiles.filter((_, currentIndex) => currentIndex !== index));
  }

  function useDefaults() {
    onChange(DEFAULT_PROFILES);
  }

  return (
    <section className="automation-credentials-shell" data-testid="automation-credentials-panel">
      <div className="automation-credentials-hero">
        <div>
          <p className="report-kicker">Automation Credentials</p>
          <h2>Test credential profiles</h2>
          <p>
            Create safe test personas that generated automation can reference with fixture aliases
            or environment variable names.
          </p>
        </div>

        <button className="secondary-button automation-credentials-defaults" data-testid="use-starter-profiles-button" type="button" onClick={useDefaults}>
          Use Starter Profiles
        </button>
      </div>

      <div className="credential-security-note">
        <div>
          <p className="report-kicker">Security Rule</p>
          <h3>No raw passwords in generated output</h3>
        </div>
        <p>
          Store profile names, roles, setup notes, and environment variable names. Generated scripts
          should reference values like <code>PROJECT_E2E_STANDARD_EMAIL</code>, not real secrets.
        </p>
      </div>

      <div className="credential-section-header">
        <div>
          <p className="report-kicker">Saved Profiles</p>
          <h3>{safeProfiles.length} profile{safeProfiles.length === 1 ? "" : "s"}</h3>
        </div>
        <p>
          These profiles help reduce missing-auth setup in automation skeletons.
        </p>
      </div>

      <div className="credential-profile-list">
        {safeProfiles.length === 0 ? (
          <div className="credential-empty-state">
            <strong>No credential profiles yet.</strong>
            <p>
              Add a standard user, admin user, or limited-access user to make login and permission
              test skeletons more useful.
            </p>
          </div>
        ) : null}

        {safeProfiles.map((profile, index) => (
          <article className="credential-profile-card" key={`${profile.key || profile.name}-${index}`}>
            <div className="credential-profile-card-header">
              <div>
                <p className="report-kicker">Profile</p>
                <h3>{profile.name || "Untitled Profile"}</h3>
                <p>{profileSummary(profile)}</p>
              </div>

              <div className="credential-profile-toggle-row">
                <label className="credential-inline-check">
                  <input
                    type="checkbox"
                    checked={profile.enabled !== false}
                    onChange={(event) => updateProfile(index, { enabled: event.target.checked })}
                  />
                  Enabled
                </label>

                <label className="credential-inline-check">
                  <input
                    type="checkbox"
                    checked={Boolean(profile.isDefault)}
                    onChange={(event) => {
                      const checked = event.target.checked;

                      onChange(
                        safeProfiles.map((item, currentIndex) => ({
                          ...item,
                          isDefault: currentIndex === index ? checked : checked ? false : item.isDefault,
                        }))
                      );
                    }}
                  />
                  Default
                </label>
              </div>
            </div>

            <div className="credential-profile-grid">
              <label>
                Profile Name
                <input
                  data-testid="credential-profile-name-input"
                  value={profile.name ?? ""}
                  onChange={(event) => updateProfile(index, { name: event.target.value })}
                  placeholder="Standard User"
                />
              </label>

              <label>
                Profile Key
                <input
                  value={profile.key ?? ""}
                  onChange={(event) => updateProfile(index, { key: normalizeCredentialKey(event.target.value) })}
                  placeholder="standard-user"
                />
              </label>

              <label>
                Role / Persona
                <input
                  data-testid="credential-profile-role-input"
                  value={profile.role ?? ""}
                  onChange={(event) => updateProfile(index, { role: event.target.value })}
                  placeholder="Signed-in standard user"
                />
              </label>

              <label>
                Environment
                <input
                  value={profile.environment ?? ""}
                  onChange={(event) => updateProfile(index, { environment: event.target.value })}
                  placeholder="local/staging"
                />
              </label>

              <label>
                Email Env Var
                <input
                  data-testid="credential-profile-email-env-input"
                  value={profile.emailEnvVar ?? ""}
                  onChange={(event) => updateProfile(index, { emailEnvVar: event.target.value })}
                  placeholder="PROJECT_E2E_STANDARD_EMAIL"
                />
              </label>

              <label>
                Password Env Var
                <input
                  data-testid="credential-profile-password-env-input"
                  value={profile.passwordEnvVar ?? ""}
                  onChange={(event) => updateProfile(index, { passwordEnvVar: event.target.value })}
                  placeholder="PROJECT_E2E_STANDARD_PASSWORD"
                />
              </label>
            </div>

            <label className="credential-notes-label">
              Setup Notes
              <textarea
                data-testid="credential-profile-notes-input"
                value={profile.notes ?? ""}
                onChange={(event) => updateProfile(index, { notes: event.target.value })}
                placeholder="Expected permissions, seed data, project state, account limits, or role restrictions..."
              />
            </label>

            <div className="credential-profile-footer">
              <code>{profile.key || "profile-key"}</code>
              <button className="danger-button" type="button" onClick={() => removeProfile(index)}>
                Delete Profile
              </button>
            </div>
          </article>
        ))}
      </div>

      <article className="credential-profile-card credential-profile-card-new">
        <div className="credential-profile-card-header">
          <div>
            <p className="report-kicker">New Profile</p>
            <h3>Add test persona</h3>
            <p>Use env var names only. Do not paste real usernames or passwords here.</p>
          </div>
        </div>

        <div className="credential-profile-grid">
          <label>
            Profile Name
            <input
              data-testid="credential-profile-name-input"
              value={draft.name ?? ""}
              onChange={(event) => {
                const name = event.target.value;
                setDraft(withGeneratedFields({ ...draft, name, key: draft.key || normalizeCredentialKey(name) }));
              }}
              placeholder="Standard User"
            />
          </label>

          <label>
            Role / Persona
            <input
              data-testid="credential-profile-role-input"
              value={draft.role ?? ""}
              onChange={(event) => setDraft({ ...draft, role: event.target.value })}
              placeholder="Signed-in standard user"
            />
          </label>

          <label>
            Email Env Var
            <input
              data-testid="credential-profile-email-env-input"
              value={draft.emailEnvVar ?? ""}
              onChange={(event) => setDraft({ ...draft, emailEnvVar: event.target.value })}
              placeholder="PROJECT_E2E_STANDARD_EMAIL"
            />
          </label>

          <label>
            Password Env Var
            <input
              data-testid="credential-profile-password-env-input"
              value={draft.passwordEnvVar ?? ""}
              onChange={(event) => setDraft({ ...draft, passwordEnvVar: event.target.value })}
              placeholder="PROJECT_E2E_STANDARD_PASSWORD"
            />
          </label>
        </div>

        <label className="credential-notes-label">
          Setup Notes
          <textarea
            data-testid="credential-profile-notes-input"
            value={draft.notes ?? ""}
            onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
            placeholder="Expected permissions, seed data, account limits, role restrictions..."
          />
        </label>

        <div className="credential-profile-footer">
          <span />
          <button className="primary-button" data-testid="add-credential-profile-button" type="button" onClick={addDraft}>
            Add Credential Profile
          </button>
        </div>
      </article>
    </section>
  );
}
