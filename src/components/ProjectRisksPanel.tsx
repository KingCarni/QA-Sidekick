"use client";

import { useEffect, useMemo, useState } from "react";
import type { SafeQAProject } from "@/components/ProjectSettingsPanel";
import styles from "./ProjectRisksPanel.module.css";

type SafeProjectRisk = {
  id: string;
  projectId: string;
  title: string;
  area: string;
  riskType: string;
  severity: string;
  likelihood: string;
  description: string;
  testingGuidance: string | null;
  relatedTags: string[];
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type SafeProjectFeature = {
  id: string;
  projectId: string;
  name: string;
  area: string;
  lifecycleState: string;
  description: string;
  dependencies: string[];
  relatedTags: string[];
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type RiskApiResponse = { ok?: boolean; error?: string; risks?: SafeProjectRisk[]; risk?: SafeProjectRisk };
type FeatureApiResponse = { ok?: boolean; error?: string; features?: SafeProjectFeature[]; feature?: SafeProjectFeature };

type Props = { activeProject: SafeQAProject | null; mode?: "risks" | "features" };

const RISK_TYPES = ["regression", "integration", "data", "permissions", "ux", "performance", "accessibility", "security", "release", "other"];
const LEVELS = ["low", "medium", "high", "critical"];
const STATES = ["planned", "in-progress", "implemented", "deprecated"];

function titleCase(value: string) {
  return value.split("-").map((word) => word.slice(0, 1).toUpperCase() + word.slice(1)).join(" ");
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
  } catch {
    return "";
  }
}

export default function ProjectRisksPanel({ activeProject, mode = "risks" }: Props) {
  const [risks, setRisks] = useState<SafeProjectRisk[]>([]);
  const [features, setFeatures] = useState<SafeProjectFeature[]>([]);
  const [selectedRiskId, setSelectedRiskId] = useState("");
  const [selectedFeatureId, setSelectedFeatureId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [riskTitle, setRiskTitle] = useState("");
  const [riskArea, setRiskArea] = useState("");
  const [riskType, setRiskType] = useState("regression");
  const [severity, setSeverity] = useState("medium");
  const [likelihood, setLikelihood] = useState("medium");
  const [riskDescription, setRiskDescription] = useState("");
  const [testingGuidance, setTestingGuidance] = useState("");
  const [riskTags, setRiskTags] = useState("");
  const [riskEnabled, setRiskEnabled] = useState(true);

  const [featureName, setFeatureName] = useState("");
  const [featureArea, setFeatureArea] = useState("");
  const [lifecycleState, setLifecycleState] = useState("planned");
  const [featureDescription, setFeatureDescription] = useState("");
  const [dependencies, setDependencies] = useState("");
  const [featureTags, setFeatureTags] = useState("");
  const [featureEnabled, setFeatureEnabled] = useState(true);

  const selectedRisk = useMemo(() => risks.find((item) => item.id === selectedRiskId) ?? null, [risks, selectedRiskId]);
  const selectedFeature = useMemo(() => features.find((item) => item.id === selectedFeatureId) ?? null, [features, selectedFeatureId]);

  const visibleRisks = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return risks.filter((risk) => {
      const matchesSearch = !q || [risk.title, risk.area, risk.riskType, risk.severity, risk.likelihood, risk.description, risk.testingGuidance ?? "", risk.relatedTags.join(" ")].join(" ").toLowerCase().includes(q);
      const matchesFilter = filter === "all" || risk.riskType === filter || risk.severity === filter || (filter === "enabled" && risk.isEnabled) || (filter === "disabled" && !risk.isEnabled);
      return matchesSearch && matchesFilter;
    });
  }, [risks, searchTerm, filter]);

  const visibleFeatures = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return features.filter((feature) => {
      const matchesSearch = !q || [feature.name, feature.area, feature.lifecycleState, feature.description, feature.dependencies.join(" "), feature.relatedTags.join(" ")].join(" ").toLowerCase().includes(q);
      const matchesFilter = filter === "all" || feature.lifecycleState === filter || (filter === "enabled" && feature.isEnabled) || (filter === "disabled" && !feature.isEnabled);
      return matchesSearch && matchesFilter;
    });
  }, [features, searchTerm, filter]);

  useEffect(() => {
    setRisks([]);
    setFeatures([]);
    setSelectedRiskId("");
    setSelectedFeatureId("");
    resetRiskEditor();
    resetFeatureEditor();
    if (activeProject?.id) void loadAll(activeProject.id);
  }, [activeProject?.id]);

  useEffect(() => {
    if (!selectedRisk) return;
    setRiskTitle(selectedRisk.title);
    setRiskArea(selectedRisk.area);
    setRiskType(selectedRisk.riskType);
    setSeverity(selectedRisk.severity);
    setLikelihood(selectedRisk.likelihood);
    setRiskDescription(selectedRisk.description);
    setTestingGuidance(selectedRisk.testingGuidance ?? "");
    setRiskTags(selectedRisk.relatedTags.join(", "));
    setRiskEnabled(selectedRisk.isEnabled);
  }, [selectedRisk]);

  useEffect(() => {
    if (!selectedFeature) return;
    setFeatureName(selectedFeature.name);
    setFeatureArea(selectedFeature.area);
    setLifecycleState(selectedFeature.lifecycleState);
    setFeatureDescription(selectedFeature.description);
    setDependencies(selectedFeature.dependencies.join(", "));
    setFeatureTags(selectedFeature.relatedTags.join(", "));
    setFeatureEnabled(selectedFeature.isEnabled);
  }, [selectedFeature]);

  function resetRiskEditor() {
    setRiskTitle(""); setRiskArea(""); setRiskType("regression"); setSeverity("medium"); setLikelihood("medium"); setRiskDescription(""); setTestingGuidance(""); setRiskTags(""); setRiskEnabled(true); setMessage(""); setError("");
  }

  function resetFeatureEditor() {
    setFeatureName(""); setFeatureArea(""); setLifecycleState("planned"); setFeatureDescription(""); setDependencies(""); setFeatureTags(""); setFeatureEnabled(true); setMessage(""); setError("");
  }

  async function loadAll(projectId: string) {
    setIsLoading(true);
    setError("");
    try {
      const [riskResponse, featureResponse] = await Promise.all([
        fetch(`/api/projects/${encodeURIComponent(projectId)}/risks`),
        fetch(`/api/projects/${encodeURIComponent(projectId)}/features`),
      ]);
      const riskPayload = (await riskResponse.json().catch(() => null)) as RiskApiResponse | null;
      const featurePayload = (await featureResponse.json().catch(() => null)) as FeatureApiResponse | null;
      if (!riskResponse.ok || riskPayload?.ok === false) throw new Error(riskPayload?.error || "Could not load risks.");
      if (!featureResponse.ok || featurePayload?.ok === false) throw new Error(featurePayload?.error || "Could not load features.");
      setRisks(riskPayload?.risks ?? []);
      setFeatures(featurePayload?.features ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load Brain risk data.");
    } finally {
      setIsLoading(false);
    }
  }

  async function saveRisk() {
    if (!activeProject?.id) return;
    setIsSaving(true); setMessage(""); setError("");
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(activeProject.id)}/risks`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selectedRiskId || undefined, title: riskTitle, area: riskArea, riskType, severity, likelihood, description: riskDescription, testingGuidance, relatedTags: riskTags, isEnabled: riskEnabled }) });
      const payload = (await response.json().catch(() => null)) as RiskApiResponse | null;
      if (!response.ok || payload?.ok === false || !payload?.risk) throw new Error(payload?.error || "Could not save risk.");
      const saved = payload.risk;
      setRisks((current) => current.some((item) => item.id === saved.id) ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
      setSelectedRiskId(saved.id); setMessage(`Saved risk: ${saved.title}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save risk.");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveFeature() {
    if (!activeProject?.id) return;
    setIsSaving(true); setMessage(""); setError("");
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(activeProject.id)}/features`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selectedFeatureId || undefined, name: featureName, area: featureArea, lifecycleState, description: featureDescription, dependencies, relatedTags: featureTags, isEnabled: featureEnabled }) });
      const payload = (await response.json().catch(() => null)) as FeatureApiResponse | null;
      if (!response.ok || payload?.ok === false || !payload?.feature) throw new Error(payload?.error || "Could not save feature.");
      const saved = payload.feature;
      setFeatures((current) => current.some((item) => item.id === saved.id) ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
      setSelectedFeatureId(saved.id); setMessage(`Saved feature: ${saved.name}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save feature.");
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleRisk(item: SafeProjectRisk) {
    const response = await fetch(`/api/project-risks/${encodeURIComponent(item.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isEnabled: !item.isEnabled }) });
    const payload = (await response.json().catch(() => null)) as RiskApiResponse | null;
    if (response.ok && payload?.risk) setRisks((current) => current.map((risk) => risk.id === payload.risk!.id ? payload.risk! : risk));
  }

  async function toggleFeature(item: SafeProjectFeature) {
    const response = await fetch(`/api/project-features/${encodeURIComponent(item.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isEnabled: !item.isEnabled }) });
    const payload = (await response.json().catch(() => null)) as FeatureApiResponse | null;
    if (response.ok && payload?.feature) setFeatures((current) => current.map((feature) => feature.id === payload.feature!.id ? payload.feature! : feature));
  }

  async function deleteRisk() {
    if (!selectedRiskId || !window.confirm("Delete this risk/hotspot?")) return;
    const response = await fetch(`/api/project-risks/${encodeURIComponent(selectedRiskId)}`, { method: "DELETE" });
    if (response.ok) { setRisks((current) => current.filter((item) => item.id !== selectedRiskId)); setSelectedRiskId(""); resetRiskEditor(); }
  }

  async function deleteFeature() {
    if (!selectedFeatureId || !window.confirm("Delete this feature registry item?")) return;
    const response = await fetch(`/api/project-features/${encodeURIComponent(selectedFeatureId)}`, { method: "DELETE" });
    if (response.ok) { setFeatures((current) => current.filter((item) => item.id !== selectedFeatureId)); setSelectedFeatureId(""); resetFeatureEditor(); }
  }

  if (!activeProject) return <section className={styles.emptyPanel}><p className="report-kicker">Risks / Hotspots</p><h2>Select or create a project first</h2><p>Risk memory attaches to a project. Create a project, then track fragile areas here.</p></section>;

  const isRiskMode = mode === "risks";

  return <section className={styles.panel}>
    <div className={styles.header}><div><p className="report-kicker">{isRiskMode ? "Known Fragile Areas" : "Feature Registry"}</p><h2>{activeProject.name} {isRiskMode ? "risks" : "features"}</h2><p>{isRiskMode ? "Track recurring regressions, fragile systems, bottlenecks, and release hotspots." : "Track planned, in-progress, implemented, and deprecated product areas."}</p></div><button type="button" onClick={isRiskMode ? () => { setSelectedRiskId(""); resetRiskEditor(); } : () => { setSelectedFeatureId(""); resetFeatureEditor(); }}>{isRiskMode ? "New Risk" : "New Feature"}</button></div>
    <div className={styles.statsGrid}><div><strong>{risks.length}</strong><span>Risks</span></div><div><strong>{risks.filter((r) => r.isEnabled).length}</strong><span>Enabled risks</span></div><div><strong>{features.length}</strong><span>Features</span></div><div><strong>{features.filter((f) => f.isEnabled).length}</strong><span>Enabled features</span></div></div>
    <div className={styles.influenceCard}><p>Brain influence</p><strong>{risks.filter((r) => r.isEnabled).length} risks · {features.filter((f) => f.isEnabled).length} features</strong><span>Enabled risk and feature memory is injected server-side with Project Brain context.</span></div>
    <div className={styles.filterPanel}><label>Search<input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder={isRiskMode ? "Search risks..." : "Search features..."} /></label><label>Filter<select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">All</option><option value="enabled">Enabled</option><option value="disabled">Disabled</option>{(isRiskMode ? [...RISK_TYPES, ...LEVELS] : STATES).map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label><button type="button" onClick={() => { setSearchTerm(""); setFilter("all"); }}>Clear</button></div>
    {error ? <p className={styles.error}>{error}</p> : null}{message ? <p className={styles.message}>{message}</p> : null}
    <div className={styles.grid}><aside className={styles.listCard}><div className={styles.listHeader}><p className="report-kicker">{isRiskMode ? "Saved Risks" : "Saved Features"}</p><span>{isRiskMode ? visibleRisks.length : visibleFeatures.length} shown</span></div>{isLoading ? <p className={styles.muted}>Loading...</p> : null}<div className={styles.itemList}>{isRiskMode ? visibleRisks.map((risk) => <article className={risk.id === selectedRiskId ? `${styles.item} ${styles.active}` : styles.item} key={risk.id}><button type="button" onClick={() => setSelectedRiskId(risk.id)}><strong>{risk.title}</strong><span>{risk.area} · {titleCase(risk.riskType)}</span><small>{titleCase(risk.severity)} severity · {titleCase(risk.likelihood)} likelihood</small><small>{formatDate(risk.updatedAt)}</small></button><button className={risk.isEnabled ? styles.on : styles.off} onClick={() => toggleRisk(risk)} type="button">{risk.isEnabled ? "Enabled" : "Disabled"}</button></article>) : visibleFeatures.map((feature) => <article className={feature.id === selectedFeatureId ? `${styles.item} ${styles.active}` : styles.item} key={feature.id}><button type="button" onClick={() => setSelectedFeatureId(feature.id)}><strong>{feature.name}</strong><span>{feature.area} · {titleCase(feature.lifecycleState)}</span><small>{feature.dependencies.length ? `Dependencies: ${feature.dependencies.join(", ")}` : "No dependencies"}</small><small>{formatDate(feature.updatedAt)}</small></button><button className={feature.isEnabled ? styles.on : styles.off} onClick={() => toggleFeature(feature)} type="button">{feature.isEnabled ? "Enabled" : "Disabled"}</button></article>)}</div></aside>
    <div className={styles.editorCard}>{isRiskMode ? <><p className="report-kicker">{selectedRiskId ? "Edit Risk" : "New Risk"}</p><label>Risk title<input value={riskTitle} onChange={(e) => setRiskTitle(e.target.value)} placeholder="Example: Localization layout regressions" /></label><label>Area / system<input value={riskArea} onChange={(e) => setRiskArea(e.target.value)} placeholder="Example: Settings, checkout, mobile nav" /></label><div className={styles.twoCol}><label>Risk type<select value={riskType} onChange={(e) => setRiskType(e.target.value)}>{RISK_TYPES.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label><label>Severity<select value={severity} onChange={(e) => setSeverity(e.target.value)}>{LEVELS.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label></div><label>Likelihood<select value={likelihood} onChange={(e) => setLikelihood(e.target.value)}>{LEVELS.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label><label>Description<textarea value={riskDescription} onChange={(e) => setRiskDescription(e.target.value)} placeholder="Describe the fragile behavior, historical issue, or release risk." /></label><label>Testing guidance<textarea className={styles.shortTextarea} value={testingGuidance} onChange={(e) => setTestingGuidance(e.target.value)} placeholder="Describe how QA should test or mitigate this risk." /></label><label>Related tags<input value={riskTags} onChange={(e) => setRiskTags(e.target.value)} placeholder="Example: mobile, localization, checkout" /></label><label className={styles.checkbox}><input checked={riskEnabled} onChange={(e) => setRiskEnabled(e.target.checked)} type="checkbox" />Enabled for future Brain context</label><div className={styles.actions}><button disabled={isSaving || !riskTitle.trim() || riskDescription.trim().length < 8} onClick={saveRisk} type="button">Save Risk</button>{selectedRiskId ? <button className={styles.danger} onClick={deleteRisk} type="button">Delete Risk</button> : null}</div></> : <><p className="report-kicker">{selectedFeatureId ? "Edit Feature" : "New Feature"}</p><label>Feature name<input value={featureName} onChange={(e) => setFeatureName(e.target.value)} placeholder="Example: Message center" /></label><label>Area / system<input value={featureArea} onChange={(e) => setFeatureArea(e.target.value)} placeholder="Example: Notifications, account, dashboard" /></label><label>Lifecycle state<select value={lifecycleState} onChange={(e) => setLifecycleState(e.target.value)}>{STATES.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label><label>Description<textarea value={featureDescription} onChange={(e) => setFeatureDescription(e.target.value)} placeholder="Describe what this feature does and what QA should understand about it." /></label><label>Dependencies<input value={dependencies} onChange={(e) => setDependencies(e.target.value)} placeholder="Example: auth, billing, notifications" /></label><label>Related tags<input value={featureTags} onChange={(e) => setFeatureTags(e.target.value)} placeholder="Example: mobile, onboarding, release-v2" /></label><label className={styles.checkbox}><input checked={featureEnabled} onChange={(e) => setFeatureEnabled(e.target.checked)} type="checkbox" />Enabled for future Brain context</label><div className={styles.actions}><button disabled={isSaving || !featureName.trim() || featureDescription.trim().length < 8} onClick={saveFeature} type="button">Save Feature</button>{selectedFeatureId ? <button className={styles.danger} onClick={deleteFeature} type="button">Delete Feature</button> : null}</div></>}</div></div>
  </section>;
}
