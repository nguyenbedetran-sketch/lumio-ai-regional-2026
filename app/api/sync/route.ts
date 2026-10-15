import {
  requireActor,
  assertSameOrigin,
  readJSON,
  json,
  errorResponse,
} from "../../../lib/server/access";
import { requireMobile } from "../../../lib/server/mobile-access";
import { getStore } from "../../../lib/server/store";
import { MAX_SYNC_BYTES } from "../../../lib/sync/contracts";
import { PlatformError } from "../../../lib/server/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function actor(req: Request) {
  const native = req.headers.has("authorization");
  if (!native) {
    if (req.method !== "GET") assertSameOrigin(req);
    else if (
      ["cross-site", "same-site"].includes(
        req.headers.get("sec-fetch-site") || "",
      )
    )
      throw new PlatformError("INVALID_ORIGIN", 403);
  }
  const result = native ? requireMobile(req) : await requireActor();
  // Bind queued work to the page's account, even if cookies changed meanwhile.
  if (
    native
      ? req.headers.get("x-lumio-user") !== result.user.id
      : req.headers.get("x-lumio-account") !== result.user.storageKey
  )
    throw new PlatformError("SESSION_REVOKED", 401);
  return result;
}
export async function GET(req: Request) {
  try {
    const { user } = await actor(req);
    return json(getStore().syncRead(user.id, user.sessionVersion));
  } catch (e) {
    return errorResponse(e);
  }
}
export async function PUT(req: Request) {
  try {
    const { user } = await actor(req),
      body = await readJSON(req, MAX_SYNC_BYTES + 8192);
    return json(
      getStore().syncWrite(
        user.id,
        user.sessionVersion,
        body as Parameters<ReturnType<typeof getStore>["syncWrite"]>[2],
      ),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function DELETE(req: Request) {
  try {
    const { user } = await actor(req),
      body = await readJSON(req);
    if (
      typeof body.epoch !== "string" ||
      !Number.isSafeInteger(body.revision) ||
      Number(body.revision) < 0
    )
      throw new PlatformError("INVALID_SYNC_REQUEST", 400);
    return json(
      getStore().syncDelete(
        user.id,
        user.sessionVersion,
        body.epoch,
        Number(body.revision),
      ),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
