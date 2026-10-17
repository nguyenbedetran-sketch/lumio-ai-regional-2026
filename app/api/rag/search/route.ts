import { getStore } from "../../../../lib/server/store";
import { readJSON, json, errorResponse } from "../../../../lib/server/access";
import { ragActor } from "../../../../lib/server/rag-access";
import { PlatformError } from "../../../../lib/server/types";
import { AIError } from "../../../../lib/ai/contracts";
import { parseRagScope } from "../../../../lib/rag/types";
import { embedTexts, embeddingStatus } from "../../../../lib/rag/embeddings";
import {
  authorizeStoredAI,
  failure,
  type AILease,
} from "../../../../lib/ai/guard";
import {
  aiHttpFingerprint,
  aiHttpKey,
  AIHttpRequestError,
  type AIHttpLease,
} from "../../../../lib/server/ai-http-core";
import {
  reserveUsage,
  settleUsage,
  failUsage,
  type UsageReservation,
} from "../../../../lib/server/billing";
import { recordAIUsageSafe } from "../../../../lib/ai/telemetry";
export const runtime = "nodejs",
  dynamic = "force-dynamic";
export async function POST(req: Request) {
  let lease: AILease | undefined, reservation: UsageReservation | undefined;
  let httpLease: AIHttpLease | undefined;
  let requestId: string = crypto.randomUUID();
  const started = Date.now();
  try {
    const actor = await ragActor(req),
      body = await readJSON(req, 16000);
    let scope;
    try {
      scope = parseRagScope(body.scope);
    } catch {
      throw new PlatformError("INVALID_RAG_SCOPE");
    }
    if (
      typeof body.query !== "string" ||
      !body.query.trim() ||
      body.query.length > 2000
    )
      throw new PlatformError("INVALID_RAG_QUERY");
    // Resolve all selected documents under this actor before any paid provider call.
    const store = getStore(),
      query = body.query.trim();
    const initial = store.ragSearch(
      actor.user.id,
      scope,
      query,
      undefined,
      actor.user.sessionVersion,
    );
    let vector: { vector: number[]; model: string } | undefined;
    let inputTokens: number | undefined;
    if (scope.mode === "hybrid") {
      if (scope.consent !== true)
        throw new PlatformError("RAG_CONSENT_REQUIRED");
      if (!embeddingStatus().enabled)
        throw new AIError("EMBEDDINGS_DISABLED", 503);
      const model = embeddingStatus().model;
      store.ragRequireSemantic(
        actor.user.id,
        scope,
        model,
        actor.user.sessionVersion,
      );
      httpLease = store.beginAIHttpRequest(
        actor.user.id,
        actor.user.sessionVersion,
        "rag-search",
        aiHttpKey(req.headers.get("idempotency-key")),
        aiHttpFingerprint({
          workspaceId: scope.workspaceId,
          documentIds: scope.documentIds,
          query,
          documents: initial.documents,
          model,
        }),
      );
      requestId = httpLease.requestId;
      lease = authorizeStoredAI(actor.user.id, actor.user.sessionVersion);
      reservation = reserveUsage({
        userId: lease.userId,
        sessionVersion: lease.sessionVersion,
        requestId,
        task: "index",
        mode: "quick",
        kind: "text",
        sourceCharacters: query.length,
      });
      const result = await embedTexts(
        [query],
        fetch,
        AbortSignal.any([req.signal, AbortSignal.timeout(30000)]),
      );
      vector = { vector: result.vectors[0], model: result.model };
      // Telemetry success is recorded only after the atomic result/credit commit below.
      inputTokens = result.totalTokens;
    }
    const result = getStore().ragSearch(
      actor.user.id,
      scope,
      query,
      vector,
      actor.user.sessionVersion,
    );
    getStore().ragAssertDocuments(
      actor.user.id,
      actor.user.sessionVersion,
      scope.workspaceId,
      initial.documents,
    );
    if (vector)
      getStore().ragRequireSemantic(
        actor.user.id,
        scope,
        vector.model,
        actor.user.sessionVersion,
      );
    if (lease && reservation) {
      const settled = settleUsage({
        userId: lease.userId,
        reservationId: reservation.reservationId,
        onSettled: () => {
          req.signal.throwIfAborted();
          store.assertAIHttpRequest(httpLease!);
          getStore().ragAssertDocuments(
            actor.user.id,
            lease!.sessionVersion,
            scope.workspaceId,
            result.documents,
          );
          if (vector)
            getStore().ragRequireSemantic(
              actor.user.id,
              scope,
              vector.model,
              lease!.sessionVersion,
            );
          store.completeAIHttpRequest(httpLease!);
        },
      });
      if (!settled.changed || settled.status !== "settled")
        throw new PlatformError("BILLING_REQUEST_FINALIZED", 409);
      recordAIUsageSafe({
        requestId,
        userId: lease.userId,
        task: "index",
        provider: "openai",
        model: vector!.model,
        status: "success",
        inputTokens,
        latencyMs: Date.now() - started,
      });
    }
    return json({ ...result, credits: reservation?.units || 0, requestId });
  } catch (e) {
    if (httpLease)
      try {
        getStore().failAIHttpRequest(
          httpLease,
          e instanceof PlatformError || e instanceof AIError
            ? e.code
            : "PROVIDER_UNAVAILABLE",
        );
      } catch {}
    if (lease && reservation)
      try {
        failUsage({
          userId: lease.userId,
          reservationId: reservation.reservationId,
        });
      } catch {}
    if (e instanceof AIHttpRequestError) return failure(e);
    if (req.signal.aborted)
      return json({ error: "REQUEST_CANCELLED", requestId }, 499);
    return e instanceof AIError
      ? json({ error: e.code, requestId }, e.status)
      : errorResponse(e);
  } finally {
    lease?.();
  }
}
