import { randomUUID } from "node:crypto";
import type { DatabaseConnection as DatabaseSync } from "./database-connection";
import { PlatformError, type User } from "./types";
import {
  PROVIDER_ATTEMPT_FEATURES,
  observedInteger,
  safeProviderIdentifier,
  type ProviderAttemptContext,
  type ProviderAttemptObservation,
  type ProviderAttemptObserver,
} from "../ai/provider-attempt";
export const PROVIDER_ATTEMPT_LIMITS = {
  terminalRetentionMs: 31 * 86400000,
  purgeBatch: 200,
  unresolvedPerAccount: 64,
  unresolvedGlobal: 2048,
  total: 100000,
} as const;
type Context = {
  db: DatabaseSync;
  now: () => number;
  transaction: <T>(fn: () => T) => T;
  getUser: (id: string) => User | null;
};
export function createProviderAttemptStore({
  db,
  now,
  transaction,
  getUser,
}: Context) {
  function assertOwner(c: ProviderAttemptContext) {
    const u = getUser(c.userId);
    if (!u || u.disabled || u.sessionVersion !== c.sessionVersion)
      throw new PlatformError("SESSION_REVOKED", 401);
    const r = db
      .prepare(
        "SELECT user_id,request_id,status,task,expires_at FROM billing_reservations WHERE id=?",
      )
      .get(c.reservationId);
    const task =
      c.feature === "teacher.lesson" ||
      c.feature === "job.summary-part" ||
      c.feature === "learner.summary"
        ? "summary"
        : c.feature === "teacher.questions" || c.feature === "learner.quiz"
          ? "quiz"
          : c.feature === "learner.cards"
            ? "cards"
            : "chat";
    if (
      !r ||
      r.user_id !== c.userId ||
      r.request_id !== c.requestId ||
      r.task !== task
    )
      throw new PlatformError("AI_ATTEMPT_CONTEXT_INVALID", 403);
    if (r.status !== "reserved" || Number(r.expires_at) <= now())
      throw new PlatformError("BILLING_REQUEST_FINALIZED", 409);
  }
  function providerAttemptObserver(
    raw: ProviderAttemptContext,
  ): ProviderAttemptObserver {
    if (
      !raw ||
      typeof raw !== "object" ||
      Object.keys(raw).sort().join(",") !==
        "feature,requestId,reservationId,sessionVersion,userId" ||
      !PROVIDER_ATTEMPT_FEATURES.includes(raw.feature) ||
      !Number.isSafeInteger(raw.sessionVersion) ||
      raw.sessionVersion < 1 ||
      ![raw.requestId, raw.userId, raw.reservationId].every(
        (value) => typeof value === "string" && /^[\w-]{1,100}$/.test(value),
      )
    )
      throw new PlatformError("AI_ATTEMPT_CONTEXT_INVALID", 403);
    const c = { ...raw };
    assertOwner(c);
    return {
      prepare(details) {
        const provider = details.provider;
        const model = safeProviderIdentifier(details.requestedModel);
        if (
          !model ||
          !["openai", "gemini"].includes(details.provider) ||
          details.endpointKind !==
            (details.provider === "openai" ? "responses" : "generate-content")
        )
          throw new PlatformError("AI_ATTEMPT_CONTEXT_INVALID", 403);
        // Bounded retention is committed even when a later capacity check
        // refuses a new dispatch. No unresolved/credit/receipt row is purged.
        transaction(() => {
          assertOwner(c);
          db.prepare(
            "DELETE FROM ai_provider_attempts WHERE id IN(SELECT id FROM ai_provider_attempts WHERE ended_at IS NOT NULL AND ended_at<? ORDER BY ended_at,id LIMIT ?)",
          ).run(
            new Date(
              now() - PROVIDER_ATTEMPT_LIMITS.terminalRetentionMs,
            ).toISOString(),
            PROVIDER_ATTEMPT_LIMITS.purgeBatch,
          );
        });
        const id = transaction(() => {
          assertOwner(c);
          const pending = Number(
              db
                .prepare(
                  "SELECT count(*) n FROM ai_provider_attempts WHERE status='prepared'",
                )
                .get()!.n,
            ),
            own = Number(
              db
                .prepare(
                  "SELECT count(*) n FROM ai_provider_attempts WHERE status='prepared' AND user_id=?",
                )
                .get(c.userId)!.n,
            ),
            total = Number(
              db.prepare("SELECT count(*) n FROM ai_provider_attempts").get()!
                .n,
            );
          if (
            pending >= PROVIDER_ATTEMPT_LIMITS.unresolvedGlobal ||
            own >= PROVIDER_ATTEMPT_LIMITS.unresolvedPerAccount ||
            total >= PROVIDER_ATTEMPT_LIMITS.total
          )
            throw new PlatformError("AI_ATTEMPT_CAPACITY", 503);
          const ordinal = Number(
              db
                .prepare(
                  "SELECT coalesce(max(dispatch_ordinal),0)+1 n FROM ai_provider_attempts WHERE logical_request_id=?",
                )
                .get(c.requestId)!.n,
            ),
            id = randomUUID();
          db.prepare(
            "INSERT INTO ai_provider_attempts(id,logical_request_id,dispatch_ordinal,user_id,session_version,reservation_id,feature,provider,endpoint_kind,requested_model,prepared_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
          ).run(
            id,
            c.requestId,
            ordinal,
            c.userId,
            c.sessionVersion,
            c.reservationId,
            c.feature,
            details.provider,
            details.endpointKind,
            model,
            new Date(now()).toISOString(),
          );
          return id;
        });
        return {
          finish(observation: ProviderAttemptObservation) {
            if (
              ![
                "response_received",
                "network_unknown",
                "timeout_unknown",
                "cancelled_unknown",
              ].includes(observation.status)
            )
              throw new PlatformError("AI_ATTEMPT_OBSERVATION_INVALID");
            const http = observedInteger(observation.httpStatus),
              source = observation.usageSource;
            const safeError =
              typeof observation.safeErrorCode === "string" &&
              /^[A-Z][A-Z0-9_]{1,79}$/.test(observation.safeErrorCode)
                ? observation.safeErrorCode
                : null;
            // This capability is a closure, not a client lease. In-flight observations
            // remain writable after account revocation/refund. Terminal CAS is one-shot.
            db.prepare(
              "UPDATE ai_provider_attempts SET status=?,http_status=?,response_model=?,provider_request_id=?,input_tokens=?,output_tokens=?,cached_tokens=?,total_tokens=?,reasoning_tokens=?,latency_ms=?,safe_error_code=?,usage_source=?,ended_at=? WHERE id=? AND user_id=? AND reservation_id=? AND session_version=? AND status='prepared'",
            ).run(
              observation.status,
              http !== null && http >= 100 && http <= 599 ? http : null,
              safeProviderIdentifier(observation.responseModel),
              safeProviderIdentifier(observation.providerRequestId),
              observedInteger(observation.inputTokens),
              observedInteger(observation.outputTokens),
              observedInteger(observation.cachedTokens),
              observedInteger(observation.totalTokens),
              observedInteger(observation.reasoningTokens),
              observedInteger(observation.latencyMs),
              safeError,
              source ===
                (provider === "openai"
                  ? "openai-response-usage"
                  : "gemini-usage-metadata")
                ? source
                : null,
              new Date(now()).toISOString(),
              id,
              c.userId,
              c.reservationId,
              c.sessionVersion,
            );
          },
        };
      },
    };
  }
  return { providerAttemptObserver };
}
