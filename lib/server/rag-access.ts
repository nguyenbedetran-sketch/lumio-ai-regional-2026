import { assertSameOrigin, requireActor } from "./access";
import { requireMobile } from "./mobile-access";
import { PlatformError } from "./types";
const limits = new Map<string, { at: number; count: number }>();
export async function ragActor(req: Request) {
  const actor = req.headers.has("authorization")
    ? requireMobile(req)
    : await (async () => {
        if (req.method === "GET") {
          const site = req.headers.get("sec-fetch-site");
          if (site && !["same-origin", "none"].includes(site))
            throw new PlatformError("INVALID_ORIGIN", 403);
        } else assertSameOrigin(req);
        return requireActor();
      })();
  if (
    req.headers.has("authorization")
      ? req.headers.get("x-lumio-user") !== actor.user.id
      : req.headers.get("x-lumio-account") !== actor.user.storageKey
  )
    throw new PlatformError("SESSION_REVOKED", 401);
  const now = Date.now(),
    id = actor.user.id,
    old = limits.get(id);
  const value = old && now - old.at < 60000 ? old : { at: now, count: 0 };
  if (value.count >= 30) throw new PlatformError("LOCAL_RATE_LIMIT", 429);
  value.count++;
  limits.set(id, value);
  if (limits.size > 1000)
    for (const [key, v] of limits) if (now - v.at >= 60000) limits.delete(key);
  return actor;
}
