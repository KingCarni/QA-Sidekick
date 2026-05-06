"use client";

import { calculateTestCaseQuality } from "@/lib/test-case-quality";

type TestCaseQualityBadgeProps = {
  testCase: {
    title?: unknown;
    type?: unknown;
    priority?: unknown;
    preconditions?: unknown;
    steps?: unknown;
    expectedResult?: unknown;
  };
};

export default function TestCaseQualityBadge({ testCase }: TestCaseQualityBadgeProps) {
  const quality = calculateTestCaseQuality(testCase);

  return (
    <div
      className={`test-case-quality-badge test-case-quality-badge-${quality.tone}`}
      title={`Test Case Quality: ${quality.score}/100 · ${quality.label}`}
      aria-label={`Test Case Quality ${quality.score} out of 100, ${quality.label}`}
      style={{ ["--quality-score" as string]: `${quality.score * 3.6}deg` }}
    >
      <div className="test-case-quality-badge-kicker">Quality</div>

      <div className="test-case-quality-donut" aria-hidden="true">
        <span>{quality.score}</span>
      </div>

      <strong>{quality.label}</strong>
    </div>
  );
}
