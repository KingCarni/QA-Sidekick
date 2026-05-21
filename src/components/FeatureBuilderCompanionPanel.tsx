"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { publishCreditBalanceUpdated } from "@/lib/credit-balance-events";

type PromptCategory = "brainstorm" | "scope" | "qa" | "acceptance" | "jira";

type ContextConfidence = "full" | "partial" | "minimal";

type FeatureBuilderCompanionPanelProps = {
  draft: string;
  extraContext?: string;
  projectName?: string;
  productType?: string;
  onAppendPrompt: (prompt: string) => void;
};

type CompanionPrompt = {
  title: string;
  prompt: string;
  category: PromptCategory;
  tone: "blue" | "green" | "yellow" | "red";
};

type MissingCallout = {
  label: string;
  detail: string;
  isReady: boolean;
};

type GuidanceItem = {
  icon: string;
  title: string;
  detail: string;
  tone: "good" | "watch" | "risk" | "info";
};

type AiPromptResponse = {
  ok?: boolean;
  error?: string;
  prompts?: CompanionPrompt[];
  nextQuestion?: string;
  credits?: {
    balanceAfter?: number;
  };
};

const CATEGORY_LABELS: Record<PromptCategory, string> = {
  brainstorm: "Brainstorm",
  scope: "Scope",
  qa: "QA",
  acceptance: "Acceptance",
  jira: "Jira",
};

const CATEGORY_DESCRIPTIONS: Record<PromptCategory, string> = {
  brainstorm: "Find the user, pain, and value before scope hardens.",
  scope: "Separate the MVP from later ideas so the feature stays buildable.",
  qa: "Expose edge cases, bad states, permissions, and regression risk.",
  acceptance: "Turn the idea into testable done conditions.",
  jira: "Shape the feature into previewable Jira parent and child work.",
};

const companionShellStyle: CSSProperties = {
  border: "1px solid rgba(59, 130, 246, 0.28)",
  borderRadius: "24px",
  background:
    "radial-gradient(circle at top left, rgba(59, 130, 246, 0.16), transparent 34%), radial-gradient(circle at 82% 8%, rgba(248, 113, 113, 0.12), transparent 32%), linear-gradient(145deg, rgba(8, 13, 27, 0.96), rgba(4, 5, 10, 0.98))",
  boxShadow: "0 24px 70px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255,255,255,0.06)",
  overflow: "hidden",
};

const companionPadStyle: CSSProperties = {
  padding: "18px",
};

const headerGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "72px minmax(0, 1fr) auto",
  gap: "14px",
  alignItems: "center",
};

const mascotBadgeStyle: CSSProperties = {
  alignItems: "center",
  background: "linear-gradient(135deg, rgba(234, 179, 8, 0.2), rgba(239, 68, 68, 0.14))",
  border: "1px solid rgba(250, 204, 21, 0.32)",
  borderRadius: "22px",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
  display: "flex",
  height: "72px",
  justifyContent: "center",
  position: "relative",
};

const hardHatStyle: CSSProperties = {
  background: "#facc15",
  border: "2px solid rgba(0, 0, 0, 0.34)",
  borderRadius: "999px 999px 10px 10px",
  color: "#111827",
  fontSize: "1.85rem",
  height: "48px",
  lineHeight: "44px",
  textAlign: "center",
  width: "54px",
};

const confidencePillBaseStyle: CSSProperties = {
  borderRadius: "999px",
  display: "inline-flex",
  flexDirection: "column",
  gap: "1px",
  minWidth: "112px",
  padding: "9px 12px",
  textAlign: "right",
};

const categoryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(128px, 1fr))",
  gap: "9px",
  marginTop: "16px",
};

const categoryButtonBaseStyle: CSSProperties = {
  border: "1px solid rgba(148, 163, 184, 0.2)",
  borderRadius: "16px",
  color: "#fff",
  cursor: "pointer",
  minHeight: "82px",
  padding: "11px",
  textAlign: "left",
};

const activeCategoryButtonStyle: CSSProperties = {
  background:
    "radial-gradient(circle at top left, rgba(255,255,255,0.14), transparent 32%), linear-gradient(135deg, rgba(220, 38, 38, 0.92), rgba(127, 29, 29, 0.94))",
  border: "1px solid rgba(248, 113, 113, 0.48)",
  boxShadow: "0 14px 30px rgba(220, 38, 38, 0.18)",
};

