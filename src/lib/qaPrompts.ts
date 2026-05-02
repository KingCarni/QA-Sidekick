export type QaMode = "generate-tests" | "analyze-risk" | "improve-bug" | "improve-test";

export function buildQaPrompt(mode: QaMode, input: string) {
  const base = `You are QA Sidekick, a senior QA analyst. Use only the provided ticket/content. Do not invent product behavior. Mark assumptions clearly. Return valid JSON only.`;

  const tasks: Record<QaMode, string> = {
    "generate-tests": `Generate practical test cases with title, type, preconditions, steps, expectedResult, and priority. Include happy path, negative, edge, and regression coverage. Return JSON with a top-level testCases array.`,
    "analyze-risk": `Analyze QA risks and bottlenecks. Include missing acceptance criteria, unclear dependencies, likely bug areas, test data needs, and follow-up questions.`,
    "improve-bug": `Rewrite the rough bug report into a clear bug report. Do not invent missing facts. Return JSON with a top-level bugReport object.`,
    "improve-test": `Improve the provided test case or checklist. Preserve intent. Add clearer steps, expected results, edge cases, and missing preconditions.`
  };

  return `${base}\n\nTask: ${tasks[mode]}\n\nInput:\n${input}`;
}

export function buildRiskAnalysisPrompt(input: string) {
  return `
You are a senior QA analyst reviewing a Jira ticket, user story, or requirements document before development begins.

Your job is to identify QA risk, ambiguity, bottlenecks, missing acceptance criteria, and test focus areas.

Return ONLY valid JSON. Do not include markdown. Do not include explanations outside JSON.

Use this exact JSON shape:

{
  "riskReview": {
    "overallRisk": "Low | Medium | High",
    "summary": "Short plain-English summary of the main QA concern.",
    "keyRisks": [
      {
        "title": "Risk title",
        "severity": "Low | Medium | High",
        "area": "UX | Data | Permissions | State | Integration | Performance | Regression | Requirements | Other",
        "whyItMatters": "Why this could cause bugs or delivery issues.",
        "mitigation": "How QA/product/dev can reduce this risk."
      }
    ],
    "bottlenecks": [
      {
        "title": "Bottleneck title",
        "impact": "Low | Medium | High",
        "owner": "QA | Dev | Product | Design | Data | Unknown",
        "recommendation": "Specific recommendation to unblock or reduce risk."
      }
    ],
    "missingAcceptanceCriteria": [
      "Specific missing acceptance criterion or unclear behavior."
    ],
    "qaFollowUpQuestions": [
      "Question QA should ask product/dev before testing starts."
    ],
    "suggestedTestFocus": [
      "Area QA should prioritize during testing."
    ]
  }
}

Rules:
- Do not invent product behavior as fact.
- If something is unclear, mark it as unclear and add a follow-up question.
- Be practical and concise.
- Focus on what a senior QA would catch before implementation.
- Prefer 3-6 key risks.
- Prefer 2-5 bottlenecks.
- Prefer 3-6 follow-up questions.
- Prefer 3-6 suggested test focus areas.

Ticket / requirements input:
${input}
`;
}

export function buildBugReportPrompt(input: string) {
  return `
You are a senior QA analyst turning rough bug notes into a clean, actionable bug report.

Return ONLY valid JSON. Do not include markdown. Do not include explanations outside JSON.

Use this exact JSON shape:

{
  "bugReport": {
    "title": "Clear, concise bug title",
    "severitySuggestion": "Low | Medium | High | Critical",
    "prioritySuggestion": "Low | Medium | High",
    "summary": "Short plain-English summary of the issue.",
    "environment": "Known environment details. If unknown, say what is missing.",
    "stepsToReproduce": [
      "Step 1",
      "Step 2",
      "Step 3"
    ],
    "expectedResult": "What should happen.",
    "actualResult": "What actually happens.",
    "impact": "Why this matters to users, QA, product, or delivery.",
    "missingInfo": [
      "Specific missing detail needed to make the bug fully actionable."
    ],
    "followUpQuestions": [
      "Specific question QA should ask to make the bug report more actionable."
    ],
    "qaNotes": [
      "Useful QA note, assumption, retest note, or investigation suggestion."
    ]
  }
}

Rules:
- Use only the information provided in the bug notes and any additional answers/context supplied by the user.
- If the input includes "Structured environment/context fields", use those fields to improve the Environment section and severity/priority reasoning.
- If the input includes "Evidence attachments, screenshots, logs, or links", include useful evidence references in qaNotes and use evidence details to improve impact/repro clarity.
- If logs are provided, summarize relevant error messages or patterns in qaNotes without dumping the entire log.
- If screenshots are attached, use only visible screenshot evidence and do not invent unseen interactions.
- If the input includes "Answered follow-up questions", use those answers to improve the report.
- If the input includes "Additional freeform context", use that context to improve the report.
- Do not invent environment, browser, user role, data state, device, frequency, or exact repro details.
- If a detail is missing, put it in missingInfo instead of pretending it exists.
- Add practical followUpQuestions that QA/product/dev should answer before triage or retest.
- If the user already answered a question in the structured fields, evidence notes, answered follow-ups, or additional context, incorporate the answer into the relevant report fields and do not ask that same question again unless more detail is still needed.
- Treat answers like "no", "none", "N/A", "not applicable", "no logs", and "no workaround" as valid answers. Do not convert those into missing info or repeat the same question.
- Distinguish "not sure" from "no": "not sure" means uncertainty and can remain a follow-up; "no" means the question was answered negatively.
- Follow-up questions should focus on repro consistency, environment/build, logs, account/data setup, affected scope, workaround, expected behavior, and severity/priority uncertainty.
- If steps are unclear, create the best practical step list from the notes and flag uncertainty in missingInfo, followUpQuestions, or qaNotes.
- Keep the title specific and bug-like.
- Severity should reflect user impact, data loss, blocking behavior, workaround availability, and affected scope.
- Priority should reflect likely business/product urgency, but mark uncertainty if unclear.
- Prefer concise, Jira-ready language.

Rough bug notes:
${input}
`;
}
