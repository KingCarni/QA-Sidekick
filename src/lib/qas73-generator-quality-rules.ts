export type QAToolPromptType = "tests" | "risk" | "bug" | "improve";

export const QAS73_COMMON_GENERATOR_RULES = `
QAS-73 GENERATOR QUALITY RULES

The generated QA artifact must be better than the source in a practical QA sense.
Do not merely mirror, reformat, or create weak generic output from the source.

Preserve source facts:
- Treat Jira ticket fields, pasted requirements, project memory, uploaded source context, and user-provided notes as source-of-truth.
- Do not invent implementation details, hidden acceptance criteria, logs, evidence, customer impact, or root cause.
- You may suggest likely selectors only as automation hints, not as confirmed existing selectors.
- Label assumptions clearly.
- Put missing details in Missing Info / Follow-up Questions instead of pretending they are known.

Avoid low-value wording:
- Do not use "visually appealing" as an expected result.
- Do not use "user experiences confusion" as an expected result.
- Do not generate tests that only say "evaluate the UI presentation".
- Do not generate comparison tests against "preferred designs" unless a design reference is actually provided.
- Do not generate a regression test that requires a previous version unless the source provides one.
- Do not use generic titles such as "Happy Path", "Negative Test", "Validation Test", or "UI Test".
`;

export const QAS73_TEST_CASE_RULES = `
TEST CASE GENERATION RULES

Generate a practical handoff-ready test plan, not filler.

High-scoring test plans should include:
- app-specific behavior
- stable observable targets
- concrete setup/preconditions
- executable steps
- observable expected results
- negative/failure coverage
- data/state or regression coverage where relevant
- automation hints where possible

Each test case must include:
- title
- type
- priority
- preconditions
- steps
- expectedResult

Title rules:
- Name the exact behavior being tested.
- Bad: "Verify Input UI for Test Case Generation"
- Better: "Generate Test Cases from a Fetched Jira Ticket and Render Structured Case Cards"

Step rules:
- Steps must be executable by a tester.
- Avoid vague steps like "inspect the UI", "evaluate the UI", or "review formatting".
- Use concrete QAtalyst actions when applicable:
  - select a project
  - fetch a Jira ticket
  - paste requirement text
  - click Run Test Cases
  - verify generated test case cards
  - verify Before/After score panel
  - verify Automation Export counts
  - copy/export markdown or CSV
  - save report
  - answer follow-up questions
  - regenerate after adding context

Expected result rules:
- Expected result must be observable/assertable.
- Bad: "The UI is clean and readable."
- Better: "Each generated test case card displays title, type, priority, preconditions, steps, expected result, and automation readiness without overlapping or truncated text."
- Bad: "The API returns structured JSON."
- Better: "The response includes a non-empty testCases array, each item has title/type/priority/preconditions/steps/expectedResult, and qaFollowUpQuestions is present as an array."

Automation readiness rules:
- When the feature under test is a web app flow, include at least 2 cases that are likely automation candidates.
- Automation-candidate cases need deterministic actions and observable assertions.
- Include selector hints only as suggestions, for example:
  "Suggested automation targets: jira ticket input, fetch button, run test cases button, generated test case card, export markdown button."
- Manual/exploratory cases are allowed, but they should not dominate unless the source is subjective.
- If source is too vague, generate fewer stronger tests and ask follow-up questions instead of producing 8 generic cases.

For QAtalyst-specific tickets:
Prefer cases that validate actual QAtalyst value:
- fetched Jira source flows
- project context injection
- selected source relevance
- generated output structure
- follow-up question behavior
- scoring/quality panel consistency
- automation export count consistency
- markdown/CSV/export/save behavior
- stale-state/regeneration behavior
- error handling for missing/invalid Jira keys
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
- Keep follow-up questions low-noise and only ask questions that materially affect testing scope, release confidence, or implementation risk.
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
