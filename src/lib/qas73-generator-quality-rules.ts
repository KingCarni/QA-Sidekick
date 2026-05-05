export const QAS73_COMMON_GENERATOR_RULES = `
QAS-73 generation quality rules:

Improve the generated QA artifact. Do not merely reformat the source.

Preserve source facts:
- Treat the user's Jira ticket, pasted requirement, bug report, project context, and source vault context as source-of-truth.
- Do not invent completed product behavior, production incidents, customer impact, logs, evidence, implementation details, selectors, routes, or hidden acceptance criteria.
- When something is inferred, label it as an assumption.
- When something is missing, call it out as missing info or a follow-up question.

Make the output score well for real reasons:
- Add concrete setup/preconditions when the source supports them.
- Add specific user/data/platform/role scope where the source supports it.
- Add observable assertions instead of generic "works correctly" wording.
- Add negative, edge, data/state, permission/auth, regression, and failure-mode coverage only when relevant.
- Prefer fewer high-quality items over many vague items.
- Avoid generic titles such as "Happy Path", "Negative Test", or "Validation Test". Titles must name the behavior being tested.
`;

export const QAS73_TEST_CASE_RULES = `
For Test Cases:
- Generate behavior-specific test cases with clear titles.
- Each test case must include type, priority, preconditions, steps, and expected result.
- Steps must be executable. Avoid vague steps like "test the feature" or "verify functionality".
- Expected results must be observable and assertable.
- Add at least one primary success-path test when the source has enough information.
- Add relevant negative/error tests if the source mentions invalid states, missing config, access failure, or broken behavior.
- Add regression tests when existing behavior or prior functionality could be affected.
- Add data/state tests when persistence, reload, sync, metadata, project/source selection, or saved output is involved.
- If the source is thin, generate a solid starter suite but include low-noise follow-up questions for the missing details.
`;

export const QAS73_RISK_REVIEW_RULES = `
For Risk Review:
- Do not produce generic risk language.
- Identify concrete risk areas from the source: requirement clarity, regression, data/state, auth/access, dependencies, failure modes, evidence gaps, release impact.
- For each material risk, include why it matters, what signal was detected, and the recommended QA action.
- Mention severity/impact only when supported by the source; otherwise label it as an assumption.
- If the source is a bug ticket, recognize its Jira structure and bug fields before judging it as thin.
- Ask follow-up questions only when the answer would materially change test scope, release confidence, or implementation risk.
`;

export const QAS73_BUG_WRITER_RULES = `
For Bug Writer:
- Separate confirmed facts from assumptions.
- Produce a concise title/summary that states what failed, where, and when.
- Include expected result and actual result as separate sections.
- Include reproduction steps. If source does not provide enough repro detail, write the best safe repro and mark missing details.
- Include environment, build/version, device/browser, repro rate, logs/screenshots, and evidence only when provided; otherwise list them as missing info.
- Do not fabricate logs, screenshots, affected users, severity, or exact root cause.
- Include impact in grounded language, not exaggerated language.
`;

export const QAS73_TEST_IMPROVER_RULES = `
For Test Improver:
- Preserve the original test intent.
- Improve the test materially, not just cosmetically.
- Strengthen title, preconditions, test data, steps, and expected result.
- Add missing negative, edge, regression, data/state, or permission coverage when relevant.
- Explain what changed and why it improves QA value.
- Keep missing info and assumptions clearly separated.
`;
