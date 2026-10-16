import { getStore } from "../../../../lib/server/store";
import { readJSON, json, errorResponse } from "../../../../lib/server/access";
import { ragActor } from "../../../../lib/server/rag-access";
import { verifySourceEvidence } from "../../../../lib/server/source-evidence";
import { PlatformError } from "../../../../lib/server/types";
import { AIError } from "../../../../lib/ai/contracts";
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
import { embedTexts, embeddingStatus } from "../../../../lib/rag/embeddings";
import { recordAIUsageSafe } from "../../../../lib/ai/telemetry";
export const runtime = "nodejs",
  dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const actor = await ragActor(req),
      url = new URL(req.url);
    if (url.searchParams.has("snapshotId"))
      return json({
        snapshot: getStore().ragReadSnapshot(
          actor.user.id,
          actor.user.sessionVersion,
          url.searchParams.get("snapshotId")!,
        ),
      });
    return json({
      documents: getStore().ragList(
        actor.user.id,
        url.searchParams.get("workspaceId") || "main",
      ),
      embeddingsAvailable: embeddingStatus().enabled,
      retentionDays: 7,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(req: Request) {
  let lease: AILease | undefined, reservation: UsageReservation | undefined;
  let httpLease: AIHttpLease | undefined;
  let requestId: string = crypto.randomUUID();
  const start = Date.now();
  try {
    const actor = await ragActor(req),
      body = await readJSON(req, 900000),
      store = getStore(),
      space = typeof body.workspaceId === "string" ? body.workspaceId : "main";
    if (body.action === "delete-source") {
      if (
        Object.keys(body).some(
          (key) => !["action", "clientItemId"].includes(key),
        ) ||
        typeof body.clientItemId !== "string"
      )
        throw new PlatformError("INVALID_RAG_DOCUMENT");
      return json(
        store.ragDeleteSource(
          actor.user.id,
          body.clientItemId,
          actor.user.sessionVersion,
        ),
      );
    }
    if (body.action === "delete") {
      if (typeof body.documentId !== "string")
        throw new PlatformError("INVALID_RAG_SCOPE");
      return json(
        store.ragDelete(
          actor.user.id,
          space,
          body.documentId,
          actor.user.sessionVersion,
        ),
      );
    }
    if (body.action === "embed") {
      if (body.externalConsent !== true)
        throw new PlatformError("RAG_CONSENT_REQUIRED", 400);
      if (typeof body.documentId !== "string")
        throw new PlatformError("INVALID_RAG_SCOPE");
      const data = store.ragEmbeddingInput(
        actor.user.id,
        space,
        body.documentId,
      );
      if (!embeddingStatus().enabled)
        throw new AIError("EMBEDDINGS_DISABLED", 503);
      const model = embeddingStatus().model,
        key = aiHttpKey(req.headers.get("idempotency-key")),
        fingerprint = aiHttpFingerprint({
          workspaceId: space,
          documentId: data.id,
          digest: data.digest,
          revision: data.revision,
          model,
        });
      // A lost-ACK retry must resolve to its prior paid receipt even though embedding is now unchanged.
      store.checkAIHttpReplay(
        actor.user.id,
        actor.user.sessionVersion,
        "rag-embed",
        key,
        fingerprint,
      );
      if (data.semantic && data.model === model)
        return json({
          document: store
            .ragList(actor.user.id, space)
            .find((d) => d.id === data.id),
          credits: 0,
          unchanged: true,
          requestId,
        });
      httpLease = store.beginAIHttpRequest(
        actor.user.id,
        actor.user.sessionVersion,
        "rag-embed",
        key,
        fingerprint,
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
      });
      const result = await embedTexts(
        data.chunks.map((c) => c.text),
        fetch,
        AbortSignal.any([req.signal, AbortSignal.timeout(30000)]),
      );
      let document;
      const settled = settleUsage({
        userId: lease.userId,
        reservationId: reservation.reservationId,
        onSettled: () => {
          req.signal.throwIfAborted();
          store.assertAIHttpRequest(httpLease!);
          document = store.ragSetEmbeddings(
            actor.user.id,
            space,
            data.id,
            data.digest,
            data.revision,
            result.model,
            result.vectors,
            true,
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
        model: result.model,
        status: "success",
        inputTokens: result.totalTokens,
        latencyMs: Date.now() - start,
      });
      return json({ document, credits: reservation.units, requestId });
    }
    if (body.action !== "index" || body.storageConsent !== true)
      throw new PlatformError("RAG_CONSENT_REQUIRED", 400);
    if (
      typeof body.text !== "string" ||
      typeof body.title !== "string" ||
      typeof body.clientItemId !== "string"
    )
      throw new PlatformError("INVALID_RAG_DOCUMENT");
    const evidence = verifySourceEvidence(
      body.sourceEvidence,
      body.text,
      actor.user.id,
    );
    return json({
      document: store.ragIndex(
        actor.user.id,
        {
          workspaceId: space,
          clientItemId: body.clientItemId,
          title: body.title,
          text: body.text,
          evidence,
        },
        actor.user.sessionVersion,
      ),
    });
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
