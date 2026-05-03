import type { Prisma } from "@prisma/client";
import Stripe from "stripe";
import { apiError, apiOk, getErrorMessage } from "@/lib/api-response";
import {
  getExpectedStripeLiveMode,
  requireStripeSecretKey,
  requireStripeWebhookSecret,
} from "@/lib/env";
import { durationSince, nowMs, serverLog } from "@/lib/server-log";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toPositiveInt(value: unknown) {
  const parsed = Number(String(value ?? "").trim());
  if (!Number.isFinite(parsed)) return 0;
  return Math.trunc(Math.abs(parsed));
}

function toJsonObject(value: Record<string, unknown>): Prisma.InputJsonObject {
  return value as Prisma.InputJsonObject;
}

function cleanString(value: unknown) {
  return String(value ?? "").trim();
}

async function markStripeEventIfNew(args: { id: string; type: string; livemode: boolean }) {
  try {
    await prisma.stripeEvent.create({
      data: {
        id: args.id,
        type: args.type,
        livemode: args.livemode,
      },
    });

    return true;
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return false;
    }

    throw error;
  }
}

async function handleCreditPurchase(args: {
  event: Stripe.Event;
  session: Stripe.Checkout.Session;
  stripeSessionId: string;
}) {
  const metadata = args.session.metadata ?? {};
  const userId = cleanString(metadata.userId);
  const email = cleanString(metadata.email);
  const pack = cleanString(metadata.pack) || "unknown";
  const credits = toPositiveInt(metadata.credits);
  const amountTotal = args.session.amount_total ?? 0;
  const currency = args.session.currency ?? "unknown";
  const ref = `stripe_checkout_session:${args.stripeSessionId}`;

  if (!userId || credits <= 0) {
    await prisma.event.create({
      data: {
        type: "stripe_credit_purchase_ignored",
        metaJson: toJsonObject({
          reason: "missing_userId_or_credits",
          stripeEventId: args.event.id,
          stripeSessionId: args.stripeSessionId,
          metadata,
        }),
      },
    });

    return { ok: true, ignored: "missing_userId_or_credits" };
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!dbUser) {
    await prisma.event.create({
      data: {
        type: "stripe_credit_purchase_ignored",
        metaJson: toJsonObject({
          reason: "user_not_found",
          userId,
          email,
          stripeEventId: args.event.id,
          stripeSessionId: args.stripeSessionId,
        }),
      },
    });

    return { ok: true, ignored: "user_not_found" };
  }

  let credited = false;

  await prisma.$transaction(async (tx) => {
    try {
      await tx.creditsLedger.create({
        data: {
          userId,
          delta: credits,
          reason: "purchase_stripe",
          ref,
        },
      });

      credited = true;
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        credited = false;
        return;
      }

      throw error;
    }

    await tx.event.create({
      data: {
        userId,
        type: "credit_purchase_completed",
        metaJson: toJsonObject({
          app: "QAtalyst",
          stripeEventId: args.event.id,
          stripeSessionId: args.stripeSessionId,
          livemode: args.event.livemode,
          pack,
          credits,
          amountTotal,
          currency,
          email,
        }),
      },
    });
  });

  if (!credited) {
    return { ok: true, alreadyProcessed: true, ref };
  }

  return { ok: true, credited: credits, ref };
}

async function handleDonation(args: {
  event: Stripe.Event;
  session: Stripe.Checkout.Session;
  stripeSessionId: string;
}) {
  const metadata = args.session.metadata ?? {};
  const amountTotal = args.session.amount_total ?? 0;
  const currency = args.session.currency ?? "unknown";

  await prisma.event.create({
    data: {
      type: "donation_completed",
      metaJson: toJsonObject({
        app: "QAtalyst",
        stripeEventId: args.event.id,
        stripeSessionId: args.stripeSessionId,
        livemode: args.event.livemode,
        amountTotal,
        currency,
        metadata,
      }),
    },
  });

  return { ok: true, donationRecorded: true, amountTotal, currency };
}

export async function GET(req: Request) {
  return apiOk(req, { route: "/api/stripe/webhook" });
}

