import {
  requireAdmin,
  assertSameOrigin,
  readJSON,
  json,
  errorResponse,
} from "../../../../lib/server/access";
import { getStore } from "../../../../lib/server/store";
import { PlatformError } from "../../../../lib/server/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    await requireAdmin("users.read");
    const params = new URL(req.url).searchParams;
    const offset = Number(params.get("offset") || 0);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1000000)
      throw new PlatformError("INVALID_PAGE");
    return json(
      getStore().listUsers({ query: params.get("q") || "", offset, limit: 30 }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PATCH(req: Request) {
  try {
    assertSameOrigin(req);
    const data = await readJSON(req);
    if (
      typeof data.userId !== "string" ||
      typeof data.reason !== "string" ||
      typeof data.action !== "string" ||
      !["disable", "enable", "revoke"].includes(data.action)
    )
      throw new PlatformError("INVALID_REQUEST");
    const action = data.action as "disable" | "enable" | "revoke";
    const actor = await requireAdmin(
      action === "revoke" ? "users.sessions.revoke" : "users.suspend",
    );
    return json({
      user: getStore().updateUserAccess(
        actor.user.id,
        data.userId,
        action,
        data.reason,
        actor.user.sessionVersion,
      ),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
