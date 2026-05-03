import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFIG_ERROR"
  | "VALIDATION_ERROR"
  | "INSUFFICIENT_CREDITS"
  | "RATE_LIMITED"
  | "UPSTREAM_ERROR"
  | "INTERNAL_ERROR";

export type ApiErrorPayload = {
  ok: false;
  error: string;
  code: ApiErrorCode;
  requestId: string;
  details?: unknown;
};

export type ApiSuccessPayload<T> = {
  ok: true;
  requestId: string;
} & T;

export function getRequestId(req?: Request) {
  const existing =
    req?.headers.get("x-request-id") ||
    req?.headers.get("x-vercel-id") ||
    req?.headers.get("cf-ray") ||
    "";

  if (existing.trim()) return existing.trim();

  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function noStoreHeaders(requestId?: string) {
  return {
    "Cache-Control": "no-store, max-age=0",
    ...(requestId ? { "X-Request-Id": requestId } : {}),
  };
}

export function apiOk<T extends Record<string, unknown>>(
  req: Request | undefined,
  payload: T,
  init?: ResponseInit
) {
  const requestId = getRequestId(req);

  return NextResponse.json(
    {
      ok: true,
      requestId,
      ...payload,
    } satisfies ApiSuccessPayload<T>,
    {
      ...init,
      headers: {
        ...noStoreHeaders(requestId),
        ...(init?.headers ?? {}),
      },
    }
  );
}

export function apiError(
  req: Request | undefined,
  args: {
    status?: number;
    code?: ApiErrorCode;
    message: string;
    details?: unknown;
  }
) {
  const requestId = getRequestId(req);
  const status = args.status ?? 500;

  const body: ApiErrorPayload = {
    ok: false,
    error: args.message,
    code: args.code ?? (status >= 500 ? "INTERNAL_ERROR" : "BAD_REQUEST"),
    requestId,
  };

  if (args.details !== undefined && process.env.NODE_ENV !== "production") {
    body.details = args.details;
  }

  return NextResponse.json(body, {
    status,
    headers: noStoreHeaders(requestId),
  });
}

export function getErrorMessage(error: unknown, fallback = "Something went wrong.") {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

export function getErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return error;
}

export async function readJsonBody<T extends object = Record<string, unknown>>(req: Request) {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}
