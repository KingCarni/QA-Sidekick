import { encode } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { getE2EPersona, isE2EAuthEnabled } from "@/lib/e2e-auth-personas";
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
  if (!isE2EAuthEnabled()) {
    return NextResponse.json({ error: "E2E auth is disabled." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    enabled: true,
    personas: ["standard-user", "admin-user", "limited-access-user"],
  });
}
