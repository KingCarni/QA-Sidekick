import type { NextAuthOptions } from "next-auth";
import { Prisma } from "@prisma/client";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import { getOptionalEnv, isGoogleAuthConfigured } from "@/lib/env";

const SIGNUP_BONUS = 25;
const DAILY_LOGIN_BONUS = 5;

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
  try {
    await prisma.$transaction([
      prisma.creditsLedger.upsert({
        where: {
          userId_ref: {
            userId: args.userId,
            ref: args.ref,
          },
        },
        update: {},
        create: {
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
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return;
    throw error;
  }
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
    reason: "daily_bonus",
    ref: `daily_bonus:${todayKey}`,
    meta: { email, dayUtc: todayKey },
  });
}

const providers: NextAuthOptions["providers"] = [];

if (isGoogleAuthConfigured()) {
  providers.push(
    GoogleProvider({
      clientId: getOptionalEnv("GOOGLE_CLIENT_ID"),
      clientSecret: getOptionalEnv("GOOGLE_CLIENT_SECRET"),
    })
  );
} else if (process.env.NODE_ENV !== "production") {
  console.warn("[auth] Google OAuth is not configured. Sign-in will be unavailable until GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set.");
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  providers,
  session: { strategy: "jwt" },
  secret: getOptionalEnv("NEXTAUTH_SECRET") || undefined,

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
