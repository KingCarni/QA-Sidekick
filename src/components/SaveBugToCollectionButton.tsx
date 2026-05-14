"use client";

import { useState } from "react";
import type { SafeQAProject } from "@/components/ProjectSettingsPanel";

type SaveBugToCollectionButtonProps = {
  activeProject: SafeQAProject | null;
  markdown: string;
  structuredData?: unknown;
  sourceInput?: string;
  onSaved?: () => void;
};

type SaveState = "idle" | "saving" | "saved" | "error";

type BugApiResponse = {
  ok?: boolean;
  error?: string;
  bug?: {
    id: string;
    title: string;
  };
};

function getBugTitle(structuredData: unknown): string {
  if (typeof structuredData !== "object" || structuredData === null || Array.isArray(structuredData)) {
    return "Saved Bug Report";
  }

  const record = structuredData as Record<string, unknown>;
  const bugReport =
    typeof record.bugReport === "object" && record.bugReport !== null && !Array.isArray(record.bugReport)
      ? (record.bugReport as Record<string, unknown>)
      : record;

  return String(bugReport.title || bugReport.summary || "Saved Bug Report")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 140);
}

export default function SaveBugToCollectionButton({
  activeProject,
  markdown,
  structuredData,
  sourceInput = "",
  onSaved,
}: SaveBugToCollectionButtonProps) {
  const [state, setState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("");

  const canSave = Boolean(activeProject?.id) && Boolean(markdown.trim()) && state !== "saving";

  async function handleSave() {
    if (!activeProject?.id) {
      setState("error");
      setMessage("Select a project before saving bugs to the Bug Collection.");
      return;
    }

    setState("saving");
    setMessage("");

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(activeProject.id)}/bugs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: getBugTitle(structuredData),
          status: "new",
          markdown,
          structuredData,
          sourceInput,
          tags: ["generated-bug", "qatalyst"],
        }),
      });

      const payload = (await response.json().catch(() => null)) as BugApiResponse | null;

      if (!response.ok || payload?.ok === false || !payload?.bug) {
        throw new Error(payload?.error || "Could not save bug to collection.");
      }

      setState("saved");
      setMessage(`Saved bug to collection: ${payload.bug.title}`);
      onSaved?.();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not save bug to collection.");
    }
  }

  if (!markdown.trim()) return null;

  return (
    <div className="save-bug-collection-button-only" data-testid="save-bug-collection-control">
      <button className="save-bug-collection-button" disabled={!canSave} onClick={handleSave} type="button">
        {state === "saving" ? "Saving..." : "Save Bug to Collection"}
      </button>

      {message ? (
        <p
          className={
            state === "error"
              ? "save-bug-collection-message save-bug-collection-message-error"
              : "save-bug-collection-message"
          }
        >
          {message}
        </p>
      ) : null}

      {!activeProject ? (
        <p className="save-bug-collection-message save-bug-collection-message-error">
          Select or create a project before saving bug reports.
        </p>
      ) : null}
    </div>
  );
}