"use client";

export type RiskTone = "critical" | "high" | "medium" | "low" | "none";

type RiskSeverityBadgeProps = {
  severity?: unknown;
  score?: unknown;
  compact?: boolean;
};

function normalizeSeverity(severity?: unknown, score?: unknown): RiskTone {
  const raw = String(severity ?? "").toLowerCase();

  if (raw.includes("critical")) return "critical";
  if (raw.includes("high")) return "high";
  if (raw.includes("medium")) return "medium";
  if (raw.includes("low")) return "low";
  if (raw.includes("none")) return "none";

  const numericScore =
    typeof score === "number"
      ? score
      : typeof score === "string" && score.trim()
        ? Number(score)
        : Number.NaN;

  if (Number.isFinite(numericScore)) {
    if (numericScore >= 75) return "high";
    if (numericScore >= 40) return "medium";
    if (numericScore > 0) return "low";
    return "none";
  }

  return "medium";
}

function scoreForTone(tone: RiskTone, score?: unknown) {
  const numericScore =
    typeof score === "number"
      ? score
      : typeof score === "string" && score.trim()
        ? Number(score)
        : Number.NaN;

  if (Number.isFinite(numericScore)) {
    return Math.max(0, Math.min(100, Math.round(numericScore)));
  }

  switch (tone) {
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

function labelForTone(tone: RiskTone) {
  switch (tone) {
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

export function riskToneFromSeverity(severity?: unknown, score?: unknown): RiskTone {
  return normalizeSeverity(severity, score);
}

export default function RiskSeverityBadge({ severity, score, compact = false }: RiskSeverityBadgeProps) {
  const tone = normalizeSeverity(severity, score);
  const riskScore = scoreForTone(tone, score);
  const label = labelForTone(tone);

  return (
    <div
      className={`risk-severity-badge risk-severity-badge-${tone} ${
        compact ? "risk-severity-badge-compact" : ""
      }`}
      title={`Risk Severity: ${label} · ${riskScore}%`}
      aria-label={`Risk Severity ${label}, ${riskScore} percent`}
      style={{ ["--risk-score" as string]: `${riskScore * 3.6}deg` }}
    >
      <div className="risk-severity-donut" aria-hidden="true">
        <span>{riskScore}</span>
      </div>

      <div className="risk-severity-copy">
        <strong>{label}</strong>
        <small>Risk</small>
      </div>
    </div>
  );
}
