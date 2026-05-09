// src/app/api/credits/route.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiError, apiOk } from "@/lib/api-response";
import { getCreditSnapshot } from "@/lib/credits-service";
import { CREDIT_ACTIONS } from "@/lib/credits-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return apiOk(req, {
      credits: 0,
      balance: 0,
      actions: CREDIT_ACTIONS,
      authenticated: false,
    });
  }

  try {
    const snapshot = await getCreditSnapshot(userId);

    return apiOk(req, {
      credits: snapshot.balance,
      balance: snapshot.balance,
      actions: snapshot.actions,
      authenticated: true,
    });
  } catch (error) {
    return apiError(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      message: error instanceof Error ? error.message : "Unable to fetch credits.",
    });
  }
}
