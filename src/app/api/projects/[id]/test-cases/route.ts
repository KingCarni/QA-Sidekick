import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  listProjectTestCases,
  normalizeProjectTestCasePayload,
  saveProjectTestCase,
} from "@/lib/project-test-cases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function requireUserId() {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? "";
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const userId = await requireUserId();

    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ ok: false, error: "Missing project id." }, { status: 400 });
    }

    const testCases = await listProjectTestCases(userId, id);

    return NextResponse.json({ ok: true, testCases });
  } catch (error) {
    console.error("Load project test cases failed", error);

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not load test cases." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const userId = await requireUserId();

    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ ok: false, error: "Missing project id." }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

    if (!body) {
      return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
    }

    const testCaseId = typeof body.id === "string" ? body.id : null;
    const payload = normalizeProjectTestCasePayload(body);
    const result = await saveProjectTestCase(userId, id, testCaseId, payload);

    if (!result.ok) {
      return NextResponse.json({ ok: false, errors: result.errors, error: result.errors[0] ?? "Could not save test case." }, { status: 400 });
    }

    return NextResponse.json({ ok: true, testCase: result.testCase });
  } catch (error) {
    console.error("Save project test case failed", error);

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not save test case." },
      { status: 500 }
    );
  }
}
