export type BrainIntelligenceSignalState = "ready" | "warning" | "missing" | "info";

export type BrainIntelligenceSignal = {
  key: string;
  label: string;
  value: string;
  state: BrainIntelligenceSignalState;
};

export type BrainIntelligenceStep = {
  key: string;
  label: string;
  complete: boolean;
  active?: boolean;
  title: string;
};

export type BrainIntelligenceRecommendation = {
  title: string;
  body: string;
  targetTab?: string;
  priority: "high" | "medium" | "low";
};

export type BrainIntelligenceSummary = {
  title: string;
  body: string;
  stateLabel: string;
  progressPercent: number;
  confidenceLabel: string;
  knownSummary: string;
  missingSummary: string;
  recommendation: BrainIntelligenceRecommendation;
  steps: BrainIntelligenceStep[];
  signals: BrainIntelligenceSignal[];
  askTip: {
    title: string;
    body: string;
  };
};

export type BrainIntelligenceInput = {
  activeTab?: string;
  project?: {
    id?: string | null;
    name?: string | null;
    productType?: string | null;
    description?: string | null;
  } | null;
  sourceCount?: number;
  enabledSourceCount?: number;
  selectedSourceCount?: number;
  projectContextUsed?: boolean;
  projectContextSummary?: string;
  jiraConfigured?: boolean;
  testRailConfigured?: boolean;
  rulesCount?: number;
  terminologyCount?: number;
  risksCount?: number;
  featureCount?: number;
  savedReportCount?: number;
  bugCount?: number;
  testCaseCount?: number;
  hasInput?: boolean;
  hasOutput?: boolean;
  hasFollowUps?: boolean;
};

function positiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function percentFromCompleted(completed: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((completed / total) * 100)));
}

function projectName(input: BrainIntelligenceInput) {
  return input.project?.name?.trim() || "this project";
}

