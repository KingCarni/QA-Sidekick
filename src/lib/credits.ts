import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DAILY_REFRESH_CREDITS, SIGNUP_CREDITS } from "@/lib/credits-config";

export type CreditLedgerReason =
  | "signup_bonus" | "daily_bonus" | "purchase_starter" | "purchase_pro" | "purchase_team" | "purchase_addon" | "donation"
  | "tool_test_cases" | "tool_risk_review" | "tool_bug_writer" | "tool_test_improver" | "tool_feature_builder" | "tool_jira_creation" | "tool_refinement"
  | "admin_adjustment" | "refund";

function todayKeyUtc(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0, 10);
}

export async function getCreditBalance(userId: string) {
  if (!userId) return 0;
  const result = await prisma.creditsLedger.aggregate({ where: { userId }, _sum: { delta: true } });
  return result._sum.delta ?? 0;
}

export async function addCredits(args: { userId: string; delta: number; reason: CreditLedgerReason | string; ref?: string }) {
  const ref = args.ref?.trim() || undefined;
  try {
    return await prisma.creditsLedger.create({ data: { userId: args.userId, delta: args.delta, reason: args.reason, ref } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return null;
    throw error;
  }
}

export async function addCreditsIfMissing(args: { userId: string; delta: number; reason: CreditLedgerReason | string; ref: string }) {
  try {
    return await prisma.creditsLedger.upsert({
      where: { userId_ref: { userId: args.userId, ref: args.ref } },
      update: {},
      create: { userId: args.userId, delta: args.delta, reason: args.reason, ref: args.ref },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return null;
    throw error;
  }
}

export async function ensureSignupCredits(userId: string) {
  if (!userId) return;
  await addCreditsIfMissing({ userId, delta: SIGNUP_CREDITS, reason: "signup_bonus", ref: "signup_bonus" });
}

export async function ensureDailyRefreshCredits(userId: string) {
  if (!userId) return;
  const todayKey = todayKeyUtc();
  await addCreditsIfMissing({ userId, delta: DAILY_REFRESH_CREDITS, reason: "daily_bonus", ref: `daily_bonus:${todayKey}` });
  await prisma.user.update({ where: { id: userId }, data: { lastDailyBonusAt: new Date() } }).catch(() => null);
}

export async function ensureUserCreditBonuses(userId: string) {
  if (!userId) return;
  await ensureSignupCredits(userId);
}

export async function spendCredits(args: { userId: string; amount: number; reason: CreditLedgerReason | string; ref: string }) {
  if (!args.userId) return { ok: false as const, balance: 0, error: "User is required." };
  if (args.amount <= 0) return { ok: true as const, balance: await getCreditBalance(args.userId) };
  return prisma.$transaction(async (tx) => {
    const result = await tx.creditsLedger.aggregate({ where: { userId: args.userId }, _sum: { delta: true } });
    const balance = result._sum.delta ?? 0;
    if (balance < args.amount) {
      return { ok: false as const, balance, error: `Not enough credits. You have ${balance}, but this action costs ${args.amount}.` };
    }
    try {
      await tx.creditsLedger.create({ data: { userId: args.userId, delta: -args.amount, reason: args.reason, ref: args.ref } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { ok: true as const, balance };
      throw error;
    }
    return { ok: true as const, balance: balance - args.amount };
  });
}