const inactiveCategoryButtonStyle: CSSProperties = {
  background:
    "radial-gradient(circle at top left, rgba(255,255,255,0.08), transparent 34%), linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(3, 7, 18, 0.9))",
};

const insightPanelStyle: CSSProperties = {
  borderTop: "1px solid rgba(255,255,255,0.08)",
  display: "grid",
  gap: "12px",
  gridTemplateColumns: "minmax(0, 1fr) minmax(220px, 0.7fr)",
  marginTop: "16px",
  paddingTop: "16px",
};

const guidanceCardStyle: CSSProperties = {
  border: "1px solid rgba(148, 163, 184, 0.18)",
  borderRadius: "16px",
  background: "rgba(0, 0, 0, 0.24)",
  padding: "12px",
};

const guidanceItemStyle: CSSProperties = {
  alignItems: "flex-start",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "14px",
  display: "grid",
  gap: "10px",
  gridTemplateColumns: "28px minmax(0, 1fr)",
  padding: "10px",
};

const promptSectionStyle: CSSProperties = {
  borderTop: "1px solid rgba(255,255,255,0.08)",
  marginTop: "16px",
  paddingTop: "16px",
};

const promptGridStyle: CSSProperties = {
  display: "grid",
  gap: "10px",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
};

const promptButtonStyle: CSSProperties = {
  borderRadius: "16px",
  color: "#fff",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  gap: "7px",
  minHeight: "108px",
  padding: "12px",
  textAlign: "left",
};

const askAiButtonStyle: CSSProperties = {
  alignItems: "center",
  background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
  border: "1px solid rgba(147, 197, 253, 0.38)",
  borderRadius: "14px",
  color: "#fff",
  display: "inline-flex",
  gap: "10px",
  fontSize: "0.8rem",
  fontWeight: 950,
  padding: "10px 12px",
};

