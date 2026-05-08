"use client";

import { useMemo, useState, type CSSProperties } from "react";
import FeatureBuilderCompanionPanel from "@/components/FeatureBuilderCompanionPanel";
import type { SafeQAProject } from "@/components/ProjectSettingsPanel";

type FeatureBuilderToolProps = {
  activeProject: SafeQAProject | null;
  onSavedToSourceVault?: () => void;
};

type FeatureBrief = {
  title?: string;
  summary?: string;
  userValue?: string;
  problemStatement?: string;
  targetUsers?: string[];
  inScope?: string[];
  outOfScope?: string[];
  userStories?: string[];
  acceptanceCriteria?: string[];
  qaRisks?: string[];
  testIdeas?: string[];
  analyticsOrTelemetry?: string[];
  dependencies?: string[];
  openQuestions?: string[];
  jiraReadyNotes?: string[];
};

type FeatureBuilderResponse = {
  ok?: boolean;
  error?: string;
  brief?: FeatureBrief;
  markdown?: string;
};

type SaveState = "idle" | "saving" | "saved" | "error";

type FeatureBriefArtifactStatus = "draft" | "approved" | "promoted";

type FeatureBriefVersion = {
  id: string;
  label: string;
  reason: string;
  brief: FeatureBrief;
  markdown: string;
  createdAt: string;
  status: FeatureBriefArtifactStatus;
};

type FeatureJiraOptions = {
  parentIssueType: string;
  createChildTasks: boolean;
  createQaTask: boolean;
  childTaskMode: "task" | "subtask";
};

type JiraPreviewTask = {
  summary: string;
  description: string;
  source: "scope" | "test" | "qa";
};

type FeatureJiraPreview = {
  parentSummary: string;
  parentDescription: string;
  childTasks: JiraPreviewTask[];
  qaTask: JiraPreviewTask | null;
};

type FeatureJiraCreateResponse = {
  ok?: boolean;
  error?: string;
  parentIssue?: {
    key: string;
    browseUrl: string;
  };
  childIssues?: Array<{
    key: string;
    browseUrl: string;
    summary: string;
  }>;
  qaIssue?: {
    key: string;
    browseUrl: string;
    summary: string;
  } | null;
};

type CompanionPrompt = {
  title: string;
  prompt: string;
  tone: "brainstorm" | "scope" | "risk" | "criteria";
};

type RefinementAction = {
  id: string;
  label: string;
  description: string;
  tone: "scope" | "risk" | "criteria" | "jira" | "mvp" | "future" | "questions";
};

type TextFieldKey = "summary" | "userValue" | "problemStatement";
type ListFieldKey =
  | "targetUsers"
  | "inScope"
  | "outOfScope"
  | "userStories"
  | "acceptanceCriteria"
  | "qaRisks"
  | "testIdeas"
  | "openQuestions"
  | "jiraReadyNotes";

type FieldChangeMap = Partial<Record<keyof FeatureBrief, Set<string> | true>>;

const REFINEMENT_ACTIONS: RefinementAction[] = [
  {
    id: "tighten-scope",
    label: "Tighten Scope",
    description: "Sharper MVP boundaries and cleaner out-of-scope notes.",
    tone: "scope",
  },
  {
    id: "add-qa-risks",
    label: "Add QA Risks",
    description: "Find more risk areas, edge cases, and regression concerns.",
    tone: "risk",
  },
  {
    id: "acceptance-criteria",
    label: "Generate Acceptance Criteria",
    description: "Make criteria more testable and release-ready.",
    tone: "criteria",
  },
  {
    id: "missing-questions",
    label: "Find Missing Questions",
    description: "Surface product, technical, and QA questions before build.",
    tone: "questions",
  },
  {
    id: "jira-ready",
    label: "Make Jira-ready",
    description: "Improve title, user stories, and implementation notes.",
    tone: "jira",
  },
  {
    id: "simplify-mvp",
    label: "Simplify MVP",
    description: "Reduce the first pass to the smallest useful slice.",
    tone: "mvp",
  },
  {
    id: "future-enhancements",
    label: "Expand Future Enhancements",
    description: "Add smart later-phase ideas without bloating MVP.",
    tone: "future",
  },
];

const TEXT_FIELDS: Array<{ key: TextFieldKey; label: string }> = [
  { key: "summary", label: "Summary" },
  { key: "userValue", label: "User Value" },
  { key: "problemStatement", label: "Problem" },
];

const LIST_FIELDS: Array<{ key: ListFieldKey; label: string }> = [
  { key: "targetUsers", label: "Target Users" },
  { key: "inScope", label: "In Scope" },
  { key: "outOfScope", label: "Out of Scope" },
  { key: "userStories", label: "User Stories" },
  { key: "acceptanceCriteria", label: "Acceptance Criteria" },
  { key: "qaRisks", label: "QA Risks" },
  { key: "testIdeas", label: "Test Ideas" },
  { key: "openQuestions", label: "Open Questions" },
  { key: "jiraReadyNotes", label: "Jira-ready Notes" },
];

const refinementCardStyle: CSSProperties = {
  border: "1px solid rgba(96, 165, 250, 0.28)",
  borderRadius: "20px",
  background:
    "radial-gradient(circle at top left, rgba(96, 165, 250, 0.12), transparent 38%), linear-gradient(135deg, rgba(8, 12, 24, 0.84), rgba(0, 0, 0, 0.58))",
  margin: "0 0 18px",
  padding: "16px",
};

const refinementHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "flex-start",
  marginBottom: "14px",
};

const refinementGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))",
  gap: "10px",
};

const refinementButtonBaseStyle: CSSProperties = {
  minHeight: "96px",
  borderRadius: "16px",
  background:
    "radial-gradient(circle at top left, rgba(255, 255, 255, 0.08), transparent 34%), linear-gradient(135deg, rgba(18, 18, 20, 0.98), rgba(5, 5, 7, 0.98))",
  color: "#fff",
  cursor: "pointer",
  padding: "12px",
  textAlign: "left",
  display: "flex",
  flexDirection: "column",
  gap: "7px",
  boxShadow: "0 14px 30px rgba(0, 0, 0, 0.24)",
};

const refinementLabelStyle: CSSProperties = {
  display: "block",
  fontSize: "0.86rem",
  fontWeight: 950,
  lineHeight: 1.2,
};

