import type { DatabaseConnection as DatabaseSync } from "./database-connection";
import type { UsageDimension } from "./usage-report";
import { PlatformError } from "./types";
import { PROVIDER_ATTEMPT_LIMITS } from "./provider-attempt-core";

export type ProviderAttemptAggregate = {
  attempts: number;
  responses: number;
  unresolved: number;
  transportUnknown: number;
  httpErrors: number;
  inputTokens: number | null;
  outputTokens: number | null;
  inputTokenRecords: number;
  outputTokenRecords: number;
  totalTokens: number | null;
  totalTokenRecords: number;
  responseModelRecords: number;
  changedModelRecords: number;
  averageLatencyMs: number | null;
  estimatedCostUsd: null;
  unpricedAttempts: number;
};
export type ProviderAttemptBreakdown = {
  scope: "recorded-text-provider-attempts";
  dimension: UsageDimension;
  days: number;
  from: string;
  through: string;
  firstRetainedAttemptAt: string | null;
  retainedAllAges: {
    attempts: number;
    unresolved: number;
    unresolvedOutsideWindow: number;
  };
  limits: {
    total: number;
    unresolvedGlobal: number;
    unresolvedPerAccount: number;
  };
  totals: ProviderAttemptAggregate;
  groups: (ProviderAttemptAggregate & {
    key: string;
    provider: string | null;
  })[];
  truncated: boolean;
  limitations: string[];
};

/** Read-only metadata; one dispatch is not one successful answer or one charge. */
export function providerAttemptBreakdown(
  db: DatabaseSync,
  now: number,
  dimension: UsageDimension,
  days = 7,
): ProviderAttemptBreakdown {
  if (!["model", "task", "user"].includes(dimension))
    throw new PlatformError("INVALID_USAGE_DIMENSION");
  if (!Number.isSafeInteger(days) || days < 1 || days > 31)
    throw new PlatformError("INVALID_USAGE_WINDOW");
  const through = new Date(now).toISOString(),
    from = new Date(now - days * 86400000).toISOString(),
    where = "prepared_at>=? AND prepared_at<=?",
    metrics = `count(*) attempts,
      sum(status='response_received') responses,
      sum(status='prepared') unresolved,
      sum(status IN ('network_unknown','timeout_unknown','cancelled_unknown')) transport_unknown,
      sum(http_status>=400) http_errors,
      sum(input_tokens) input_tokens, sum(output_tokens) output_tokens,
      count(input_tokens) input_records, count(output_tokens) output_records,
      sum(total_tokens) total_tokens, count(total_tokens) total_records,
      count(response_model) response_models,
      sum(response_model IS NOT NULL AND response_model<>requested_model) changed_models,
      avg(latency_ms) latency`;
  const nullable = (value: unknown) => (value === null ? null : Number(value)),
    aggregate = (row: Record<string, unknown>): ProviderAttemptAggregate => ({
      attempts: Number(row.attempts),
      responses: Number(row.responses || 0),
      unresolved: Number(row.unresolved || 0),
      transportUnknown: Number(row.transport_unknown || 0),
      httpErrors: Number(row.http_errors || 0),
      inputTokens: nullable(row.input_tokens),
      outputTokens: nullable(row.output_tokens),
      inputTokenRecords: Number(row.input_records),
      outputTokenRecords: Number(row.output_records),
      totalTokens: nullable(row.total_tokens),
      totalTokenRecords: Number(row.total_records),
      responseModelRecords: Number(row.response_models),
      changedModelRecords: Number(row.changed_models || 0),
      averageLatencyMs:
        row.latency === null ? null : Math.round(Number(row.latency)),
      estimatedCostUsd: null,
      unpricedAttempts: Number(row.attempts),
    });
  // Identifiers come only from a closed enum, never from request SQL/text.
  const key =
      dimension === "model"
        ? "requested_model"
        : dimension === "task"
          ? "feature"
          : "user_id",
    provider = dimension === "model" ? "provider" : "NULL",
    totals = aggregate(
      db
        .prepare(`SELECT ${metrics} FROM ai_provider_attempts WHERE ${where}`)
        .get(from, through)!,
    ),
    rows = db
      .prepare(
        `SELECT ${key} group_key, ${provider} group_provider, ${metrics}
      FROM ai_provider_attempts WHERE ${where}
      GROUP BY ${key}${dimension === "model" ? ",provider" : ""}
      ORDER BY attempts DESC, group_key, group_provider LIMIT 26`,
      )
      .all(from, through),
    first = db
      .prepare(
        "SELECT min(prepared_at) first FROM ai_provider_attempts WHERE prepared_at<=?",
      )
      .get(through)!;
  return {
    scope: "recorded-text-provider-attempts",
    dimension,
    days,
    from,
    through,
    firstRetainedAttemptAt: first.first === null ? null : String(first.first),
    retainedAllAges: (() => {
      const row = db
        .prepare(
          `SELECT count(*) attempts,
        sum(status='prepared') unresolved,
        sum(status='prepared' AND NOT (prepared_at>=? AND prepared_at<=?)) outside_window
        FROM ai_provider_attempts`,
        )
        .get(from, through)!;
      return {
        attempts: Number(row.attempts),
        unresolved: Number(row.unresolved || 0),
        unresolvedOutsideWindow: Number(row.outside_window || 0),
      };
    })(),
    limits: {
      total: PROVIDER_ATTEMPT_LIMITS.total,
      unresolvedGlobal: PROVIDER_ATTEMPT_LIMITS.unresolvedGlobal,
      unresolvedPerAccount: PROVIDER_ATTEMPT_LIMITS.unresolvedPerAccount,
    },
    totals,
    groups: rows.slice(0, 25).map((row) => ({
      ...aggregate(row),
      key: String(row.group_key),
      provider: row.group_provider === null ? null : String(row.group_provider),
    })),
    truncated: rows.length > 25,
    limitations: [
      "Text/multimodal generation only: learner, teacher drafts and summary jobs. Embedding, voice and historical attempts are not backfilled.",
      "Prepared records are dispatch intents, not proof the provider received a request. Unresolved/network/timeout/cancelled records have unknown provider receipt or cost.",
      "An HTTP response is not a valid or accepted answer. Recorded requested models are grouped; response model metadata may differ or be absent.",
      "Token fields sum only observed non-null values; coverage is separate. No approved price is assumed: all attempt costs remain null, not zero or an invoice.",
      "This cohort uses preparation time. First retained row is not an instrumentation activation date. Terminal retention and storage failures can reduce coverage; credits/refunds remain in the independent billing ledger.",
    ],
  };
}
