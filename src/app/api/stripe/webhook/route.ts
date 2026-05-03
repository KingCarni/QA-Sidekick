import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStore(payload: unknown, init?: ResponseInit) {
  return NextResponse.json(payload, {
    ...init,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      ...(init?.headers ?? {}),
    },
  });
}

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

function getExpectedLiveMode() {
  if (process.env.STRIPE_EXPECT_LIVEMODE === "true") return true;
  if (process.env.STRIPE_EXPECT_LIVEMODE === "false") return false;
  return null;
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

export async function GET() {
  return noStore({ ok: true, route: "/api/stripe/webhook" });
}

export async function POST(req: Request) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey) {
    return noStore({ ok: false, error: "Missing STRIPE_SECRET_KEY." }, { status: 500 });
  }

  if (!webhookSecret) {
    return noStore({ ok: false, error: "Missing STRIPE_WEBHOOK_SECRET." }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return noStore({ ok: false, error: "Missing stripe-signature header." }, { status: 400 });
  }

  const rawBody = await req.text();
  const stripe = new Stripe(stripeSecretKey);

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error("[stripe-webhook] signature verification failed", error);
    return noStore({ ok: false, error: "Invalid Stripe signature." }, { status: 400 });
  }

  const expectedLiveMode = getExpectedLiveMode();
  if (typeof expectedLiveMode === "boolean" && event.livemode !== expectedLiveMode) {
    console.error("[stripe-webhook] livemode mismatch", {
      expectedLiveMode,
      actualLivemode: event.livemode,
      eventId: event.id,
    });

    return noStore({ ok: true, ignored: "livemode_mismatch" });
  }

  const isNewEvent = await markStripeEventIfNew({
    id: event.id,
    type: event.type,
    livemode: event.livemode,
  });

  if (!isNewEvent) {
    return noStore({ ok: true, alreadyProcessedEvent: event.id });
  }

  if (event.type !== "checkout.session.completed") {
    return noStore({ ok: true, ignored: event.type });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  if (session.payment_status && session.payment_status !== "paid") {
    return noStore({
      ok: true,
      ignored: `payment_status=${session.payment_status}`,
      stripeSessionId: session.id,
    });
  }

  const stripeSessionId = session.id;
  const type = cleanString(session.metadata?.type);

  try {
    if (type === "credit_purchase") {
      const result = await handleCreditPurchase({ event, session, stripeSessionId });
      return noStore(result);
    }

    if (type === "donation") {
      const result = await handleDonation({ event, session, stripeSessionId });
      return noStore(result);
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

    return noStore({ ok: true, ignored: "unhandled_checkout_metadata_type", type });
  } catch (error) {
    console.error("[stripe-webhook] handler failed", error);

    return noStore(
      { ok: false, error: error instanceof Error ? error.message : "Stripe webhook handler failed." },
      { status: 500 }
    );
  }
}
