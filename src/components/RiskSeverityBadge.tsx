"use client";

type RiskSeverity = "Critical" | "High" | "Medium" | "Low" | "None" | string;

type RiskSeverityBadgeProps = {
  severity?: RiskSeverity;
  score?: number;
  label?: string;
};

function normalizeSeverity(severity?: RiskSeverity, score?: number) {
  const raw = String(severity ?? "").toLowerCase();

  if (raw.includes("critical")) return "critical";
  if (raw.includes("high")) return "high";
  if (raw.includes("medium")) return "medium";
  if (raw.includes("low")) return "low";
  if (raw.includes("none")) return "none";

  if (typeof score === "number") {
    if (score >= 75) return "high";
    if (score >= 40) return "medium";
    if (score > 0) return "low";
    return "none";
  }

  return "medium";
}

function severityScore(severityTone: string, score?: number) {
  if (typeof score === "number") return Math.max(0, Math.min(100, Math.round(score)));

  switch (severityTone) {
    case "critical":
      return 95;
    case "high":
      return 82;
    case "medium":
      return 55;
    case "low":
      return 22;
    case "none":
      return 0;
    default:
      return 55;
  }
}

function severityLabel(severityTone: string, label?: string) {
  if (label) return label;

  switch (severityTone) {
    case "critical":
      return "Critical";
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "low":
      return "Low";
    case "none":
      return "None";
    default:
      return "Medium";
  }
}

export default function RiskSeverityBadge({ severity, score, label }: RiskSeverityBadgeProps) {
  const tone = normalizeSeverity(severity, score);
  const numericScore = severityScore(tone, score);
  const displayLabel = severityLabel(tone, label);

  return (
    <div
      className={`risk-severity-badge risk-severity-badge-${tone}`}
      title={`Risk Severity: ${displayLabel} · ${numericScore}%`}
      aria-label={`Risk Severity ${displayLabel}, ${numericScore} percent`}
      style={{ ["--risk-score" as string]: `${numericScore * 3.6}deg` }}
    >
      <div className="risk-severity-donut" aria-hidden="true">
        <span>{numericScore}</span>
      </div>
      <div className="risk-severity-copy">
        <strong>{displayLabel}</strong>
        <small>Risk</small>
      </div>
    </div>
  );
}
