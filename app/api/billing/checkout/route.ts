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
      typeof body.itemId !== "string" ||
      (body.interval !== "month" && body.interval !== "year")
    )
      throw new PlatformError("INVALID_BILLING_ITEM");
    return json(
      getStore().prepareCheckout({
        userId: actor.user.id,
        sessionVersion: actor.user.sessionVersion,
        itemId: body.itemId,
        interval: body.interval,
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
