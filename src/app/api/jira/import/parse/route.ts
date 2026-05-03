import { apiError, apiOk, readJsonBody } from "@/lib/api-response";
import { parseJiraTicket } from "@/lib/jira-ticket";
import { durationSince, nowMs, serverLog } from "@/lib/server-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ParseJiraImportBody = {
  text?: unknown;
};

export async function POST(req: Request) {
  const startedAt = nowMs();
  const route = "/api/jira/import/parse";

  try {
    const body = await readJsonBody<ParseJiraImportBody>(req);
    const text = typeof body.text === "string" ? body.text : "";

    if (!text.trim()) {
      return apiError(req, {
        status: 400,
        code: "VALIDATION_ERROR",
        message: "Paste Jira ticket text before importing.",
      });
    }

    if (text.length > 25000) {
      return apiError(req, {
        status: 400,
        code: "VALIDATION_ERROR",
        message: "Jira ticket text is too long. Please paste a smaller ticket or remove unrelated content.",
      });
    }

    const ticket = parseJiraTicket(text);

    serverLog.info("Jira ticket text parsed.", {
      route,
      status: 200,
      durationMs: durationSince(startedAt),
      meta: {
        hasKey: Boolean(ticket.key),
        hasSummary: Boolean(ticket.summary),
        acceptanceCriteriaCount: ticket.acceptanceCriteria.length,
        confidence: ticket.confidence,
        missingFieldCount: ticket.missingFields.length,
      },
    });

    return apiOk(req, { ticket });
  } catch (error) {
    serverLog.error("Jira ticket parse failed.", {
      route,
      status: 500,
      durationMs: durationSince(startedAt),
      error,
    });

    return apiError(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Could not parse Jira ticket text.",
    });
  }
}
