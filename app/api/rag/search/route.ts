import { getStore } from "../../../../lib/server/store";
import { readJSON, json, errorResponse } from "../../../../lib/server/access";
import { ragActor } from "../../../../lib/server/rag-access";
import { PlatformError } from "../../../../lib/server/types";
import { AIError } from "../../../../lib/ai/contracts";
import { parseRagScope } from "../../../../lib/rag/types";
import { embedTexts, embeddingStatus } from "../../../../lib/rag/embeddings";
import { authorizeAI, type AILease } from "../../../../lib/ai/guard";
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
  const requestId = crypto.randomUUID(),
    started = Date.now();
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
    const initial = getStore().ragSearch(
      actor.user.id,
      scope,
      body.query,
      undefined,
      actor.user.sessionVersion,
    );
    let vector: { vector: number[]; model: string } | undefined;
    if (scope.mode === "hybrid") {
      if (scope.consent !== true)
        throw new PlatformError("RAG_CONSENT_REQUIRED");
      if (!embeddingStatus().enabled)
        throw new AIError("EMBEDDINGS_DISABLED", 503);
      getStore().ragRequireSemantic(
        actor.user.id,
        scope,
        embeddingStatus().model,
      );
      lease = await authorizeAI(req);
      reservation = reserveUsage({
        userId: lease.userId,
        sessionVersion: lease.sessionVersion,
        requestId,
        task: "index",
        mode: "quick",
        kind: "text",
      });
      const result = await embedTexts(
        [body.query],
        fetch,
        AbortSignal.any([req.signal, AbortSignal.timeout(30000)]),
      );
      vector = { vector: result.vectors[0], model: result.model };
      recordAIUsageSafe({
        requestId,
        userId: lease.userId,
        task: "index",
        provider: "openai",
        model: result.model,
        status: "success",
        inputTokens: result.totalTokens,
        latencyMs: Date.now() - started,
      });
    }
    const result = getStore().ragSearch(
      actor.user.id,
      scope,
      body.query,
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
    if (lease && reservation)
      settleUsage({
        userId: lease.userId,
        reservationId: reservation.reservationId,
        onSettled: () => {
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
        },
      });
    return json({ ...result, credits: reservation?.units || 0, requestId });
  } catch (e) {
    if (lease && reservation)
      try {
        failUsage({
          userId: lease.userId,
          reservationId: reservation.reservationId,
        });
      } catch {}
    return e instanceof AIError
      ? json({ error: e.code, requestId }, e.status)
      : errorResponse(e);
  } finally {
    lease?.();
  }
}
