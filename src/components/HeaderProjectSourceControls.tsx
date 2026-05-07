"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const [popoverPosition, setPopoverPosition] = useState<PopoverPosition>({ top: 0, left: 0 });
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
    const button = sourcesButtonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const menuWidth = Math.min(460, window.innerWidth - 32);
    const safeLeft = Math.min(Math.max(16, rect.left), Math.max(16, window.innerWidth - menuWidth - 16));

    setPopoverPosition({
      top: rect.bottom + 12,
      left: safeLeft,
    });
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
      const clickedMenu = target instanceof Element && Boolean(target.closest("[data-header-sources-menu='true']"));

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
      className="header-sources-menu header-sources-menu-portal"
      data-header-sources-menu="true"
      data-testid="choose-sources-panel"
      role="menu"
      style={{ top: popoverPosition.top, left: popoverPosition.left }}
    >
      <div className="header-sources-menu-summary">
        <p className="report-kicker">Project Sources</p>
        <strong>{optionSummary(selectedCount, enabledSources.length)}</strong>
        <span>
          Choose the source memory for this run. Leave all unchecked to use only the pasted/Jira ticket source.
        </span>
      </div>

      <div className="header-sources-menu-actions">
        <button type="button" onClick={selectSuggested}>
          Use Suggested
        </button>
        <button type="button" onClick={selectAllEnabled}>
          Select All
        </button>
        <button type="button" onClick={clearSelection}>
          Clear
        </button>
      </div>

      {enabledSources.length ? (
        <div className="header-sources-list" data-testid="source-list">
          {rankedSources.map((source) => {
            const sourceSlug = slugifyForTestId(source.title || source.id);
            const checked = selectedSourceIds.includes(source.id);

            return (
              <label
                className={checked ? "header-source-option header-source-option-selected" : "header-source-option"}
                data-testid={`source-option-${sourceSlug}`}
                key={source.id}
              >
                <input
                  checked={checked}
                  data-testid={`source-checkbox-${sourceSlug}`}
                  onChange={() => toggleSource(source.id)}
                  type="checkbox"
                />
                <span>
                  <strong>{source.title}</strong>
                  <small>
                    {source.sourceType} · score {source.relevanceScore}
                    {source.isSuggested ? " · suggested" : ""}
                  </small>
                  <em>{source.relevanceReason}</em>
                </span>
              </label>
            );
          })}
        </div>
      ) : (
        <p className="header-sources-empty">
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
          requestAnimationFrame(() => updatePopoverPosition());
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
