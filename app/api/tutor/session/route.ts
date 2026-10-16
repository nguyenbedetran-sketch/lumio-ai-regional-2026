import { readJSON, json, errorResponse } from "../../../../lib/server/access";
import { requireBoundAIActor } from "../../../../lib/ai/guard";
import { getStore } from "../../../../lib/server/store";
import { PlatformError } from "../../../../lib/server/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
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
    const user = await requireBoundAIActor(req),
      id = sessionId(new URL(req.url).searchParams.get("sessionId"));
    return json(
      getStore().getTutorSession(user.userId, user.sessionVersion, id),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function DELETE(req: Request) {
  try {
    const user = await requireBoundAIActor(req),
      body = await readJSON(req);
    if (body.all !== true && body.sessionId === undefined)
      throw new PlatformError("INVALID_TUTOR_SESSION");
    if (body.all === true && body.sessionId !== undefined)
      throw new PlatformError("INVALID_TUTOR_SESSION");
    return json(
      getStore().deleteTutorSessions(
        user.userId,
        user.sessionVersion,
        body.all === true ? undefined : sessionId(body.sessionId),
      ),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
