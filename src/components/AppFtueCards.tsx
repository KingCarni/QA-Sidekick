"use client";

import { useEffect, useState } from "react";
import QAtGuideCard from "@/components/QAtGuideCard";
import { FTUE_KEYS, completeFtueStep, isFtueStepComplete, type FtueStepKey } from "@/lib/ftue-state";

type ToolId = "tests" | "bug" | "risk" | "improve" | "feature";

const toolFtueCopy: Record<ToolId, { title: string; body: string }> = {
  tests: {
    title: "QAt can build test coverage from rough source work.",
    body: "Paste a Jira ticket, user story, or acceptance criteria. QAtalyst will generate reviewable test cases and call out follow-up questions when the source is thin.",
  },
  bug: {
    title: "QAt can turn messy bug notes into a clean defect.",
    body: "Add repro notes, environment details, screenshots, logs, or tester notes. QAtalyst will structure the report so it is easier for developers to triage.",
  },
  risk: {
    title: "QAt can spot release risks before QA starts.",
    body: "Paste a ticket or requirements note. QAtalyst will look for unclear acceptance criteria, bottlenecks, fragile areas, and follow-up questions.",
  },
  improve: {
    title: "QAt can strengthen weak test cases.",
    body: "Paste an existing test case or checklist. QAtalyst will improve structure, coverage, clarity, and missing validation points.",
  },
  feature: {
    title: "QAt can shape rough feature ideas into QA-ready briefs.",
    body: "Start messy. Feature Builder helps turn early ideas into structured scope, risks, follow-up questions, and QA-ready direction.",
  },
};

function getToolFtueKey(activeTool: ToolId): FtueStepKey {
  if (activeTool === "tests") return FTUE_KEYS.testsIntro;
  if (activeTool === "bug") return FTUE_KEYS.bugIntro;
  if (activeTool === "risk") return FTUE_KEYS.riskIntro;
  if (activeTool === "improve") return FTUE_KEYS.improveIntro;
  return FTUE_KEYS.featureIntro;
}

function goTo(path: string) {
  window.location.href = path;
}

export default function AppFtueCards({ activeTool, toolLabel }: { activeTool: ToolId; toolLabel: string }) {
  const ftueToolKey = getToolFtueKey(activeTool);
  const [showWelcomeFtue, setShowWelcomeFtue] = useState(false);
  const [showBrainFtue, setShowBrainFtue] = useState(false);
  const [showIntegrationsFtue, setShowIntegrationsFtue] = useState(false);
  const [showToolFtue, setShowToolFtue] = useState(false);

  useEffect(() => {
    setShowWelcomeFtue(!isFtueStepComplete(FTUE_KEYS.welcome));
    setShowBrainFtue(!isFtueStepComplete(FTUE_KEYS.brainIntro));
    setShowIntegrationsFtue(!isFtueStepComplete(FTUE_KEYS.integrationsIntro));
  }, []);

  useEffect(() => {
    setShowToolFtue(!isFtueStepComplete(ftueToolKey));
  }, [ftueToolKey]);

  function dismissFtueStep(key: FtueStepKey) {
    completeFtueStep(key);

    if (key === FTUE_KEYS.welcome) setShowWelcomeFtue(false);
    if (key === FTUE_KEYS.brainIntro) setShowBrainFtue(false);
    if (key === FTUE_KEYS.integrationsIntro) setShowIntegrationsFtue(false);
    if (key === ftueToolKey) setShowToolFtue(false);
  }

  return (
    <>
      {showWelcomeFtue ? (
        <QAtGuideCard
          className="qat-ftue-card"
          eyebrow="First-time setup"
          title="Hi, I’m QAt. Let’s set up your Project Brain first."
          body="QAtalyst works best when your project memory is set up. Start in Brain to add project details, Source Vault context, rules, terminology, risks, features, and integrations before generating QA work."
          primaryAction={{
            label: "Set up Project Brain",
            onClick: () => {
              dismissFtueStep(FTUE_KEYS.welcome);
              goTo("/brain?tab=projects");
            },
          }}
          secondaryAction={{
            label: "Skip for now",
            onClick: () => dismissFtueStep(FTUE_KEYS.welcome),
          }}
        />
      ) : null}

      {showBrainFtue ? (
        <QAtGuideCard
          className="qat-ftue-card"
          eyebrow="Project Brain"
          title="Your Brain is the reusable context layer for QAtalyst."
          body="Use Brain for project setup, Source Vault, rules, terminology, risks, feature registry, saved reports, bug collection, test case library, and integrations. The more clean context you add, the less generic every QA output becomes."
          primaryAction={{
            label: "Open Brain",
            onClick: () => {
              dismissFtueStep(FTUE_KEYS.brainIntro);
              goTo("/brain?tab=overview");
            },
          }}
          secondaryAction={{
            label: "Got it",
            onClick: () => dismissFtueStep(FTUE_KEYS.brainIntro),
          }}
        />
      ) : null}

      {showIntegrationsFtue ? (
        <QAtGuideCard
          className="qat-ftue-card"
          eyebrow="Integrations"
          title="Connect Jira and TestRail when you’re ready for handoff."
          body="Integrations now live in Brain. Jira helps QAtalyst fetch tickets and create structured QA work; TestRail keeps generated coverage closer to your test management workflow."
          primaryAction={{
            label: "Open integrations",
            onClick: () => {
              dismissFtueStep(FTUE_KEYS.integrationsIntro);
              goTo("/brain?tab=integrations");
            },
          }}
          secondaryAction={{
            label: "Skip integrations",
            onClick: () => dismissFtueStep(FTUE_KEYS.integrationsIntro),
          }}
        />
      ) : null}

      {showToolFtue ? (
        <QAtGuideCard
          className="qat-ftue-card qat-tool-ftue-card"
          eyebrow={`${toolLabel} tutorial`}
          title={toolFtueCopy[activeTool].title}
          body={toolFtueCopy[activeTool].body}
          compact
          primaryAction={{
            label: "Got it",
            onClick: () => dismissFtueStep(ftueToolKey),
          }}
          secondaryAction={{
            label: "Hide this tip",
            onClick: () => dismissFtueStep(ftueToolKey),
          }}
        />
      ) : null}
    </>
  );
}
