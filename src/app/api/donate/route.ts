import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReqBody = {
  amountCad?: unknown;
};

function toCents(amountCad: number) {
  return Math.round(amountCad * 100);
}

function getAppUrl(req: Request) {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "http";
  if (!host) return "http://localhost:3000";

  return `${proto}://${host}`;
}

export async function POST(req: Request) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
      return NextResponse.json({ ok: false, error: "Missing STRIPE_SECRET_KEY." }, { status: 500 });
    }

    const body = (await req.json().catch(() => ({}))) as ReqBody;
    const amountCad = Number(body.amountCad);

    if (!Number.isFinite(amountCad) || amountCad < 1 || amountCad > 250) {
      return NextResponse.json(
        { ok: false, error: "Invalid amount. Use a value between 1 and 250 CAD." },
        { status: 400 }
      );
    }

    const stripe = new Stripe(secretKey);
    const appUrl = getAppUrl(req);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      submit_type: "donate",
      success_url: `${appUrl}/donate/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/donate/cancel`,
      line_items: [
        {
          price_data: {
            currency: "cad",
            product_data: { name: "Support QAtalyst" },
            unit_amount: toCents(amountCad),
          },
          quantity: 1,
        },
      ],
      metadata: {
        app: "QAtalyst",
        type: "donation",
        amountCad: String(amountCad),
      },
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch (error) {
    console.error("/api/donate failed", error);

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to create checkout session." },
      { status: 500 }
    );
  }
}
