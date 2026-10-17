import {
  assertSameOrigin,
  readJSON,
  json,
  errorResponse,
} from "../../../../lib/server/access";
import { adminActor } from "../../../../lib/server/admin-access";
import { getStore } from "../../../../lib/server/store";
import { PlatformError } from "../../../../lib/server/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function PATCH(req: Request) {
  try {
    assertSameOrigin(req);
    const data = await readJSON(req),
      actor = await adminActor(req, "features.update");
    if (typeof data.key !== "string" || typeof data.enabled !== "boolean")
      throw new PlatformError("INVALID_REQUEST");
    return json({
      flag: getStore().updateFlag(
        actor.user.id,
        data.key,
        data.enabled,
        actor.user.sessionVersion,
      ),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
