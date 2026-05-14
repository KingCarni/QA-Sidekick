import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STANDARD_USER = {
  email: process.env.PROJECT_E2E_STANDARD_EMAIL || "e2e.standard@example.test",
  name: "E2E Standard User",
};

const LIMITED_USER = {
  email: process.env.PROJECT_E2E_LIMITED_EMAIL || "e2e.limited@example.test",
  name: "E2E Limited Access User",
};

const SECRET_CANARY = process.env.QATALYST_E2E_SECRET_CANARY || "QATALYST_PRIVATE_SOURCE_CANARY";
const PROJECT_NAME = "E2E Security Isolation Project";
const SOURCE_TITLE = "E2E Private Security Source";
const REPORT_TITLE = "E2E Private Security Report";
const BUG_TITLE = "E2E Private Security Bug";

async function upsertUser({ email, name }) {
  return prisma.user.upsert({
    where: { email },
    update: { name },
    create: { email, name },
  });
}

async function upsertProject(userId) {
  return prisma.qAProject.upsert({
    where: {
      userId_name: {
        userId,
        name: PROJECT_NAME,
      },
    },
    update: {
      description: "Private E2E security fixture used to verify cross-user isolation.",
      productType: "Web App",
    },
    create: {
      userId,
      name: PROJECT_NAME,
      description: "Private E2E security fixture used to verify cross-user isolation.",
      productType: "Web App",
    },
  });
}

async function upsertSource(projectId) {
  const existing = await prisma.qAProjectSource.findFirst({
    where: {
      projectId,
      title: SOURCE_TITLE,
    },
    select: { id: true },
  });

  const data = {
    projectId,
    title: SOURCE_TITLE,
    sourceType: "security-fixture",
    tags: ["e2e", "security", "private"],
    isEnabled: true,
    body: [
      "Private security fixture source for QAtalyst cross-user isolation tests.",
      `Canary: ${SECRET_CANARY}`,
      "This content must never be visible to a limited-access user.",
    ].join("\n"),
  };

  if (existing) {
    return prisma.qAProjectSource.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.qAProjectSource.create({ data });
}

async function upsertReport(userId, projectId) {
  const existing = await prisma.qAReport.findFirst({
    where: {
      userId,
      projectId,
      title: REPORT_TITLE,
    },
    select: { id: true },
  });

  const data = {
    userId,
    projectId,
    type: "tests",
    title: REPORT_TITLE,
    sourceInput: "Private E2E report source input.",
    markdown: [
      "# E2E Private Security Report",
      "This saved report belongs to the standard E2E user only.",
      `Canary: ${SECRET_CANARY}`,
    ].join("\n\n"),
    structuredData: {
      fixture: true,
      purpose: "security-cross-user-abuse",
    },
  };

  if (existing) {
    return prisma.qAReport.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.qAReport.create({ data });
}

async function upsertBug(userId, projectId) {
  const existing = await prisma.bugCollectionItem.findFirst({
    where: {
      userId,
      projectId,
      title: BUG_TITLE,
    },
    select: { id: true },
  });

  const data = {
    userId,
    projectId,
    title: BUG_TITLE,
    status: "new",
    severity: "medium",
    priority: "medium",
    summary: "Private E2E bug collection item for cross-user isolation tests.",
    environment: "E2E local security fixture",
    steps: ["Open private standard-user data.", "Attempt access as limited-access user."],
    expectedResult: "Limited-access user is blocked.",
    actualResult: "This item should not be readable by the limited-access user.",
    impact: "Verifies user data isolation.",
    sourceInput: "Private E2E bug source input.",
    markdown: `# ${BUG_TITLE}\n\nCanary: ${SECRET_CANARY}`,
    tags: ["e2e", "security", "private"],
    structuredData: {
      fixture: true,
      purpose: "security-cross-user-abuse",
    },
  };

  if (existing) {
    return prisma.bugCollectionItem.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.bugCollectionItem.create({ data });
}

function printPowerShellEnv({ project, source, report, bug }) {
  console.log("");
  console.log("Security E2E fixtures are ready. Paste these into PowerShell before running the security spec:");
  console.log("");
  console.log(`$env:QATALYST_E2E_STANDARD_PROJECT_ID="${project.id}"`);
  console.log(`$env:QATALYST_E2E_STANDARD_SOURCE_ID="${source.id}"`);
  console.log(`$env:QATALYST_E2E_STANDARD_REPORT_ID="${report.id}"`);
  console.log(`$env:QATALYST_E2E_STANDARD_BUG_ID="${bug.id}"`);
  console.log(`$env:QATALYST_E2E_SECRET_CANARY="${SECRET_CANARY}"`);
  console.log("");
  console.log("Then run:");
  console.log("npx playwright test e2e/security-cross-user-abuse.spec.ts");
  console.log("");
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required. Run this from the project root with your local .env loaded.");
  }

  const standardUser = await upsertUser(STANDARD_USER);
  await upsertUser(LIMITED_USER);

  const project = await upsertProject(standardUser.id);
  const source = await upsertSource(project.id);
  const report = await upsertReport(standardUser.id, project.id);
  const bug = await upsertBug(standardUser.id, project.id);

  printPowerShellEnv({ project, source, report, bug });
}

main()
  .catch((error) => {
    console.error("Failed to seed E2E security fixtures:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
