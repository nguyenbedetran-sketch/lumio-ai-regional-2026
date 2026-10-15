import { assertSameOrigin, requireActor, requireAdmin } from "./access";
import { PlatformError } from "./types";
/** Account-bound browser endpoints; native teacher tools are not exposed yet. */
export async function teacherActor(
  req: Request,
  permission?: "teachers.read" | "teachers.review",
) {
  if (req.headers.has("authorization"))
    throw new PlatformError("SIGN_IN_REQUIRED", 401);
  if (req.method !== "GET") assertSameOrigin(req);
  else if (
    ["cross-site", "same-site"].includes(
      req.headers.get("sec-fetch-site") || "",
    )
  )
    throw new PlatformError("INVALID_ORIGIN", 403);
  const actor = permission
    ? await requireAdmin(permission)
    : await requireActor();
  if (req.headers.get("x-lumio-account") !== actor.user.storageKey)
    throw new PlatformError("SESSION_REVOKED", 401);
  return actor;
}
