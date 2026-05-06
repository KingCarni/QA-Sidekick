"use client";

import RiskSeverityBadge, { riskToneFromSeverity } from "@/components/RiskSeverityBadge";

type RiskItem = {
  title?: unknown;
  severity?: unknown;
  area?: unknown;
  whyItMatters?: unknown;
  mitigation?: unknown;
  score?: unknown;
};

type BottleneckItem = {
  title?: unknown;
  impact?: unknown;
  owner?: unknown;
  recommendation?: unknown;
};

type RiskReview = {
  overallRisk?: unknown;
  summary?: unknown;
  keyRisks?: unknown;
  bottlenecks?: unknown;
  missingAcceptanceCriteria?: unknown;
  qaFollowUpQuestions?: unknown;
  suggestedTestFocus?: unknown;
};

type RiskReviewPanelProps = {
  review: RiskReview;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeText(value: unknown, fallback = "Not specified."): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value.trim() || fallback;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((item) => safeText(item)).join(", ");
  if (isPlainObject(value)) {
    return Object.entries(value)
      .map(([key, item]) => `${key}: ${safeText(item)}`)
      .join("\n");
  }

  return String(value);
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function lines(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => safeText(item)).filter(Boolean);
  const text = safeText(value, "");
  if (!text) return [];

  return text
    .split(/\n+/)
    .map((line) => line.replace(/^[-*•]\s+/, "").replace(/^\d+[.)]\s+/, "").trim())
    .filter(Boolean);
}

function chipLabel(prefix: string, value: unknown) {
  const text = safeText(value, "");
  return text ? `${prefix}: ${text}` : prefix;
}

export default function RiskReviewPanel({ review }: RiskReviewPanelProps) {
  const keyRisks = asArray<RiskItem>(review.keyRisks);
  const bottlenecks = asArray<BottleneckItem>(review.bottlenecks);
  const missingAcceptanceCriteria = lines(review.missingAcceptanceCriteria);
  const followUps = lines(review.qaFollowUpQuestions);
  const suggestedFocus = lines(review.suggestedTestFocus);
  const overallTone = riskToneFromSeverity(review.overallRisk);

  return (
    <div className="risk-review-report-layout">
      <section className={`risk-review-summary-card risk-review-summary-card-${overallTone}`}>
        <div className="risk-review-summary-header">
          <div className="risk-review-summary-copy">
            <p className="report-kicker">Summary</p>
            <h3>Pre-production QA Risk Review</h3>
            <p>{safeText(review.summary, "No risk summary returned.")}</p>
          </div>

          <RiskSeverityBadge severity={review.overallRisk} />
        </div>
      </section>

      {keyRisks.length > 0 ? (
        <section className="risk-review-section">
          <div className="risk-review-section-heading">
            <p className="report-kicker">Key Risks</p>
            <h3>{keyRisks.length} risks found</h3>
          </div>

          <div className="risk-item-list">
            {keyRisks.map((risk, index) => {
              const tone = riskToneFromSeverity(risk.severity, risk.score);

              return (
                <article className={`risk-item-card risk-item-card-${tone}`} key={`${safeText(risk.title)}-${index}`}>
                  <div className="risk-item-copy">
                    <div className="risk-item-title-row">
                      <p className="report-kicker">Risk {index + 1}</p>
                      <div className="risk-mini-chip-row">
                        <span className={`risk-mini-chip risk-mini-chip-${tone}`}>
                          {chipLabel("Severity", risk.severity)}
                        </span>
                        {safeText(risk.area, "") ? <span className="risk-mini-chip">{chipLabel("Area", risk.area)}</span> : null}
                      </div>
                    </div>

                    <h4>{safeText(risk.title, `Risk ${index + 1}`)}</h4>

                    <div className="risk-item-detail-grid">
                      <div>
                        <strong>Why it matters</strong>
                        <p>{safeText(risk.whyItMatters, "No impact explanation returned.")}</p>
                      </div>

                      <div>
                        <strong>Recommended QA action</strong>
                        <p>{safeText(risk.mitigation, "No mitigation returned.")}</p>
                      </div>
                    </div>
                  </div>

                  <RiskSeverityBadge severity={risk.severity} score={risk.score} compact />
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {bottlenecks.length > 0 ? (
        <section className="risk-review-section risk-review-glow-card">
          <p className="report-kicker">Bottlenecks</p>
          <div className="risk-secondary-grid">
            {bottlenecks.map((item, index) => (
              <article className="risk-secondary-card" key={`${safeText(item.title)}-${index}`}>
                <h4>{safeText(item.title, `Bottleneck ${index + 1}`)}</h4>
                <p>{safeText(item.impact, "No impact returned.")}</p>
                <small>{safeText(item.owner, "Owner not specified.")}</small>
                <p>{safeText(item.recommendation, "No recommendation returned.")}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {missingAcceptanceCriteria.length > 0 || suggestedFocus.length > 0 || followUps.length > 0 ? (
        <section className="risk-review-section risk-review-glow-card">
          <div className="risk-secondary-grid risk-secondary-grid-three">
            {missingAcceptanceCriteria.length > 0 ? (
              <article className="risk-secondary-card">
                <p className="report-kicker">Missing Criteria</p>
                <ul>
                  {missingAcceptanceCriteria.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ) : null}

            {suggestedFocus.length > 0 ? (
              <article className="risk-secondary-card">
                <p className="report-kicker">Suggested Test Focus</p>
                <ul>
                  {suggestedFocus.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ) : null}

            {followUps.length > 0 ? (
              <article className="risk-secondary-card">
                <p className="report-kicker">Follow-up Questions</p>
                <ul>
                  {followUps.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
