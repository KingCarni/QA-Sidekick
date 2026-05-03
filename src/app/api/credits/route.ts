import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCreditBalance } from "@/lib/credits";

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

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return noStore({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const balance = await getCreditBalance(userId);

    return noStore({ ok: true, balance, credits: balance });
  } catch (error) {
    console.error("/api/credits failed", error);
    return noStore({ ok: false, error: "Failed to load credits." }, { status: 500 });
  }
}
