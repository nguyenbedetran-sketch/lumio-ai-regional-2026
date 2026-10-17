import { json, errorResponse } from "../../../../lib/server/access";
import { adminActor } from "../../../../lib/server/admin-access";
import { getStore } from "../../../../lib/server/store";
import { PlatformError } from "../../../../lib/server/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    await adminActor(req, "audit_logs.read");
    const offset = Number(new URL(req.url).searchParams.get("offset") || 0);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1000000)
      throw new PlatformError("INVALID_PAGE");
    return json({ events: getStore().listAudit(40, offset) });
  } catch (error) {
    return errorResponse(error);
  }
}
