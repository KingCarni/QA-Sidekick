import { test, expect } from "@playwright/test";

const roughFeatureIdea = `I want to add a Jira Task Creator tool to QAtalyst. The user should be able to type a rough task idea, improve it with guided prompts, preview the Jira-ready title/description/acceptance criteria, and then create the task directly in their connected Jira project.

The first version should be simple: use the saved Jira integration settings, default project, default issue type, and existing user auth. It should not support advanced Jira fields yet, subtasks yet, or bulk task creation yet.

The tool should help the user avoid vague tickets by asking for missing details like user value, scope, acceptance criteria, dependencies, risk, and QA notes. Before creating anything in Jira, the user must see a preview and click an explicit Create Jira Task button.`;

test.describe("QAS-88 Feature Builder", () => {
  test.beforeEach(async ({ page }) => {
    // Assumption: dev/test auth fixture is already seeded or bypassed.
    // If not, replace this with your existing login helper.
    await page.goto("/app");
  });

  test("opens Feature Builder from Toolbelt", async ({ page }) => {
    await expect(page.getByText("Qatalyst Toolbelt", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: /Feature Builder/i }).click();

    await expect(page.getByText("Shape a rough idea into a feature brief")).toBeVisible();
    await expect(page.getByText("Live Prompt Companion")).toBeVisible();
  });

  test("live companion updates and appends prompts", async ({ page }) => {
    await page.getByRole("button", { name: /Feature Builder/i }).click();

    const roughIdea = page.getByLabel(/Rough feature idea/i);
    await roughIdea.fill("I want a tool that helps users create Jira tasks from rough notes.");

    await expect(page.getByText(/This idea is missing/i)).toBeVisible();

    const nextQuestion = page.getByRole("button", { name: /What/i }).first();
    await nextQuestion.click();

    await expect(roughIdea).toHaveValue(/Who|What|feature|Jira/i);
  });

  test("generates a feature brief with mocked API", async ({ page }) => {
    await page.route("**/api/feature-builder", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          brief: {
            title: "Jira Task Creator Tool",
            summary: "A tool that helps users create clearer Jira tasks.",
            userValue: "Users create Jira tasks faster with less ambiguity.",
            problemStatement: "Vague Jira tasks slow down delivery.",
            targetUsers: ["QA Engineers", "Product Managers"],
            inScope: ["Input rough task idea", "Preview Jira-ready task"],
            outOfScope: ["Bulk creation"],
            userStories: ["As a user, I want a guided task creator."],
            acceptanceCriteria: ["User can preview before creating Jira work."],
            qaRisks: ["Invalid Jira token"],
            testIdeas: ["Test missing Jira config"],
            analyticsOrTelemetry: ["Track creation success"],
            dependencies: ["Jira integration"],
            openQuestions: ["Which issue types are supported?"],
            jiraReadyNotes: ["Use saved Jira config."]
          },
          markdown: "# Jira Task Creator Tool"
        }),
      });
    });

    await page.getByRole("button", { name: /Feature Builder/i }).click();
    await page.getByLabel(/Rough feature idea/i).fill(roughFeatureIdea);
    await page.getByRole("button", { name: /Build Feature Brief/i }).click();

    await expect(page.getByText("Jira Task Creator Tool")).toBeVisible();
    await expect(page.getByText("Refinement Loop")).toBeVisible();
    await expect(page.getByRole("button", { name: /Copy Markdown/i })).toBeEnabled();
  });

  test("existing tool cards remain available", async ({ page }) => {
    await expect(page.getByRole("button", { name: /Test Cases/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Bug Writer/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Risk Review/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Test Improver/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Feature Builder/i })).toBeVisible();
  });
});
