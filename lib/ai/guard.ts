import { AIError } from "./contracts";
import { getStore, isFeatureEnabled } from "../server/store";
import { assertSameOrigin, requireActor } from "../server/access";
import { PlatformError } from "../server/types";
import { requireMobile } from "../server/mobile-access";
import { isDesktopPreview } from "../server/desktop-mode";
import { isCompetitionPreview } from "../server/competition-preview";
import { AIHttpRequestError } from "../server/ai-http-core";
export type AIPrincipal = { userId: string; sessionVersion: number };
export type AILease = (() => void) & AIPrincipal;
function enabled(voice: boolean) {
  if (
    isDesktopPreview() ||
    process.env.LUMIO_AI_ENABLED !== "true" ||
    !isFeatureEnabled("ai.enabled") ||
    (voice && !isFeatureEnabled("ai.voice"))
  )
    throw new AIError("AI_DISABLED", 503);
}
/** No AI quota/credits: also used by owned tutor-session and receipt recovery endpoints. */
export async function requireBoundAIActor(req: Request): Promise<AIPrincipal> {
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
  const { user } = native ? requireMobile(req) : await requireActor();
  if (
    native
      ? req.headers.get("x-lumio-user") !== user.id
      : req.headers.get("x-lumio-account") !== user.storageKey
  )
    throw new PlatformError("SESSION_REVOKED", 401);
  return { userId: user.id, sessionVersion: user.sessionVersion };
}
export async function resolveAIPrincipal(
  req: Request,
  voice = false,
): Promise<AIPrincipal> {
  enabled(voice);
  return requireBoundAIActor(req);
}
/** Server-only continuation of a persisted owned job; no public bypass credentials. */
export function authorizeStoredAI(
  userId: string,
  sessionVersion: number,
  voice = false,
): AILease {
  enabled(voice);
  const store = getStore(),
    user = store.getUser(userId);
  if (!user || user.disabled || user.sessionVersion !== sessionVersion)
    throw new AIError("SESSION_REVOKED", 401);
  const leaseId = store.acquireRuntimeAILease(
    userId,
    sessionVersion,
    isCompetitionPreview(),
  );
  let released = false;
  const release: AILease = () => {
    if (!released) {
      released = true;
      store.releaseRuntimeAILease(leaseId);
    }
  };
  release.userId = userId;
  release.sessionVersion = sessionVersion;
  return release;
}
export async function authorizeAI(
  req: Request,
  voice = false,
): Promise<AILease> {
  const p = await resolveAIPrincipal(req, voice);
  return authorizeStoredAI(p.userId, p.sessionVersion, voice);
}
export async function boundedBytes(
  req: Pick<Request, "body" | "headers">,
  max: number,
): Promise<Uint8Array> {
  if (Number(req.headers.get("content-length")) > max)
    throw new AIError("PAYLOAD_TOO_LARGE", 413);
  const reader = req.body?.getReader();
  if (!reader) throw new AIError("EMPTY_INPUT");
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > max) {
      await reader.cancel();
      throw new AIError("PAYLOAD_TOO_LARGE", 413);
    }
    chunks.push(value);
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
export function failure(e: unknown) {
  const known = e instanceof AIError || e instanceof PlatformError;
  return Response.json(
    {
      error: known ? e.code : "PROVIDER_UNAVAILABLE",
      requestId:
        e instanceof AIHttpRequestError && e.receipt
          ? e.receipt.requestId
          : crypto.randomUUID(),
      ...(e instanceof AIHttpRequestError && e.receipt
        ? { receipt: e.receipt }
        : {}),
    },
    {
      status: known ? e.status : 502,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
