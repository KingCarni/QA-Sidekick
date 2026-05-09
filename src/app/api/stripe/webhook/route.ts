import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getCreditPack } from "@/lib/credits-config";
import { addCreditsIfMissing } from "@/lib/credits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: "Stripe webhook is not configured." }, { status: 500 });
  }
  if (!signature) return NextResponse.json({ ok: false, error: "Missing Stripe signature." }, { status: 400 });
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Invalid Stripe webhook signature." }, { status: 400 });
  }
  try {
    const existing = await prisma.stripeEvent.findUnique({ where: { id: event.id } });
    if (existing) return NextResponse.json({ ok: true, duplicate: true });
    await prisma.stripeEvent.create({ data: { id: event.id, type: event.type, livemode: event.livemode } });
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = String(session.metadata?.userId ?? session.client_reference_id ?? "").trim();
      const pack = getCreditPack(String(session.metadata?.packId ?? "").trim());
      if (userId && pack && session.payment_status === "paid") {
        if (pack.credits > 0) {
          await addCreditsIfMissing({ userId, delta: pack.credits, reason: pack.reason, ref: `stripe:${session.id}` });
        }
        await prisma.event.create({ data: { userId, type: pack.reason, metaJson: { packId: pack.id, kind: pack.kind, credits: pack.credits, priceCad: pack.priceCad, currency: "cad", stripeSessionId: session.id, stripeEventId: event.id } } });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Stripe webhook handling failed", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Stripe webhook failed." }, { status: 500 });
  }
}
