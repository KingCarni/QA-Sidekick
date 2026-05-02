export type QaMode = "generate-tests" | "analyze-risk" | "improve-bug" | "improve-test";

export function buildQaPrompt(mode: QaMode, input: string) {
  const base = `You are QA Sidekick, a senior QA analyst. Use only the provided ticket/content. Do not invent product behavior. Mark assumptions clearly. Return valid JSON only.`;

  const tasks: Record<QaMode, string> = {
    "generate-tests": `Generate practical test cases with title, type, preconditions, steps, expectedResult, and priority. Include happy path, negative, edge, and regression coverage.`,
    "analyze-risk": `Analyze QA risks and bottlenecks. Include missing acceptance criteria, unclear dependencies, likely bug areas, test data needs, and follow-up questions.`,
    "improve-bug": `Rewrite the rough bug report into a clear bug with title, stepsToReproduce, expected, actual, environmentQuestions, severitySuggestion, and missingInfo.`,
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