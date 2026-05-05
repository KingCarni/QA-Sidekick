"use client";

import { useEffect, useState } from "react";
import type { SafeQAProject } from "@/components/ProjectSettingsPanel";

type ProjectPickerProps = {
  activeProjectId?: string;
  onActiveProjectChange?: (project: SafeQAProject | null) => void;
};

type ProjectsResponse = {
  ok?: boolean;
  projects?: SafeQAProject[];
};

const ACTIVE_PROJECT_STORAGE_KEY = "qatalyst.activeProjectId";

export default function ProjectPicker({ activeProjectId = "", onActiveProjectChange }: ProjectPickerProps) {
  const [projects, setProjects] = useState<SafeQAProject[]>([]);
  const [selectedId, setSelectedId] = useState(activeProjectId);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const storedId = typeof window !== "undefined" ? window.localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY) ?? "" : "";
    setSelectedId(activeProjectId || storedId);
    void loadProjects(activeProjectId || storedId);
  }, [activeProjectId]);

  async function loadProjects(preferredId: string) {
    setIsLoading(true);

    try {
      const response = await fetch("/api/projects", { method: "GET" });
      const payload = (await response.json().catch(() => null)) as ProjectsResponse | null;

      if (!response.ok || payload?.ok === false) return;

      const nextProjects = payload?.projects ?? [];
      setProjects(nextProjects);

      const activeProject =
        nextProjects.find((project) => project.id === preferredId) ??
        nextProjects[0] ??
        null;

      setSelectedId(activeProject?.id ?? "");
      onActiveProjectChange?.(activeProject);

      if (activeProject && typeof window !== "undefined") {
        window.localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, activeProject.id);
      }
    } finally {
      setIsLoading(false);
    }
  }

  function handleChange(projectId: string) {
    setSelectedId(projectId);

    const activeProject = projects.find((project) => project.id === projectId) ?? null;
    onActiveProjectChange?.(activeProject);

    if (typeof window !== "undefined") {
      if (projectId) {
        window.localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, projectId);
      } else {
        window.localStorage.removeItem(ACTIVE_PROJECT_STORAGE_KEY);
      }
    }
  }

  if (projects.length === 0 && !isLoading) {
    return (
      <div className="project-picker project-picker-empty">
        <span>No active project</span>
      </div>
    );
  }

  return (
    <label className="project-picker">
      <span>Project</span>
      <select disabled={isLoading} onChange={(event) => handleChange(event.target.value)} value={selectedId}>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
    </label>
  );
}
