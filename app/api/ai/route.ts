import {
  resolveAIPrincipal,
  authorizeStoredAI,
  boundedBytes,
  failure,
  type AILease,
} from "../../../lib/ai/guard";
import { AIError, validateInput } from "../../../lib/ai/contracts";
import { routeAI } from "../../../lib/ai/router";
import { recordAIUsageSafe as recordAIUsage } from "../../../lib/ai/telemetry";
import {
  reserveUsage,
  settleUsage,
  failUsage,
  type UsageReservation,
} from "../../../lib/server/billing";
import { PlatformError } from "../../../lib/server/types";
import { getStore } from "../../../lib/server/store";
import {
  TutorLockedError,
  type TutorTurnLease,
} from "../../../lib/server/tutor-core";
import type { TutorState } from "../../../lib/tutor/types";
import { verifySourceEvidence } from "../../../lib/server/source-evidence";
import { embedTexts, embeddingStatus } from "../../../lib/rag/embeddings";
import type { RagSnapshot } from "../../../lib/rag/types";
import { executeSummaryInput } from "../../../lib/server/summary-execution";
import {
  aiHttpKey,
  aiHttpFingerprint,
  type AIHttpLease,
} from "../../../lib/server/ai-http-core";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  let release: AILease | undefined;
  let reservation: UsageReservation | undefined;
  let embeddingReservation: UsageReservation | undefined;
  let ragSnapshot: RagSnapshot | undefined;
  const ragMetadata = () =>
    ragSnapshot
      ? {
          rag: {
            snapshotId: ragSnapshot.id,
            mode: ragSnapshot.mode,
            documents: ragSnapshot.documents.length,
            hits: ragSnapshot.hits.length,
            potentialConflict: ragSnapshot.potentialConflict,
            expiresAt: ragSnapshot.expiresAt,
          },
        }
      : {};
  let tutorLease: TutorTurnLease | undefined;
  let httpLease: AIHttpLease | undefined;
  let requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const signal = AbortSignal.any([req.signal, AbortSignal.timeout(60000)]);
  let task = "invalid";
  try {
    const principal = await resolveAIPrincipal(req);
    const key = aiHttpKey(req.headers.get("idempotency-key"));
    signal.throwIfAborted();
    if (!req.headers.get("content-type")?.includes("application/json"))
      throw new AIError("INVALID_CONTENT_TYPE", 415);
    let raw: unknown;
    try {
      raw = JSON.parse(
        new TextDecoder().decode(await boundedBytes(req, 9 * 1024 * 1024)),
      );
    } catch (e) {
      if (e instanceof AIError) throw e;
      throw new AIError("INVALID_JSON");
    }
    const input = validateInput(raw);
    input.sourceEvidence = verifySourceEvidence(
      input.sourceEvidence,
      input.source,
      principal.userId,
    );
    httpLease = getStore().beginAIHttpRequest(
      principal.userId,
      principal.sessionVersion,
      "ai",
      key,
      aiHttpFingerprint(input),
    );
    requestId = httpLease.requestId;
    release = authorizeStoredAI(principal.userId, principal.sessionVersion);
    task = input.task;
    if (input.task === "summary") {
      const result = await executeSummaryInput(
        input,
        { userId: release.userId, sessionVersion: release.sessionVersion },
        {
          requestId,
          signal,
          telemetry: false,
          commit: () => {
            signal.throwIfAborted();
            getStore().completeAIHttpRequest(httpLease!);
          },
        },
      );
      recordAIUsage({
        requestId,
        userId: release.userId,
        task,
        provider: result.provider,
        model: result.model,
        status: "success",
        ...result.usage,
        latencyMs: Date.now() - startedAt,
      });
      const {
        provider: _provider,
        model: _model,
        usage: _usage,
        tutorReply: _tutorReply,
        ...output
      } = result;
      return Response.json(
        { ...output, requestId },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (input.ragScope) {
      if (input.media || input.youtubeUrl)
        throw new AIError("RAG_RAW_MEDIA_UNSUPPORTED");
      if (input.tutorSessionId && !input.ragScope.snapshotId)
        throw new AIError("RAG_SOURCE_CHANGED", 409);
      const store = getStore(),
        scope = input.ragScope;
      if (scope.snapshotId)
        ragSnapshot = store.ragReadSnapshot(
          release.userId,
          release.sessionVersion,
          scope.snapshotId,
          scope,
        );
      else {
        const initial = store.ragSearch(
          release.userId,
          scope,
          input.tutorProblem || input.question,
        );
        reservation = reserveUsage({
          userId: release.userId,
          sessionVersion: release.sessionVersion,
          requestId,
          task: input.task,
          mode: input.mode,
          kind: "text",
        });
        let embedding: { vector: number[]; model: string } | undefined;
        if (scope.mode === "hybrid") {
          if (scope.consent !== true) throw new AIError("RAG_CONSENT_REQUIRED");
          store.ragRequireSemantic(
            release.userId,
            scope,
            embeddingStatus().model,
          );
          embeddingReservation = reserveUsage({
            userId: release.userId,
            sessionVersion: release.sessionVersion,
            requestId: requestId + "-embedding",
            task: "index",
            mode: "quick",
            kind: "text",
          });
          const encoded = await embedTexts(
            [input.tutorProblem || input.question],
            fetch,
            signal,
          );
          embedding = { vector: encoded.vectors[0], model: encoded.model };
          recordAIUsage({
            requestId: requestId + "-embedding",
            userId: release.userId,
            task: "index",
            provider: "openai",
            model: encoded.model,
            status: "success",
            inputTokens: encoded.totalTokens,
            latencyMs: Date.now() - startedAt,
          });
        }
        ragSnapshot = store.ragPrepareSnapshot(
          release.userId,
          release.sessionVersion,
          scope,
          input.tutorProblem || input.question,
          embedding,
        );
        store.ragAssertDocuments(
          release.userId,
          release.sessionVersion,
          scope.workspaceId,
          initial.documents,
        );
        if (embedding)
          store.ragRequireSemantic(
            release.userId,
            scope,
            embedding.model,
            release.sessionVersion,
          );
      }
      input.source = ragSnapshot.source;
      input.sourceEvidence = undefined;
      input.ragContext = ragSnapshot;
    }
    if (input.task === "chat") {
      tutorLease = getStore().prepareTutorTurn(
        release.userId,
        release.sessionVersion,
        input,
        requestId,
      );
      input.history = tutorLease.history;
      input.tutorContext = tutorLease.context;
      input.guidance = tutorLease.context.guidance;
      if (input.guidance === "full")
        input.question =
          "Provide the complete worked solution for ONLY the immutable current exercise in the server tutoring context. Do not solve a different exercise from the latest message or source.";
    }
    task = input.task;
    const mime = input.media?.mimeType || "";
    const kind =
      input.youtubeUrl || mime.startsWith("video/")
        ? "video"
        : mime.startsWith("audio/")
          ? "audio"
          : mime.startsWith("image/")
            ? "image"
            : mime === "application/pdf"
              ? "pdf"
              : "text";
    signal.throwIfAborted();
    reservation ||= reserveUsage({
      userId: release.userId,
      sessionVersion: release.sessionVersion,
      requestId,
      task: input.task,
      mode: input.mode,
      kind,
      duration: input.videoRange
        ? input.videoRange.endSeconds - input.videoRange.startSeconds
        : undefined,
    });
    const result = await routeAI(input, fetch, signal);
    if (ragSnapshot) getStore().ragAssertSnapshot(release.userId, ragSnapshot);
    signal.throwIfAborted();
    let tutor: TutorState | undefined;
    if (tutorLease && !result.tutorReply)
      throw new AIError("INVALID_TUTOR_OUTPUT", 502);
    const settled = settleUsage({
      userId: release.userId,
      reservationId: reservation.reservationId,
      additionalReservationIds: embeddingReservation
        ? [embeddingReservation.reservationId]
        : undefined,
      onSettled: () => {
        signal.throwIfAborted();
        getStore().assertAIHttpRequest(httpLease!);
        if (ragSnapshot)
          getStore().ragAssertSnapshot(
            release!.userId,
            ragSnapshot,
            release!.sessionVersion,
          );
        if (tutorLease)
          tutor = getStore().commitTutorTurn(
            tutorLease!,
            result.tutorReply!,
            result.text,
            {
              references: result.references,
              verification: result.verification,
            },
          );
        getStore().completeAIHttpRequest(httpLease!, tutor?.sessionId);
      },
    });
    if (!settled.changed || settled.status !== "settled")
      throw new PlatformError("BILLING_REQUEST_FINALIZED", 409);
    recordAIUsage({
      requestId,
      userId: release.userId,
      task,
      provider: result.provider,
      model: result.model,
      status: "success",
      ...result.usage,
      latencyMs: Date.now() - startedAt,
    });
    const {
      provider: _provider,
      model: _model,
      usage: _usage,
      tutorReply: _tutorReply,
      ...output
    } = result;
    return Response.json(
      { ...output, ...(tutor ? { tutor } : {}), requestId },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    if (httpLease) {
      try {
        getStore().failAIHttpRequest(
          httpLease,
          e instanceof AIError || e instanceof PlatformError
            ? e.code
            : "PROVIDER_UNAVAILABLE",
        );
      } catch {
        console.warn("[lumio] HTTP_RECEIPT_RECOVERY_REQUIRED");
      }
    }
    if (release && embeddingReservation)
      try {
        failUsage({
          userId: release.userId,
          reservationId: embeddingReservation.reservationId,
        });
      } catch {}
    if (release && reservation) {
      try {
        failUsage({
          userId: release.userId,
          reservationId: reservation.reservationId,
        });
      } catch {
        console.warn(
          "Lumio credit reservation requires reconciliation",
          requestId,
        );
      }
    }
    if (release)
      recordAIUsage({
        requestId,
        userId: release.userId,
        task,
        status: "error",
        errorCode:
          e instanceof AIError || e instanceof PlatformError
            ? e.code
            : "PROVIDER_UNAVAILABLE",
        latencyMs: Date.now() - startedAt,
      });
    if (e instanceof TutorLockedError)
      return Response.json(
        { error: e.code, tutor: e.tutor, requestId, ...ragMetadata() },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    const response = failure(
      req.signal.aborted
        ? new AIError("REQUEST_CANCELLED", 499)
        : signal.aborted
          ? new AIError("PROVIDER_TIMEOUT", 504)
          : e,
    );
    if (tutorLease) {
      try {
        const saved = getStore().getTutorSession(
          tutorLease.userId,
          tutorLease.sessionVersion,
          tutorLease.sessionId,
        );
        const {
          sessionId,
          hintCount,
          requiredHints,
          canUnlock,
          revision,
          expiresAt,
          needsClarification,
        } = saved;
        return Response.json(
          {
            ...(await response.json()),
            ...ragMetadata(),
            requestId,
            tutor: {
              sessionId,
              hintCount,
              requiredHints,
              canUnlock,
              revision,
              expiresAt,
              needsClarification,
              guidance: tutorLease.context.guidance,
            },
          },
          { status: response.status, headers: { "Cache-Control": "no-store" } },
        );
      } catch {
        /* Never expose state after revocation, expiry or storage failure. */
      }
    }
    return response;
  } finally {
    if (tutorLease) {
      try {
        getStore().abortTutorTurn(tutorLease);
      } catch {
        /* Lease expires after 70 seconds if storage is unavailable. */
      }
    }
    release?.();
  }
}
