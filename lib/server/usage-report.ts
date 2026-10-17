import type { DatabaseConnection as DatabaseSync } from "./database-connection";
import { PlatformError } from "./types";
import { latencyAggregateQuery } from "./latency-report-sql";

export type UsageDimension = "model" | "task" | "user";
export type UsageAggregate = {
  requests: number;
  errors: number;
  inputTokens: number | null;
  outputTokens: number | null;
  tokenRecords: number;
  recordedEstimatedCostUsd: number | null;
  costRecords: number;
  unpricedRequests: number;
  averageLatencyMs: number | null;
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
  latencyRecords: number;
  /** Legacy outcomes defaulted absent latency to zero; observation is unknown. */
  observedLatencyRecords: null;
  recordedErrorRatio: number | null;
  httpStatusRecords: null;
  httpStatusCoverage: null;
  httpErrorRatio: null;
};
export type UsageBreakdown = {
  dimension: UsageDimension;
  from: string;
  through: string;
  days: number;
  totals: UsageAggregate;
  groups: (UsageAggregate & { key: string; provider: string | null })[];
  truncated: boolean;
  scope: "recorded-request-outcomes";
  limitations: string[];
};

// Existing request outcomes are not a provider-attempt or financial ledger.
export function usageBreakdown(
  db: DatabaseSync,
  now: number,
  dimension: UsageDimension,
  days = 7,
): UsageBreakdown {
  if (!["model", "task", "user"].includes(dimension))
    throw new PlatformError("INVALID_USAGE_DIMENSION");
  if (!Number.isSafeInteger(days) || days < 1 || days > 31)
    throw new PlatformError("INVALID_USAGE_WINDOW");
  const through = new Date(now).toISOString();
  const from = new Date(now - days * 86400000).toISOString();
  const metrics = `count(*) requests, sum(status='error') errors,
    sum(input_tokens) input_tokens, sum(output_tokens) output_tokens,
    count(input_tokens) token_records, sum(estimated_cost_usd) cost,
    count(estimated_cost_usd) cost_records, avg(latency_ms) latency`;
  const aggregate = (row: Record<string, unknown>): UsageAggregate => ({
    requests: Number(row.requests),
    errors: Number(row.errors || 0),
    inputTokens: row.input_tokens === null ? null : Number(row.input_tokens),
    outputTokens: row.output_tokens === null ? null : Number(row.output_tokens),
    tokenRecords: Number(row.token_records),
    recordedEstimatedCostUsd: row.cost === null ? null : Number(row.cost),
    costRecords: Number(row.cost_records),
    unpricedRequests: Number(row.requests) - Number(row.cost_records),
    averageLatencyMs:
      row.latency === null ? null : Math.round(Number(row.latency)),
    p50LatencyMs: row.p50_latency === null ? null : Number(row.p50_latency),
    p95LatencyMs: row.p95_latency === null ? null : Number(row.p95_latency),
    latencyRecords: Number(row.latency_records),
    observedLatencyRecords: null,
    recordedErrorRatio: Number(row.requests) ? Number(row.errors || 0) / Number(row.requests) : null,
    httpStatusRecords: null,
    httpStatusCoverage: null,
    httpErrorRatio: null,
  });
  const totals = aggregate(
    db
      .prepare(latencyAggregateQuery("ai_usage", null, metrics))
      .get(from, through)!,
  );
  const rows = db
    .prepare(latencyAggregateQuery("ai_usage", dimension, metrics))
    .all(from, through);
  return {
    dimension,
    from,
    through,
    days,
    totals,
    groups: rows.slice(0, 25).map((row) => ({
      ...aggregate(row),
      key: row.group_key === null ? "unknown" : String(row.group_key),
      provider: row.group_provider === null ? null : String(row.group_provider),
    })),
    truncated: rows.length > 25,
    scope: "recorded-request-outcomes",
    limitations: [
      "Recorded outcomes are not a provider invoice or a complete provider-attempt ledger.",
      "Fallback attempts, failed generations with consumed tokens and unrecorded telemetry may be missing.",
      "Unknown cost is null. Only explicitly recorded estimates are summed; no current price is assumed.",
      "Credits and refunds are determined by the separate transactional billing ledger.",
      "Latency percentiles use nearest rank over recorded latency values, not interpolation. Legacy outcomes stored absent/invalid latency as zero, so the true observed count is unknown and recorded zeros are ambiguous.",
      "Recorded error ratio is errors/recorded outcomes in this cohort; HTTP status was not stored here, so HTTP status coverage and HTTP error ratio are null.",
    ],
  };
}
