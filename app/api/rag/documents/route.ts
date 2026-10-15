import { getStore } from "../../../../lib/server/store";
import { readJSON, json, errorResponse } from "../../../../lib/server/access";
import { ragActor } from "../../../../lib/server/rag-access";
import { verifySourceEvidence } from "../../../../lib/server/source-evidence";
import { PlatformError } from "../../../../lib/server/types";
import { AIError } from "../../../../lib/ai/contracts";
import { authorizeAI, type AILease } from "../../../../lib/ai/guard";
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
  const requestId = crypto.randomUUID(),
    start = Date.now();
  try {
    const actor = await ragActor(req),
      body = await readJSON(req, 900000),
      store = getStore(),
      space = typeof body.workspaceId === "string" ? body.workspaceId : "main";
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
      if (data.semantic && data.model === embeddingStatus().model)
        return json({
          document: store
            .ragList(actor.user.id, space)
            .find((d) => d.id === data.id),
          credits: 0,
          unchanged: true,
          requestId,
        });
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
        data.chunks.map((c) => c.text),
        fetch,
        AbortSignal.any([req.signal, AbortSignal.timeout(30000)]),
      );
      let document;
      settleUsage({
        userId: lease.userId,
        reservationId: reservation.reservationId,
        onSettled: () => {
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
        },
      });
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
