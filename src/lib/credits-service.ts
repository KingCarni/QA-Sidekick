// src/lib/credits-service.ts
// QAS-126 Pass 1e
// Server-side credit balance, preflight checks, and ledger-backed spending.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CREDIT_ACTIONS, type CreditActionId, getCreditAction } from "@/lib/credits-config";

type JsonRecord = Record<string, unknown>;

function asJsonObject(value: JsonRecord): Prisma.InputJsonObject {
  return value as Prisma.InputJsonObject;
}

function cleanRef(value: unknown): string {
  return String(value ?? "").trim().slice(0, 220);
}

function isPrismaUniqueError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export class InsufficientCreditsError extends Error {
  readonly status = 402;
  readonly code = "INSUFFICIENT_CREDITS";
  readonly balance: number;
  readonly required: number;
  readonly action: CreditActionId;

  constructor(args: { action: CreditActionId; balance: number; required: number }) {
    super(`Insufficient credits. ${args.required} required, ${args.balance} available.`);
    this.name = "InsufficientCreditsError";
    this.action = args.action;
    this.balance = args.balance;
    this.required = args.required;
  }
}

export async function getCreditBalance(userId: string): Promise<number> {
  if (!userId) return 0;

  const aggregate = await prisma.creditsLedger.aggregate({
    where: { userId },
    _sum: { delta: true },
  });

  return aggregate._sum.delta ?? 0;
}

export async function getCreditSnapshot(userId: string) {
  const balance = await getCreditBalance(userId);

  return {
    balance,
    actions: CREDIT_ACTIONS,
  };
}

export async function ensureSufficientCredits(args: {
  userId: string;
  action: CreditActionId;
  costOverride?: number;
}): Promise<{ ok: true; balance: number; required: number }> {
  const required = Math.max(1, Math.trunc(args.costOverride ?? getCreditAction(args.action).cost));
  const balance = await getCreditBalance(args.userId);

  if (balance < required) {
    throw new InsufficientCreditsError({ action: args.action, balance, required });
  }

  return { ok: true, balance, required };
}

export type SpendCreditsResult = {
  ok: true;
  action: CreditActionId;
  cost: number;
  balanceBefore: number;
  balanceAfter: number;
  alreadyApplied: boolean;
  ref: string;
};

export async function spendCredits(args: {
  userId: string;
  action: CreditActionId;
  ref: string;
  costOverride?: number;
  meta?: JsonRecord;
}): Promise<SpendCreditsResult> {
  const userId = String(args.userId ?? "").trim();
  const action = getCreditAction(args.action);
  const cost = Math.max(1, Math.trunc(args.costOverride ?? action.cost));
  const ref = cleanRef(args.ref);

  if (!userId) {
    throw new Error("Missing userId for credit spend.");
  }

  if (!ref) {
    throw new Error("Missing idempotency ref for credit spend.");
  }

  const existing = await prisma.creditsLedger.findFirst({
    where: {
      userId,
      ref,
      delta: { lt: 0 },
    },
    select: { id: true },
  });

  if (existing) {
    const balance = await getCreditBalance(userId);
    return {
      ok: true,
      action: action.id,
      cost,
      balanceBefore: balance,
      balanceAfter: balance,
      alreadyApplied: true,
      ref,
    };
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        const aggregate = await tx.creditsLedger.aggregate({
          where: { userId },
          _sum: { delta: true },
        });

        const balanceBefore = aggregate._sum.delta ?? 0;

        if (balanceBefore < cost) {
          throw new InsufficientCreditsError({
            action: action.id,
            balance: balanceBefore,
            required: cost,
          });
        }

        await tx.creditsLedger.create({
          data: {
            userId,
            delta: -cost,
            reason: action.reason,
            ref,
          },
        });

        const balanceAfter = balanceBefore - cost;

        await tx.event.create({
          data: {
            userId,
            type: "credits_spent",
            metaJson: asJsonObject({
              action: action.id,
              label: action.label,
              cost,
              baseCost: action.cost,
              isMetered: args.costOverride != null,
              reason: action.reason,
              ref,
              balanceBefore,
              balanceAfter,
              ...(args.meta ?? {}),
            }),
          },
        });

        return {
          ok: true,
          action: action.id,
          cost,
          balanceBefore,
          balanceAfter,
          alreadyApplied: false,
          ref,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (isPrismaUniqueError(error)) {
      const balance = await getCreditBalance(userId);
      return {
        ok: true,
        action: action.id,
        cost,
        balanceBefore: balance,
        balanceAfter: balance,
        alreadyApplied: true,
        ref,
      };
    }

    throw error;
  }
}

export async function refundCredits(args: {
  userId: string;
  amount: number;
  reason: string;
  ref: string;
  meta?: JsonRecord;
}) {
  const userId = String(args.userId ?? "").trim();
  const amount = Math.trunc(Math.abs(Number(args.amount) || 0));
  const ref = cleanRef(args.ref);

  if (!userId) throw new Error("Missing userId for credit refund.");
  if (!amount) return { ok: true, amount: 0, balanceAfter: await getCreditBalance(userId) };
  if (!ref) throw new Error("Missing idempotency ref for credit refund.");

  const existing = await prisma.creditsLedger.findFirst({
    where: {
      userId,
      ref,
      delta: { gt: 0 },
    },
    select: { id: true },
  });

  if (existing) {
    return { ok: true, amount, balanceAfter: await getCreditBalance(userId), alreadyApplied: true };
  }

  await prisma.$transaction(async (tx) => {
    await tx.creditsLedger.create({
      data: {
        userId,
        delta: amount,
        reason: args.reason,
        ref,
      },
    });

    await tx.event.create({
      data: {
        userId,
        type: "credits_refunded",
        metaJson: asJsonObject({
          amount,
          reason: args.reason,
          ref,
          ...(args.meta ?? {}),
        }),
      },
    });
  });

  return { ok: true, amount, balanceAfter: await getCreditBalance(userId), alreadyApplied: false };
}
