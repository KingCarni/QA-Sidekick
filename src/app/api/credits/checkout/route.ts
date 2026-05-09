import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { authOptions } from "@/lib/auth";
import { CREDIT_CURRENCY, getCreditPack } from "@/lib/credits-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBaseUrl(req: Request) {
  const envUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return envUrl.replace(/\/+$/, "");
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id ?? "";

    if (!userId) {
      return NextResponse.json({ ok: false, error: "Please sign in before buying credits." }, { status: 401 });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ ok: false, error: "STRIPE_SECRET_KEY is not configured." }, { status: 500 });
    }

    const body = await req.json().catch(() => null);
    const packId = String(body?.packId ?? "").trim();
    const pack = getCreditPack(packId);

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const baseUrl = getBaseUrl(req);

    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${baseUrl}/buy-credits?success=1&pack=${encodeURIComponent(pack.id)}`,
      cancel_url: `${baseUrl}/buy-credits?cancelled=1`,
      customer_email: session?.user?.email ?? undefined,
      client_reference_id: userId,
      metadata: {
        userId,
        packId: pack.id,
        credits: String(pack.credits),
        reason: pack.reason,
        kind: pack.kind,
        currency: CREDIT_CURRENCY,
      },
      line_items: [
        {
          price_data: {
            currency: CREDIT_CURRENCY,
            unit_amount: pack.amountCents,
            product_data: {
              name: pack.kind === "support" ? `${pack.label} — CA$${pack.priceCad}` : `${pack.label} Credit Pack`,
              description: pack.kind === "support" ? pack.description : `${pack.credits} QAtalyst credits`,
            },
          },
          quantity: 1,
        },
      ],
    });

    return NextResponse.json({ ok: true, url: checkout.url });
  } catch (error) {
    console.error("Stripe checkout creation failed", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not create checkout session." },
      { status: 500 }
    );
  }
}
