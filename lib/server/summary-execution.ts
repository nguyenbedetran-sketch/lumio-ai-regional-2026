import { AIError, validateInput, type AIResult } from "../ai/contracts";
import { routeAI } from "../ai/router";
import { recordAIUsageSafe } from "../ai/telemetry";
import { verifySourceEvidence } from "./source-evidence";
import { getStore } from "./store";
import { PlatformError } from "./types";
import type { UsageReservation } from "./billing-types";
/** Shared summary execution AFTER a canonical AI lease is acquired by HTTP auth or an owned persisted job. */
export async function executeSummaryInput(
  raw: unknown,
  principal: { userId: string; sessionVersion: number },
  options: {
    requestId: string;
    signal?: AbortSignal;
    onReserved?: (reservation: UsageReservation) => void;
    /** Called in the same transaction as credit settlement. Must not open a transaction. */
    commit?: (result: AIResult) => void;
    telemetry?: boolean;
    /** Trusted production caller, never copied from raw AI input. */
    feature?: "learner.summary" | "job.summary-part";
  },
): Promise<AIResult> {
  const store = getStore(),
    startedAt = Date.now(),
    signal = AbortSignal.any([
      options.signal || new AbortController().signal,
      AbortSignal.timeout(60000),
    ]);
  let reservation: UsageReservation | undefined;
  try {
    signal.throwIfAborted();
    const user = store.getUser(principal.userId);
    if (
      !user ||
      user.disabled ||
      user.sessionVersion !== principal.sessionVersion
    )
      throw new PlatformError("SESSION_REVOKED", 401);
    const input = validateInput(raw);
    if (input.task !== "summary" || input.ragScope)
      throw new AIError("INVALID_TASK");
    input.sourceEvidence = verifySourceEvidence(
      input.sourceEvidence,
      input.source,
      principal.userId,
    );
    const mime = input.media?.mimeType || "",
      kind =
        input.youtubeUrl || mime.startsWith("video/")
          ? "video"
          : mime.startsWith("audio/")
            ? "audio"
            : mime.startsWith("image/")
              ? "image"
              : mime === "application/pdf"
                ? "pdf"
                : "text";
    reservation = store.reserveUsage({
      ...principal,
      requestId: options.requestId,
      task: "summary",
      mode: input.mode,
      kind,
      duration: input.videoRange
        ? input.videoRange.endSeconds - input.videoRange.startSeconds
        : undefined,
    });
    options.onReserved?.(reservation);
    signal.throwIfAborted();
    const result = await routeAI(input, fetch, signal, store.providerAttemptObserver({ userId: principal.userId, sessionVersion: principal.sessionVersion, requestId: options.requestId, reservationId: reservation.reservationId, feature: options.feature || "learner.summary" }));
    if (!result.summary) throw new AIError("INVALID_AI_OUTPUT", 502);
    signal.throwIfAborted();
    const current = store.getUser(principal.userId);
    if (
      !current ||
      current.disabled ||
      current.sessionVersion !== principal.sessionVersion
    )
      throw new PlatformError("SESSION_REVOKED", 401);
    const settled = store.settleUsage({
      userId: principal.userId,
      reservationId: reservation.reservationId,
      onSettled: options.commit ? () => options.commit!(result) : undefined,
    });
    if (!settled.changed || settled.status !== "settled")
      throw new PlatformError("BILLING_REQUEST_FINALIZED", 409);
    if (options.telemetry !== false)
      recordAIUsageSafe({
        requestId: options.requestId,
        userId: principal.userId,
        task: "summary",
        provider: result.provider,
        model: result.model,
        status: "success",
        ...result.usage,
        latencyMs: Date.now() - startedAt,
      });
    return result;
  } catch (error) {
    if (reservation)
      try {
        store.failUsage({
          userId: principal.userId,
          reservationId: reservation.reservationId,
        });
      } catch {
        console.warn("[lumio] JOB_CREDIT_RECONCILIATION_REQUIRED");
      }
    const safe = signal.aborted
      ? new AIError(
          options.signal?.aborted ? "REQUEST_CANCELLED" : "PROVIDER_TIMEOUT",
          504,
        )
      : error;
    if (options.telemetry !== false)
      recordAIUsageSafe({
        requestId: options.requestId,
        userId: principal.userId,
        task: "summary",
        status: "error",
        errorCode:
          safe instanceof AIError || safe instanceof PlatformError
            ? safe.code
            : "PROVIDER_UNAVAILABLE",
        latencyMs: Date.now() - startedAt,
      });
    throw safe;
  }
}