const refinementDescriptionStyle: CSSProperties = {
  color: "rgba(229, 231, 235, 0.72)",
  display: "block",
  fontSize: "0.76rem",
  lineHeight: 1.35,
};

const refinementToneBorders: Record<RefinementAction["tone"], string> = {
  scope: "1px solid rgba(34, 197, 94, 0.34)",
  risk: "1px solid rgba(248, 113, 113, 0.36)",
  criteria: "1px solid rgba(250, 204, 21, 0.34)",
  questions: "1px solid rgba(250, 204, 21, 0.34)",
  jira: "1px solid rgba(96, 165, 250, 0.36)",
  mvp: "1px solid rgba(34, 197, 94, 0.34)",
  future: "1px solid rgba(96, 165, 250, 0.36)",
};

const editTextareaStyle: CSSProperties = {
  width: "100%",
  minHeight: "108px",
  resize: "vertical",
  border: "1px solid rgba(96, 165, 250, 0.28)",
  borderRadius: "14px",
  background: "rgba(0, 0, 0, 0.44)",
  color: "#fff",
  font: "inherit",
  fontSize: "0.92rem",
  lineHeight: 1.5,
  padding: "12px",
  outline: "none",
};

const editInputStyle: CSSProperties = {
  width: "100%",
  border: "1px solid rgba(96, 165, 250, 0.28)",
  borderRadius: "14px",
  background: "rgba(0, 0, 0, 0.44)",
  color: "#fff",
  font: "inherit",
  fontSize: "1.1rem",
  fontWeight: 900,
  padding: "11px 12px",
  outline: "none",
};

const editToggleStyle: CSSProperties = {
  border: "1px solid rgba(147, 197, 253, 0.34)",
  borderRadius: "12px",
  background: "rgba(37, 99, 235, 0.18)",
  color: "#dbeafe",
  cursor: "pointer",
  fontSize: "0.78rem",
  fontWeight: 950,
  padding: "8px 10px",
};

const artifactCardStyle: CSSProperties = {
  border: "1px solid rgba(34, 197, 94, 0.28)",
  borderRadius: "20px",
  background:
    "radial-gradient(circle at top left, rgba(34, 197, 94, 0.1), transparent 38%), linear-gradient(135deg, rgba(4, 24, 14, 0.72), rgba(0, 0, 0, 0.58))",
  margin: "0 0 18px",
  padding: "16px",
};

const artifactHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "14px",
  alignItems: "flex-start",
  marginBottom: "14px",
};

const artifactActionsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "10px",
  justifyContent: "flex-end",
};

const artifactButtonStyle: CSSProperties = {
  border: "1px solid rgba(147, 197, 253, 0.34)",
  borderRadius: "14px",
  background: "linear-gradient(135deg, rgba(37, 99, 235, 0.94), rgba(30, 64, 175, 0.92))",
  color: "#fff",
  cursor: "pointer",
  fontSize: "0.82rem",
  fontWeight: 950,
  padding: "10px 12px",
};

const artifactGhostButtonStyle: CSSProperties = {
  ...artifactButtonStyle,
  background: "rgba(15, 23, 42, 0.82)",
  border: "1px solid rgba(148, 163, 184, 0.28)",
};

const artifactGreenButtonStyle: CSSProperties = {
  ...artifactButtonStyle,
  background: "linear-gradient(135deg, rgba(22, 163, 74, 0.96), rgba(21, 128, 61, 0.92))",
  border: "1px solid rgba(134, 239, 172, 0.34)",
};

const versionListStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "10px",
};

const versionButtonStyle: CSSProperties = {
  border: "1px solid rgba(148, 163, 184, 0.24)",
  borderRadius: "14px",
  background: "rgba(0, 0, 0, 0.32)",
  color: "#fff",
  cursor: "pointer",
  padding: "11px",
  textAlign: "left",
};

const contextShortcutStyle: CSSProperties = {
  border: "1px solid rgba(96, 165, 250, 0.25)",
  borderRadius: "14px",
  background: "rgba(15, 23, 42, 0.68)",
  color: "rgba(229, 231, 235, 0.9)",
  padding: "12px",
};

const jiraPlanCardStyle: CSSProperties = {
  border: "1px solid rgba(59, 130, 246, 0.32)",
  borderRadius: "20px",
  background:
    "radial-gradient(circle at top left, rgba(37, 99, 235, 0.16), transparent 42%), linear-gradient(135deg, rgba(3, 7, 18, 0.9), rgba(0, 0, 0, 0.62))",
  margin: "0 0 18px",
  padding: "16px",
};

const jiraPlanGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "12px",
  marginTop: "14px",
};

const jiraPlanPreviewBoxStyle: CSSProperties = {
  border: "1px solid rgba(148, 163, 184, 0.18)",
  borderRadius: "16px",
  background: "rgba(0, 0, 0, 0.34)",
  padding: "14px",
};

const jiraPlanControlStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "7px",
  color: "#fecaca",
  fontSize: "0.72rem",
  fontWeight: 950,
  letterSpacing: "0.11em",
  textTransform: "uppercase",
};

const jiraPlanInputStyle: CSSProperties = {
  border: "1px solid rgba(96, 165, 250, 0.32)",
  borderRadius: "12px",
  background: "rgba(0, 0, 0, 0.48)",
  color: "#fff",
  font: "inherit",
  fontSize: "0.92rem",
  fontWeight: 800,
  padding: "10px 11px",
  outline: "none",
  textTransform: "none",
  letterSpacing: "normal",
};

const jiraCheckboxRowStyle: CSSProperties = {
  alignItems: "center",
  color: "rgba(255, 255, 255, 0.88)",
  display: "flex",
  gap: "9px",
  fontSize: "0.9rem",
  fontWeight: 850,
  letterSpacing: "normal",
  textTransform: "none",
};

const jiraCreateButtonStyle: CSSProperties = {
  minHeight: "44px",
  border: "1px solid rgba(74, 222, 128, 0.42)",
  borderRadius: "14px",
  background:
    "radial-gradient(circle at top left, rgba(255, 255, 255, 0.13), transparent 36%), linear-gradient(135deg, #16a34a, #15803d)",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 950,
  padding: "10px 16px",
  boxShadow: "0 14px 28px rgba(34, 197, 94, 0.18)",
};

