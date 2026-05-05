export type QAToolPromptType = "tests" | "risk" | "bug" | "improve";

export const QAS73_COMMON_GENERATOR_RULES = `
QAS-73 GENERATOR QUALITY RULES

The generated QA artifact must be better than the source in a practical QA sense.
Do not merely mirror, reformat, or create weak generic output from the source.

Preserve source facts:
- Treat Jira ticket fields, pasted requirements, project memory, uploaded source context, and user-provided notes as source-of-truth.
- Do not invent implementation details, selectors, routes, hidden acceptance criteria, logs, evidence, customer impact, or root cause.
- Label assumptions clearly.
- Put missing details in Missing Info / Follow-up Questions instead of pretending they are known.

Make the output better for real reasons:
- Add concrete setup/preconditions where the source supports them.
- Add specific user/data/platform/role scope where the source supports it.
- Add observable assertions instead of generic "works correctly" wording.
- Add negative, edge, data/state, permission/auth, regression, accessibility/readability, and failure-mode coverage only when relevant.
- Prefer fewer high-quality items over many vague items.

Avoid low-value wording:
- Do not use "visually appealing" as an expected result unless the source provides concrete visual acceptance criteria.
- Do not use "user experiences confusion" as an expected result.
- Do not generate tests that only say "evaluate the UI presentation".
- Do not generate comparison tests against "preferred designs" unless a design reference is actually provided.
- Do not generate a regression test that requires a previous version unless the source provides one.
- Do not use generic titles such as "Happy Path", "Negative Test", "Validation Test", or "UI Test".

For vague UI bugs:
- Generate grounded manual/design-review coverage only when the issue is subjective.
- Add concrete missing-info questions asking which element is unclear, what the expected layout/content should be, and whether screenshots/design references exist.
- If screenshots are referenced but unavailable to the model, call that out.
`;

export const QAS73_TEST_CASE_RULES = `
TEST CASE GENERATION RULES

Generate a practical QA suite, not filler.

Each test case must include:
- title
- type
- priority
- preconditions
- steps
- expectedResult

Title rules:
- Name the exact behavior being tested.
- Bad: "Verify UI Clarity"
- Better: "Verify Risk Review Summary Separates Score, Risk Level, and Recommended Actions"

Step rules:
- Steps must be executable by a tester.
- Avoid vague steps like "evaluate the UI" or "review the summary".
- Use concrete actions like open the tab, fetch a Jira ticket, generate a report, inspect a named section, resize viewport, or compare visible fields.

Expected result rules:
- Expected result must be observable/assertable.
- Bad: "The UI should be visually appealing."
- Better: "The Risk Review summary displays score, risk label, top risk area, and recommended QA action without overlapping or truncated text."
- Bad: "User experiences confusion."
- Better: "If source detail is missing, QAtalyst displays follow-up questions instead of presenting assumptions as confirmed facts."

Coverage rules:
- Add a primary success-path test when source has enough behavior.
- Add negative/error tests when source mentions invalid states, missing config, access failure, or broken behavior.
- Add regression tests only when existing behavior could be affected.
- Add data/state tests when persistence, reload, sync, metadata, project/source selection, or saved output is involved.
- Add accessibility/readability checks for UI clarity tickets when relevant.
- Subjective visual review cases should be marked Manual or Exploratory, not automation-ready.
- If the ticket is too vague, generate a small starter suite and ask low-noise follow-up questions instead of inventing details.

QAS-75 style warning:
If the source says "UI pass needed" or "summary is confusing", do not generate five subjective UI tests.
Generate:
1. A concrete readability/layout test if visible elements are known.
2. A missing-information test/follow-up flow.
3. A regression smoke test only if existing behavior is identifiable.
4. Optional accessibility/readability coverage.
Then ask follow-up questions for screenshots, expected design, target section, viewport/device, and acceptance criteria.
`;

export const QAS73_RISK_REVIEW_RULES = `
RISK REVIEW GENERATION RULES

The review must include concrete risk analysis, not generic warnings.

Each material risk should include:
- signal detected from source
- why it matters
- likely impact
- recommended QA action

Good risk review sections:
- Requirement clarity risk
- Evidence/design-reference risk
- Regression risk
- Data/state risk
- Auth/access risk
- Accessibility/readability risk
- Failure-mode risk
- Release confidence / missing-info risk

Rules:
- Do not describe a source as complete just because Jira metadata exists.
- If the source is a bug ticket, recognize its summary, issue type, status, priority, description, and evidence gaps.
- If the source is UI-related but vague, call out that visual expectations need screenshots/design references.
- Keep follow-up questions low-noise and only ask questions that materially affect test scope, release confidence, or implementation risk.
- Do not invent severity, root cause, affected users, or implementation details.
`;

export const QAS73_BUG_WRITER_RULES = `
BUG WRITER GENERATION RULES

Create a structured bug report that preserves facts and exposes gaps.

Required sections:
- Summary
- Environment
- Steps to Reproduce
- Expected Result
- Actual Result
- Impact
- Missing Info
- Follow-up Questions
- QA Notes
- Evidence / Attachments
- Original Source Input

Rules:
- Separate confirmed facts from assumptions.
- Do not claim evidence is attached unless it is actually provided.
- Do not fabricate logs, screenshots, affected users, severity, or exact root cause.
- If the source only says a UI pass is needed, keep impact grounded and ask for the specific unclear elements and expected design.
- Expected vs actual must be separated.
- Repro steps should use the best safe sequence from source; if incomplete, state what is missing.
`;

export const QAS73_TEST_IMPROVER_RULES = `
TEST IMPROVER GENERATION RULES

Improve the test materially, not cosmetically.

Rules:
- Preserve original test intent.
- Strengthen title, preconditions, test data, steps, and expected result.
- Replace subjective expected results with concrete observable assertions when possible.
- If concrete assertions cannot be inferred, mark them as missing information.
- Add missing negative, edge, regression, data/state, accessibility, or permission coverage when relevant.
- Explain what changed and why it improves QA value.
- Keep missing info and assumptions clearly separated.
`;

export function getQAS73RulesForTool(tool: QAToolPromptType): string {
  switch (tool) {
    case "tests":
      return `${QAS73_COMMON_GENERATOR_RULES}\n\n${QAS73_TEST_CASE_RULES}`;
    case "risk":
      return `${QAS73_COMMON_GENERATOR_RULES}\n\n${QAS73_RISK_REVIEW_RULES}`;
    case "bug":
      return `${QAS73_COMMON_GENERATOR_RULES}\n\n${QAS73_BUG_WRITER_RULES}`;
    case "improve":
      return `${QAS73_COMMON_GENERATOR_RULES}\n\n${QAS73_TEST_IMPROVER_RULES}`;
    default:
      return QAS73_COMMON_GENERATOR_RULES;
  }
}

export function buildQAS73PromptBlock(tool: QAToolPromptType): string {
  return `
${getQAS73RulesForTool(tool)}

Before returning JSON:
- Check whether the output contains vague filler.
- Replace subjective wording with observable QA checks.
- Do not add fake facts to improve the score.
- The generated artifact should improve the source through structure, specificity, and useful QA judgment.
`;
}
