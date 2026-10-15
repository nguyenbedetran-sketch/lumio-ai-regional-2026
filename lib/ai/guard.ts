import { getServerSession } from "next-auth";
import { authOptions, providerStatus } from "../lumio/auth";
import { AIError } from "./contracts";
import { getUser, getStore, isFeatureEnabled } from "../server/store";
import { assertSameOrigin } from "../server/access";
import { PlatformError } from "../server/types";
import { requireMobile } from "../server/mobile-access";
import { isDesktopPreview } from "../server/desktop-mode";
import { isCompetitionPreview } from "../server/competition-preview";
export type AILease = (() => void) & { userId: string; sessionVersion: number };
/** Server-only continuation of a persisted owned job. No HTTP credential or public bypass. */
export function authorizeStoredAI(
  userId: string,
  sessionVersion: number,
  voice = false,
): AILease {
  if (
    isDesktopPreview() ||
    process.env.LUMIO_AI_ENABLED !== "true" ||
    !isFeatureEnabled("ai.enabled") ||
    (voice && !isFeatureEnabled("ai.voice"))
  )
    throw new AIError("AI_DISABLED", 503);
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
  if (
    isDesktopPreview() ||
    process.env.LUMIO_AI_ENABLED !== "true" ||
    !isFeatureEnabled("ai.enabled") ||
    (voice && !isFeatureEnabled("ai.voice"))
  )
    throw new AIError("AI_DISABLED", 503);
  const config = providerStatus();
  let principal = "";
  let userId: string | undefined;
  let sessionVersion = 0;
  if (req.headers.has("authorization")) {
    const { user } = requireMobile(req);
    principal = user.id;
    userId = user.id;
    sessionVersion = user.sessionVersion;
  } else {
    try {
      assertSameOrigin(req);
    } catch {
      throw new AIError("INVALID_ORIGIN", 403);
    }
  }
  if (!userId && (config.google || config.facebook)) {
    const session = await getServerSession(authOptions());
    const identity = session as unknown as {
      userId?: string;
      sessionVersion?: number;
    } | null;
    const user = identity?.userId ? getUser(identity.userId) : null;
    if (
      user &&
      !user.disabled &&
      user.sessionVersion === identity?.sessionVersion
    ) {
      principal = user.id;
      userId = user.id;
      sessionVersion = user.sessionVersion;
    }
  }
  // Every paid provider call must belong to a canonical account and credit ledger.
  if (!principal || !userId) throw new AIError("SIGN_IN_REQUIRED", 401);
  // Transactional SQLite counters coordinate processes sharing this database.
  // Separate machines still require a shared durable backend; free-host resets
  // remain explicitly disclosed by the competition preview.
  return authorizeStoredAI(userId, sessionVersion, voice);
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
      requestId: crypto.randomUUID(),
    },
    {
      status: known ? e.status : 502,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
