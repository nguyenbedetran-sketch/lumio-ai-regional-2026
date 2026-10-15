import {
  requireActor,
  assertSameOrigin,
  readJSON,
  json,
  errorResponse,
} from "../../../../lib/server/access";
import { requireMobile } from "../../../../lib/server/mobile-access";
import { getStore } from "../../../../lib/server/store";
import { PlatformError } from "../../../../lib/server/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function actor(req: Request) {
  if (req.headers.has("authorization")) return requireMobile(req);
  return requireActor();
}
function sessionId(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
      value,
    )
  )
    throw new PlatformError("INVALID_TUTOR_SESSION");
  return value;
}
export async function GET(req: Request) {
  try {
    const { user } = await actor(req),
      id = sessionId(new URL(req.url).searchParams.get("sessionId"));
    return json(getStore().getTutorSession(user.id, user.sessionVersion, id));
  } catch (e) {
    return errorResponse(e);
  }
}
export async function DELETE(req: Request) {
  try {
    if (!req.headers.has("authorization")) assertSameOrigin(req);
    const { user } = await actor(req),
      body = await readJSON(req);
    if (body.all !== true && body.sessionId === undefined)
      throw new PlatformError("INVALID_TUTOR_SESSION");
    if (body.all === true && body.sessionId !== undefined)
      throw new PlatformError("INVALID_TUTOR_SESSION");
    return json(
      getStore().deleteTutorSessions(
        user.id,
        user.sessionVersion,
        body.all === true ? undefined : sessionId(body.sessionId),
      ),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
