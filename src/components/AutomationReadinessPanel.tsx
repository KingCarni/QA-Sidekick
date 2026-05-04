"use client";

import { useMemo } from "react";
import { evaluateAutomationReadiness } from "@/lib/automation-readiness";

type AutomationReadinessPanelProps = {
  sourceText: string;
};

function frameworkLabel(value: string) {
  if (value === "playwright") return "Playwright";
  if (value === "cypress") return "Cypress";
  return "Manual review";
}

export default function AutomationReadinessPanel({ sourceText }: AutomationReadinessPanelProps) {
  const report = useMemo(() => evaluateAutomationReadiness(sourceText), [sourceText]);

  if (!sourceText.trim() || report.cases.length === 0) {
    return null;
  }

  return (
    <section className="automation-readiness-card automation-readiness-card-compact">
      <div className="automation-readiness-header">
        <div>
          <p className="report-kicker">Automation Readiness</p>
          <h3>{report.label}</h3>
          <p>{report.summary}</p>
        </div>

        <div className="automation-readiness-score">
          <strong>{report.overallScore}</strong>
          <span>/100</span>
          <small>{frameworkLabel(report.framework)}</small>
        </div>
      </div>

      <div className="automation-readiness-totals">
        <div>
          <strong>{report.totals.ready}</strong>
          <span>Ready</span>
        </div>
        <div>
          <strong>{report.totals.partial}</strong>
          <span>Partial</span>
        </div>
        <div>
          <strong>{report.totals.manual}</strong>
          <span>Manual</span>
        </div>
        <div>
          <strong>{report.totals.blocked}</strong>
          <span>Blocked</span>
        </div>
      </div>

      <div className="automation-readiness-recommendations">
        <p className="report-kicker">Recommended next steps</p>
        <ul>
          {report.recommendations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
