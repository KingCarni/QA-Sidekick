// src/lib/paid-action.ts
// QAS-126 Pass 1e
// Helper for paid API routes: preflight balance check, run work, then charge only on success.

import { randomUUID } from "crypto";
import type { CreditActionId } from "@/lib/credits-config";
import {
  ensureSufficientCredits,
  InsufficientCreditsError,
  spendCredits,
  type SpendCreditsResult,
} from "@/lib/credits-service";

type JsonRecord = Record<string, unknown>;

export function makeCreditRef(action: CreditActionId, requestId?: string) {
  return `${action}:${String(requestId || randomUUID()).slice(0, 180)}`;
}

export async function runPaidAction<T>(args: {
  userId: string;
  action: CreditActionId;
  requestId?: string;
  costOverride?: number;
  meta?: JsonRecord;
  work: () => Promise<T>;
}): Promise<T & { creditSpend: SpendCreditsResult }> {
  await ensureSufficientCredits({ userId: args.userId, action: args.action, costOverride: args.costOverride });

  // Important: work runs before spend. If AI/Jira/etc. fails, no credits are deducted.
  const result = await args.work();

  const creditSpend = await spendCredits({
    userId: args.userId,
    action: args.action,
    ref: makeCreditRef(args.action, args.requestId),
    costOverride: args.costOverride,
    meta: args.meta,
  });

  if (typeof result === "object" && result !== null && !Array.isArray(result)) {
    return { ...(result as T), creditSpend };
  }

  return { value: result, creditSpend } as unknown as T & { creditSpend: SpendCreditsResult };
}

export function isInsufficientCreditsError(error: unknown): error is InsufficientCreditsError {
  return error instanceof InsufficientCreditsError;
}

export function insufficientCreditsPayload(error: InsufficientCreditsError) {
  return {
    ok: false,
    error: "INSUFFICIENT_CREDITS",
    message: error.message,
    action: error.action,
    required: error.required,
    balance: error.balance,
  };
}
