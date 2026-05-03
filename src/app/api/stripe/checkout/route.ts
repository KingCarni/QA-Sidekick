import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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

function getAppUrl(req: Request) {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "http";
  if (!host) return "http://localhost:3000";

  return `${proto}://${host}`;
}

function normalizePack(value: unknown): Pack {
  const pack = String(value ?? "").trim().toLowerCase();

  if (pack === "standard" || pack === "plus" || pack === "pro" || pack === "premium") {
    return pack;
  }

  return "standard";
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const email = session?.user?.email;

    if (!userId || !email) {
      return NextResponse.json({ ok: false, error: "Please sign in before buying credits." }, { status: 401 });
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      return NextResponse.json({ ok: false, error: "Missing STRIPE_SECRET_KEY." }, { status: 500 });
    }

    const body = (await req.json().catch(() => ({}))) as ReqBody;
    const pack = normalizePack(body.pack);
    const packInfo = PACKS[pack];
    const appUrl = getAppUrl(req);

    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!dbUser) {
      return NextResponse.json({ ok: false, error: "User not found." }, { status: 401 });
    }

    const stripe = new Stripe(stripeSecretKey);

    await prisma.event.create({
      data: {
        userId: dbUser.id,
        type: "credit_checkout_started",
        metaJson: {
          app: "QAtalyst",
          pack,
          credits: packInfo.credits,
          amountCents: packInfo.amountCents,
        },
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

    return NextResponse.json({ ok: true, url: checkout.url });
  } catch (error) {
    console.error("/api/stripe/checkout failed", error);

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Checkout failed." },
      { status: 500 }
    );
  }
}
