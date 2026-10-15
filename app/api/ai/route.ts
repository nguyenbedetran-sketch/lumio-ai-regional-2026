import {
  authorizeAI,
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
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  let release: AILease | undefined;
  let reservation: UsageReservation | undefined;
  let tutorLease: TutorTurnLease | undefined;
  const requestId = crypto.randomUUID(),
    startedAt = Date.now();
  const signal = AbortSignal.any([req.signal, AbortSignal.timeout(60000)]);
  let task = "invalid";
  try {
    release = await authorizeAI(req);
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
      release.userId,
    );
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
    reservation = reserveUsage({
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
    signal.throwIfAborted();
    let tutor: TutorState | undefined;
    if (tutorLease && !result.tutorReply)
      throw new AIError("INVALID_TUTOR_OUTPUT", 502);
    settleUsage({
      userId: release.userId,
      reservationId: reservation.reservationId,
      onSettled: tutorLease
        ? () => {
            tutor = getStore().commitTutorTurn(
              tutorLease!,
              result.tutorReply!,
              result.text,
              {
                references: result.references,
                verification: result.verification,
              },
            );
          }
        : undefined,
    });
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
        { error: e.code, tutor: e.tutor, requestId },
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
