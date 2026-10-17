import { getStore, type PlatformStore } from "./store";
import { requirePermission } from "./policy";
import { requestOrigin } from "./origin";
import { PlatformError, type Actor, type Permission } from "./types";
import {
  reportServerError,
  safeServerErrorCode,
  type ServerErrorContext,
} from "./error-diagnostics";

export function actorFromSession(
  session: unknown,
  store: PlatformStore = getStore(),
): Actor {
  const value = session as {
    userId?: unknown;
    sessionVersion?: unknown;
  } | null;
  if (
    typeof value?.userId !== "string" ||
    typeof value?.sessionVersion !== "number"
  )
    throw new PlatformError("SIGN_IN_REQUIRED", 401);
  const user = store.getUser(value.userId);
  if (!user || user.disabled || user.sessionVersion !== value.sessionVersion)
    throw new PlatformError("SESSION_REVOKED", 401);
  return { user, memberships: store.getMemberships(user.id) };
}
export async function currentSession() {
  // Lazy imports keep the OAuth callbacks -> identity store -> authorization graph acyclic.
  const [{ getServerSession }, { authOptions }] = await Promise.all([
    import("next-auth"),
    import("../lumio/auth"),
  ]);
  return getServerSession(authOptions());
}
export async function requireActor(): Promise<Actor> {
  return actorFromSession(await currentSession());
}
export function requireRecentAdminSession(session: unknown, time = Date.now()) {
  const authTime = (session as { authenticatedAt?: unknown } | null)
    ?.authenticatedAt;
  if (
    typeof authTime !== "number" ||
    !Number.isFinite(authTime) ||
    authTime > time + 30000 ||
    time - authTime > 60 * 60 * 1000
  )
    throw new PlatformError("ADMIN_REAUTH_REQUIRED", 401);
}
export async function requireAdmin(
  permission: Permission = "admin.read",
): Promise<Actor> {
  const session = await currentSession(),
    actor = actorFromSession(session);
  requirePermission(actor, "admin.read");
  requireRecentAdminSession(session);
  requirePermission(actor, permission);
  return actor;
}
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const expected = requestOrigin(req);
  if (!origin || origin !== expected)
    throw new PlatformError("INVALID_ORIGIN", 403);
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none")
    throw new PlatformError("INVALID_ORIGIN", 403);
}
export async function readJSON(
  req: Request,
  limit = 4096,
): Promise<Record<string, unknown>> {
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    throw new PlatformError("INVALID_CONTENT_TYPE", 415);
  if (Number(req.headers.get("content-length")) > limit)
    throw new PlatformError("PAYLOAD_TOO_LARGE", 413);
  const reader = req.body?.getReader();
  if (!reader) throw new PlatformError("INVALID_JSON");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new PlatformError("PAYLOAD_TOO_LARGE", 413);
    }
    chunks.push(value);
  }
  try {
    const combined = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const data: unknown = JSON.parse(new TextDecoder().decode(combined));
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw new Error();
    return data as Record<string, unknown>;
  } catch {
    throw new PlatformError("INVALID_JSON");
  }
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export function errorResponse(error: unknown, context?: ServerErrorContext) {
  const status = error instanceof PlatformError ? error.status : 503,
    code = error instanceof PlatformError ? error.code : "PLATFORM_UNAVAILABLE",
    publicCode = status >= 500 ? safeServerErrorCode(code) : code,
    requestId = crypto.randomUUID();
  reportServerError({ requestId, code: publicCode, status, context });
  return json(
    {
      error: publicCode,
      requestId,
    },
    status,
  );
}
