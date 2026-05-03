import Stripe from "stripe";
import { apiError, apiOk, getErrorMessage, readJsonBody } from "@/lib/api-response";
import { getAppBaseUrl, requireStripeSecretKey } from "@/lib/env";
import { durationSince, nowMs, serverLog } from "@/lib/server-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReqBody = {
  amountCad?: unknown;
};

function toCents(amountCad: number) {
  return Math.round(amountCad * 100);
}

export async function POST(req: Request) {
  const startedAt = nowMs();
  const route = "/api/donate";

  try {
    const secretKey = requireStripeSecretKey();
    const body = await readJsonBody<ReqBody>(req);
    const amountCad = Number(body.amountCad);

    if (!Number.isFinite(amountCad) || amountCad < 1 || amountCad > 250) {
      serverLog.warn("Donation checkout blocked: invalid amount.", {
        route,
        status: 400,
        durationMs: durationSince(startedAt),
        meta: { amountCad: body.amountCad },
      });

      return apiError(req, {
        status: 400,
        code: "VALIDATION_ERROR",
        message: "Invalid amount. Use a value between 1 and 250 CAD.",
      });
    }

    const stripe = new Stripe(secretKey);
    const appUrl = getAppBaseUrl(req);

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

    serverLog.info("Donation checkout created.", {
      route,
      status: 200,
      durationMs: durationSince(startedAt),
      meta: { amountCad, stripeSessionId: session.id },
    });

    return apiOk(req, { url: session.url });
  } catch (error) {
    const message = getErrorMessage(error, "Failed to create checkout session.");

    serverLog.error("Donation checkout failed.", {
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
