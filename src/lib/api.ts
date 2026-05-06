import { z } from "zod";

export const qaRequestSchema = z.object({
  input: z.string().min(10, "Please provide at least 10 characters."),
  projectId: z.string().nullable().optional(),
  projectContext: z.string().optional(),
  projectContextBlock: z.string().optional(),
  projectContextSummary: z.string().optional(),
  projectContextUsed: z.boolean().optional(),
  selectedProjectId: z.string().optional(),
  selectedProjectName: z.string().optional(),
  selectedProjectSourceIds: z.array(z.string()).optional(),
  automationCredentialsUsed: z.boolean().optional(),
  automationCredentialProfileSummary: z.string().optional(),
  automationCredentialPromptBlock: z.string().optional(),
  automationCredentialProfiles: z
    .array(
      z.object({
        key: z.string(),
        name: z.string(),
        role: z.string(),
        environment: z.string(),
        emailEnvVar: z.string(),
        passwordEnvVar: z.string(),
        usernameEnvVar: z.string(),
        notes: z.string(),
        isDefault: z.boolean(),
      })
    )
    .optional(),
  projectContextMeta: z
    .object({
      projectName: z.string().optional(),
      productType: z.string().optional(),
      enabledSourceCount: z.number().optional(),
      selectedSourceCount: z.number().optional(),
      selectedSourceIds: z.array(z.string()).optional(),
      totalSourceCount: z.number().optional(),
    })
    .nullable()
    .optional(),
});

export function jsonError(message: string, status = 400) {
  return Response.json({ ok: false, error: message }, { status });
}
