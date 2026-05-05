"use client";

import { useEffect, useMemo, useState } from "react";

export type SafeQAProject = {
  id: string;
  name: string;
  description: string;
  productType: string;
  createdAt: string;
  updatedAt: string;
};

type ProjectApiResponse = {
  ok?: boolean;
  error?: string;
  projects?: SafeQAProject[];
  project?: SafeQAProject;
};

type ProjectSettingsPanelProps = {
  activeProjectId?: string;
  onActiveProjectChange?: (project: SafeQAProject | null) => void;
};

const PRODUCT_TYPE_OPTIONS = [
  { value: "web-app", label: "Web App" },
  { value: "mobile-app", label: "Mobile App" },
  { value: "game", label: "Game" },
  { value: "api", label: "API" },
  { value: "saas", label: "SaaS" },
  { value: "other", label: "Other" },
];

export default function ProjectSettingsPanel({
  activeProjectId = "",
  onActiveProjectChange,
}: ProjectSettingsPanelProps) {
  const [projects, setProjects] = useState<SafeQAProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState(activeProjectId);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [productType, setProductType] = useState("web-app");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  useEffect(() => {
    void loadProjects();
  }, []);

  useEffect(() => {
    if (!selectedProject) return;

    setName(selectedProject.name);
    setDescription(selectedProject.description);
    setProductType(selectedProject.productType || "other");
  }, [selectedProject]);

  async function loadProjects() {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/projects", { method: "GET" });
      const payload = (await response.json().catch(() => null)) as ProjectApiResponse | null;

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || "Could not load projects.");
      }

      const nextProjects = payload?.projects ?? [];
      setProjects(nextProjects);

      const nextActive =
        nextProjects.find((project) => project.id === selectedProjectId) ??
        nextProjects.find((project) => project.id === activeProjectId) ??
        nextProjects[0] ??
        null;

      if (nextActive) {
        setSelectedProjectId(nextActive.id);
        onActiveProjectChange?.(nextActive);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load projects.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleNewProject() {
    setSelectedProjectId("");
    setName("");
    setDescription("");
    setProductType("web-app");
    setMessage("");
    setError("");
    onActiveProjectChange?.(null);
  }

  async function handleSaveProject() {
    setIsSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: selectedProjectId || undefined,
          name,
          description,
          productType,
        }),
      });

      const payload = (await response.json().catch(() => null)) as ProjectApiResponse | null;

      if (!response.ok || payload?.ok === false || !payload?.project) {
        throw new Error(payload?.error || "Could not save project.");
      }

      const savedProject = payload.project;
      setProjects((current) => {
        const exists = current.some((project) => project.id === savedProject.id);
        if (exists) {
          return current.map((project) => (project.id === savedProject.id ? savedProject : project));
        }

        return [savedProject, ...current];
      });

      setSelectedProjectId(savedProject.id);
      onActiveProjectChange?.(savedProject);
      setMessage(`Project saved: ${savedProject.name}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save project.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteProject() {
    if (!selectedProjectId) return;

    const projectName = selectedProject?.name || "this project";
    const confirmed = window.confirm(`Delete ${projectName}? Reports stay saved, but future context will no longer use this project.`);

    if (!confirmed) return;

    setIsSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(selectedProjectId)}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => null)) as ProjectApiResponse | null;

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || "Could not delete project.");
      }

      const remaining = projects.filter((project) => project.id !== selectedProjectId);
      setProjects(remaining);

      const nextActive = remaining[0] ?? null;
      setSelectedProjectId(nextActive?.id ?? "");
      onActiveProjectChange?.(nextActive);
      setMessage(nextActive ? `Deleted ${projectName}. Active project is now ${nextActive.name}.` : `Deleted ${projectName}.`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete project.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleSelectProject(projectId: string) {
    setSelectedProjectId(projectId);
    setMessage("");
    setError("");

    const project = projects.find((item) => item.id === projectId) ?? null;
    onActiveProjectChange?.(project);
  }

  return (
    <section className="project-settings-panel">
      <div className="project-settings-header">
        <div>
          <p className="report-kicker">Projects</p>
          <h2>Project foundation</h2>
          <p>
            Create the project containers that future source memories, saved sources, Jira links, and QA outputs will attach to.
          </p>
        </div>

        <button type="button" onClick={handleNewProject}>
          New Project
        </button>
      </div>

      <div className="project-settings-grid">
        <aside className="project-list-card">
          <p className="report-kicker">Project List</p>

          {isLoading ? <p className="project-empty-text">Loading projects...</p> : null}

          {!isLoading && projects.length === 0 ? (
            <p className="project-empty-text">No projects yet. Create your first project to start building project memory.</p>
          ) : null}

          <div className="project-list">
            {projects.map((project) => (
              <button
                className={project.id === selectedProjectId ? "project-list-item project-list-item-active" : "project-list-item"}
                key={project.id}
                onClick={() => handleSelectProject(project.id)}
                type="button"
              >
                <strong>{project.name}</strong>
                <span>{project.productType || "other"}</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="project-editor-card">
          <p className="report-kicker">{selectedProjectId ? "Edit Project" : "New Project"}</p>

          <label>
            Project name
            <input
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
              placeholder="Example: QAtalyst"
              value={name}
            />
          </label>

          <label>
            Product type
            <select onChange={(event) => setProductType(event.target.value)} value={productType}>
              {PRODUCT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Project description
            <textarea
              maxLength={1200}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What is this project building? Who are the users? What should QAtalyst know before generating QA output?"
              value={description}
            />
          </label>

          <div className="project-editor-actions">
            <button disabled={isSaving || !name.trim()} onClick={handleSaveProject} type="button">
              {isSaving ? "Saving..." : "Save Project"}
            </button>

            {selectedProjectId ? (
              <button className="project-danger-button" disabled={isSaving} onClick={handleDeleteProject} type="button">
                Delete Project
              </button>
            ) : null}
          </div>

          {message ? <p className="project-settings-message">{message}</p> : null}
          {error ? <p className="project-settings-error">{error}</p> : null}
        </div>
      </div>
    </section>
  );
}
