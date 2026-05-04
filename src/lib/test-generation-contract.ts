export type TestGenerationContractOptions = {
  expectedCaseCount?: number;
  forceSameCaseCount?: boolean;
  previousTitles?: string[];
};

/**
 * Add this to the Test Cases API prompt.
 *
 * Purpose:
 * - Reduce AI variance between runs.
 * - Keep output count stable when the user is regenerating the same source.
 * - Make parser/scoring/export more consistent.
 *
 * Still not mathematically deterministic because the model can vary, but this
 * removes a lot of avoidable drift.
 */
export function buildTestGenerationContract(options: TestGenerationContractOptions = {}): string {
  const previousTitles = options.previousTitles?.filter(Boolean) ?? [];
  const countLine =
    options.expectedCaseCount && options.expectedCaseCount > 0
      ? `Generate exactly ${options.expectedCaseCount} test cases.`
      : "Generate the smallest useful set of high-value test cases. Do not pad with filler cases.";

  const sameCountLine =
    options.forceSameCaseCount && options.expectedCaseCount
      ? "This is a regeneration of the same source. Preserve the same number of test cases unless the source requirements changed."
      : "";

  const titlesLine =
    previousTitles.length > 0
      ? [
          "When regenerating the same source, preserve these test case titles unless they are clearly wrong:",
          ...previousTitles.map((title, index) => `${index + 1}. ${title}`),
        ].join("\n")
      : "";

  return [
    "TEST GENERATION CONSISTENCY CONTRACT",
    countLine,
    sameCountLine,
    titlesLine,
    "Use the same output schema every time.",
    "Do not add extra sections outside the schema.",
    "Each test case must include: title, type, priority, preconditions, steps, expectedResult.",
    "Each steps field must be an ordered list of concrete tester actions.",
    "Each expectedResult must include an observable assertion.",
    "Prefer stable wording over creative rewriting.",
    "Avoid duplicate test cases.",
    "Avoid splitting one scenario into multiple cases unless the acceptance criteria require it.",
  ]
    .filter(Boolean)
    .join("\n");
}

export const RECOMMENDED_OPENAI_TEST_GENERATION_OPTIONS = {
  temperature: 0,
  top_p: 1,
} as const;
