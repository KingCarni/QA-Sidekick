"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { ActiveProjectContext } from "@/components/ProjectContextIndicator";
import type { SafeQAProject } from "@/components/ProjectSettingsPanel";
import {
  buildSelectedProjectContextBlock,
  rankProjectSourcesForInput,
  type RankedProjectSource,
} from "@/lib/project-source-relevance";

type ProjectsResponse = {
  ok?: boolean;
  error?: string;
  projects?: SafeQAProject[];
};

type HeaderProjectSourceControlsProps = {
  activeProject: SafeQAProject | null;
  activeContext: ActiveProjectContext | null;
  sourceInput: string;
  toolId: string;
  selectedSourceIds: string[];
  onActiveProjectChange: (project: SafeQAProject | null) => void;
  onSelectedSourceIdsChange: (sourceIds: string[]) => void;
  onSelectedContextBlockChange?: (contextBlock: string) => void;
};

type PopoverPosition = {
  top: number;
  left: number;
};

function optionSummary(selectedCount: number, enabledCount: number) {
  if (enabledCount === 0) return "0/0";
  return `${selectedCount}/${enabledCount}`;
}

function sourceButtonSubtext(selectedCount: number, _suggestedCount: number, enabledCount: number) {
  if (enabledCount === 0) return "No sources";
  if (selectedCount === 0) return "None selected";
  if (selectedCount === enabledCount) return "All sources";
  return "Selected";
}

function slugifyForTestId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getSafePopoverPosition(button: HTMLButtonElement | null): PopoverPosition {
  if (!button || typeof window === "undefined") {
    return { top: 220, left: 320 };
  }

  const rect = button.getBoundingClientRect();
  const menuWidth = Math.min(460, window.innerWidth - 32);
  const top = Math.max(16, Math.min(rect.bottom + 12, window.innerHeight - 120));
  const left = Math.min(Math.max(16, rect.left), Math.max(16, window.innerWidth - menuWidth - 16));

  return { top, left };
}

const popoverStyleBase: CSSProperties = {
  width: "min(460px, calc(100vw - 32px))",
  maxHeight: "min(520px, calc(100vh - 32px))",
  overflowY: "auto",
  overflowX: "hidden",
  border: "1px solid rgba(34, 197, 94, 0.38)",
  borderRadius: 24,
  background:
    "radial-gradient(circle at top left, rgba(34, 197, 94, 0.16), transparent 36%), radial-gradient(circle at top right, rgba(37, 99, 235, 0.12), transparent 38%), linear-gradient(135deg, rgba(6, 10, 22, 0.99), rgba(0, 0, 0, 0.98))",
  boxShadow:
    "0 30px 80px rgba(0, 0, 0, 0.72), 0 0 38px rgba(34, 197, 94, 0.16), inset 0 0 0 1px rgba(255, 255, 255, 0.04)",
  padding: 18,
  pointerEvents: "auto",
  isolation: "isolate",
};

const summaryStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  paddingBottom: 14,
  borderBottom: "1px solid rgba(34, 197, 94, 0.18)",
};

const actionRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 9,
  margin: "14px 0",
};

const blueActionStyle: CSSProperties = {
  border: "1px solid rgba(96, 165, 250, 0.32)",
  borderRadius: 999,
  background: "rgba(37, 99, 235, 0.18)",
  color: "rgb(219, 234, 254)",
  cursor: "pointer",
  fontSize: "0.78rem",
  fontWeight: 950,
  padding: "9px 12px",
};

const greenActionStyle: CSSProperties = {
  ...blueActionStyle,
  border: "1px solid rgba(34, 197, 94, 0.34)",
  background: "rgba(22, 163, 74, 0.2)",
  color: "rgb(220, 252, 231)",
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: 10,
};

function sourceOptionStyle(isSelected: boolean): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    gap: 12,
    alignItems: "flex-start",
    border: isSelected ? "1px solid rgba(34, 197, 94, 0.46)" : "1px solid rgba(96, 165, 250, 0.16)",
    borderRadius: 18,
    background: isSelected
      ? "radial-gradient(circle at top left, rgba(34, 197, 94, 0.14), transparent 44%), rgba(6, 78, 59, 0.2)"
      : "rgba(15, 23, 42, 0.56)",
    cursor: "pointer",
    padding: 13,
  };
}

