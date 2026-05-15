"use client";

import { useState } from "react";
import type { SafeQAProject } from "@/components/ProjectSettingsPanel";
import type { SafeProjectSource } from "@/components/ProjectSourceVaultPanel";

export type ActiveProjectContext = {
  project: SafeQAProject | null;
  sources: SafeProjectSource[];
  enabledSourceCount: number;
  totalSourceCount: number;
  enabledRuleCount?: number;
  totalRuleCount?: number;
  enabledTermCount?: number;
  totalTermCount?: number;
  enabledRiskCount?: number;
  totalRiskCount?: number;
  enabledFeatureCount?: number;
  totalFeatureCount?: number;
  contextBlock: string;
  contextPreview: string;
};

type ProjectContextIndicatorProps = {
  context: ActiveProjectContext | null;
  isLoading?: boolean;
  error?: string;
};

export default function ProjectContextIndicator({
  context,
  isLoading = false,
  error = "",
}: ProjectContextIndicatorProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (isLoading) {
    return (
      <section className="project-context-indicator project-context-indicator-loading">
        <p className="report-kicker">Project Context</p>
        <strong>Loading project context...</strong>
      </section>
    );
  }

  if (error) {
    return (
      <section className="project-context-indicator project-context-indicator-error">
        <p className="report-kicker">Project Context</p>
        <strong>Context unavailable</strong>
        <span>{error}</span>
      </section>
    );
  }

  if (!context?.project) {
    return (
      <section className="project-context-indicator project-context-indicator-empty">
        <p className="report-kicker">Project Context</p>
        <strong>No active project context</strong>
        <span>Select a project in Project Brain to make QA output project-aware.</span>
      </section>
    );
  }

  return (
    <section className="project-context-indicator">
      <div className="project-context-main">
        <div>
          <p className="report-kicker">Project Context</p>
          <strong>{context.project.name}</strong>
          <span>
            Using {context.enabledSourceCount} enabled source{context.enabledSourceCount === 1 ? "" : "s"}.
            {context.enabledRuleCount ? ` ${context.enabledRuleCount} rules.` : ""}
            {context.enabledTermCount ? ` ${context.enabledTermCount} terms.` : ""}
            {context.enabledRiskCount ? ` ${context.enabledRiskCount} risks.` : ""}
            {context.enabledFeatureCount ? ` ${context.enabledFeatureCount} features.` : ""}
            {context.totalSourceCount !== context.enabledSourceCount ? ` ${context.totalSourceCount - context.enabledSourceCount} disabled sources.` : ""}
          </span>
        </div>

        <button type="button" onClick={() => setIsOpen((value) => !value)}>
          {isOpen ? "Hide Context" : "Preview Context"}
        </button>
      </div>

      {isOpen ? (
        <pre className="project-context-preview">
          {context.contextPreview || "No enabled source context yet."}
        </pre>
      ) : null}
    </section>
  );
}
