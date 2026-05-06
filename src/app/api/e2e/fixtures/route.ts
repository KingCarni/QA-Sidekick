import { NextRequest, NextResponse } from "next/server";
import { E2E_PERSONAS, isE2EAuthEnabled } from "@/lib/e2e-auth-personas";
import { upsertE2EUserAndFixtures } from "@/lib/e2e-fixtures";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FixtureTarget = "all" | "project" | "source" | "credits" | "permissions";

function isFixtureTarget(value: unknown): value is FixtureTarget {
  return value === "all" || value === "project" || value === "source" || value === "credits" || value === "permissions";
}

export async function POST(request: NextRequest) {
  if (!isE2EAuthEnabled()) {
    return NextResponse.json({ error: "E2E fixture seeding is disabled." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const target: FixtureTarget = isFixtureTarget(body?.target) ? body.target : "all";

  for (const persona of Object.values(E2E_PERSONAS)) {
    await upsertE2EUserAndFixtures(persona);
  }

  return NextResponse.json({
    ok: true,
    target,
    seeded: target === "all" ? ["project", "source", "credits", "permissions"] : [target],
    personas: Object.keys(E2E_PERSONAS),
    message: target === "all" ? "E2E fixtures seeded." : `E2E ${target} fixture seeded.`,
  });
}