export default function HeaderProjectSourceControls({
  activeProject,
  activeContext,
  sourceInput,
  toolId,
  selectedSourceIds,
  onActiveProjectChange,
  onSelectedSourceIdsChange,
  onSelectedContextBlockChange,
}: HeaderProjectSourceControlsProps) {
  const [projects, setProjects] = useState<SafeQAProject[]>([]);
  const [projectError, setProjectError] = useState("");
  const [isSourcesOpen, setIsSourcesOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<PopoverPosition>({ top: 220, left: 320 });
  const sourcesButtonRef = useRef<HTMLButtonElement | null>(null);

  const rankedSources = useMemo<RankedProjectSource[]>(() => {
    if (!activeContext) return [];
    return rankProjectSourcesForInput(activeContext.sources, sourceInput, toolId);
  }, [activeContext, sourceInput, toolId]);

  const enabledSources = rankedSources.filter((source) => source.isEnabled);
  const suggestedSourceIds = rankedSources.filter((source) => source.isSuggested).map((source) => source.id);
  const selectedCount = selectedSourceIds.length;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadProjects() {
      setProjectError("");

      try {
        const response = await fetch("/api/projects", { method: "GET" });
        const payload = (await response.json().catch(() => null)) as ProjectsResponse | null;

        if (!response.ok || payload?.ok === false || !payload?.projects) {
          throw new Error(payload?.error || "Could not load projects.");
        }

        if (ignore) return;

        setProjects(payload.projects);

        if (!activeProject && payload.projects.length > 0) {
          onActiveProjectChange(payload.projects[0]);
        }
      } catch (error) {
        if (!ignore) {
          setProjectError(error instanceof Error ? error.message : "Could not load projects.");
        }
      }
    }

    void loadProjects();

    return () => {
      ignore = true;
    };
  }, [activeProject, onActiveProjectChange]);

  function updatePopoverPosition() {
    setPopoverPosition(getSafePopoverPosition(sourcesButtonRef.current));
  }

  useEffect(() => {
    if (!isSourcesOpen) return;

    updatePopoverPosition();

    function handleResizeOrScroll() {
      updatePopoverPosition();
    }

    window.addEventListener("resize", handleResizeOrScroll);
    window.addEventListener("scroll", handleResizeOrScroll, true);

    return () => {
      window.removeEventListener("resize", handleResizeOrScroll);
      window.removeEventListener("scroll", handleResizeOrScroll, true);
    };
  }, [isSourcesOpen]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!isSourcesOpen) return;

      const target = event.target as Node;
      const clickedTrigger = sourcesButtonRef.current?.contains(target);
      const clickedMenu = target instanceof Element && Boolean(target.closest("[data-q84-sources-menu='true']"));

      if (!clickedTrigger && !clickedMenu) {
        setIsSourcesOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsSourcesOpen(false);
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isSourcesOpen]);

  function updateSelection(nextIds: string[]) {
    onSelectedSourceIdsChange(nextIds);

    if (activeContext) {
      onSelectedContextBlockChange?.(
        buildSelectedProjectContextBlock(activeContext.contextBlock, rankedSources, nextIds)
      );
    }
  }

  function handleProjectChange(projectId: string) {
    const selectedProject = projects.find((project) => project.id === projectId) ?? null;
    onActiveProjectChange(selectedProject);
    onSelectedSourceIdsChange([]);
    onSelectedContextBlockChange?.("");
    setIsSourcesOpen(false);
  }

  function toggleSource(sourceId: string) {
    const exists = selectedSourceIds.includes(sourceId);
    updateSelection(exists ? selectedSourceIds.filter((id) => id !== sourceId) : [...selectedSourceIds, sourceId]);
  }

  function selectSuggested() {
    updateSelection(suggestedSourceIds);
  }

  function selectAllEnabled() {
    updateSelection(enabledSources.map((source) => source.id));
  }

  function clearSelection() {
    updateSelection([]);
  }

  const sourcesMenu = (
    <div
      data-q84-sources-menu="true"
      data-testid="choose-sources-panel"
      role="menu"
      style={{
        ...popoverStyleBase,
        position: "fixed",
        top: `${popoverPosition.top}px`,
        left: `${popoverPosition.left}px`,
        right: "auto",
        bottom: "auto",
        zIndex: 2147483647,
      }}
    >
      <div style={summaryStyle}>
        <p className="report-kicker" style={{ margin: 0 }}>
          Project Sources
        </p>
        <strong style={{ color: "white", fontSize: "1.05rem" }}>
          {optionSummary(selectedCount, enabledSources.length)}
        </strong>
        <span style={{ color: "rgba(255, 255, 255, 0.68)", lineHeight: 1.45 }}>
          Choose the source memory for this run. Leave all unchecked to use only the pasted/Jira ticket source.
        </span>
      </div>

      <div style={actionRowStyle}>
        <button style={greenActionStyle} type="button" onClick={selectSuggested}>
          Use Suggested
        </button>
        <button style={blueActionStyle} type="button" onClick={selectAllEnabled}>
          Select All
        </button>
        <button style={blueActionStyle} type="button" onClick={clearSelection}>
          Clear
        </button>
      </div>

      {enabledSources.length ? (
        <div data-testid="source-list" style={listStyle}>
          {rankedSources.map((source) => {
            const sourceSlug = slugifyForTestId(source.title || source.id);
            const checked = selectedSourceIds.includes(source.id);

            return (
              <label
                data-testid={`source-option-${sourceSlug}`}
                key={source.id}
                style={sourceOptionStyle(checked)}
              >
                <input
                  checked={checked}
                  data-testid={`source-checkbox-${sourceSlug}`}
                  onChange={() => toggleSource(source.id)}
                  style={{
                    width: 17,
                    height: 17,
                    marginTop: 4,
                    accentColor: "rgb(34, 197, 94)",
                  }}
                  type="checkbox"
                />
                <span style={{ display: "grid", gap: 4, minWidth: 0 }}>
                  <strong style={{ color: "white", fontSize: "0.92rem", overflowWrap: "anywhere" }}>
                    {source.title}
                  </strong>
                  <small style={{ color: "rgba(255, 255, 255, 0.62)", fontSize: "0.78rem" }}>
                    {source.sourceType} · score {source.relevanceScore}
                    {source.isSuggested ? " · suggested" : ""}
                  </small>
                  <em
                    style={{
                      color: "rgba(255, 255, 255, 0.54)",
                      fontSize: "0.78rem",
                      fontStyle: "normal",
                      lineHeight: 1.35,
                    }}
                  >
                    {source.relevanceReason}
                  </em>
                </span>
              </label>
            );
          })}
        </div>
      ) : (
        <p style={{ color: "rgba(255, 255, 255, 0.68)", lineHeight: 1.45 }}>
          No enabled sources yet. Add or enable sources in the Project Source Vault.
        </p>
      )}
    </div>
  );

  return (
    <div className="header-project-source-controls" data-testid="header-project-source-controls">
      <div className="header-project-source-field header-project-picker-field">
        <label htmlFor="header-project-select">Project</label>
        <div className="header-select-shell">
          <select
            id="header-project-select"
            data-testid="project-picker"
            value={activeProject?.id ?? ""}
            onChange={(event) => handleProjectChange(event.target.value)}
          >
            {projects.length === 0 ? <option value="">No projects</option> : null}
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <span aria-hidden="true">▾</span>
        </div>
        {projectError ? <span className="header-project-source-error">{projectError}</span> : null}
      </div>

      <div className="header-project-source-field header-source-dropdown-field">
        <label htmlFor="header-sources-button">Sources</label>
        <button
          id="header-sources-button"
          ref={sourcesButtonRef}
          aria-expanded={isSourcesOpen}
          aria-haspopup="true"
          className="header-sources-trigger"
          data-testid="choose-sources-button"
          type="button"
          onClick={() => {
            setPopoverPosition(getSafePopoverPosition(sourcesButtonRef.current));
            setIsSourcesOpen((value) => !value);
          }}
        >
          <span>
            <strong>{optionSummary(selectedCount, enabledSources.length)}</strong>
            <small>{sourceButtonSubtext(selectedCount, suggestedSourceIds.length, enabledSources.length)}</small>
          </span>
          <em>{isSourcesOpen ? "▲" : "▼"}</em>
        </button>

        {isMounted && isSourcesOpen ? createPortal(sourcesMenu, document.body) : null}
      </div>
    </div>
  );
}
