"use client";

import { useMemo, useState } from "react";
import { publishCreditBalanceUpdated } from "@/lib/credit-balance-events";

type PromptCategory = "brainstorm" | "scope" | "qa" | "acceptance" | "jira";

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

function getPromptClass(tone: CompanionPrompt["tone"]) {
  if (tone === "green") return "feature-companion-prompt-green";
  if (tone === "yellow") return "feature-companion-prompt-yellow";
  if (tone === "red") return "feature-companion-prompt-red";
  return "feature-companion-prompt-blue";
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
    <aside className="feature-builder-companion-card feature-companion-smart-card">
      <div className="feature-companion-header">
        <div>
          <p className="report-kicker">Live Prompt Companion</p>
          <h3>Plan the feature before you build it</h3>
          <p>
            Use local prompts for speed. Ask AI only when you want deeper suggestions from the current draft.
          </p>
        </div>

        <div className="feature-companion-score" aria-label={`Readiness score ${readinessScore}%`}>
          <strong>{readinessScore}</strong>
          <span>ready</span>
        </div>
      </div>

      <div className="feature-companion-meter" aria-hidden="true">
        <span style={{ width: `${readinessScore}%` }} />
      </div>

      <div className="feature-companion-tabs" role="tablist" aria-label="Prompt categories">
        {(Object.keys(CATEGORY_LABELS) as PromptCategory[]).map((category) => (
          <button
            aria-selected={activeCategory === category}
            className={activeCategory === category ? "active" : ""}
            key={category}
            onClick={() => {
              setActiveCategory(category);
              setAiPrompts([]);
              setAiNextQuestion("");
              setAiError("");
            }}
            role="tab"
            type="button"
          >
            {CATEGORY_LABELS[category]}
          </button>
        ))}
      </div>

      <section className="feature-companion-prompt-section">
        <div className="feature-companion-section-header">
          <h4>{CATEGORY_LABELS[activeCategory]} prompts</h4>
          <button className="feature-ai-prompt-button" disabled={!canAskAi} onClick={requestAiPrompts} type="button">
            <span>{isLoadingAiPrompts ? "Asking AI..." : "Ask AI for prompts"}</span>
            <strong>1 credit</strong>
          </button>
        </div>

        {!canAskAi && draft.trim().length < 80 ? (
          <p className="feature-companion-hint">
            Type a little more context before asking AI for custom prompts.
          </p>
        ) : null}

        {aiError ? <p className="feature-builder-error">{aiError}</p> : null}

        <div className="feature-builder-prompt-list feature-companion-prompt-list">
          {[...aiPrompts, ...localPrompts].slice(0, 8).map((item, index) => (
            <button
              className={`feature-builder-prompt ${getPromptClass(item.tone)}`}
              key={`${item.title}-${item.prompt}-${index}`}
              onClick={() => onAppendPrompt(item.prompt)}
              type="button"
            >
              <strong>{item.title}</strong>
              <span>{item.prompt}</span>
              {index < aiPrompts.length ? <em>AI suggested</em> : null}
            </button>
          ))}
        </div>
      </section>
      <section className="feature-companion-missing-panel" aria-label="Feature readiness callouts">
        <h4>This idea is missing...</h4>
        <div className="feature-companion-callouts">
          {missingCallouts.map((callout) => (
            <div className={callout.isReady ? "ready" : ""} key={callout.label}>
              <strong>{callout.isReady ? "✓ " : ""}{callout.label}</strong>
              <span>{callout.detail}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="feature-companion-next-question">
        <h4>Suggested next question</h4>
        <button onClick={() => onAppendPrompt(nextQuestion)} type="button">
          {nextQuestion}
        </button>
      </section>

    </aside>
  );
}
