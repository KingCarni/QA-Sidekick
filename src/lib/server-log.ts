import { getErrorDetails, getRequestId } from "@/lib/api-response";

type LogLevel = "info" | "warn" | "error";

type LogContext = {
  requestId?: string;
  route?: string;
  action?: string;
  userId?: string | null;
  status?: number;
  durationMs?: number;
  meta?: Record<string, unknown>;
  error?: unknown;
};

function cleanMeta(meta?: Record<string, unknown>) {
  if (!meta) return undefined;

  const safe: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(meta)) {
    const lower = key.toLowerCase();

    if (
      lower.includes("secret") ||
      lower.includes("token") ||
      lower.includes("password") ||
      lower.includes("authorization") ||
      lower.includes("cookie")
    ) {
      safe[key] = "[redacted]";
      continue;
    }

    safe[key] = value;
  }

  return safe;
}

function write(level: LogLevel, message: string, context: LogContext = {}) {
  const requestId = context.requestId || getRequestId();
  const payload = {
    app: "QAtalyst",
    level,
    message,
    requestId,
    route: context.route,
    action: context.action,
    userId: context.userId ?? undefined,
    status: context.status,
    durationMs: context.durationMs,
    meta: cleanMeta(context.meta),
    error: context.error ? getErrorDetails(context.error) : undefined,
    at: new Date().toISOString(),
  };

  if (level === "error") {
    console.error("[qatalyst]", JSON.stringify(payload));
    return;
  }

  if (level === "warn") {
    console.warn("[qatalyst]", JSON.stringify(payload));
    return;
  }

  console.info("[qatalyst]", JSON.stringify(payload));
}

export const serverLog = {
  info(message: string, context?: LogContext) {
    write("info", message, context);
  },

  warn(message: string, context?: LogContext) {
    write("warn", message, context);
  },

  error(message: string, context?: LogContext) {
    write("error", message, context);
  },
};

export function nowMs() {
  return Date.now();
}

export function durationSince(startMs: number) {
  return Date.now() - startMs;
}