export async function POST(req: Request) {
  const startedAt = nowMs();
  const route = "/api/stripe/webhook";

  let stripeSecretKey = "";
  let webhookSecret = "";

  try {
    stripeSecretKey = requireStripeSecretKey();
    webhookSecret = requireStripeWebhookSecret();
  } catch (error) {
    const message = getErrorMessage(error, "Stripe webhook is not configured.");

    serverLog.error("Stripe webhook config failed.", {
      route,
      status: 500,
      durationMs: durationSince(startedAt),
      error,
    });

    return apiError(req, {
      status: 500,
      code: "CONFIG_ERROR",
      message,
    });
  }

  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    serverLog.warn("Stripe webhook missing signature.", {
      route,
      status: 400,
      durationMs: durationSince(startedAt),
    });

    return apiError(req, {
      status: 400,
      code: "BAD_REQUEST",
      message: "Missing stripe-signature header.",
    });
  }

  const rawBody = await req.text();
  const stripe = new Stripe(stripeSecretKey);

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    serverLog.warn("Stripe webhook signature verification failed.", {
      route,
      status: 400,
      durationMs: durationSince(startedAt),
      error,
    });

    return apiError(req, {
      status: 400,
      code: "BAD_REQUEST",
      message: "Invalid Stripe signature.",
    });
  }

  const expectedLiveMode = getExpectedStripeLiveMode();
  if (typeof expectedLiveMode === "boolean" && event.livemode !== expectedLiveMode) {
    serverLog.warn("Stripe webhook livemode mismatch.", {
      route,
      status: 200,
      durationMs: durationSince(startedAt),
      meta: {
        expectedLiveMode,
        actualLivemode: event.livemode,
        stripeEventId: event.id,
        type: event.type,
      },
    });

    return apiOk(req, { ignored: "livemode_mismatch" });
  }

  const isNewEvent = await markStripeEventIfNew({
    id: event.id,
    type: event.type,
    livemode: event.livemode,
  });

  if (!isNewEvent) {
    serverLog.info("Stripe webhook duplicate event ignored.", {
      route,
      status: 200,
      durationMs: durationSince(startedAt),
      meta: { stripeEventId: event.id, type: event.type },
    });

    return apiOk(req, { alreadyProcessedEvent: event.id });
  }

  if (event.type !== "checkout.session.completed") {
    return apiOk(req, { ignored: event.type });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  if (session.payment_status && session.payment_status !== "paid") {
    return apiOk(req, {
      ignored: `payment_status=${session.payment_status}`,
      stripeSessionId: session.id,
    });
  }

  const stripeSessionId = session.id;
  const type = cleanString(session.metadata?.type);

  try {
    if (type === "credit_purchase") {
      const result = await handleCreditPurchase({ event, session, stripeSessionId });

      serverLog.info("Stripe credit purchase webhook handled.", {
        route,
        status: 200,
        durationMs: durationSince(startedAt),
        meta: {
          stripeEventId: event.id,
          stripeSessionId,
          result,
        },
      });

      return apiOk(req, result);
    }

    if (type === "donation") {
      const result = await handleDonation({ event, session, stripeSessionId });

      serverLog.info("Stripe donation webhook handled.", {
        route,
        status: 200,
        durationMs: durationSince(startedAt),
        meta: {
          stripeEventId: event.id,
          stripeSessionId,
          result,
        },
      });

      return apiOk(req, result);
    }

    await prisma.event.create({
      data: {
        type: "stripe_checkout_completed_unhandled",
        metaJson: toJsonObject({
          stripeEventId: event.id,
          stripeSessionId,
          livemode: event.livemode,
          metadata: session.metadata ?? {},
        }),
      },
    });

    serverLog.warn("Stripe checkout completed with unhandled metadata type.", {
      route,
      status: 200,
      durationMs: durationSince(startedAt),
      meta: { stripeEventId: event.id, stripeSessionId, type },
    });

    return apiOk(req, { ignored: "unhandled_checkout_metadata_type", type });
  } catch (error) {
    const message = getErrorMessage(error, "Stripe webhook handler failed.");

    serverLog.error("Stripe webhook handler failed.", {
      route,
      status: 500,
      durationMs: durationSince(startedAt),
      error,
      meta: {
        stripeEventId: event.id,
        stripeSessionId,
        type,
      },
    });

    return apiError(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      message,
    });
  }
}
