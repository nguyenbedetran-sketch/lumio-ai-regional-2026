import { assertSameOrigin, requireAdmin } from "./access";
import { PlatformError, type Permission } from "./types";

/** Bind browser administration to the account that rendered the page. */
export async function adminActor(
  req: Request,
  permission: Permission = "admin.read",
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
  const actor = await requireAdmin(permission);
  if (req.headers.get("x-lumio-account") !== actor.user.storageKey)
    throw new PlatformError("SESSION_REVOKED", 401);
  return actor;
}
