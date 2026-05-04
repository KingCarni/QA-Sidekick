"use client";

import { useMemo, useState } from "react";
import {
  evaluateAutomationReadinessCase,
  getAutomationCaseTextFromObject,
  getAutomationReadinessTone,
  type AutomationReadinessCase,
  type AutomationReadinessLevel,
} from "@/lib/automation-readiness";
import { generateAutomationSkeleton, getSelectorHintsForTestCase } from "@/lib/automation-codegen";

type InlineTestCase = {
  title?: unknown;
  type?: unknown;
  preconditions?: unknown;
  steps?: unknown;
  expectedResult?: unknown;
  priority?: unknown;
};

type TestCaseAutomationReadinessProps = {
  testCase: InlineTestCase;
  index: number;
};

const READINESS_LABELS: Record<AutomationReadinessLevel, string> = {
  ready: "Ready",
  partial: "Needs Work",
  manual: "Manual",
  blocked: "Blocked",
};

function frameworkLabel(value: AutomationReadinessCase["framework"]) {
  if (value === "playwright") return "Playwright";
  if (value === "cypress") return "Cypress";
  return "Manual review";
}

function readinessClass(value: AutomationReadinessLevel) {
  return `automation-readiness-pill automation-readiness-${value}`;
}

export default function TestCaseAutomationReadiness({ testCase, index }: TestCaseAutomationReadinessProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  const readiness = useMemo(() => {
    return evaluateAutomationReadinessCase(getAutomationCaseTextFromObject(testCase), index);
  }, [index, testCase]);

  const selectorHints = useMemo(() => getSelectorHintsForTestCase(testCase), [testCase]);
  const skeleton = useMemo(() => generateAutomationSkeleton(testCase, index), [index, testCase]);
  const tone = getAutomationReadinessTone(readiness.score, readiness.readiness);

  async function copySkeleton() {
    await navigator.clipboard.writeText(skeleton.code);
    setCopyState("copied");
    window.setTimeout(() => setCopyState("idle"), 1400);
  }

  return (
    <div className={`test-case-automation-box test-case-automation-${tone}`}>
      <div className="test-case-automation-top">
        <div>
          <p className="report-kicker">Automation Readiness</p>
          <strong>{READINESS_LABELS[readiness.readiness]}</strong>
          <span>{frameworkLabel(readiness.framework)}</span>
        </div>

        <em className={readinessClass(readiness.readiness)}>{READINESS_LABELS[readiness.readiness]}</em>
      </div>

      <div className={`automation-score-meter automation-score-meter-${tone}`} aria-label={`Automation readiness score ${readiness.score} out of 100`}>
        <div className="automation-score-meter-track">
          <span style={{ width: `${readiness.score}%` }} />
        </div>
        <strong>{readiness.score}/100</strong>
      </div>

      <p>{readiness.summary}</p>

      <div className="automation-readiness-actions">
        <button className="automation-action-button" type="button" onClick={() => setShowDetails((value) => !value)}>
          {showDetails ? "Hide Details" : "Show Details"}
        </button>

        <button className="automation-action-button automation-action-button-primary" type="button" onClick={() => setShowSkeleton((value) => !value)}>
          {showSkeleton ? "Hide Skeleton" : "Generate Skeleton"}
        </button>
      </div>

      {showDetails ? (
        <div className="automation-details-panel">
          <div className="test-case-automation-columns">
            <div>
              <h5>Detected</h5>
              <ul>
                {readiness.reasons.slice(0, 3).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div>
              <h5>Before coding</h5>
              {readiness.missingInputs.length ? (
                <ul>
                  {readiness.missingInputs.slice(0, 4).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p>No major missing inputs detected.</p>
              )}
            </div>
          </div>

          {selectorHints.length ? (
            <div className="automation-selector-hints">
              <h5>Selector hints</h5>
              <p>{selectorHints.join(" · ")}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {showSkeleton ? (
        <div className="automation-skeleton-box">
          <div className="automation-skeleton-header">
            <div>
              <h5>{skeleton.framework === "cypress" ? "Cypress" : "Playwright"} skeleton</h5>
              <p>{skeleton.filename}</p>
            </div>

            <button className="automation-action-button" type="button" onClick={copySkeleton}>
              {copyState === "copied" ? "Copied" : "Copy Code"}
            </button>
          </div>

          <pre>{skeleton.code}</pre>
        </div>
      ) : null}
    </div>
  );
}
