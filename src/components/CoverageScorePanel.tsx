"use client";

import { useMemo, useState } from "react";
import {
  calculateCoverageScore,
  coverageScoreTone,
  riskScoreTone,
  type CoverageScoreResult,
  type ReportType,
  type RiskBreakdownItem,
} from "@/lib/coverage-score";
import { calculateSourceQualityScore } from "@/lib/source-quality-score";

type CoverageScorePanelProps = {
  reportType: ReportType;
  sourceInput?: unknown;
  markdown?: unknown;
  structuredData?: unknown;
};

type RiskDetail = {
  title: string;
  why: string;
  signals: string;
  qaAction: string;
};

function toolScoreLabel(reportType: ReportType) {
  switch (reportType) {
    case "risk":
      return "Risk Review Score";
    case "bug":
      return "Bug Report Quality";
    case "improve":
      return "Improvement Score";
    case "tests":
    default:
      return "QA Handoff Quality";
  }
}

function toolNoun(reportType: ReportType) {
  switch (reportType) {
    case "risk":
      return "risk review";
    case "bug":
      return "bug report";
    case "improve":
      return "improved test";
    case "tests":
    default:
      return "test plan";
  }
}

function beforeLabel(reportType: ReportType) {
  switch (reportType) {
    case "tests":
      return "Source readiness";
    case "risk":
      return "Risk input";
    case "bug":
      return "Bug source";
    case "improve":
      return "Original test";
    default:
      return "Source";
  }
}

function afterLabel(reportType: ReportType) {
  switch (reportType) {
    case "tests":
      return "Generated suite";
    case "risk":
      return "Generated risk review";
    case "bug":
      return "Generated bug report";
    case "improve":
      return "Improved test";
    default:
      return "Generated output";
  }
}

function renderCoverageScore(score: CoverageScoreResult) {
  const tone = coverageScoreTone(score.score);

  return (
    <div className={`coverage-score-number coverage-score-number-${tone}`}>
      <strong>{score.score}</strong>
      <span>/100</span>
    </div>
  );
}

function renderRiskScore(score: CoverageScoreResult) {
  const tone = riskScoreTone(score.risk.score);

  return (
    <div className={`risk-score-number risk-score-number-${tone}`}>
      <strong>{score.risk.score}%</strong>
      <span>{score.risk.label} Risk</span>
    </div>
  );
}

