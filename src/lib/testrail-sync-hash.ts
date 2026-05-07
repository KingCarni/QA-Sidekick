import { createHash } from "crypto";

export type TestRailHashInput = {
  title: string;
  preconditions?: string;
  steps: string[];
  expectedResult?: string;
  priority?: string;
  type?: string;
  sourceJiraKey?: string;
};

function normalize(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function buildTestRailContentHash(input: TestRailHashInput) {
  const stablePayload = {
    title: normalize(input.title),
    preconditions: normalize(input.preconditions),
    steps: input.steps.map(normalize),
    expectedResult: normalize(input.expectedResult),
    priority: normalize(input.priority),
    type: normalize(input.type),
    sourceJiraKey: normalize(input.sourceJiraKey),
  };

  return createHash("sha256").update(JSON.stringify(stablePayload)).digest("hex");
}
