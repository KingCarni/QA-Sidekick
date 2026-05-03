import { apiOk } from "@/lib/api-response";
import { getSafeConfigStatus } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const status = getSafeConfigStatus();

  return apiOk(req, {
    ...status,
  });
}
