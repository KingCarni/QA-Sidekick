import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function toJsonObject(meta?: Record<string, unknown>): Prisma.InputJsonObject {
  return (meta ?? {}) as Prisma.InputJsonObject;
}

export async function getCreditBalance(userId: string) {
  const agg = await prisma.creditsLedger.aggregate({
    where: { userId },
    _sum: { delta: true },
  });

  return agg._sum.delta ?? 0;
}

export async function grantCredits(args: {
  userId: string;
  amount: number;
  reason: string;
  ref?: string;
  meta?: Record<string, unknown>;
}) {
  const amount = Math.abs(Number(args.amount) || 0);
  if (!args.userId || amount <= 0) {
    return { ok: false as const, error: "Invalid credit grant." };
  }

  if (args.ref) {
    const existing = await prisma.creditsLedger.findUnique({
      where: {
        userId_ref: {
          userId: args.userId,
          ref: args.ref,
        },
      },
      select: { id: true },
    });

    if (existing) {
      return { ok: true as const, alreadyApplied: true as const };
    }
  }

  await prisma.$transaction([
    prisma.creditsLedger.create({
      data: {
        userId: args.userId,
        delta: amount,
        reason: args.reason,
        ref: args.ref,
      },
    }),
    prisma.event.create({
      data: {
        userId: args.userId,
        type: args.reason,
        metaJson: toJsonObject(args.meta),
      },
    }),
  ]);

  return { ok: true as const, alreadyApplied: false as const };
}

export async function chargeCredits(args: {
  userId: string;
  cost: number;
  reason: string;
  ref?: string;
  meta?: Record<string, unknown>;
}) {
  const cost = Math.abs(Number(args.cost) || 0);
  if (!args.userId || cost <= 0) {
    return { ok: false as const, error: "Invalid credit charge.", balance: 0 };
  }

  if (args.ref) {
    const existing = await prisma.creditsLedger.findFirst({
      where: {
        userId: args.userId,
        ref: args.ref,
        delta: { lt: 0 },
      },
      select: { id: true },
    });

    if (existing) {
      const balance = await getCreditBalance(args.userId);
      return { ok: true as const, balance, alreadyApplied: true as const };
    }
  }

  return prisma.$transaction(async (tx) => {
    const agg = await tx.creditsLedger.aggregate({
      where: { userId: args.userId },
      _sum: { delta: true },
    });
    const balance = agg._sum.delta ?? 0;

    if (balance < cost) {
      return { ok: false as const, error: "Insufficient credits.", balance };
    }

    await tx.creditsLedger.create({
      data: {
        userId: args.userId,
        delta: -cost,
        reason: args.reason,
        ref: args.ref,
      },
    });

    await tx.event.create({
      data: {
        userId: args.userId,
        type: args.reason,
        metaJson: toJsonObject({
          ...(args.meta ?? {}),
          amount: cost,
          direction: "debit",
          ref: args.ref,
        }),
      },
    });

    return { ok: true as const, balance: balance - cost, alreadyApplied: false as const };
  });
}