const jiraSecondaryButtonStyle: CSSProperties = {
  minHeight: "44px",
  border: "1px solid rgba(147, 197, 253, 0.36)",
  borderRadius: "14px",
  background:
    "radial-gradient(circle at top left, rgba(255, 255, 255, 0.13), transparent 36%), linear-gradient(135deg, #2563eb, #1d4ed8)",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 950,
  padding: "10px 16px",
  boxShadow: "0 14px 28px rgba(37, 99, 235, 0.18)",
};

function normalizeForCompare(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function getChangedFields(previous: FeatureBrief | null, next: FeatureBrief): FieldChangeMap {
  if (!previous) return {};

  const changed: FieldChangeMap = {};
  const textFields: TextFieldKey[] = ["summary", "userValue", "problemStatement"];

  for (const key of textFields) {
    if (normalizeForCompare(previous[key] ?? "") !== normalizeForCompare(next[key] ?? "")) {
      changed[key] = true;
    }
  }

  const listFields: ListFieldKey[] = [
    "targetUsers",
    "inScope",
    "outOfScope",
    "userStories",
    "acceptanceCriteria",
    "qaRisks",
    "testIdeas",
    "openQuestions",
    "jiraReadyNotes",
  ];

  for (const key of listFields) {
    const previousItems = new Set((previous[key] ?? []).map(normalizeForCompare));
    const addedItems = new Set<string>();

    for (const item of next[key] ?? []) {
      if (!previousItems.has(normalizeForCompare(item))) {
        addedItems.add(item);
      }
    }

    if (addedItems.size > 0) {
      changed[key] = addedItems;
    }
  }

  return changed;
}

function splitWords(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function getDraftSignals(draft: string) {
  const words = splitWords(draft);
  const hasUser = /\b(user|player|admin|qa|dev|customer|manager|teacher|student)\b/i.test(draft);
  const hasOutcome = /\b(so that|because|goal|should|need|want|improve|reduce|increase|prevent)\b/i.test(draft);
  const hasScope = /\b(in scope|out of scope|phase|mvp|later|not included|exclude)\b/i.test(draft);
  const hasRisk = /\b(risk|edge|fail|error|bug|security|permission|privacy|performance|stale|sync)\b/i.test(draft);
  const hasCriteria = /\b(acceptance|given|when|then|criteria|success|done|validate)\b/i.test(draft);

  return {
    wordCount: words.length,
    hasUser,
    hasOutcome,
    hasScope,
    hasRisk,
    hasCriteria,
  };
}

function buildCompanionPrompts(draft: string): CompanionPrompt[] {
  const signals = getDraftSignals(draft);
  const trimmed = draft.trim();

  if (!trimmed) {
    return [
      {
        title: "Start with the user",
        tone: "brainstorm",
        prompt: "Who needs this feature, and what job are they trying to complete?",
      },
      {
        title: "Name the outcome",
        tone: "scope",
        prompt: "What should be easier, faster, safer, or clearer after this feature exists?",
      },
      {
        title: "Sketch the MVP",
        tone: "criteria",
        prompt: "What is the smallest version that would still be useful enough to test?",
      },
    ];
  }

  const prompts: CompanionPrompt[] = [];

  if (!signals.hasUser) {
    prompts.push({
      title: "Add the target user",
      tone: "brainstorm",
      prompt: "Who is this for? Example: QA analyst, product manager, developer, admin, external client.",
    });
  }

  if (!signals.hasOutcome) {
    prompts.push({
      title: "Add the value",
      tone: "brainstorm",
      prompt: "What pain does this solve, and what should the user be able to do after it ships?",
    });
  }

  if (!signals.hasScope) {
    prompts.push({
      title: "Draw the boundary",
      tone: "scope",
      prompt: "What belongs in the first pass, and what should be explicitly deferred?",
    });
  }

  if (!signals.hasCriteria) {
    prompts.push({
      title: "Define done",
      tone: "criteria",
      prompt: "What 3-5 acceptance criteria would prove the feature works?",
    });
  }

  if (!signals.hasRisk) {
    prompts.push({
      title: "Pressure-test it",
      tone: "risk",
      prompt: "What could go wrong: bad input, permissions, stale state, confusing UX, or failed saves?",
    });
  }

  prompts.push(
    {
      title: "QA angle",
      tone: "risk",
      prompt: "What regression areas should QA check after this change lands?",
    },
    {
      title: "Jira-ready phrasing",
      tone: "scope",
      prompt: "Rewrite the idea as: As a [user], I want [capability], so that [benefit].",
    }
  );

  return prompts.slice(0, 6);
}

function asList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function normalizeBrief(value: unknown): FeatureBrief {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const record = value as Record<string, unknown>;

  return {
    title: typeof record.title === "string" ? record.title : "Feature Brief",
    summary: typeof record.summary === "string" ? record.summary : "",
    userValue: typeof record.userValue === "string" ? record.userValue : "",
    problemStatement: typeof record.problemStatement === "string" ? record.problemStatement : "",
    targetUsers: asList(record.targetUsers),
    inScope: asList(record.inScope),
    outOfScope: asList(record.outOfScope),
    userStories: asList(record.userStories),
    acceptanceCriteria: asList(record.acceptanceCriteria),
    qaRisks: asList(record.qaRisks),
    testIdeas: asList(record.testIdeas),
    analyticsOrTelemetry: asList(record.analyticsOrTelemetry),
    dependencies: asList(record.dependencies),
    openQuestions: asList(record.openQuestions),
    jiraReadyNotes: asList(record.jiraReadyNotes),
  };
}

function listMarkdown(title: string, items: string[]) {
  return [`## ${title}`, ...(items.length ? items.map((item) => `- ${item}`) : ["- Not specified."])].join("\n");
}

function buildFeatureMarkdown(brief: FeatureBrief) {
  const title = brief.title?.trim() || "Feature Brief";

  return [
    `# ${title}`,
    "",
    "## Summary",
    brief.summary?.trim() || "Not specified.",
    "",
    "## User Value",
    brief.userValue?.trim() || "Not specified.",
    "",
    "## Problem Statement",
    brief.problemStatement?.trim() || "Not specified.",
    "",
    listMarkdown("Target Users", brief.targetUsers ?? []),
    "",
    listMarkdown("User Stories", brief.userStories ?? []),
    "",
    listMarkdown("In Scope", brief.inScope ?? []),
    "",
    listMarkdown("Out of Scope", brief.outOfScope ?? []),
    "",
    listMarkdown("Acceptance Criteria", brief.acceptanceCriteria ?? []),
    "",
    listMarkdown("QA Risks", brief.qaRisks ?? []),
    "",
    listMarkdown("Test Ideas", brief.testIdeas ?? []),
    "",
    listMarkdown("Analytics / Telemetry", brief.analyticsOrTelemetry ?? []),
    "",
    listMarkdown("Dependencies", brief.dependencies ?? []),
    "",
    listMarkdown("Open Questions", brief.openQuestions ?? []),
    "",
    listMarkdown("Jira-ready Notes", brief.jiraReadyNotes ?? []),
  ].join("\n");
}

function parseListText(value: string) {
  return value
    .split("\n")
    .map((item) => item.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);
}

function listToText(items: string[] | undefined) {
  return (items ?? []).join("\n");
}

function isFieldChanged(changeMap: FieldChangeMap, key: keyof FeatureBrief) {
  return changeMap[key] === true;
}

function isListItemNew(changeMap: FieldChangeMap, key: keyof FeatureBrief, item: string) {
  const value = changeMap[key];

  if (!value || value === true) return false;

  return value.has(item);
}


function firstNonEmpty(values: Array<string | undefined>) {
  return values.map((value) => value?.trim()).find(Boolean) ?? "";
}

function buildFeatureJiraPreview(brief: FeatureBrief | null): FeatureJiraPreview | null {
  if (!brief) return null;

  const title = brief.title?.trim() || "Feature Brief";
  const parentSummary = title.slice(0, 240);

  const acceptance = brief.acceptanceCriteria ?? [];
  const scope = brief.inScope ?? [];
  const risks = brief.qaRisks ?? [];
  const tests = brief.testIdeas ?? [];
  const questions = brief.openQuestions ?? [];

  const parentDescription = [
    `# ${title}`,
    "",
    "## Summary",
    brief.summary || "Not specified.",
    "",
    "## User Value",
    brief.userValue || "Not specified.",
    "",
    "## Problem Statement",
    brief.problemStatement || "Not specified.",
    "",
    listMarkdown("In Scope", scope),
    "",
    listMarkdown("Out of Scope", brief.outOfScope ?? []),
    "",
    listMarkdown("Acceptance Criteria", acceptance),
    "",
    listMarkdown("QA Risks", risks),
    "",
    listMarkdown("Open Questions", questions),
  ].join("\n");

  const childTasks: JiraPreviewTask[] = [];

  scope.slice(0, 4).forEach((item) => {
    childTasks.push({
      source: "scope",
      summary: `Implement: ${item}`.slice(0, 240),
      description: [
        `# Implement: ${item}`,
        "",
        "## Source",
        "Generated from Feature Builder In Scope.",
        "",
        "## Parent Feature",
        title,
        "",
        "## Acceptance Notes",
        acceptance.length ? acceptance.map((entry) => `- ${entry}`).join("\n") : "- Confirm implementation matches the feature brief.",
      ].join("\n"),
    });
  });

  tests.slice(0, 3).forEach((item) => {
    childTasks.push({
      source: "test",
      summary: `QA: ${item}`.slice(0, 240),
      description: [
        `# QA: ${item}`,
        "",
        "## Source",
        "Generated from Feature Builder Test Ideas.",
        "",
        "## Parent Feature",
        title,
      ].join("\n"),
    });
  });

  const qaTask: JiraPreviewTask | null =
    risks.length || tests.length
      ? {
          source: "qa",
          summary: `QA Review: ${title}`.slice(0, 240),
          description: [
            `# QA Review: ${title}`,
            "",
            "## QA Risks",
            risks.length ? risks.map((entry) => `- ${entry}`).join("\n") : "- No QA risks listed.",
            "",
            "## Test Ideas",
            tests.length ? tests.map((entry) => `- ${entry}`).join("\n") : "- No test ideas listed.",
            "",
            "## Open Questions",
            questions.length ? questions.map((entry) => `- ${entry}`).join("\n") : "- No open questions listed.",
          ].join("\n"),
        }
      : null;

  return {
    parentSummary,
    parentDescription,
    childTasks: childTasks.slice(0, 7),
    qaTask,
  };
}

function renderList(items: string[] | undefined, key: ListFieldKey, changedFields: FieldChangeMap) {
  const safeItems = items?.filter(Boolean) ?? [];

  if (!safeItems.length) {
    return <p className="feature-builder-muted">Not specified.</p>;
  }

  return (
    <ul>
      {safeItems.map((item, index) => {
        const isNew = isListItemNew(changedFields, key, item);

        return (
          <li
            key={`${item}-${index}`}
            style={
              isNew
                ? {
                    color: "#86efac",
                    fontWeight: 900,
                    textShadow: "0 0 14px rgba(34, 197, 94, 0.18)",
                  }
                : undefined
            }
          >
            {isNew ? "+ " : ""}
            {item}
          </li>
        );
      })}
    </ul>
  );
}

export default function FeatureBuilderTool({ activeProject, onSavedToSourceVault }: FeatureBuilderToolProps) {
  const [draft, setDraft] = useState("");
  const [extraContext, setExtraContext] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [refiningActionId, setRefiningActionId] = useState("");
  const [error, setError] = useState("");
  const [brief, setBrief] = useState<FeatureBrief | null>(null);
  const [changedFields, setChangedFields] = useState<FieldChangeMap>({});
  const [isEditingBrief, setIsEditingBrief] = useState(false);
  const [markdown, setMarkdown] = useState("");
  const [lastRefinement, setLastRefinement] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [artifactStatus, setArtifactStatus] = useState<FeatureBriefArtifactStatus>("draft");
  const [versionHistory, setVersionHistory] = useState<FeatureBriefVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [artifactMessage, setArtifactMessage] = useState("");
  const [jiraOptions, setJiraOptions] = useState<FeatureJiraOptions>({
    parentIssueType: "Story",
    createChildTasks: true,
    createQaTask: true,
    childTaskMode: "task",
  });
  const [jiraCreateState, setJiraCreateState] = useState<"idle" | "creating" | "created" | "error">("idle");
  const [jiraCreateMessage, setJiraCreateMessage] = useState("");
  const [jiraCreatedParent, setJiraCreatedParent] = useState<FeatureJiraCreateResponse["parentIssue"] | null>(null);
  const [jiraCreatedChildren, setJiraCreatedChildren] = useState<NonNullable<FeatureJiraCreateResponse["childIssues"]>>([]);
  const [jiraCreatedQaIssue, setJiraCreatedQaIssue] = useState<FeatureJiraCreateResponse["qaIssue"] | null>(null);

  const companionPrompts = useMemo(() => buildCompanionPrompts(draft), [draft]);
  const signals = useMemo(() => getDraftSignals(draft), [draft]);
  const jiraPreview = useMemo(() => buildFeatureJiraPreview(brief), [brief]);
  const canCreateJiraPlan = Boolean(brief && markdown.trim() && jiraPreview && jiraCreateState !== "creating");

  const canGenerate = draft.trim().length >= 12 && !isGenerating && !refiningActionId;
  const canSave = Boolean(activeProject?.id) && Boolean(markdown.trim()) && saveState !== "saving";
  const isBusy = isGenerating || Boolean(refiningActionId);

  function addVersionSnapshot(nextBrief: FeatureBrief, reason: string, status: FeatureBriefArtifactStatus = "draft") {
    const nextMarkdown = buildFeatureMarkdown(nextBrief);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    setVersionHistory((current) => [
      ...current,
      {
        id,
        label: `v${current.length + 1}`,
        reason,
        brief: nextBrief,
        markdown: nextMarkdown,
        createdAt: new Date().toLocaleString(),
        status,
      },
    ]);
    setSelectedVersionId(id);
    setArtifactStatus(status);
    setArtifactMessage(`${reason} saved as a feature brief version.`);
  }

  function saveManualVersion() {
    if (!brief) return;

    addVersionSnapshot(brief, isEditingBrief ? "Manual edit" : "Manual checkpoint", artifactStatus);
  }

  function restoreVersion(version: FeatureBriefVersion) {
    setBrief(version.brief);
    setMarkdown(version.markdown);
    setSelectedVersionId(version.id);
    setArtifactStatus(version.status);
    setChangedFields({});
    setLastRefinement(`Restored ${version.label}`);
    setArtifactMessage(`Restored ${version.label}: ${version.reason}.`);
    setSaveState("idle");
    setSaveMessage("");
  }

  function approveCurrentBrief() {
    if (!brief) return;

    addVersionSnapshot(brief, "Approved feature brief", "approved");
  }

  function updateBrief(nextBrief: FeatureBrief, resetChanged = false) {
    setBrief(nextBrief);
    setMarkdown(buildFeatureMarkdown(nextBrief));

    if (resetChanged) {
      setChangedFields({});
    }
  }

  function updateTextField(key: TextFieldKey, value: string) {
    if (!brief) return;

    const nextBrief = {
      ...brief,
      [key]: value,
    };

    updateBrief(nextBrief);
    setSaveState("idle");
    setSaveMessage("");
  }

  function updateListField(key: ListFieldKey, value: string) {
    if (!brief) return;

    const nextBrief = {
      ...brief,
      [key]: parseListText(value),
    };

    updateBrief(nextBrief);
    setSaveState("idle");
    setSaveMessage("");
  }

  function updateTitle(value: string) {
    if (!brief) return;

    const nextBrief = {
      ...brief,
      title: value,
    };

    updateBrief(nextBrief);
    setSaveState("idle");
    setSaveMessage("");
  }

  function appendPrompt(prompt: string) {
    setDraft((current) => {
      const trimmed = current.trim();

      if (!trimmed) return prompt;

      return `${trimmed}\n\n${prompt}`;
    });
  }

  async function submitFeatureBuilderRequest(mode: "generate" | "refine", refinement?: RefinementAction) {
    if (mode === "generate" && !canGenerate) return;
    if (mode === "refine" && (!brief || !markdown || !refinement || isBusy)) return;

    const previousBrief = brief ? normalizeBrief(brief) : null;

    if (mode === "generate") {
      setIsGenerating(true);
      setBrief(null);
      setMarkdown("");
      setLastRefinement("");
      setChangedFields({});
      setIsEditingBrief(false);
      setArtifactStatus("draft");
      setVersionHistory([]);
      setSelectedVersionId("");
      setArtifactMessage("");
    } else {
      setRefiningActionId(refinement?.id ?? "");
      setLastRefinement("");
    }

    setError("");
    setSaveState("idle");
    setSaveMessage("");

    try {
      const response = await fetch("/api/feature-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          refinementAction: refinement?.id ?? "",
          refinementLabel: refinement?.label ?? "",
          draft,
          extraContext,
          currentBrief: brief,
          currentMarkdown: markdown,
          projectName: activeProject?.name ?? "",
          projectType: activeProject?.productType ?? "",
        }),
      });

      const payload = (await response.json().catch(() => null)) as FeatureBuilderResponse | null;

      if (!response.ok || payload?.ok === false || !payload?.brief) {
        throw new Error(payload?.error || "Could not generate feature brief.");
      }

      const normalized = normalizeBrief(payload.brief);
      const nextMarkdown = payload.markdown?.trim() || buildFeatureMarkdown(normalized);

      setBrief(normalized);
      setMarkdown(nextMarkdown);

      if (mode === "refine" && refinement) {
        setChangedFields(getChangedFields(previousBrief, normalized));
        setLastRefinement(`Updated with: ${refinement.label}`);
        addVersionSnapshot(normalized, `Refined: ${refinement.label}`, "draft");
      } else {
        setChangedFields({});
        addVersionSnapshot(normalized, "Initial generated brief", "draft");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Feature Builder could not complete this request.");
    } finally {
      setIsGenerating(false);
      setRefiningActionId("");
    }
  }

  async function generateFeatureBrief() {
    await submitFeatureBuilderRequest("generate");
  }

  async function refineFeatureBrief(refinement: RefinementAction) {
    await submitFeatureBuilderRequest("refine", refinement);
  }

  async function saveToSourceVault() {
    if (!activeProject?.id) {
      setSaveState("error");
      setSaveMessage("Select a project before saving to Project Source Vault.");
      return;
    }

    if (!markdown.trim()) {
      setSaveState("error");
      setSaveMessage("Generate a feature brief before saving.");
      return;
    }

    setSaveState("saving");
    setSaveMessage("");

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(activeProject.id)}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: (brief?.title || "Generated Feature Brief").trim().slice(0, 100),
          sourceType: "feature-brief",
          tags: ["feature-builder", "feature-brief", "qatalyst"],
          body: markdown.trim().slice(0, 24000),
          isEnabled: true,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; source?: { id: string; title: string } }
        | null;

      if (!response.ok || payload?.ok === false || !payload?.source) {
        throw new Error(payload?.error || "Could not save feature brief to Project Source Vault.");
      }

      setSaveState("saved");
      setSaveMessage(`Promoted "${payload.source.title}" to Project Source Vault.`);
      setArtifactStatus("promoted");
      setArtifactMessage("Current feature brief was promoted to reusable Project Source Vault context.");
      if (brief) {
        addVersionSnapshot(brief, "Promoted to Project Source Vault", "promoted");
      }
      onSavedToSourceVault?.();
    } catch (err) {
      setSaveState("error");
      setSaveMessage(err instanceof Error ? err.message : "Could not save feature brief to Project Source Vault.");
    }
  }


  async function createJiraFeaturePlan() {
    if (!brief || !jiraPreview || !markdown.trim()) {
      setJiraCreateState("error");
      setJiraCreateMessage("Generate a feature brief before creating Jira work.");
      return;
    }

    setJiraCreateState("creating");
    setJiraCreateMessage("");
    setJiraCreatedParent(null);
    setJiraCreatedChildren([]);
    setJiraCreatedQaIssue(null);

    try {
      const response = await fetch("/api/feature-builder/jira/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief,
          markdown,
          preview: jiraPreview,
          options: jiraOptions,
        }),
      });

      const payload = (await response.json().catch(() => null)) as FeatureJiraCreateResponse | null;

      if (!response.ok || payload?.ok === false || !payload?.parentIssue) {
        throw new Error(payload?.error || "Could not create Jira feature work.");
      }

      setJiraCreatedParent(payload.parentIssue);
      setJiraCreatedChildren(payload.childIssues ?? []);
      setJiraCreatedQaIssue(payload.qaIssue ?? null);
      setJiraCreateState("created");
      setJiraCreateMessage(`Created ${payload.parentIssue.key} in Jira.`);
    } catch (err) {
      setJiraCreateState("error");
      setJiraCreateMessage(err instanceof Error ? err.message : "Could not create Jira feature work.");
    }
  }

  function updateJiraOptions(nextOptions: Partial<FeatureJiraOptions>) {
    setJiraOptions((current) => ({
      ...current,
      ...nextOptions,
    }));
    setJiraCreateState("idle");
    setJiraCreateMessage("");
    setJiraCreatedParent(null);
    setJiraCreatedChildren([]);
    setJiraCreatedQaIssue(null);
  }

  return (
    <section className="feature-builder-shell" data-testid="feature-builder-tool">
      <div className="feature-builder-input-card">
        <p className="report-kicker">Feature Builder</p>
        <h2>Shape a rough idea into a feature brief</h2>
        <p>
          Start messy. QAtalyst will help turn the idea into scope, acceptance criteria, QA
          risks, and Jira-ready notes.
        </p>

        <label className="feature-builder-label">
          Rough feature idea
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Example: I want a tool that lets users type a rough feature idea, get live brainstorming prompts, and generate a structured feature brief..."
            rows={12}
          />
        </label>

        <label className="feature-builder-label">
          Extra context / constraints
          <textarea
            value={extraContext}
            onChange={(event) => setExtraContext(event.target.value)}
            placeholder="Optional: project constraints, user type, known risks, design notes, release goal..."
            rows={5}
          />
        </label>

        <div className="feature-builder-readiness">
          <span className={signals.hasUser ? "ready" : ""}>User</span>
          <span className={signals.hasOutcome ? "ready" : ""}>Value</span>
          <span className={signals.hasScope ? "ready" : ""}>Scope</span>
          <span className={signals.hasCriteria ? "ready" : ""}>Criteria</span>
          <span className={signals.hasRisk ? "ready" : ""}>Risk</span>
        </div>

        <button
          className="feature-builder-primary"
          disabled={!canGenerate}
          onClick={generateFeatureBrief}
          type="button"
        >
          {isGenerating ? "Building Feature Brief..." : "Build Feature Brief"}
        </button>

        {error ? <p className="feature-builder-error">{error}</p> : null}
      </div>

      <FeatureBuilderCompanionPanel
        draft={draft}
        extraContext={extraContext}
        projectName={activeProject?.name ?? ""}
        productType={activeProject?.productType ?? ""}
        onAppendPrompt={appendPrompt}
      />

      <div className="feature-builder-output-card">
        <div className="feature-builder-output-header">
          <div>
            <p className="report-kicker">Generated Feature Brief</p>
            {brief && isEditingBrief ? (
              <input
                aria-label="Feature brief title"
                onChange={(event) => updateTitle(event.target.value)}
                style={editInputStyle}
                value={brief.title ?? ""}
              />
            ) : (
              <h2>{brief?.title || "No feature brief generated yet"}</h2>
            )}
            {lastRefinement ? <p className="feature-builder-success-inline">{lastRefinement}</p> : null}
          </div>

          <div className="feature-builder-output-actions">
            {brief ? (
              <button onClick={() => setIsEditingBrief((value) => !value)} style={editToggleStyle} type="button">
                {isEditingBrief ? "Preview Brief" : "Edit Brief"}
              </button>
            ) : null}
            <button disabled={!markdown} onClick={() => navigator.clipboard?.writeText(markdown)} type="button">
              Copy Markdown
            </button>
            <button disabled={!canSave} onClick={saveToSourceVault} type="button">
              {saveState === "saving" ? "Saving..." : "Save to Source Vault"}
            </button>
          </div>
        </div>

        {brief ? (
          <section aria-label="Feature brief artifact controls" style={artifactCardStyle}>
            <div style={artifactHeaderStyle}>
              <div>
                <p className="report-kicker">Feature Brief Artifact</p>
                <h3 style={{ color: "#fff", fontSize: "1.04rem", margin: "4px 0 0" }}>
                  Version, approve, and promote this brief
                </h3>
                <p style={{ color: "rgba(229, 231, 235, 0.68)", margin: "7px 0 0" }}>
                  Status: <strong style={{ color: artifactStatus === "promoted" ? "#86efac" : artifactStatus === "approved" ? "#bfdbfe" : "#fde68a" }}>{artifactStatus}</strong>
                  {selectedVersionId ? " · Current version selected" : ""}
                </p>
              </div>

              <div style={artifactActionsStyle}>
                <button onClick={saveManualVersion} style={artifactGhostButtonStyle} type="button">
                  Save Draft Version
                </button>
                <button onClick={approveCurrentBrief} style={artifactButtonStyle} type="button">
                  Approve Brief
                </button>
                <button disabled={!canSave} onClick={saveToSourceVault} style={{ ...artifactGreenButtonStyle, opacity: canSave ? 1 : 0.55, cursor: canSave ? "pointer" : "not-allowed" }} type="button">
                  Promote to Source Vault
                </button>
              </div>
            </div>

            {artifactMessage ? (
              <p style={{ color: "#bbf7d0", fontWeight: 900, margin: "0 0 12px" }}>{artifactMessage}</p>
            ) : null}

            {versionHistory.length > 0 ? (
              <div style={versionListStyle}>
                {versionHistory.map((version) => (
                  <button
                    key={version.id}
                    onClick={() => restoreVersion(version)}
                    style={{
                      ...versionButtonStyle,
                      border:
                        version.id === selectedVersionId
                          ? "1px solid rgba(134, 239, 172, 0.52)"
                          : version.status === "approved"
                            ? "1px solid rgba(147, 197, 253, 0.36)"
                            : version.status === "promoted"
                              ? "1px solid rgba(134, 239, 172, 0.42)"
                              : versionButtonStyle.border,
                    }}
                    type="button"
                  >
                    <strong style={{ display: "block", fontSize: "0.88rem" }}>{version.label} · {version.status}</strong>
                    <span style={{ color: "rgba(229, 231, 235, 0.72)", display: "block", fontSize: "0.76rem", marginTop: "5px" }}>
                      {version.reason}
                    </span>
                    <span style={{ color: "rgba(229, 231, 235, 0.52)", display: "block", fontSize: "0.7rem", marginTop: "5px" }}>
                      {version.createdAt}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px", marginTop: "14px" }}>
              <div style={contextShortcutStyle}>
                <strong>Use for Test Cases</strong>
                <p style={{ margin: "6px 0 0", color: "rgba(229, 231, 235, 0.68)" }}>Promote this brief to Source Vault, then select it as project context before generating test cases.</p>
              </div>
              <div style={contextShortcutStyle}>
                <strong>Use for Risk Review</strong>
                <p style={{ margin: "6px 0 0", color: "rgba(229, 231, 235, 0.68)" }}>Approved briefs make strong planning context for risk and bottleneck review.</p>
              </div>
            </div>
          </section>
        ) : null}

        {brief ? (
          <section aria-label="Feature brief refinement actions" style={refinementCardStyle}>
            <div style={refinementHeaderStyle}>
              <div>
                <p className="report-kicker">Refinement Loop</p>
                <h3 style={{ color: "#fff", fontSize: "1.04rem", margin: "4px 0 0" }}>
                  Improve this brief without starting over
                </h3>
                <p style={{ color: "rgba(229, 231, 235, 0.68)", margin: "7px 0 0" }}>
                  Refinements use your current edited brief, not just the original AI output.
                </p>
              </div>
            </div>

            <div style={refinementGridStyle}>
              {REFINEMENT_ACTIONS.map((action) => (
                <button
                  disabled={isBusy}
                  key={action.id}
                  onClick={() => refineFeatureBrief(action)}
                  style={{
                    ...refinementButtonBaseStyle,
                    border: refinementToneBorders[action.tone],
                    opacity: isBusy ? 0.58 : 1,
                  }}
                  type="button"
                >
                  <strong style={refinementLabelStyle}>
                    {refiningActionId === action.id ? "Working..." : action.label}
                  </strong>
                  <span style={refinementDescriptionStyle}>{action.description}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}


        {brief && jiraPreview ? (
          <section aria-label="Create Jira feature work" style={jiraPlanCardStyle}>
            <div style={refinementHeaderStyle}>
              <div>
                <p className="report-kicker">Jira Creation</p>
                <h3 style={{ color: "#fff", fontSize: "1.08rem", margin: "4px 0 0" }}>
                  Preview Jira work before creating it
                </h3>
                <p style={{ color: "rgba(229, 231, 235, 0.7)", margin: "7px 0 0" }}>
                  Create the main feature issue, optional child work items, and an optional linked QA planning task.
                </p>
              </div>
            </div>

            <div style={jiraPlanGridStyle}>
              <label style={jiraPlanControlStyle}>
                Parent issue type
                <select
                  onChange={(event) => updateJiraOptions({ parentIssueType: event.target.value })}
                  style={jiraPlanInputStyle}
                  value={jiraOptions.parentIssueType}
                >
                  <option value="Story">Story</option>
                  <option value="Task">Task</option>
                  <option value="Feature">Feature</option>
                </select>
              </label>

              <label style={jiraPlanControlStyle}>
                Child work mode
                <select
                  onChange={(event) =>
                    updateJiraOptions({ childTaskMode: event.target.value === "subtask" ? "subtask" : "task" })
                  }
                  style={jiraPlanInputStyle}
                  value={jiraOptions.childTaskMode}
                >
                  <option value="task">Create as regular tasks</option>
                  <option value="subtask">Create as Jira subtasks</option>
                </select>
              </label>

              <div style={{ ...jiraPlanControlStyle, justifyContent: "end" }}>
                <label style={jiraCheckboxRowStyle}>
                  <input
                    checked={jiraOptions.createChildTasks}
                    onChange={(event) => updateJiraOptions({ createChildTasks: event.target.checked })}
                    type="checkbox"
                  />
                  Include child tasks from scope/test ideas
                </label>
                <label style={jiraCheckboxRowStyle}>
                  <input
                    checked={jiraOptions.createQaTask}
                    onChange={(event) => updateJiraOptions({ createQaTask: event.target.checked })}
                    type="checkbox"
                  />
                  Include QA planning task
                </label>
              </div>
            </div>

            <div style={jiraPlanGridStyle}>
              <div style={jiraPlanPreviewBoxStyle}>
                <p className="report-kicker">Parent Issue Preview</p>
                <h4 style={{ color: "#fff", margin: "6px 0 8px" }}>{jiraPreview.parentSummary}</h4>
                <p style={{ color: "rgba(229, 231, 235, 0.72)", lineHeight: 1.45, margin: 0 }}>
                  Type: {jiraOptions.parentIssueType}. Description includes summary, user value, scope, acceptance criteria,
                  QA risks, and open questions.
                </p>
              </div>

              <div style={jiraPlanPreviewBoxStyle}>
                <p className="report-kicker">Child Work Preview</p>
                <p style={{ color: "rgba(229, 231, 235, 0.72)", margin: "6px 0" }}>
                  {jiraOptions.createChildTasks
                    ? `${jiraPreview.childTasks.length} child work item(s) from scope/test ideas.`
                    : "Child work creation disabled."}
                </p>
                {jiraOptions.createChildTasks && jiraPreview.childTasks.length ? (
                  <ul style={{ margin: "8px 0 0", paddingLeft: "18px", color: "rgba(255, 255, 255, 0.86)" }}>
                    {jiraPreview.childTasks.slice(0, 4).map((task) => (
                      <li key={task.summary}>{task.summary}</li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <div style={jiraPlanPreviewBoxStyle}>
                <p className="report-kicker">QA Task Preview</p>
                <p style={{ color: "rgba(229, 231, 235, 0.72)", margin: "6px 0" }}>
                  {jiraOptions.createQaTask && jiraPreview.qaTask
                    ? jiraPreview.qaTask.summary
                    : "QA planning task disabled or no QA content found."}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "14px" }}>
              <button
                disabled={!canCreateJiraPlan}
                onClick={createJiraFeaturePlan}
                style={{
                  ...jiraCreateButtonStyle,
                  opacity: canCreateJiraPlan ? 1 : 0.55,
                  cursor: canCreateJiraPlan ? "pointer" : "not-allowed",
                }}
                type="button"
              >
                {jiraCreateState === "creating" ? "Creating Jira Work..." : "Create Jira Feature Work"}
              </button>
              <button
                disabled={!jiraPreview.parentDescription}
                onClick={() => navigator.clipboard?.writeText(jiraPreview.parentDescription)}
                style={jiraSecondaryButtonStyle}
                type="button"
              >
                Copy Jira Preview
              </button>
            </div>

            {jiraCreateMessage ? (
              <p className={jiraCreateState === "error" ? "feature-builder-error" : "feature-builder-success"}>
                {jiraCreateMessage}
              </p>
            ) : null}

            {jiraCreatedParent ? (
              <div style={{ ...jiraPlanPreviewBoxStyle, marginTop: "14px" }}>
                <p className="report-kicker">Created Jira Work</p>
                <p style={{ color: "#bbf7d0", fontWeight: 950 }}>
                  Parent:{" "}
                  <a href={jiraCreatedParent.browseUrl} rel="noreferrer" target="_blank">
                    {jiraCreatedParent.key}
                  </a>
                </p>
                {jiraCreatedChildren.length ? (
                  <ul style={{ color: "rgba(255, 255, 255, 0.86)", margin: "8px 0", paddingLeft: "18px" }}>
                    {jiraCreatedChildren.map((issue) => (
                      <li key={issue.key}>
                        <a href={issue.browseUrl} rel="noreferrer" target="_blank">
                          {issue.key}
                        </a>{" "}
                        — {issue.summary}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {jiraCreatedQaIssue ? (
                  <p style={{ color: "#bfdbfe", fontWeight: 900 }}>
                    QA:{" "}
                    <a href={jiraCreatedQaIssue.browseUrl} rel="noreferrer" target="_blank">
                      {jiraCreatedQaIssue.key}
                    </a>{" "}
                    — {jiraCreatedQaIssue.summary}
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        {!brief ? (
          <div className="feature-builder-empty">
            Generate a brief to see summary, scope, acceptance criteria, QA risks, and source-vault save options here.
          </div>
        ) : isEditingBrief ? (
          <div className="feature-builder-brief-grid">
            {TEXT_FIELDS.map((field) => (
              <section key={field.key}>
                <h3>{field.label}</h3>
                <textarea
                  aria-label={field.label}
                  onChange={(event) => updateTextField(field.key, event.target.value)}
                  style={editTextareaStyle}
                  value={brief[field.key] ?? ""}
                />
              </section>
            ))}

            {LIST_FIELDS.map((field) => (
              <section key={field.key}>
                <h3>{field.label}</h3>
                <textarea
                  aria-label={field.label}
                  onChange={(event) => updateListField(field.key, event.target.value)}
                  placeholder="One item per line..."
                  style={editTextareaStyle}
                  value={listToText(brief[field.key])}
                />
              </section>
            ))}
          </div>
        ) : (
          <div className="feature-builder-brief-grid">
            {TEXT_FIELDS.map((field) => {
              const updated = isFieldChanged(changedFields, field.key);

              return (
                <section key={field.key}>
                  <h3>{field.label}</h3>
                  <p
                    style={
                      updated
                        ? {
                            color: "#86efac",
                            fontWeight: 900,
                            textShadow: "0 0 14px rgba(34, 197, 94, 0.18)",
                          }
                        : undefined
                    }
                  >
                    {updated ? "+ " : ""}
                    {brief[field.key] || "Not specified."}
                  </p>
                </section>
              );
            })}

            {LIST_FIELDS.map((field) => (
              <section key={field.key}>
                <h3>{field.label}</h3>
                {renderList(brief[field.key], field.key, changedFields)}
              </section>
            ))}
          </div>
        )}

        {saveMessage ? (
          <p className={saveState === "error" ? "feature-builder-error" : "feature-builder-success"}>
            {saveMessage}
          </p>
        ) : null}
      </div>
    </section>
  );
}
