"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import QAtGuideCard from "@/components/QAtGuideCard";
import { FTUE_KEYS } from "@/lib/ftue-state";
import { isAdminEmail } from "@/lib/admin";

type FtueKeyName = keyof typeof FTUE_KEYS;

const FTUE_ROWS: Array<{ label: string; keyName: FtueKeyName; description: string }> = [
  { label: "Welcome", keyName: "welcome", description: "First-time QAt welcome card" },
  { label: "Project Brain", keyName: "brainIntro", description: "Project context / Brain setup card" },
  { label: "Integrations", keyName: "integrationsIntro", description: "Jira/TestRail setup card" },
  { label: "Test Cases", keyName: "testsIntro", description: "Test Cases tool tutorial" },
  { label: "Bug Writer", keyName: "bugIntro", description: "Bug Writer tool tutorial" },
  { label: "Risk Review", keyName: "riskIntro", description: "Risk Review tool tutorial" },
  { label: "Test Improver", keyName: "improveIntro", description: "Test Improver tool tutorial" },
  { label: "Feature Builder", keyName: "featureIntro", description: "Feature Builder tool tutorial" },
];

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  const tagName = target.tagName.toLowerCase();

  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable
  );
}

function readFtueState() {
  if (typeof window === "undefined") return {};

  return FTUE_ROWS.reduce<Record<string, boolean>>((state, row) => {
    const key = FTUE_KEYS[row.keyName];
    state[key] = window.localStorage.getItem(key) === "true";
    return state;
  }, {});
}

