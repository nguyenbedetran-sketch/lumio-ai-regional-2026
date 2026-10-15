import {
  assertSameOrigin,
  errorResponse,
  json,
  readJSON,
  requireActor,
} from "../../../../lib/server/access";
import { getStore } from "../../../../lib/server/store";
import { PlatformError } from "../../../../lib/server/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const body = await readJSON(req);
    const actor = await requireActor();
    if (
      typeof body.requestId !== "string" ||
      !["cancel", "resume", "downgrade"].includes(String(body.action)) ||
      (body.planId !== undefined && body.planId !== "free")
    )
      throw new PlatformError("INVALID_SUBSCRIPTION_ACTION");
    return json(
      getStore().updateSubscription({
        userId: actor.user.id,
        sessionVersion: actor.user.sessionVersion,
        requestId: body.requestId,
        action: body.action as "cancel" | "resume" | "downgrade",
        planId: body.planId as "free" | undefined,
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
