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

function renderDimensionBar(score: number) {
  return (
    <span className="coverage-dimension-meter" aria-hidden="true">
      <span style={{ width: `${Math.max(4, Math.min(100, score))}%` }} />
    </span>
  );
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
      intro:
        "QAtalyst did not detect meaningful signals for this risk area in the current ticket/report context.",
      action:
        "No extra QA action is needed unless your product knowledge suggests this area is still relevant.",
    };
  }

  if (item.score < 25) {
    return {
      label: "Low watch item",
      intro:
        "Only light signals were detected. This is probably not a release blocker, but it is worth a quick sanity check.",
      action:
        "Add one lightweight check if this area touches a critical user flow.",
    };
  }

  if (item.score < 60) {
    return {
      label: "Medium QA focus",
      intro:
        "Enough signals were detected that this area deserves targeted testing before handoff.",
      action:
        "Add focused test coverage and clarify any assumptions before release sign-off.",
    };
  }

  return {
    label: "High QA focus",
    intro:
      "Strong signals were detected. This area is likely to carry meaningful delivery or release risk.",
    action:
      "Treat this as a priority QA focus area. Add explicit coverage, clarify requirements, and validate failure states.",
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
          ? "No meaningful requirement-ambiguity signals were detected, such as TBDs, unknowns, missing acceptance criteria, or vague completion language."
          : "QAtalyst detected signs such as vague language, missing acceptance criteria, unknowns, TBDs, or ambiguity in the ticket/report.",
      qaAction:
        item.score <= 0
          ? "No extra action needed. Keep normal acceptance-criteria validation in the test plan."
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
          ? "No meaningful data/state signals were detected, such as persistence, metadata, reload behavior, stale state, or migration language."
          : "QAtalyst detected data/state signals such as persistence, caching, metadata, stale state, reload behavior, or state transitions.",
      qaAction:
        item.score <= 0
          ? "No extra action needed. Add data checks only if the implementation touches persistence or stored state."
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
          ? "No strong regression signals were detected, such as existing workflows, legacy behavior, backward compatibility, or unchanged flows."
          : "QAtalyst detected regression signals such as existing workflows, legacy behavior, unchanged flows, backward compatibility, or previous functionality.",
      qaAction:
        item.score <= 0
          ? "No extra regression action needed beyond your standard smoke/regression suite."
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
          ? "No meaningful auth/access signals were detected, such as roles, permissions, signed-in states, unauthorized access, or admin-only behavior."
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
        ? "No meaningful failure-mode signals were detected, such as invalid input, missing data, crashes, timeouts, unavailable services, or negative paths."
        : "QAtalyst detected failure-mode signals such as errors, missing/invalid input, crashes, unavailable services, timeouts, or negative paths.",
    qaAction:
      item.score <= 0
        ? "No extra action needed beyond normal negative-path sanity checks."
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

  const showRiskBreakdown = reportType !== "bug";
  const weakDimensions = score.dimensions.filter((dimension) => dimension.status !== "strong").slice(0, 4);
  const visibleRiskItems = score.risk.items.slice(0, 5);
  const highestRiskItem =
    visibleRiskItems
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)[0] ?? visibleRiskItems[0];

  const expandedRisk =
    visibleRiskItems.find((item) => item.label === expandedRiskLabel) ?? highestRiskItem;

  const expandedRiskDetails = expandedRisk ? riskDetailFor(expandedRisk) : null;

  return (
    <section className="coverage-score-card" aria-label="Test coverage and risk score">
      <div className="coverage-score-top">
        <div>
          <p className="report-kicker">Coverage Score</p>
          <h3>{score.grade}</h3>
          <p>{score.summary}</p>
        </div>

        <div className="score-number-stack">
          {renderCoverageScore(score)}
          {showRiskBreakdown ? renderRiskScore(score) : null}
        </div>
      </div>

      <div className="coverage-score-columns">
        <div className="coverage-score-section">
          <h4>Strongest coverage</h4>
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
              Risk % estimates delivery exposure. Select a risk area to see why QAtalyst flagged it and what QA
              should do next.
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

      {weakDimensions.length > 0 ? (
        <div className="coverage-dimension-list">
          {weakDimensions.map((dimension) => (
            <article className="coverage-dimension-row" key={dimension.id}>
              <div>
                <strong>{dimension.label}</strong>
                <span>{dimension.reason}</span>
              </div>

              <div className="coverage-dimension-score">
                {renderDimensionBar(dimension.score)}
                <small>{dimension.score}</small>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
