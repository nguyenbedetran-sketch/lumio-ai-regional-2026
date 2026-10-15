import {
  actorFromSession,
  currentSession,
  requireRecentAdminSession,
  assertSameOrigin,
  readJSON,
  json,
  errorResponse,
} from "../../../../lib/server/access";
import { getStore } from "../../../../lib/server/store";
import { PlatformError } from "../../../../lib/server/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { user } = actorFromSession(await currentSession());
    return json({
      devices: getStore().listMobileSessions(user.id, user.sessionVersion),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const session = await currentSession(),
      { user } = actorFromSession(session);
    // Issuing credentials requires a recent OAuth login, even for ordinary learners.
    try {
      requireRecentAdminSession(session);
    } catch {
      throw new PlatformError("REAUTH_REQUIRED", 401);
    }
    return json(getStore().createMobileCode(user.id, user.sessionVersion));
  } catch (error) {
    return errorResponse(error);
  }
}
export async function DELETE(req: Request) {
  try {
    assertSameOrigin(req);
    const { user } = actorFromSession(await currentSession()),
      { id } = await readJSON(req);
    if (typeof id !== "string" || id.length > 80)
      throw new PlatformError("INVALID_DEVICE");
    getStore().revokeMobileSession(user.id, user.sessionVersion, id);
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
