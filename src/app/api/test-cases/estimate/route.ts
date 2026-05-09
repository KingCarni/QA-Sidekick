import { apiError, apiOk, readJsonBody } from "@/lib/api-response";
import { getTestCaseCostSummary, normalizeRequestedTestCaseCount } from "@/lib/test-case-credit-meter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReqBody = {
  requestedCount?: unknown;
  prompt?: unknown;
};

function estimateFromPrompt(prompt: string): number {
  const text = prompt.toLowerCase();
  const explicitMatch =
    text.match(/(?:generate|create|write|make)\s+(\d+)\s+(?:test\s+)?cases?/) ||
    text.match(/(\d+)\s+(?:test\s+)?cases?/);

  if (explicitMatch?.[1]) return normalizeRequestedTestCaseCount(explicitMatch[1], 10);

  const scenarioHints = ["edge case", "negative", "regression", "accessibility", "mobile", "desktop", "api", "permissions", "auth", "payment", "jira", "testrail"];
  const hintCount = scenarioHints.filter((hint) => text.includes(hint)).length;

  if (hintCount >= 8 || text.length > 2500) return 20;
  if (hintCount >= 5 || text.length > 1500) return 15;
  return 10;
}

export async function POST(req: Request) {
  const body = await readJsonBody<ReqBody>(req);
  const prompt = String(body.prompt ?? "");

  if (!prompt.trim()) {
    return apiError(req, {
      status: 400,
      code: "VALIDATION_ERROR",
      message: "Add a prompt or Jira ticket content before estimating test cases.",
    });
  }

  const estimatedCount =
    body.requestedCount != null
      ? normalizeRequestedTestCaseCount(body.requestedCount, 10)
      : estimateFromPrompt(prompt);

  return apiOk(req, getTestCaseCostSummary(estimatedCount));
}
