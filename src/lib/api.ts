import { z } from "zod";

export const qaRequestSchema = z.object({
  input: z.string().min(10, "Please provide at least 10 characters."),
});

export function jsonError(message: string, status = 400) {
  return Response.json({ ok: false, error: message }, { status });
}
