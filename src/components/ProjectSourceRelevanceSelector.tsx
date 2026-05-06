"use client";

import { useMemo, useState } from "react";
import type { ActiveProjectContext } from "@/components/ProjectContextIndicator";
import {
  buildSelectedProjectContextBlock,
  rankProjectSourcesForInput,
  type RankedProjectSource,
} from "@/lib/project-source-relevance";

function slugifyForTestId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type ProjectSourceRelevanceSelectorProps = {
  activeContext: ActiveProjectContext | null;
  sourceInput: string;
  toolId: string;
  selectedSourceIds: string[];
  onSelectedSourceIdsChange: (sourceIds: string[]) => void;
  onSelectedContextBlockChange?: (contextBlock: string) => void;
};

export default function ProjectSourceRelevanceSelector({
  activeContext,
  sourceInput,
  toolId,
  selectedSourceIds,
  onSelectedSourceIdsChange,
  onSelectedContextBlockChange,
}: ProjectSourceRelevanceSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const rankedSources = useMemo<RankedProjectSource[]>(() => {
    if (!activeContext) return [];
    return rankProjectSourcesForInput(activeContext.sources, sourceInput, toolId);
  }, [activeContext, sourceInput, toolId]);

  const enabledSources = rankedSources.filter((source) => source.isEnabled);
  const suggestedSourceIds = rankedSources.filter((source) => source.isSuggested).map((source) => source.id);
  const selectedCount = selectedSourceIds.length;

  function updateSelection(nextIds: string[]) {
    onSelectedSourceIdsChange(nextIds);

    if (activeContext) {
      onSelectedContextBlockChange?.(
        buildSelectedProjectContextBlock(activeContext.contextBlock, rankedSources, nextIds)
      );
    }
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

  if (!activeContext?.project) {
    return null;
  }

  if (enabledSources.length === 0) {
    return (
      <section className="source-relevance-selector source-relevance-selector-empty" data-testid="project-sources-card">
        <p className="report-kicker">Project Sources</p>
        <strong>No enabled sources</strong>
        <span>Enable sources in the Project Source Vault to use project memory for this run.</span>
      </section>
    );
  }

  return (
    <section className="source-relevance-selector" data-testid="project-sources-card">
      <div className="source-relevance-main">
        <div>
          <p className="report-kicker">Project Sources</p>
          <strong>
            <span data-testid="selected-source-count">{selectedCount} selected</span> for this run
          </strong>
          <span>
            {suggestedSourceIds.length} suggested from {enabledSources.length} enabled source
            {enabledSources.length === 1 ? "" : "s"}.
          </span>
        </div>

        <div className="source-relevance-actions">
          <button type="button" onClick={selectSuggested}>
            Use Suggested
          </button>
          <button type="button" data-testid="choose-sources-button" onClick={() => setIsOpen((value) => !value)}>
            {isOpen ? "Hide Sources" : "Choose Sources"}
          </button>
        </div>
      </div>

      {isOpen ? (
        <div className="source-relevance-drawer" data-testid="choose-sources-panel">
          <div className="source-relevance-toolbar">
            <button type="button" onClick={selectAllEnabled}>
              Select All
            </button>
            <button type="button" onClick={clearSelection}>
              Clear
            </button>
          </div>

          <div className="source-relevance-list" data-testid="source-list">
            {rankedSources.map((source) => {
              const sourceSlug = slugifyForTestId(source.title || source.id);

              return (
              <label
                className={
                  selectedSourceIds.includes(source.id)
                    ? "source-relevance-item source-relevance-item-selected"
                    : "source-relevance-item"
                }
                data-testid={`source-option-${sourceSlug}`}
                key={source.id}
              >
                <input
                  checked={selectedSourceIds.includes(source.id)}
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
        </div>
      ) : null}
    </section>
  );
}
