import { expect, test, type APIResponse } from "@playwright/test";
import { loginAs } from "../support/auth";

type BlockedStatus = 401 | 403 | 404;

const STANDARD_OWNED_PROJECT_ID = process.env.QATALYST_E2E_STANDARD_PROJECT_ID;
const STANDARD_OWNED_SOURCE_ID = process.env.QATALYST_E2E_STANDARD_SOURCE_ID;
const STANDARD_OWNED_REPORT_ID = process.env.QATALYST_E2E_STANDARD_REPORT_ID;
const STANDARD_OWNED_BUG_ID = process.env.QATALYST_E2E_STANDARD_BUG_ID;

const SECRET_CANARY = process.env.QATALYST_E2E_SECRET_CANARY ?? "QATALYST_PRIVATE_SOURCE_CANARY";

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    test.skip(true, `Missing ${name}; skipping cross-user abuse regression.`);
    return "";
  }

  return value;
}

async function expectBlocked(response: APIResponse, allowed: BlockedStatus[] = [401, 403, 404]) {
  expect(allowed).toContain(response.status() as BlockedStatus);
  const text = await response.text().catch(() => "");
  expect(text).not.toContain(SECRET_CANARY);
}

test.describe("Security: cross-user project isolation", () => {
  test("limited-access user cannot read another user's project source context", async ({ page }) => {
    const projectId = requireEnv("QATALYST_E2E_STANDARD_PROJECT_ID", STANDARD_OWNED_PROJECT_ID);

    await loginAs(page, "limited-access-user");

    const response = await page.request.get(`/api/projects/${projectId}/context`);
    await expectBlocked(response);
  });

  test("limited-access user cannot list another user's project sources", async ({ page }) => {
    const projectId = requireEnv("QATALYST_E2E_STANDARD_PROJECT_ID", STANDARD_OWNED_PROJECT_ID);

    await loginAs(page, "limited-access-user");

    const response = await page.request.get(`/api/projects/${projectId}/sources`);
    await expectBlocked(response);
  });

  test("limited-access user cannot update another user's project source by raw source id", async ({ page }) => {
    const sourceId = requireEnv("QATALYST_E2E_STANDARD_SOURCE_ID", STANDARD_OWNED_SOURCE_ID);

    await loginAs(page, "limited-access-user");

    const response = await page.request.patch(`/api/project-sources/${sourceId}`, {
      data: {
        isEnabled: false,
      },
    });

    await expectBlocked(response);
  });

  test("limited-access user cannot open another user's saved report by raw id", async ({ page }) => {
    const reportId = requireEnv("QATALYST_E2E_STANDARD_REPORT_ID", STANDARD_OWNED_REPORT_ID);

    await loginAs(page, "limited-access-user");

    const response = await page.request.get(`/api/reports/${reportId}`);
    await expectBlocked(response);
  });

  test("limited-access user cannot update another user's bug collection item by raw id", async ({ page }) => {
    const bugId = requireEnv("QATALYST_E2E_STANDARD_BUG_ID", STANDARD_OWNED_BUG_ID);

    await loginAs(page, "limited-access-user");

    const response = await page.request.patch(`/api/bug-collection/${bugId}`, {
      data: {
        status: "triaged",
      },
    });

    await expectBlocked(response);
  });

  test("limited-access user cannot inject another user's project memory into AI generation", async ({ page }) => {
    const projectId = requireEnv("QATALYST_E2E_STANDARD_PROJECT_ID", STANDARD_OWNED_PROJECT_ID);
    const sourceId = requireEnv("QATALYST_E2E_STANDARD_SOURCE_ID", STANDARD_OWNED_SOURCE_ID);

    await loginAs(page, "limited-access-user");

    const response = await page.request.post("/api/analyze-risk", {
      data: {
        input: "Review checkout flow risk for a logged in customer changing payment method.",
        projectId,
        selectedProjectId: projectId,
        selectedProjectSourceIds: [sourceId],
        projectContextUsed: true,
        projectContextBlock: `${SECRET_CANARY} should never be trusted from the client.`,
        projectContextSummary: "Malicious client supplied context",
      },
    });

    expect(response.status()).not.toBe(500);
    const text = await response.text().catch(() => "");
    expect(text).not.toContain(SECRET_CANARY);
  });

  test("limited-access user cannot use another user's saved report id during TestRail sync", async ({ page }) => {
    const reportId = requireEnv("QATALYST_E2E_STANDARD_REPORT_ID", STANDARD_OWNED_REPORT_ID);

    await loginAs(page, "limited-access-user");

    const response = await page.request.post("/api/testrail/sync-cases", {
      data: {
        approve: true,
        reportId,
        mode: "create",
        cases: [
          {
            index: 0,
            title: "Security isolation smoke case",
            contentHash: "qatalyst-cross-user-abuse-smoke",
            sectionId: 1,
            payload: {
              title: "Security isolation smoke case",
              template_id: 1,
              type_id: 1,
              priority_id: 2,
            },
          },
        ],
      },
    });

    await expectBlocked(response, [400, 401, 403, 404]);
  });
});
