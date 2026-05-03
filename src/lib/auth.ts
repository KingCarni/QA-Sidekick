import type { NextAuthOptions } from "next-auth";
import type { Prisma } from "@prisma/client";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

const SIGNUP_BONUS = 25;
const DAILY_LOGIN_BONUS = 10;

function todayKeyUtc(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

function toJsonObject(meta?: Record<string, unknown>): Prisma.InputJsonObject {
  return (meta ?? {}) as Prisma.InputJsonObject;
}

async function resolveUserId(user: unknown) {
  const candidate = user as { id?: string; email?: string } | null;
  const email = String(candidate?.email ?? "").trim().toLowerCase();
  let userId = String(candidate?.id ?? "").trim();

  if (!userId && email) {
    const dbUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    userId = dbUser?.id ?? "";
  }

  return { userId, email };
}

async function grantCreditIfMissing(args: {
  userId: string;
  delta: number;
  reason: string;
  ref: string;
  meta?: Record<string, unknown>;
}) {
  const existing = await prisma.creditsLedger.findUnique({
    where: {
      userId_ref: {
        userId: args.userId,
        ref: args.ref,
      },
    },
    select: { id: true },
  });

  if (existing) return;

  await prisma.$transaction([
    prisma.creditsLedger.create({
      data: {
        userId: args.userId,
        delta: args.delta,
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
}

async function ensureUserBonuses(user: unknown) {
  const { userId, email } = await resolveUserId(user);
  if (!userId) return;

  await grantCreditIfMissing({
    userId,
    delta: SIGNUP_BONUS,
    reason: "signup_bonus",
    ref: "signup_bonus",
    meta: { email },
  });

  const todayKey = todayKeyUtc();

  await grantCreditIfMissing({
    userId,
    delta: DAILY_LOGIN_BONUS,
    reason: "daily_login_bonus",
    ref: `daily_login_bonus:${todayKey}`,
    meta: { email, dayUtc: todayKey },
  });
}

const providers = [];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  providers,
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,

  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.uid = user.id;
      }

      return token;
    },

    async session({ session, token }) {
      const uid = typeof token.uid === "string" ? token.uid : "";

      if (session.user && uid) {
        session.user.id = uid;
      }

      if (uid) {
        await ensureUserBonuses({ id: uid, email: session.user?.email });
      }

      return session;
    },
  },

  events: {
    async signIn(message) {
      await ensureUserBonuses(message.user);
    },
  },
};
