"use client";

import Link from "next/link";
import type { ActiveProjectContext } from "@/components/ProjectContextIndicator";

type BrainInfluenceSummaryProps = {
  context: ActiveProjectContext | null;
  selectedSourceCount?: number;
  compact?: boolean;
};

type InfluenceItem = {
  label: string;
  value: number;
  total?: number;
  tone: "source" | "rule" | "term" | "risk" | "feature";
};

const TONE_STYLES: Record<InfluenceItem["tone"], { border: string; background: string; color: string }> = {
  source: {
    border: "rgba(34, 197, 94, 0.36)",
    background: "rgba(22, 101, 52, 0.18)",
    color: "rgb(187, 247, 208)",
  },
  rule: {
    border: "rgba(248, 113, 113, 0.36)",
    background: "rgba(127, 29, 29, 0.2)",
    color: "rgb(254, 202, 202)",
  },
  term: {
    border: "rgba(96, 165, 250, 0.34)",
    background: "rgba(30, 64, 175, 0.18)",
    color: "rgb(191, 219, 254)",
  },
  risk: {
    border: "rgba(250, 204, 21, 0.38)",
    background: "rgba(113, 63, 18, 0.2)",
    color: "rgb(254, 240, 138)",
  },
  feature: {
    border: "rgba(168, 85, 247, 0.34)",
    background: "rgba(88, 28, 135, 0.18)",
    color: "rgb(233, 213, 255)",
  },
};

function formatValue(item: InfluenceItem) {
  if (typeof item.total === "number" && item.total !== item.value) {
    return `${item.value}/${item.total}`;
  }

  return String(item.value);
}

export default function BrainInfluenceSummary({
  context,
  selectedSourceCount = 0,
  compact = false,
}: BrainInfluenceSummaryProps) {
  const projectName = context?.project?.name ?? "No project selected";
  const enabledSources = context?.enabledSourceCount ?? 0;
  const totalSources = context?.totalSourceCount ?? 0;
  const ruleCount = context?.enabledRuleCount ?? 0;
  const termCount = context?.enabledTermCount ?? 0;
  const riskCount = context?.enabledRiskCount ?? 0;
  const featureCount = context?.enabledFeatureCount ?? 0;
  const hasAnyInfluence = Boolean(
    selectedSourceCount || ruleCount || termCount || riskCount || featureCount
  );

  const items: InfluenceItem[] = [
    {
      label: "Sources selected",
      value: selectedSourceCount,
      total: enabledSources,
      tone: "source",
    },
    { label: "QA rules", value: ruleCount, tone: "rule" },
    { label: "Terms", value: termCount, tone: "term" },
    { label: "Risks", value: riskCount, tone: "risk" },
    { label: "Features", value: featureCount, tone: "feature" },
  ];

  return (
    <section
      className="brain-influence-summary"
      aria-label="Project Brain influence summary"
      style={{
        display: "grid",
        gap: compact ? 10 : 12,
        marginTop: compact ? 12 : 16,
        padding: compact ? 12 : 16,
        border: "1px solid rgba(34, 197, 94, 0.22)",
        borderRadius: compact ? 16 : 20,
        background:
          "radial-gradient(circle at top left, rgba(34, 197, 94, 0.1), transparent 38%), rgba(2, 6, 23, 0.48)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <p
            className="report-kicker"
            style={{ margin: 0, color: "rgb(187, 247, 208)" }}
          >
            Brain influence
          </p>
          <strong style={{ display: "block", marginTop: 4, color: "white", fontSize: compact ? "0.92rem" : "1.02rem" }}>
            {hasAnyInfluence ? "Project memory ready for this run" : "No active Brain influence yet"}
          </strong>
          <span style={{ display: "block", marginTop: 4, color: "rgba(226, 232, 240, 0.72)", lineHeight: 1.45 }}>
            {context?.project
              ? `${projectName} can contribute sources, rules, terminology, risks, and feature context server-side.`
              : "Select a project to make generated QA output project-aware."}
          </span>
        </div>
        <Link
          href="/brain"
          style={{
            border: "1px solid rgba(96, 165, 250, 0.28)",
            borderRadius: 999,
            color: "rgb(219, 234, 254)",
            background: "rgba(37, 99, 235, 0.16)",
            padding: "8px 11px",
            textDecoration: "none",
            fontSize: "0.74rem",
            fontWeight: 950,
            whiteSpace: "nowrap",
          }}
        >
          Open Brain
        </Link>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          gap: 7,
        }}
      >
        {items.map((item) => {
          const tone = TONE_STYLES[item.tone];
          return (
            <div
              key={item.label}
              title={item.label}
              style={{
                minWidth: 0,
                border: `1px solid ${tone.border}`,
                borderRadius: 999,
                background: tone.background,
                color: tone.color,
                padding: compact ? "6px 8px" : "7px 9px",
                textAlign: "center",
              }}
            >
              <strong style={{ display: "block", color: tone.color, fontSize: "0.84rem", lineHeight: 1 }}>
                {formatValue(item)}
              </strong>
              <span
                style={{
                  display: "block",
                  marginTop: 3,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontSize: "0.6rem",
                  fontWeight: 900,
                  opacity: 0.9,
                }}
              >
                {item.label}
              </span>
            </div>
          );
        })}
      </div>

      {totalSources > enabledSources ? (
        <small style={{ color: "rgba(226, 232, 240, 0.56)", lineHeight: 1.4 }}>
          {totalSources - enabledSources} disabled source{totalSources - enabledSources === 1 ? "" : "s"} ignored.
        </small>
      ) : null}
    </section>
  );
}
