import { encode } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { E2E_PERSONAS, getE2EPersona, isE2EAuthEnabled } from "@/lib/e2e-auth-personas";
import { upsertE2EUserAndFixtures } from "@/lib/e2e-fixtures";
import { getOptionalEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sessionCookieName(request: NextRequest) {
  return request.nextUrl.protocol === "https:" ? "__Secure-next-auth.session-token" : "next-auth.session-token";
}

export async function POST(request: NextRequest) {
  if (!isE2EAuthEnabled()) {
    return NextResponse.json({ error: "E2E auth is disabled." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const persona = getE2EPersona(body?.profileKey);

  if (!persona) {
    return NextResponse.json({ error: "Unknown E2E persona." }, { status: 400 });
  }

  const { user } = await upsertE2EUserAndFixtures(persona);
  const secret = getOptionalEnv("NEXTAUTH_SECRET");

  if (!secret) {
    return NextResponse.json({ error: "NEXTAUTH_SECRET is required for E2E auth." }, { status: 500 });
  }

  const token = await encode({
    secret,
    token: {
      sub: user.id,
      uid: user.id,
      email: user.email,
      name: user.name,
      picture: null,
    },
    maxAge: 60 * 60 * 8,
  });

  const response = NextResponse.json({
    ok: true,
    profileKey: persona.key,
    email: persona.email,
    redirectTo: "/app",
  });

  response.cookies.set(sessionCookieName(request), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return response;
}

export async function GET() {
  const productionBlocked = process.env.NODE_ENV === "production";
  const enabled = isE2EAuthEnabled();

  return NextResponse.json(
    {
      ok: enabled,
      enabled,
      productionBlocked,
      environment: process.env.NODE_ENV || "unknown",
      personas: Object.values(E2E_PERSONAS).map((persona) => ({
        key: persona.key,
        name: persona.name,
        role: persona.role,
      })),
      fixtures: {
        project: enabled,
        source: enabled,
        credits: enabled,
        permissions: enabled,
      },
      message: enabled
        ? "E2E dev/test auth is enabled."
        : productionBlocked
          ? "E2E dev/test auth is blocked in production."
          : "Set ENABLE_E2E_AUTH=true in .env.e2e to enable local dev/test auth.",
    },
    { status: productionBlocked ? 403 : 200 }
  );
}
