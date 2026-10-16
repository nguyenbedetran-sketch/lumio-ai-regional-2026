import {
  requireAdmin,
  json,
  errorResponse,
} from "../../../../lib/server/access";
import { getStore } from "../../../../lib/server/store";
import { PlatformError } from "../../../../lib/server/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const actor = await requireAdmin("system.read");
    if (req.headers.get("x-lumio-account") !== actor.user.storageKey)
      throw new PlatformError("SESSION_REVOKED", 401);
    if (
      req.headers.has("authorization") ||
      ["cross-site", "same-site"].includes(
        req.headers.get("sec-fetch-site") || "",
      )
    )
      throw new PlatformError("INVALID_ORIGIN", 403);
    if (new URL(req.url).search)
      throw new PlatformError("INVALID_JOB_HEALTH_QUERY", 400);
    return json(
      getStore().getJobHealth(actor.user.id, actor.user.sessionVersion),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
