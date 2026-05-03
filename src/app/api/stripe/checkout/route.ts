import type { Prisma } from "@prisma/client";
import Stripe from "stripe";
import { getServerSession } from "next-auth";
import { apiError, apiOk, getErrorMessage, readJsonBody } from "@/lib/api-response";
import { authOptions } from "@/lib/auth";
import { getAppBaseUrl, requireStripeSecretKey } from "@/lib/env";
import { durationSince, nowMs, serverLog } from "@/lib/server-log";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Pack = "standard" | "plus" | "pro" | "premium";

type ReqBody = {
  pack?: unknown;
};

const PACKS: Record<Pack, { credits: number; amountCents: number; label: string }> = {
  standard: { label: "Standard", credits: 25, amountCents: 500 },
  plus: { label: "Plus", credits: 75, amountCents: 1000 },
  pro: { label: "Pro", credits: 150, amountCents: 1500 },
  premium: { label: "Premium", credits: 500, amountCents: 2500 },
};

function toJsonObject(value: Record<string, unknown>): Prisma.InputJsonObject {
  return value as Prisma.InputJsonObject;
}

function normalizePack(value: unknown): Pack {
  const pack = String(value ?? "").trim().toLowerCase();

  if (pack === "standard" || pack === "plus" || pack === "pro" || pack === "premium") {
    return pack;
  }

  return "standard";
}

export async function POST(req: Request) {
  const startedAt = nowMs();
  const route = "/api/stripe/checkout";

  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const email = session?.user?.email;

    if (!userId || !email) {
      serverLog.warn("Credit checkout blocked: unauthenticated user.", {
        route,
        status: 401,
        durationMs: durationSince(startedAt),
      });

      return apiError(req, {
        status: 401,
        code: "UNAUTHORIZED",
        message: "Please sign in before buying credits.",
      });
    }

    const stripeSecretKey = requireStripeSecretKey();
    const body = await readJsonBody<ReqBody>(req);
    const pack = normalizePack(body.pack);
    const packInfo = PACKS[pack];
    const appUrl = getAppBaseUrl(req);

    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!dbUser) {
      serverLog.warn("Credit checkout blocked: user not found.", {
        route,
        userId,
        status: 401,
        durationMs: durationSince(startedAt),
      });

      return apiError(req, {
        status: 401,
        code: "UNAUTHORIZED",
        message: "User not found.",
      });
    }

    const stripe = new Stripe(stripeSecretKey);

    await prisma.event.create({
      data: {
        userId: dbUser.id,
        type: "credit_checkout_started",
        metaJson: toJsonObject({
          app: "QAtalyst",
          pack,
          credits: packInfo.credits,
          amountCents: packInfo.amountCents,
        }),
      },
    });

    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${appUrl}/buy-credits/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/buy-credits/cancel`,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `QAtalyst Credits — ${packInfo.label} (${packInfo.credits})`,
            },
            unit_amount: packInfo.amountCents,
          },
          quantity: 1,
        },
      ],
      customer_email: dbUser.email ?? email,
      metadata: {
        app: "QAtalyst",
        type: "credit_purchase",
        userId: dbUser.id,
        email: dbUser.email ?? email,
        pack,
        credits: String(packInfo.credits),
      },
    });

    serverLog.info("Credit checkout created.", {
      route,
      userId: dbUser.id,
      status: 200,
      durationMs: durationSince(startedAt),
      meta: {
        pack,
        credits: packInfo.credits,
        amountCents: packInfo.amountCents,
        stripeSessionId: checkout.id,
      },
    });

    return apiOk(req, { url: checkout.url });
  } catch (error) {
    const message = getErrorMessage(error, "Checkout failed.");

    serverLog.error("Credit checkout failed.", {
      route,
      status: 500,
      durationMs: durationSince(startedAt),
      error,
    });

    return apiError(req, {
      status: 500,
      code: message.includes("environment variable") ? "CONFIG_ERROR" : "INTERNAL_ERROR",
      message,
    });
  }
}