export function buildBrainIntelligenceSummary(input: BrainIntelligenceInput): BrainIntelligenceSummary {
  const hasProject = Boolean(input.project?.id);
  const hasProjectProfile = Boolean(
    input.project?.name?.trim() &&
      (input.project?.productType?.trim() || input.project?.description?.trim())
  );

  const sourceCount = positiveInteger(input.sourceCount);
  const enabledSourceCount = positiveInteger(input.enabledSourceCount);
  const selectedSourceCount = positiveInteger(input.selectedSourceCount);

  const hasSources = sourceCount > 0;
  const hasEnabledSources = enabledSourceCount > 0;
  const hasSelectedSources = selectedSourceCount > 0;
  const hasRules = positiveInteger(input.rulesCount) > 0;
  const hasTerminology = positiveInteger(input.terminologyCount) > 0;
  const hasRisks = positiveInteger(input.risksCount) > 0;
  const hasJira = Boolean(input.jiraConfigured);
  const hasTestRail = Boolean(input.testRailConfigured);
  const hasContextUse = Boolean(input.projectContextUsed || hasSelectedSources);

  const setupChecks = [
    hasProject,
    hasProjectProfile,
    hasSources,
    hasEnabledSources,
    hasRules,
    hasTerminology,
    hasRisks,
    hasJira,
    hasTestRail,
  ];

  const completedCount = setupChecks.filter(Boolean).length;
  const progressPercent = hasProject ? Math.max(15, percentFromCompleted(completedCount, setupChecks.length)) : 10;

  let recommendation: BrainIntelligenceRecommendation;

  if (!hasProject) {
    recommendation = {
      title: "Create/select a project first",
      body: "Project Brain needs a workspace before sources, rules, reports, bugs, and integrations can be scoped safely.",
      targetTab: "projects",
      priority: "high",
    };
  } else if (!hasProjectProfile) {
    recommendation = {
      title: "Complete the project profile",
      body: "Add product type or a short project description so QAt can explain what it is grounding future QA work against.",
      targetTab: "projects",
      priority: "high",
    };
  } else if (!hasSources) {
    recommendation = {
      title: "Add Source Vault context",
      body: "Add specs, ticket examples, product notes, release notes, or known workflow rules so generated QA output stops starting from a blank prompt.",
      targetTab: "sources",
      priority: "high",
    };
  } else if (!hasEnabledSources) {
    recommendation = {
      title: "Enable at least one useful source",
      body: "Sources exist, but none are enabled. Enable the context QAt should reuse before test generation, risk reviews, and bug writing.",
      targetTab: "sources",
      priority: "high",
    };
  } else if (!hasRules) {
    recommendation = {
      title: "Add QA rules next",
      body: "Rules teach QAt your team’s release gates, severity standards, automation expectations, and review habits.",
      targetTab: "rules",
      priority: "medium",
    };
  } else if (!hasTerminology) {
    recommendation = {
      title: "Add product terminology",
      body: "Terminology prevents generated QA artifacts from drifting away from your product language, roles, acronyms, and naming conventions.",
      targetTab: "terminology",
      priority: "medium",
    };
  } else if (!hasRisks) {
    recommendation = {
      title: "Capture known risks and hotspots",
      body: "Known fragile areas help QAt bias test cases and risk reviews toward the places your team actually worries about.",
      targetTab: "risks",
      priority: "medium",
    };
  } else if (!hasJira) {
    recommendation = {
      title: "Connect Jira when handoff matters",
      body: "Jira setup lets QAtalyst fetch real tickets and prepare structured QA work closer to your team’s execution workflow.",
      targetTab: "integrations",
      priority: "medium",
    };
  } else if (!hasTestRail) {
    recommendation = {
      title: "Connect TestRail for coverage handoff",
      body: "TestRail setup makes generated test coverage easier to preview, approve, and sync into your test management workflow.",
      targetTab: "integrations",
      priority: "medium",
    };
  } else {
    recommendation = {
      title: "Run a project-aware QA workflow",
      body: "The Brain has enough structure to help. Head to the Toolbelt, select useful sources, and run a small test case or risk review pass.",
      targetTab: "overview",
      priority: "low",
    };
  }

  const knownPieces = [
    hasProject ? `Project: ${projectName(input)}` : "",
    hasSources ? `${sourceCount} source${sourceCount === 1 ? "" : "s"}` : "",
    hasEnabledSources ? `${enabledSourceCount} enabled source${enabledSourceCount === 1 ? "" : "s"}` : "",
    hasRules ? "QA rules present" : "",
    hasTerminology ? "Terminology present" : "",
    hasRisks ? "Risks/hotspots present" : "",
    hasJira ? "Jira configured" : "",
    hasTestRail ? "TestRail configured" : "",
  ].filter(Boolean);

  const missingPieces = [
    !hasProject ? "project" : "",
    hasProject && !hasProjectProfile ? "project profile" : "",
    hasProject && !hasSources ? "Source Vault context" : "",
    hasSources && !hasEnabledSources ? "enabled sources" : "",
    hasProject && !hasRules ? "QA rules" : "",
    hasProject && !hasTerminology ? "terminology" : "",
    hasProject && !hasRisks ? "risks/hotspots" : "",
    hasProject && !hasJira ? "Jira" : "",
    hasProject && !hasTestRail ? "TestRail" : "",
  ].filter(Boolean);

  const confidenceLabel =
    progressPercent >= 85
      ? "High grounding"
      : progressPercent >= 55
        ? "Moderate grounding"
        : progressPercent >= 25
          ? "Early setup"
          : "Needs setup";

  const title = hasProject
    ? progressPercent >= 85
      ? "Brain is project-aware."
      : "Brain is learning this project."
    : "Let’s set up your QA memory.";

  const body = hasProject
    ? `QAt has a project container for ${projectName(input)}. Guidance is based on visible Brain setup: sources, rules, terminology, risks, and integrations.`
    : "Create or select a project first, then add reusable source context, QA rules, terminology, risks, and integrations.";

  const steps: BrainIntelligenceStep[] = [
    { key: "project", label: "Project", complete: hasProject, title: hasProject ? "Project selected" : "Create/select a project" },
    { key: "sources", label: "Sources", complete: hasEnabledSources, title: hasEnabledSources ? "Source context enabled" : hasSources ? "Enable useful sources" : "Add Source Vault context" },
    { key: "rules", label: "Rules", complete: hasRules, title: hasRules ? "QA rules present" : "Add QA rules" },
    { key: "terms", label: "Terms", complete: hasTerminology, title: hasTerminology ? "Terminology present" : "Add terminology" },
    { key: "risks", label: "Risks", complete: hasRisks, title: hasRisks ? "Risk memory present" : "Add risks/hotspots" },
    { key: "jira", label: "Jira", complete: hasJira, title: hasJira ? "Jira configured" : "Configure Jira" },
    { key: "testrail", label: "TestRail", complete: hasTestRail, title: hasTestRail ? "TestRail configured" : "Configure TestRail" },
  ];

  const signals: BrainIntelligenceSignal[] = [
    { key: "project", label: "Project", value: hasProject ? projectName(input) : "Missing", state: hasProject ? "ready" : "warning" },
    { key: "sources", label: "Sources", value: hasEnabledSources ? `${enabledSourceCount} enabled` : hasSources ? `${sourceCount} saved, none enabled` : "Missing", state: hasEnabledSources ? "ready" : hasSources ? "warning" : "missing" },
    { key: "grounding", label: "Grounding", value: confidenceLabel, state: progressPercent >= 55 ? "ready" : "warning" },
    { key: "handoff", label: "Handoff", value: hasJira && hasTestRail ? "Jira + TestRail" : hasJira ? "Jira only" : hasTestRail ? "TestRail only" : "Not connected", state: hasJira || hasTestRail ? "ready" : "warning" },
  ];

  const askTip = input.hasFollowUps
    ? { title: "Follow-ups are still open", body: "Answer the active follow-up questions before treating this output as handoff-ready. QAt should preserve resolved answers and avoid repeating closed questions." }
    : input.hasOutput
      ? { title: hasContextUse ? "Review the project-aware output" : "Output has limited project grounding", body: hasContextUse ? "This output used project context. Review it for accuracy, then save, sync, or export it if it is ready." : "This output did not use selected project context. Add or enable Source Vault context before relying on it for release work." }
      : input.hasInput
        ? { title: hasContextUse ? "Input is ready with project context" : "Input is ready, but context is thin", body: hasContextUse ? "Run the selected workflow, then use QAt to review gaps, missing coverage, and handoff readiness." : "Run the workflow if this is a quick pass, or select useful Source Vault context first for a more grounded result." }
        : { title: recommendation.title, body: recommendation.body };

  return {
    title,
    body,
    stateLabel: progressPercent >= 85 ? "Ready" : hasProject ? "Learning" : "Setup",
    progressPercent,
    confidenceLabel,
    knownSummary: knownPieces.length ? knownPieces.join(" · ") : "No project memory selected yet.",
    missingSummary: missingPieces.length ? missingPieces.join(", ") : "No major setup gaps detected.",
    recommendation,
    steps,
    signals,
    askTip,
  };
}