function deltaLabel(delta: number) {
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

function deltaClass(delta: number) {
  if (delta >= 15) return "score-delta score-delta-strong";
  if (delta > 0) return "score-delta score-delta-good";
  if (delta === 0) return "score-delta";
  return "score-delta score-delta-down";
}

function comparisonExplainer(reportType: ReportType) {
  if (reportType === "tests") {
    return "Before measures how much usable QA detail existed in the source. After measures how useful the generated suite is for handoff, including structure, coverage, and automation readiness.";
  }

  if (reportType === "risk") {
    return "Before measures how useful the source is for risk analysis. Jira metadata helps, but it is not a completed risk review.";
  }

  if (reportType === "bug") {
    return "Before measures how complete the original bug source is. After measures the structured bug report QAtalyst generated.";
  }

  return "Before measures the original test quality. After measures the improved test QAtalyst generated.";
}

function riskPieVars(items: CoverageScoreResult["risk"]["items"]) {
  const visible = items.slice(0, 5);
  const total = visible.reduce((sum, item) => sum + Math.max(1, item.score), 0) || 1;

  let cursor = 0;
  const stops = visible.map((item, index) => {
    const start = cursor;
    const amount = (Math.max(1, item.score) / total) * 100;
    cursor += amount;

    const color = [
      "rgba(248, 113, 113, 0.95)",
      "rgba(245, 158, 11, 0.95)",
      "rgba(59, 130, 246, 0.95)",
      "rgba(168, 85, 247, 0.95)",
      "rgba(34, 197, 94, 0.95)",
    ][index];

    return `${color} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
  });

  return {
    background: `conic-gradient(${stops.join(", ")})`,
  };
}

function riskLevelCopy(item: RiskBreakdownItem) {
  if (item.score <= 0) {
    return {
      label: "No action needed",
      action: "No extra QA action is needed unless your product knowledge suggests this area is still relevant.",
    };
  }

  if (item.score < 25) {
    return {
      label: "Low watch item",
      action: "Add one lightweight check if this area touches a critical user flow.",
    };
  }

  if (item.score < 60) {
    return {
      label: "Medium QA focus",
      action: "Add focused test coverage and clarify any assumptions before release sign-off.",
    };
  }

  return {
    label: "High QA focus",
    action: "Treat this as a priority QA focus area. Add explicit coverage, clarify requirements, and validate failure states.",
  };
}

function riskDetailFor(item: RiskBreakdownItem): RiskDetail {
  const label = item.label.toLowerCase();
  const level = riskLevelCopy(item);

  if (label.includes("requirements")) {
    return {
      title: item.score <= 0 ? "No requirements clarity action needed" : `${level.label}: requirements clarity`,
      why:
        item.score <= 0
          ? "The current ticket/report does not show strong signs of vague or missing requirements."
          : "Unclear requirements create QA churn because testers cannot confidently tell whether the feature is complete or correct.",
      signals:
        item.score <= 0
          ? "No meaningful requirement-ambiguity signals were detected."
          : "QAtalyst detected signs such as vague language, missing acceptance criteria, unknowns, TBDs, or ambiguity in the ticket/report.",
      qaAction:
        item.score <= 0
          ? "Keep normal acceptance-criteria validation in the test plan."
          : `${level.action} Ask for concrete acceptance criteria, expected results, out-of-scope notes, and examples.`,
    };
  }

  if (label.includes("data")) {
    return {
      title: item.score <= 0 ? "No data/state action needed" : `${level.label}: data and state`,
      why:
        item.score <= 0
          ? "The current ticket/report does not show meaningful data, persistence, cache, or state-transition risk."
          : "Data and state bugs often survive happy-path testing because they show up after reloads, saves, migrations, or repeated actions.",
      signals:
        item.score <= 0
          ? "No meaningful data/state signals were detected."
          : "QAtalyst detected data/state signals such as persistence, caching, metadata, stale state, reload behavior, or state transitions.",
      qaAction:
        item.score <= 0
          ? "Add data checks only if the implementation touches persistence or stored state."
          : `${level.action} Test create/update/reload flows, stale state, rollback/cleanup, duplicate data, and transition boundaries.`,
    };
  }

  if (label.includes("regression")) {
    return {
      title: item.score <= 0 ? "No regression-specific action needed" : `${level.label}: regression`,
      why:
        item.score <= 0
          ? "QAtalyst did not detect meaningful evidence that existing workflows are likely to be affected."
          : "New work can quietly break existing behavior even when the new feature itself appears to work.",
      signals:
        item.score <= 0
          ? "No strong regression signals were detected."
          : "QAtalyst detected regression signals such as existing workflows, legacy behavior, unchanged flows, backward compatibility, or previous functionality.",
      qaAction:
        item.score <= 0
          ? "Use your standard smoke/regression suite."
          : `${level.action} Add checks for the most important existing user flows that could be affected by this change.`,
    };
  }

  if (label.includes("auth") || label.includes("access")) {
    return {
      title: item.score <= 0 ? "No auth/access action needed" : `${level.label}: auth and access`,
      why:
        item.score <= 0
          ? "The current ticket/report does not show meaningful access-control, role, or user-isolation risk."
          : "Access-control bugs can expose user data, block valid users, or allow actions from the wrong role.",
      signals:
        item.score <= 0
          ? "No meaningful auth/access signals were detected."
          : "QAtalyst detected auth/access signals such as users, roles, permissions, signed-in/signed-out states, unauthorized access, or admin-only behavior.",
      qaAction:
        item.score <= 0
          ? "No extra action needed unless the feature is gated by role, account, or ownership."
          : `${level.action} Test signed-in, signed-out, wrong-user, wrong-role, and permission-boundary scenarios.`,
    };
  }

  return {
    title: item.score <= 0 ? "No failure-mode action needed" : `${level.label}: failure modes`,
    why:
      item.score <= 0
        ? "The current ticket/report does not show meaningful failure-mode or recovery-path risk."
        : "Failure cases determine whether users get clear recovery paths or confusing broken states.",
    signals:
      item.score <= 0
        ? "No meaningful failure-mode signals were detected."
        : "QAtalyst detected failure-mode signals such as errors, missing/invalid input, crashes, unavailable services, timeouts, or negative paths.",
    qaAction:
      item.score <= 0
        ? "Use normal negative-path sanity checks."
        : `${level.action} Add invalid-input, empty-state, service-failure, unavailable dependency, timeout, and error-message checks.`,
  };
}

function riskStatusLabel(item: RiskBreakdownItem) {
  if (item.score <= 0) return "0% · No action needed";
  return `${item.score}% · ${item.reason}`;
}

export default function CoverageScorePanel({
  reportType,
  sourceInput,
  markdown,
  structuredData,
}: CoverageScorePanelProps) {
  const [expandedRiskLabel, setExpandedRiskLabel] = useState<string | null>(null);

  const score = useMemo(
    () =>
      calculateCoverageScore({
        reportType,
        sourceInput,
        markdown,
        structuredData,
      }),
    [reportType, sourceInput, markdown, structuredData]
  );

  const originalScore = useMemo(
    () => calculateSourceQualityScore(reportType, sourceInput),
    [reportType, sourceInput]
  );

  const delta = score.score - originalScore.score;
  const showRiskBreakdown = reportType !== "bug";
  const visibleRiskItems = score.risk.items.slice(0, 5);
  const highestRiskItem =
    visibleRiskItems
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)[0] ?? visibleRiskItems[0];

  const expandedRisk =
    visibleRiskItems.find((item) => item.label === expandedRiskLabel) ?? highestRiskItem;

  const expandedRiskDetails = expandedRisk ? riskDetailFor(expandedRisk) : null;

  return (
    <section
      className={`coverage-score-card coverage-score-card-${coverageScoreTone(score.score)}`}
      aria-label={toolScoreLabel(reportType)}
    >
      <div className="coverage-score-top">
        <div>
          <p className="report-kicker">{toolScoreLabel(reportType)}</p>
          <h3>{score.grade}</h3>
          <p>{score.summary}</p>
          <p className="coverage-score-method">{comparisonExplainer(reportType)}</p>
        </div>

        <div className="score-number-stack">
          {renderCoverageScore(score)}
          {showRiskBreakdown ? renderRiskScore(score) : null}
        </div>
      </div>

      <div className="score-comparison-card">
        <div>
          <p className="report-kicker">Before</p>
          <strong>{originalScore.score}/100</strong>
          <span>{beforeLabel(reportType)}</span>
        </div>

        <div>
          <p className="report-kicker">After</p>
          <strong>{score.score}/100</strong>
          <span>{afterLabel(reportType)}</span>
        </div>

        <div>
          <p className="report-kicker">Lift</p>
          <strong className={deltaClass(delta)}>{deltaLabel(delta)}</strong>
          <span>{delta >= 0 ? "Improvement" : "Regression"}</span>
        </div>
      </div>

      {originalScore.signals.length > 0 ? (
        <div className="source-quality-signal-card">
          <p className="report-kicker">Source Signals</p>
          <ul>
            {originalScore.signals.slice(0, 4).map((signal) => (
              <li key={signal}>{signal}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="coverage-score-columns">
        <div className="coverage-score-section">
          <h4>Strongest areas</h4>
          <ul>
            {score.strengths.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="coverage-score-section">
          <h4>Recommended improvements</h4>
          <ul>
            {score.gaps.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      {showRiskBreakdown ? (
        <div className="risk-donut-card">
          <div className="risk-donut-copy">
            <p className="report-kicker">Risk Breakdown</p>
            <h4>{score.risk.summary}</h4>
            <p>
              Risk % estimates delivery exposure from the source plus generated output.
              Select a risk area to see why QAtalyst flagged it and what QA should do next.
            </p>
          </div>

          <div className="risk-donut-layout">
            <div className="risk-donut-wrap">
              <div className="risk-donut" style={riskPieVars(visibleRiskItems)}>
                <div>
                  <strong>{score.risk.score}%</strong>
                  <span>{score.risk.label}</span>
                </div>
              </div>
            </div>

            <div className="risk-donut-legend">
              {visibleRiskItems.map((item, index) => {
                const isExpanded = expandedRisk?.label === item.label;
                const isZeroRisk = item.score <= 0;

                return (
                  <button
                    className={`risk-donut-legend-item risk-donut-legend-item-${index + 1} ${
                      isExpanded ? "risk-donut-legend-item-active" : ""
                    } ${isZeroRisk ? "risk-donut-legend-item-zero" : ""}`}
                    key={item.label}
                    onClick={() => setExpandedRiskLabel(item.label)}
                    type="button"
                  >
                    <span aria-hidden="true" />
                    <div>
                      <strong>{item.label}</strong>
                      <small>{riskStatusLabel(item)}</small>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {expandedRisk && expandedRiskDetails ? (
            <article className={`risk-detail-card ${expandedRisk.score <= 0 ? "risk-detail-card-zero" : ""}`}>
              <div className="risk-detail-card-heading">
                <p className="report-kicker">Selected Risk</p>
                <h4>
                  {expandedRisk.label} · {expandedRisk.score <= 0 ? "No action needed" : `${expandedRisk.score}%`}
                </h4>
              </div>

              <div className="risk-detail-grid">
                <div>
                  <strong>{expandedRiskDetails.title}</strong>
                  <p>{expandedRiskDetails.why}</p>
                </div>

                <div>
                  <strong>What QAtalyst detected</strong>
                  <p>{expandedRiskDetails.signals}</p>
                </div>

                <div>
                  <strong>Recommended QA action</strong>
                  <p>{expandedRiskDetails.qaAction}</p>
                </div>
              </div>
            </article>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
