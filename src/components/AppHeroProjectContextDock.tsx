"use client";

import { useMemo, useState } from "react";
import ProjectPicker from "@/components/ProjectPicker";
import type { ActiveProjectContext } from "@/components/ProjectContextIndicator";
import type { SafeQAProject } from "@/components/ProjectSettingsPanel";
import {
  buildSelectedProjectContextBlock,
  rankProjectSourcesForInput,
} from "@/lib/project-source-relevance";

type ToolId = "tests" | "risk" | "bug" | "improve";

type AppHeroProjectContextDockProps = {
  activeProject: SafeQAProject | null;
  onActiveProjectChange: (project: SafeQAProject | null) => void;
  activeProjectContext: ActiveProjectContext | null;
  isProjectContextLoading: boolean;
  projectContextError: string;
  sourceInput: string;
  toolId: ToolId;
  selectedProjectSourceIds: string[];
  onSelectedProjectSourceIdsChange: (sourceIds: string[]) => void;
  onSelectedProjectContextBlockChange: (contextBlock: string) => void;
};

export default function AppHeroProjectContextDock({
  activeProject,
  onActiveProjectChange,
  activeProjectContext,
  isProjectContextLoading,
  projectContextError,
  sourceInput,
  toolId,
  selectedProjectSourceIds,
  onSelectedProjectSourceIdsChange,
  onSelectedProjectContextBlockChange,
}: AppHeroProjectContextDockProps) {
  const [showContextPreview, setShowContextPreview] = useState(false);
  const [showSourceChooser, setShowSourceChooser] = useState(false);

  const rankedSources = useMemo(() => {
    if (!activeProjectContext) return [];
    return rankProjectSourcesForInput(activeProjectContext.sources, sourceInput, toolId);
  }, [activeProjectContext, sourceInput, toolId]);

  const enabledSources = rankedSources.filter((source) => source.isEnabled);
  const suggestedSourceIds = rankedSources.filter((source) => source.isSuggested).map((source) => source.id);

  function updateSourceSelection(nextSourceIds: string[]) {
    onSelectedProjectSourceIdsChange(nextSourceIds);

    if (!activeProjectContext) {
      onSelectedProjectContextBlockChange("");
      return;
    }

    onSelectedProjectContextBlockChange(
      buildSelectedProjectContextBlock(
        activeProjectContext.contextBlock,
        rankedSources,
        nextSourceIds
      )
    );
  }

  function toggleSource(sourceId: string) {
    updateSourceSelection(
      selectedProjectSourceIds.includes(sourceId)
        ? selectedProjectSourceIds.filter((id) => id !== sourceId)
        : [...selectedProjectSourceIds, sourceId]
    );
  }

  return (
    <section className="app-hero-context-dock-fixed" aria-label="Project memory controls">
      <div className="hero-context-card hero-project-card">
        <p className="report-kicker">Project</p>
        <ProjectPicker
          activeProjectId={activeProject?.id}
          onActiveProjectChange={onActiveProjectChange}
        />
      </div>

      <div className="hero-context-card">
        <div>
          <p className="report-kicker">Project Context</p>
          {isProjectContextLoading ? (
            <>
              <strong>Loading context...</strong>
              <span>Checking enabled project memory.</span>
            </>
          ) : projectContextError ? (
            <>
              <strong>Context unavailable</strong>
              <span>{projectContextError}</span>
            </>
          ) : activeProjectContext?.project ? (
            <>
              <strong>{activeProjectContext.project.name}</strong>
              <span>
                Using {activeProjectContext.enabledSourceCount} enabled source
                {activeProjectContext.enabledSourceCount === 1 ? "" : "s"}.
              </span>
            </>
          ) : (
            <>
              <strong>No active context</strong>
              <span>Select a project to use memory.</span>
            </>
          )}
        </div>

        <button
          className="hero-context-secondary-button"
          type="button"
          onClick={() => setShowContextPreview((value) => !value)}
          disabled={!activeProjectContext?.contextPreview}
        >
          {showContextPreview ? "Hide" : "Preview"}
        </button>
      </div>

      <div className="hero-context-card">
        <div>
          <p className="report-kicker">Project Sources</p>
          {activeProjectContext?.project ? (
            <>
              <strong>{selectedProjectSourceIds.length} selected</strong>
              <span>
                {suggestedSourceIds.length} suggested from {enabledSources.length} enabled.
              </span>
            </>
          ) : (
            <>
              <strong>No sources</strong>
              <span>Select a project first.</span>
            </>
          )}
        </div>

        <div className="hero-source-actions">
          <button
            className="hero-context-green-button"
            type="button"
            onClick={() => updateSourceSelection(suggestedSourceIds)}
            disabled={!activeProjectContext?.project || suggestedSourceIds.length === 0}
          >
            Suggested
          </button>
          <button
            className="hero-context-secondary-button"
            type="button"
            onClick={() => setShowSourceChooser((value) => !value)}
            disabled={!activeProjectContext?.project || enabledSources.length === 0}
          >
            Choose
          </button>
        </div>
      </div>

      {showContextPreview && activeProjectContext?.contextPreview ? (
        <div className="hero-context-expanded hero-context-preview-fixed">
          <div className="hero-context-expanded-header">
            <p className="report-kicker">Context Preview</p>
            <button type="button" onClick={() => setShowContextPreview(false)}>
              Close
            </button>
          </div>
          <pre>{activeProjectContext.contextPreview}</pre>
        </div>
      ) : null}

      {showSourceChooser && activeProjectContext?.project ? (
        <div className="hero-context-expanded hero-source-chooser-fixed">
          <div className="hero-context-expanded-header">
            <div>
              <p className="report-kicker">Choose Project Sources</p>
              <strong>{selectedProjectSourceIds.length} selected for this run</strong>
            </div>

            <div className="hero-source-toolbar">
              <button type="button" onClick={() => updateSourceSelection(suggestedSourceIds)}>
                Suggested
              </button>
              <button type="button" onClick={() => updateSourceSelection(enabledSources.map((source) => source.id))}>
                All
              </button>
              <button type="button" onClick={() => updateSourceSelection([])}>
                Clear
              </button>
              <button type="button" onClick={() => setShowSourceChooser(false)}>
                Close
              </button>
            </div>
          </div>

          <div className="hero-source-list-fixed">
            {rankedSources.map((source) => (
              <label
                className={
                  selectedProjectSourceIds.includes(source.id)
                    ? "hero-source-row-fixed hero-source-row-fixed-selected"
                    : "hero-source-row-fixed"
                }
                key={source.id}
              >
                <input
                  checked={selectedProjectSourceIds.includes(source.id)}
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
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