export default function AdminDebugMenu() {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [ftueState, setFtueState] = useState<Record<string, boolean>>({});
  const [reloadAfterReset, setReloadAfterReset] = useState(true);
  const [showQAtPreview, setShowQAtPreview] = useState(false);
  const [lastAction, setLastAction] = useState("");

  const userEmail = session?.user?.email ?? "";
  const isAdmin = isAdminEmail(userEmail);

  const ftueRows = useMemo(
    () =>
      FTUE_ROWS.map((row) => ({
        ...row,
        storageKey: FTUE_KEYS[row.keyName],
        isComplete: ftueState[FTUE_KEYS[row.keyName]] === true,
      })),
    [ftueState]
  );

  function refreshFtueState() {
    setFtueState(readFtueState());
  }

  function reloadOrRefresh(message: string) {
    setLastAction(message);

    if (reloadAfterReset) {
      window.setTimeout(() => window.location.reload(), 120);
      return;
    }

    refreshFtueState();
  }

  function resetFtueKey(storageKey: string, label: string) {
    window.localStorage.removeItem(storageKey);
    reloadOrRefresh(`Reset ${label}.`);
  }

  function completeFtueKey(storageKey: string, label: string) {
    window.localStorage.setItem(storageKey, "true");
    reloadOrRefresh(`Marked ${label} complete.`);
  }

  function resetAllFtue() {
    ftueRows.forEach((row) => window.localStorage.removeItem(row.storageKey));
    reloadOrRefresh("Reset all FTUE steps.");
  }

  function completeAllFtue() {
    ftueRows.forEach((row) => window.localStorage.setItem(row.storageKey, "true"));
    reloadOrRefresh("Marked all FTUE steps complete.");
  }

  function copyLocalStorageSnapshot() {
    const snapshot = Object.keys(window.localStorage)
      .sort()
      .reduce<Record<string, string>>((result, key) => {
        if (
          key.toLowerCase().includes("ftue") ||
          key.toLowerCase().includes("qatalyst") ||
          key.toLowerCase().includes("qa")
        ) {
          result[key] = window.localStorage.getItem(key) ?? "";
        }

        return result;
      }, {});

    void navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
    setLastAction("Copied localStorage debug snapshot.");
  }

  useEffect(() => {
    refreshFtueState();
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setIsOpen(false);
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return;

      if (event.key === "`") {
        event.preventDefault();
        setIsOpen((value) => !value);
      }

      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAdmin]);

  if (!isAdmin) return null;

  return (
    <>
      {isOpen ? (
        <aside className="admin-debug-drawer" aria-label="Admin debug menu">
          <div className="admin-debug-header">
            <div>
              <p>Admin Debug</p>
              <h2>QAtalyst test controls</h2>
              <span>Press ` to toggle · Esc to close</span>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} aria-label="Close admin debug menu">
              ×
            </button>
          </div>

          <section className="admin-debug-card">
            <h3>Session</h3>
            <dl className="admin-debug-kv">
              <div>
                <dt>Email</dt>
                <dd>{userEmail || "Not signed in"}</dd>
              </div>
              <div>
                <dt>Admin</dt>
                <dd>{isAdmin ? "true" : "false"}</dd>
              </div>
              <div>
                <dt>Route</dt>
                <dd>{typeof window !== "undefined" ? window.location.pathname : "Unknown"}</dd>
              </div>
            </dl>
          </section>

          <section className="admin-debug-card">
            <div className="admin-debug-section-title">
              <div>
                <h3>FTUE controls</h3>
                <p>Reset onboarding/tutorial cards without manually clearing browser storage.</p>
              </div>
              <label className="admin-debug-toggle">
                <input
                  type="checkbox"
                  checked={reloadAfterReset}
                  onChange={(event) => setReloadAfterReset(event.target.checked)}
                />
                Reload after action
              </label>
            </div>

            <div className="admin-debug-actions">
              <button type="button" onClick={resetAllFtue}>Reset all FTUE</button>
              <button type="button" onClick={completeAllFtue}>Mark all complete</button>
              <button type="button" onClick={refreshFtueState}>Refresh state</button>
            </div>

            <div className="admin-debug-ftue-list">
              {ftueRows.map((row) => (
                <article key={row.storageKey} className="admin-debug-ftue-row">
                  <div>
                    <strong>{row.label}</strong>
                    <span>{row.description}</span>
                    <code>{row.storageKey}</code>
                  </div>
                  <em className={row.isComplete ? "is-complete" : "is-open"}>
                    {row.isComplete ? "complete" : "will show"}
                  </em>
                  <div className="admin-debug-row-actions">
                    <button type="button" onClick={() => resetFtueKey(row.storageKey, row.label)}>
                      Reset
                    </button>
                    <button type="button" onClick={() => completeFtueKey(row.storageKey, row.label)}>
                      Complete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="admin-debug-card">
            <div className="admin-debug-section-title">
              <div>
                <h3>QAt preview</h3>
                <p>Quick visual check for the guide-card component and peeking behavior.</p>
              </div>
              <button type="button" onClick={() => setShowQAtPreview((value) => !value)}>
                {showQAtPreview ? "Hide preview" : "Show preview"}
              </button>
            </div>

            {showQAtPreview ? (
              <QAtGuideCard
                className="qat-ftue-card admin-debug-qat-preview"
                eyebrow="Debug preview"
                title="QAt is ready to test the guide layer."
                body="This preview lets you verify the card, QAt image, hover/focus behavior, and copy rhythm without resetting FTUE."
                primaryAction={{ label: "Primary action", onClick: () => setLastAction("Clicked preview primary action.") }}
                secondaryAction={{ label: "Secondary action", onClick: () => setLastAction("Clicked preview secondary action.") }}
              />
            ) : null}
          </section>

          <section className="admin-debug-card">
            <h3>Diagnostics</h3>
            <div className="admin-debug-actions">
              <button type="button" onClick={copyLocalStorageSnapshot}>Copy localStorage snapshot</button>
            </div>
            <p className="admin-debug-note">
              No secrets, tokens, or credit mutation controls are exposed in this v1 menu.
            </p>
            {lastAction ? <p className="admin-debug-last-action">{lastAction}</p> : null}
          </section>
        </aside>
      ) : null}
    </>
  );
}