function splitWords(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function includesAny(value: string, terms: RegExp[]) {
  return terms.some((term) => term.test(value));
}

function getSignals(draft: string, extraContext = "") {
  const combined = `${draft}\n${extraContext}`;
  const words = splitWords(combined);

  const hasUser = includesAny(combined, [
    /\b(user|player|admin|qa|tester|developer|dev|customer|manager|teacher|student|product owner|pm)\b/i,
  ]);
  const hasOutcome = includesAny(combined, [
    /\b(so that|because|goal|value|benefit|should|need|want|improve|reduce|increase|prevent|avoid|faster|easier|clearer)\b/i,
  ]);
  const hasScope = includesAny(combined, [
    /\b(in scope|out of scope|phase|mvp|first version|first pass|later|future|not included|exclude|defer)\b/i,
  ]);
  const hasRisk = includesAny(combined, [
    /\b(risk|edge|fail|failure|error|bug|security|permission|privacy|performance|stale|sync|regression|bad input)\b/i,
  ]);
  const hasAcceptance = includesAny(combined, [
    /\b(acceptance|given|when|then|criteria|success|done|validate|verify|must|should be able)\b/i,
  ]);
  const hasJira = includesAny(combined, [
    /\b(jira|ticket|issue|story|task|epic|subtask|sub-task|project key|issue type)\b/i,
  ]);

  return {
    wordCount: words.length,
    hasUser,
    hasOutcome,
    hasScope,
    hasRisk,
    hasAcceptance,
    hasJira,
  };
}

function getMissingCallouts(draft: string, extraContext = ""): MissingCallout[] {
  const signals = getSignals(draft, extraContext);

  return [
    {
      label: "Target user",
      detail: "Name who this is for and what they are trying to do.",
      isReady: signals.hasUser,
    },
    {
      label: "User value",
      detail: "Explain the pain solved or the outcome improved.",
      isReady: signals.hasOutcome,
    },
    {
      label: "MVP scope",
      detail: "Separate first-pass scope from later-phase ideas.",
      isReady: signals.hasScope,
    },
    {
      label: "Acceptance criteria",
      detail: "Add testable success conditions before build starts.",
      isReady: signals.hasAcceptance,
    },
    {
      label: "QA risk",
      detail: "Call out edge cases, stale state, permissions, or failure modes.",
      isReady: signals.hasRisk,
    },
  ];
}

function getReadinessScore(draft: string, extraContext = "") {
  const callouts = getMissingCallouts(draft, extraContext);
  const ready = callouts.filter((item) => item.isReady).length;

  return Math.round((ready / callouts.length) * 100);
}

function getContextConfidence(args: {
  draft: string;
  extraContext: string;
  projectName: string;
  productType: string;
}): ContextConfidence {
  const signals = getSignals(args.draft, args.extraContext);
  const hasProject = Boolean(args.projectName.trim());
  const hasProductType = Boolean(args.productType.trim());
  const hasLocalContext = args.extraContext.trim().length >= 40;
  const hasUsefulDraft = signals.wordCount >= 35;

  const score = [hasProject, hasProductType, hasLocalContext, hasUsefulDraft].filter(Boolean).length;

  if (score >= 3) return "full";
  if (score >= 1) return "partial";
  return "minimal";
}

function getConfidenceCopy(confidence: ContextConfidence) {
  if (confidence === "full") {
    return {
      label: "Full context",
      detail: "Project + draft signals are strong.",
      color: "#86efac",
      border: "1px solid rgba(134, 239, 172, 0.36)",
      background: "rgba(22, 101, 52, 0.22)",
    };
  }

  if (confidence === "partial") {
    return {
      label: "Partial context",
      detail: "Useful, but QAt may need more detail.",
      color: "#fde68a",
      border: "1px solid rgba(250, 204, 21, 0.34)",
      background: "rgba(113, 63, 18, 0.24)",
    };
  }

  return {
    label: "Minimal context",
    detail: "QAt can start, but expect broad guidance.",
    color: "#fecaca",
    border: "1px solid rgba(248, 113, 113, 0.34)",
    background: "rgba(127, 29, 29, 0.22)",
  };
}

function getSuggestedNextQuestion(draft: string, extraContext = "") {
  const missing = getMissingCallouts(draft, extraContext).find((item) => !item.isReady);

  if (!draft.trim()) {
    return "What feature are you trying to create, and who needs it?";
  }

  if (missing?.label === "Target user") {
    return "Who is the primary user for this feature?";
  }

  if (missing?.label === "User value") {
    return "What gets easier, faster, safer, or clearer once this feature exists?";
  }

  if (missing?.label === "MVP scope") {
    return "What is included in the first version, and what should be deferred?";
  }

  if (missing?.label === "Acceptance criteria") {
    return "What would prove this feature works from a user point of view?";
  }

  if (missing?.label === "QA risk") {
    return "What could go wrong with bad input, permissions, stale state, or failed integrations?";
  }

  return "What is the next decision needed before this can become a Jira-ready feature?";
}

function buildGuidanceFeed(args: {
  draft: string;
  extraContext: string;
  projectName: string;
  productType: string;
  readinessScore: number;
  confidence: ContextConfidence;
}): GuidanceItem[] {
  const missing = getMissingCallouts(args.draft, args.extraContext).filter((item) => !item.isReady);
  const signals = getSignals(args.draft, args.extraContext);
  const items: GuidanceItem[] = [];

  if (!args.draft.trim()) {
    items.push({
      icon: "🧱",
      title: "Start rough",
      detail: "Give me the messy idea. I’ll help turn it into scope, criteria, risks, and Jira work.",
      tone: "info",
    });
  }

  if (args.confidence === "minimal") {
    items.push({
      icon: "🟡",
      title: "Minimal context mode",
      detail: "I can still help, but project name, product type, or constraints will make the guidance sharper.",
      tone: "watch",
    });
  }

  if (missing[0]) {
    items.push({
      icon: "🔎",
      title: `${missing[0].label} is the next gap`,
      detail: missing[0].detail,
      tone: "watch",
    });
  }

  if (!signals.hasRisk && args.draft.trim()) {
    items.push({
      icon: "⚠️",
      title: "No risk lens yet",
      detail: "Add failure modes, permissions, stale state, bad input, or regression areas before Jira creation.",
      tone: "risk",
    });
  }

  if (signals.hasAcceptance && signals.hasScope && signals.hasRisk) {
    items.push({
      icon: "✅",
      title: "This is getting buildable",
      detail: "Scope, acceptance, and risk signals are present. Next step: make Jira work previewable.",
      tone: "good",
    });
  }

  if (args.projectName) {
    items.push({
      icon: "🧠",
      title: `Using ${args.projectName}`,
      detail: "Project context is available for this builder session. Avoid polling; refresh context intentionally when needed.",
      tone: "info",
    });
  }

  if (items.length === 0) {
    items.push({
      icon: "✅",
      title: "Ready for the next pass",
      detail: "The idea has enough structure for QAt to help refine toward a feature brief.",
      tone: "good",
    });
  }

  return items.slice(0, 4);
}

function buildLocalPrompts(category: PromptCategory, draft: string, extraContext = ""): CompanionPrompt[] {
  const signals = getSignals(draft, extraContext);

  const prompts: Record<PromptCategory, CompanionPrompt[]> = {
    brainstorm: [
      {
        title: "Start with the user",
        category: "brainstorm",
        tone: "blue",
        prompt: "Who needs this feature, and what job are they trying to complete?",
      },
      {
        title: "Name the pain",
        category: "brainstorm",
        tone: "blue",
        prompt: "What is frustrating, slow, risky, or unclear today?",
      },
      {
        title: "Describe the win",
        category: "brainstorm",
        tone: "green",
        prompt: "What should the user be able to do after this feature ships?",
      },
    ],
    scope: [
      {
        title: "Define MVP",
        category: "scope",
        tone: "green",
        prompt: "What is the smallest useful first version of this feature?",
      },
      {
        title: "Draw the boundary",
        category: "scope",
        tone: "yellow",
        prompt: "What is explicitly out of scope for this pass?",
      },
      {
        title: "Future lane",
        category: "scope",
        tone: "blue",
        prompt: "What would be useful later, but should not block the first release?",
      },
    ],
    qa: [
      {
        title: "Bad input",
        category: "qa",
        tone: "red",
        prompt: "What should happen when the user submits incomplete, vague, or invalid input?",
      },
      {
        title: "State risk",
        category: "qa",
        tone: "red",
        prompt: "What stale state, refresh, permission, or saved-config issues could affect this feature?",
      },
      {
        title: "Regression check",
        category: "qa",
        tone: "yellow",
        prompt: "What existing workflows could break when this feature is added?",
      },
    ],
    acceptance: [
      {
        title: "Given / When / Then",
        category: "acceptance",
        tone: "green",
        prompt: "Write 3 acceptance criteria in Given/When/Then format.",
      },
      {
        title: "Success state",
        category: "acceptance",
        tone: "green",
        prompt: "What should the user see when the action succeeds?",
      },
      {
        title: "Failure state",
        category: "acceptance",
        tone: "red",
        prompt: "What useful error should the user see when the action fails?",
      },
    ],
    jira: [
      {
        title: "Ticket shape",
        category: "jira",
        tone: "blue",
        prompt: "What should the Jira title, description, issue type, and acceptance criteria include?",
      },
      {
        title: "Child work",
        category: "jira",
        tone: "blue",
        prompt: "What implementation tasks or QA tasks should be created under this feature?",
      },
      {
        title: "Create guardrail",
        category: "jira",
        tone: "yellow",
        prompt: "What must the user preview or approve before anything is created in Jira?",
      },
    ],
  };

  const categoryPrompts = [...prompts[category]];

  if (!signals.hasUser && category !== "brainstorm") {
    categoryPrompts.unshift({
      title: "Missing user",
      category,
      tone: "yellow",
      prompt: "Add the primary user before expanding this section.",
    });
  }

  if (!signals.hasScope && category !== "scope") {
    categoryPrompts.push({
      title: "Scope check",
      category,
      tone: "yellow",
      prompt: "What belongs in the first release, and what should wait?",
    });
  }

  return categoryPrompts.slice(0, 5);
}

function getPromptStyle(tone: CompanionPrompt["tone"], isAi = false): CSSProperties {
  const toneStyles: Record<CompanionPrompt["tone"], CSSProperties> = {
    blue: {
      background: "linear-gradient(135deg, rgba(30, 64, 175, 0.44), rgba(15, 23, 42, 0.86))",
      border: "1px solid rgba(96, 165, 250, 0.34)",
    },
    green: {
      background: "linear-gradient(135deg, rgba(22, 101, 52, 0.42), rgba(15, 23, 42, 0.86))",
      border: "1px solid rgba(134, 239, 172, 0.32)",
    },
    yellow: {
      background: "linear-gradient(135deg, rgba(113, 63, 18, 0.44), rgba(15, 23, 42, 0.86))",
      border: "1px solid rgba(250, 204, 21, 0.32)",
    },
    red: {
      background: "linear-gradient(135deg, rgba(127, 29, 29, 0.46), rgba(15, 23, 42, 0.86))",
      border: "1px solid rgba(248, 113, 113, 0.34)",
    },
  };

  return {
    ...promptButtonStyle,
    ...toneStyles[tone],
    boxShadow: isAi ? "0 14px 30px rgba(37, 99, 235, 0.16)" : "none",
  };
}

function getGuidanceStyle(tone: GuidanceItem["tone"]): CSSProperties {
  const colors: Record<GuidanceItem["tone"], CSSProperties> = {
    good: { borderColor: "rgba(134, 239, 172, 0.3)", background: "rgba(22, 101, 52, 0.14)" },
    watch: { borderColor: "rgba(250, 204, 21, 0.28)", background: "rgba(113, 63, 18, 0.13)" },
    risk: { borderColor: "rgba(248, 113, 113, 0.3)", background: "rgba(127, 29, 29, 0.14)" },
    info: { borderColor: "rgba(96, 165, 250, 0.28)", background: "rgba(30, 64, 175, 0.13)" },
  };

  return { ...guidanceItemStyle, ...colors[tone] };
}

export default function FeatureBuilderCompanionPanel({
  draft,
  extraContext = "",
  projectName = "",
  productType = "",
  onAppendPrompt,
}: FeatureBuilderCompanionPanelProps) {
  const [activeCategory, setActiveCategory] = useState<PromptCategory>("brainstorm");
  const [aiPrompts, setAiPrompts] = useState<CompanionPrompt[]>([]);
  const [aiNextQuestion, setAiNextQuestion] = useState("");
  const [isLoadingAiPrompts, setIsLoadingAiPrompts] = useState(false);
  const [aiError, setAiError] = useState("");

  const readinessScore = useMemo(() => getReadinessScore(draft, extraContext), [draft, extraContext]);
  const missingCallouts = useMemo(() => getMissingCallouts(draft, extraContext), [draft, extraContext]);
  const confidence = useMemo(
    () => getContextConfidence({ draft, extraContext, projectName, productType }),
    [draft, extraContext, projectName, productType]
  );
  const confidenceCopy = useMemo(() => getConfidenceCopy(confidence), [confidence]);
  const guidanceFeed = useMemo(
    () => buildGuidanceFeed({ draft, extraContext, projectName, productType, readinessScore, confidence }),
    [draft, extraContext, projectName, productType, readinessScore, confidence]
  );
  const nextQuestion = useMemo(
    () => aiNextQuestion || getSuggestedNextQuestion(draft, extraContext),
    [aiNextQuestion, draft, extraContext]
  );
  const localPrompts = useMemo(
    () => buildLocalPrompts(activeCategory, draft, extraContext),
    [activeCategory, draft, extraContext]
  );

  const canAskAi = draft.trim().length >= 80 && !isLoadingAiPrompts;

  async function requestAiPrompts() {
    if (!canAskAi) return;

    setIsLoadingAiPrompts(true);
    setAiError("");

    try {
      const response = await fetch("/api/feature-builder/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft,
          extraContext,
          projectName,
          productType,
          category: activeCategory,
          readinessScore,
          contextConfidence: confidence,
          missingCallouts: missingCallouts.filter((item) => !item.isReady),
        }),
      });

      const payload = (await response.json().catch(() => null)) as AiPromptResponse | null;

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || "Could not generate AI prompt suggestions.");
      }

      setAiPrompts(payload?.prompts ?? []);
      setAiNextQuestion(payload?.nextQuestion ?? "");
      if (typeof payload?.credits?.balanceAfter === "number") {
        publishCreditBalanceUpdated(payload.credits.balanceAfter);
      }
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Could not generate AI prompt suggestions.");
    } finally {
      setIsLoadingAiPrompts(false);
    }
  }

  return (
    <aside className="feature-builder-companion-card feature-companion-smart-card" style={companionShellStyle}>
      <div style={companionPadStyle}>
        <div className="feature-companion-header" style={headerGridStyle}>
          <div aria-hidden="true" style={mascotBadgeStyle}>
            <div style={hardHatStyle}>Q</div>
          </div>

          <div>
            <p className="report-kicker">Live QAt Builder</p>
            <h3 style={{ color: "#fff", fontSize: "1.15rem", lineHeight: 1.2, margin: "0 0 6px" }}>
              Build the feature with QAt
            </h3>
            <p style={{ color: "rgba(229, 231, 235, 0.72)", lineHeight: 1.5, margin: 0 }}>
              I’ll nudge scope, QA risk, acceptance criteria, and Jira readiness without polling your project brain.
            </p>
          </div>

          <div style={{ ...confidencePillBaseStyle, background: confidenceCopy.background, border: confidenceCopy.border }}>
            <strong style={{ color: confidenceCopy.color, fontSize: "0.78rem" }}>{confidenceCopy.label}</strong>
            <span style={{ color: "rgba(229, 231, 235, 0.64)", fontSize: "0.68rem", lineHeight: 1.25 }}>
              {confidenceCopy.detail}
            </span>
          </div>
        </div>

        <div className="feature-companion-meter" aria-label={`Readiness score ${readinessScore}%`} style={{ marginTop: "16px" }}>
          <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", gap: "12px", marginBottom: "7px" }}>
            <span style={{ color: "rgba(229, 231, 235, 0.74)", fontSize: "0.76rem", fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Feature readiness
            </span>
            <strong style={{ color: readinessScore >= 80 ? "#86efac" : readinessScore >= 50 ? "#fde68a" : "#fecaca" }}>
              {readinessScore}%
            </strong>
          </div>
          <div style={{ background: "rgba(15, 23, 42, 0.9)", border: "1px solid rgba(148, 163, 184, 0.18)", borderRadius: "999px", height: "10px", overflow: "hidden" }}>
            <span
              style={{
                background: readinessScore >= 80 ? "linear-gradient(90deg, #22c55e, #86efac)" : readinessScore >= 50 ? "linear-gradient(90deg, #f59e0b, #fde68a)" : "linear-gradient(90deg, #ef4444, #fca5a5)",
                borderRadius: "999px",
                display: "block",
                height: "100%",
                width: `${readinessScore}%`,
              }}
            />
          </div>
        </div>

        <div className="feature-companion-tabs" role="tablist" aria-label="Prompt categories" style={categoryGridStyle}>
          {(Object.keys(CATEGORY_LABELS) as PromptCategory[]).map((category) => {
            const isActive = activeCategory === category;

            return (
              <button
                aria-selected={isActive}
                className={isActive ? "active" : ""}
                key={category}
                onClick={() => {
                  setActiveCategory(category);
                  setAiPrompts([]);
                  setAiNextQuestion("");
                  setAiError("");
                }}
                role="tab"
                style={{
                  ...categoryButtonBaseStyle,
                  ...(isActive ? activeCategoryButtonStyle : inactiveCategoryButtonStyle),
                }}
                type="button"
              >
                <strong style={{ display: "block", fontSize: "0.88rem", marginBottom: "6px" }}>
                  {CATEGORY_LABELS[category]}
                </strong>
                <span style={{ color: "rgba(229, 231, 235, 0.68)", display: "block", fontSize: "0.72rem", lineHeight: 1.35 }}>
                  {CATEGORY_DESCRIPTIONS[category]}
                </span>
              </button>
            );
          })}
        </div>

        <div style={insightPanelStyle}>
          <section aria-label="QAt builder guidance" style={guidanceCardStyle}>
            <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", gap: "10px", marginBottom: "10px" }}>
              <h4 style={{ color: "#fff", fontSize: "0.92rem", margin: 0 }}>QAt builder notes</h4>
              <span style={{ color: "rgba(229, 231, 235, 0.52)", fontSize: "0.72rem", fontWeight: 850 }}>Live, local</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {guidanceFeed.map((item) => (
                <div key={`${item.title}-${item.detail}`} style={getGuidanceStyle(item.tone)}>
                  <span style={{ fontSize: "1.1rem", lineHeight: 1 }}>{item.icon}</span>
                  <div>
                    <strong style={{ color: "#fff", display: "block", fontSize: "0.82rem", lineHeight: 1.35 }}>{item.title}</strong>
                    <span style={{ color: "rgba(229, 231, 235, 0.68)", display: "block", fontSize: "0.74rem", lineHeight: 1.4, marginTop: "3px" }}>
                      {item.detail}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="feature-companion-missing-panel" aria-label="Feature readiness callouts" style={guidanceCardStyle}>
            <h4 style={{ color: "#fff", fontSize: "0.92rem", margin: "0 0 10px" }}>Readiness checklist</h4>
            <div className="feature-companion-callouts" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {missingCallouts.map((callout) => (
                <div
                  className={callout.isReady ? "ready" : ""}
                  key={callout.label}
                  style={{
                    border: callout.isReady ? "1px solid rgba(134, 239, 172, 0.24)" : "1px solid rgba(248, 113, 113, 0.18)",
                    borderRadius: "13px",
                    background: callout.isReady ? "rgba(22, 101, 52, 0.14)" : "rgba(0, 0, 0, 0.22)",
                    padding: "9px 10px",
                  }}
                >
                  <strong style={{ color: callout.isReady ? "#86efac" : "#fecaca", display: "block", fontSize: "0.78rem" }}>
                    {callout.isReady ? "✓ " : "• "}{callout.label}
                  </strong>
                  <span style={{ color: "rgba(229, 231, 235, 0.62)", display: "block", fontSize: "0.7rem", lineHeight: 1.35, marginTop: "3px" }}>
                    {callout.detail}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="feature-companion-next-question" style={{ ...guidanceCardStyle, marginTop: "12px" }}>
          <h4 style={{ color: "#fff", fontSize: "0.92rem", margin: "0 0 8px" }}>Suggested next move</h4>
          <button
            onClick={() => onAppendPrompt(nextQuestion)}
            style={{
              border: "1px solid rgba(250, 204, 21, 0.32)",
              borderRadius: "14px",
              background: "linear-gradient(135deg, rgba(113, 63, 18, 0.46), rgba(15, 23, 42, 0.86))",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 850,
              lineHeight: 1.4,
              padding: "11px 12px",
              textAlign: "left",
              width: "100%",
            }}
            type="button"
          >
            {nextQuestion}
          </button>
        </section>

        <section className="feature-companion-prompt-section" style={promptSectionStyle}>
          <div className="feature-companion-section-header" style={{ alignItems: "center", display: "flex", gap: "12px", justifyContent: "space-between", marginBottom: "12px" }}>
            <div>
              <h4 style={{ color: "#fff", fontSize: "0.94rem", margin: 0 }}>{CATEGORY_LABELS[activeCategory]} prompts</h4>
              <p style={{ color: "rgba(229, 231, 235, 0.6)", fontSize: "0.75rem", lineHeight: 1.4, margin: "4px 0 0" }}>
                Click a card to add it to the draft. Local prompts are free; AI prompts cost credits only when requested.
              </p>
            </div>

            <button disabled={!canAskAi} onClick={requestAiPrompts} style={askAiButtonStyle} type="button">
              <span>{isLoadingAiPrompts ? "Asking AI..." : "Ask AI"}</span>
              <strong>1 credit</strong>
            </button>
          </div>

          {!canAskAi && draft.trim().length < 80 ? (
            <p className="feature-companion-hint" style={{ color: "rgba(229, 231, 235, 0.62)", fontSize: "0.78rem", margin: "0 0 10px" }}>
              Type a little more context before asking AI for custom prompts.
            </p>
          ) : null}

          {aiError ? <p className="feature-builder-error">{aiError}</p> : null}

          <div className="feature-builder-prompt-list feature-companion-prompt-list" style={promptGridStyle}>
            {[...aiPrompts, ...localPrompts].slice(0, 8).map((item, index) => (
              <button
                className="feature-builder-prompt"
                key={`${item.title}-${item.prompt}-${index}`}
                onClick={() => onAppendPrompt(item.prompt)}
                style={getPromptStyle(item.tone, index < aiPrompts.length)}
                type="button"
              >
                <strong style={{ color: "#fff", fontSize: "0.88rem", lineHeight: 1.25 }}>{item.title}</strong>
                <span style={{ color: "rgba(229, 231, 235, 0.72)", fontSize: "0.78rem", lineHeight: 1.42 }}>{item.prompt}</span>
                {index < aiPrompts.length ? (
                  <em style={{ color: "#bfdbfe", fontSize: "0.68rem", fontStyle: "normal", fontWeight: 950, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    AI suggested
                  </em>
                ) : null}
              </button>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}
