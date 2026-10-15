import { errorResponse, json, requireActor } from "../../../lib/server/access";
import { getStore } from "../../../lib/server/store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const actor = await requireActor();
    const offset = Number(new URL(req.url).searchParams.get("offset") || 0);
    return json(
      getStore().getBillingSnapshot(
        actor.user.id,
        actor.user.sessionVersion,
        Number.isSafeInteger(offset)
          ? Math.max(0, Math.min(100000, offset))
          : 0,
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
