"use client";

import { useState } from "react";
import {
  FTUE_KEYS,
  completeFtueStep,
  resetAllFtueSteps,
} from "@/lib/ftue-state";

const ADMIN_EMAIL = "harleydean17@gmail.com";
const ACTIVE_PROJECT_STORAGE_KEY = "qatalyst.activeProjectId";

type AdminDebugMenuProps = {
  userEmail?: string | null;
  activeTool?: string;
  activeProjectId?: string | null;
  activeProjectName?: string | null;
};

export default function AdminDebugMenu({
  userEmail,
  activeTool,
  activeProjectId,
  activeProjectName,
}: AdminDebugMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");

  if (userEmail !== ADMIN_EMAIL) return null;

  function flash(nextMessage: string) {
    setMessage(nextMessage);

    window.setTimeout(() => {
      setMessage("");
    }, 2400);
  }

  function resetFtue() {
    resetAllFtueSteps();

    flash("FTUE reset. Refresh to see onboarding cards again.");
  }

  function completeFtue() {
    Object.values(FTUE_KEYS).forEach((key) => completeFtueStep(key));

    flash("FTUE marked complete.");
  }

  function clearActiveProject() {
    window.localStorage.removeItem(ACTIVE_PROJECT_STORAGE_KEY);

    flash("Active project cleared.");
  }

  function openPath(path: string) {
    window.location.href = path;
  }

  return (
    <aside
      style={{
        position: "fixed",
        right: 20,
        bottom: 20,
        zIndex: 9999,
      }}
    >
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        style={{
          borderRadius: 12,
          padding: "10px 14px",
          background: "#111827",
          color: "white",
          border: "1px solid rgba(255,255,255,0.12)",
          cursor: "pointer",
        }}
      >
        Debug
      </button>

      {isOpen ? (
        <div
          style={{
            width: 300,
            marginTop: 12,
            borderRadius: 16,
            background: "#0f172a",
            border: "1px solid rgba(255,255,255,0.12)",
            padding: 16,
            color: "white",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
          }}
        >
          <div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              Admin Debug Menu
            </div>

            <div style={{ fontWeight: 700 }}>
              QA Shortcuts
            </div>
          </div>

          <div
            style={{
              fontSize: 12,
              opacity: 0.8,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <span>Tool: {activeTool || "unknown"}</span>

            <span>
              Project: {activeProjectName || activeProjectId || "none"}
            </span>
          </div>

          <button type="button" onClick={resetFtue}>
            Reset FTUE
          </button>

          <button type="button" onClick={completeFtue}>
            Complete FTUE
          </button>

          <button type="button" onClick={clearActiveProject}>
            Clear Active Project
          </button>

          <button type="button" onClick={() => openPath("/brain")}>
            Open Brain
          </button>

          <button
            type="button"
            onClick={() => openPath("/brain?tab=integrations")}
          >
            Brain Integrations
          </button>

          <button type="button" onClick={() => openPath("/account")}>
            Account
          </button>

          {message ? (
            <div
              style={{
                fontSize: 12,
                opacity: 0.85,
                marginTop: 4,
              }}
            >
              {message}
            </div>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}