import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  deleteProjectTestCase,
  normalizeProjectTestCasePayload,
  saveProjectTestCase,
  setProjectTestCaseStatus,
} from "@/lib/project-test-cases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ testCaseId: string }>;
};

async function requireUserId() {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? "";
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const userId = await requireUserId();

    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { testCaseId } = await context.params;

    if (!testCaseId) {
      return NextResponse.json({ ok: false, error: "Missing test case id." }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

    if (!body) {
      return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
    }

    if (typeof body.status === "string" && !body.projectId) {
      const result = await setProjectTestCaseStatus(userId, testCaseId, body.status);
      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
      }
      return NextResponse.json({ ok: true, testCase: result.testCase });
    }

    const projectId = typeof body.projectId === "string" ? body.projectId : "";

    if (!projectId) {
      return NextResponse.json({ ok: false, error: "Missing project id." }, { status: 400 });
    }

    const payload = normalizeProjectTestCasePayload(body);
    const result = await saveProjectTestCase(userId, projectId, testCaseId, payload);

    if (!result.ok) {
      return NextResponse.json({ ok: false, errors: result.errors, error: result.errors[0] ?? "Could not update test case." }, { status: 400 });
    }

    return NextResponse.json({ ok: true, testCase: result.testCase });
  } catch (error) {
    console.error("Update project test case failed", error);

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not update test case." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const userId = await requireUserId();

    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { testCaseId } = await context.params;

    if (!testCaseId) {
      return NextResponse.json({ ok: false, error: "Missing test case id." }, { status: 400 });
    }

    const result = await deleteProjectTestCase(userId, testCaseId);

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete project test case failed", error);

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not delete test case." },
      { status: 500 }
    );
  }
}
