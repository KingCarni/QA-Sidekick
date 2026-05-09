import { getServerSession } from "next-auth";
import { apiError, apiOk, getErrorMessage } from "@/lib/api-response";
import { authOptions } from "@/lib/auth";
import { normalizeJiraErrorMessage } from "@/lib/jira-error-normalizer";
import { getUserJiraConfigStatus } from "@/lib/jira-config";
import { uploadJiraIssueAttachments } from "@/lib/jira-attachments";
import { durationSince, nowMs, serverLog } from "@/lib/server-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    key: string;
  }>;
};

const MAX_ATTACHMENT_COUNT = 5;
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;

async function getSignedInUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

function isAllowedAttachment(file: File) {
  const allowedTypes = [
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "text/plain",
    "text/csv",
    "application/json",
    "application/pdf",
    "application/zip",
    "application/x-zip-compressed",
  ];

  if (allowedTypes.includes(file.type)) return true;

  return /\.(png|jpe?g|webp|gif|txt|log|csv|json|pdf|zip)$/i.test(file.name);
}

export async function POST(req: Request, context: RouteContext): Promise<Response> {
  const startedAt = nowMs();
  const route = "/api/jira/issues/[key]/attachments";

  try {
    const userId = await getSignedInUserId();

    if (!userId) {
      return apiError(req, {
        status: 401,
        code: "UNAUTHORIZED",
        message: "Please sign in before uploading Jira attachments.",
      });
    }

    const { key } = await context.params;
    const issueKey = String(key ?? "").trim();

    if (!issueKey) {
      return apiError(req, {
        status: 400,
        code: "VALIDATION_ERROR",
        message: "Missing Jira issue key.",
      });
    }

    const jiraStatus = await getUserJiraConfigStatus(userId);

    if (!jiraStatus.configured || !jiraStatus.config) {
      return apiError(req, {
        status: 400,
        code: "VALIDATION_ERROR",
        message:
          jiraStatus.missingFields.length > 0
            ? `Jira config is missing: ${jiraStatus.missingFields.join(", ")}.`
            : "Jira is not configured.",
      });
    }

    const formData = await req.formData();
    const files = formData
      .getAll("file")
      .filter((item): item is File => item instanceof File && item.size > 0);

    if (files.length === 0) {
      return apiError(req, {
        status: 400,
        code: "VALIDATION_ERROR",
        message: "Select at least one file before uploading Jira attachments.",
      });
    }

    if (files.length > MAX_ATTACHMENT_COUNT) {
      return apiError(req, {
        status: 400,
        code: "VALIDATION_ERROR",
        message: `Upload up to ${MAX_ATTACHMENT_COUNT} files at a time.`,
      });
    }

    const oversizedFile = files.find((file) => file.size > MAX_ATTACHMENT_SIZE_BYTES);
    if (oversizedFile) {
      return apiError(req, {
        status: 400,
        code: "VALIDATION_ERROR",
        message: `${oversizedFile.name} is too large. Max attachment size is 10MB for this MVP pass.`,
      });
    }

    const blockedFile = files.find((file) => !isAllowedAttachment(file));
    if (blockedFile) {
      return apiError(req, {
        status: 400,
        code: "VALIDATION_ERROR",
        message: `${blockedFile.name} is not an allowed attachment type.`,
      });
    }

    const result = await uploadJiraIssueAttachments({
      config: jiraStatus.config,
      issueKey,
      files,
    });

    if (!result.ok) {
      serverLog.warn("Jira attachment upload failed.", {
        route,
        userId,
        status: result.status,
        durationMs: durationSince(startedAt),
        meta: {
          issueKey,
          fileCount: files.length,
          error: result.error,
        },
      });

      return apiError(req, {
        status: result.status >= 400 && result.status < 600 ? result.status : 502,
        code: "UPSTREAM_ERROR",
        message: normalizeJiraErrorMessage(result.error),
        details: {
          jira: result.details,
          attachments: result.attachments,
        },
      });
    }

    serverLog.info("Jira attachments uploaded.", {
      route,
      userId,
      status: 200,
      durationMs: durationSince(startedAt),
      meta: {
        issueKey,
        fileCount: result.attachments.length,
      },
    });

    return apiOk(req, {
      attachments: result.attachments,
    });
  } catch (error) {
    serverLog.error("Jira attachment route failed.", {
      route,
      status: 500,
      durationMs: durationSince(startedAt),
      error,
    });

    return apiError(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      message: normalizeJiraErrorMessage(error, getErrorMessage(error, "Could not upload Jira attachments.")),
    });
  }
}
