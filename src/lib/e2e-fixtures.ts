import { prisma } from "@/lib/prisma";
import { isE2EAuthEnabled, type E2EPersona } from "@/lib/e2e-auth-personas";

export async function upsertE2EUserAndFixtures(persona: E2EPersona) {
  if (!isE2EAuthEnabled()) {
    throw new Error("E2E fixtures are disabled.");
  }

  const user = await prisma.user.upsert({
    where: { email: persona.email },
    update: { name: persona.name },
    create: {
      email: persona.email,
      name: persona.name,
    },
  });

  const project = await prisma.qAProject.upsert({
    where: {
      userId_name: {
        userId: user.id,
        name: "Project",
      },
    },
    update: {
      description: "E2E project fixture for generated Playwright skeletons.",
      productType: "Web App",
    },
    create: {
      userId: user.id,
      name: "Project",
      description: "E2E project fixture for generated Playwright skeletons.",
      productType: "Web App",
    },
  });

  const existingSource = await prisma.qAProjectSource.findFirst({
    where: {
      projectId: project.id,
      title: "Project Product Overview",
    },
    select: { id: true },
  });

  if (existingSource) {
    await prisma.qAProjectSource.update({
      where: { id: existingSource.id },
      data: {
        isEnabled: true,
        body: "E2E source fixture used for source-selection automation tests.",
        sourceType: "product-overview",
        tags: ["e2e", "fixture"],
      },
    });
  } else {
    await prisma.qAProjectSource.create({
      data: {
        projectId: project.id,
        title: "Project Product Overview",
        sourceType: "product-overview",
        tags: ["e2e", "fixture"],
        isEnabled: true,
        body: "E2E source fixture used for source-selection automation tests.",
      },
    });
  }

  if (persona.credits !== 0) {
    await prisma.creditsLedger.upsert({
      where: {
        userId_ref: {
          userId: user.id,
          ref: `e2e_fixture:${persona.key}`,
        },
      },
      update: {},
      create: {
        userId: user.id,
        delta: persona.credits,
        reason: "e2e_fixture",
        ref: `e2e_fixture:${persona.key}`,
      },
    });
  }

  return { user, project };
}
