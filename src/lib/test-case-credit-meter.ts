export const TEST_CASES_PER_CREDIT_BLOCK = 10;
export const TEST_CASE_CREDIT_BLOCK_COST = 5;
export const TEST_CASE_MIN_COST = 5;

export function normalizeRequestedTestCaseCount(value: unknown, fallback = 10): number {
  const parsed = Number(String(value ?? "").trim());
  if (!Number.isFinite(parsed)) return fallback;
  const count = Math.trunc(parsed);
  return count > 0 ? count : fallback;
}

export function calculateTestCaseCreditCost(testCaseCount: number): number {
  const safeCount = Math.max(1, Math.trunc(testCaseCount));
  const blocks = Math.ceil(safeCount / TEST_CASES_PER_CREDIT_BLOCK);
  return Math.max(TEST_CASE_MIN_COST, blocks * TEST_CASE_CREDIT_BLOCK_COST);
}

export function shouldConfirmTestCaseCost(testCaseCount: number): boolean {
  return Math.max(1, Math.trunc(testCaseCount)) > TEST_CASES_PER_CREDIT_BLOCK;
}

export function getTestCaseCostSummary(testCaseCount: number) {
  const safeCount = Math.max(1, Math.trunc(testCaseCount));
  const cost = calculateTestCaseCreditCost(safeCount);
  const blocks = Math.ceil(safeCount / TEST_CASES_PER_CREDIT_BLOCK);

  return {
    testCaseCount: safeCount,
    blocks,
    cost,
    requiresConfirmation: shouldConfirmTestCaseCost(safeCount),
    label: `${safeCount} test case${safeCount === 1 ? "" : "s"} = ${cost} credits`,
  };
}
