import type { UsageDimension } from "./usage-report";

/** Internal SQL builder: all identifiers and aggregate expressions come from
 * these two read services, never request text. One statement per aggregation,
 * independent of group count. Nearest rank, without interpolation: ceil(p*N).
 */
export function latencyAggregateQuery(
  table: "ai_usage" | "ai_provider_attempts",
  dimension: UsageDimension | null,
  metrics: string,
) {
  const outcome = table === "ai_usage";
  const key = dimension === null ? "'all'" : dimension === "user" ? "user_id" : dimension === "model" ? outcome ? "model" : "requested_model" : outcome ? "task" : "feature";
  const provider = dimension === "model" ? "provider" : "NULL";
  const time = outcome ? "created_at" : "prepared_at";
  const count = outcome ? "requests" : "attempts";
  // The remote adapter conservatively classifies non-SELECT prefixes as writes.
  // Keep this read-only CTE inside an outer SELECT; never change that adapter.
  return `SELECT * FROM (WITH scoped AS (
    SELECT *, ${key} group_key, ${provider} group_provider FROM ${table}
    WHERE ${time}>=? AND ${time}<=?
  ), aggregates AS (
    SELECT group_key, group_provider, ${metrics} FROM scoped
    ${dimension === null ? "" : "GROUP BY group_key,group_provider"}
  ), ordered_latency AS (
    SELECT group_key,group_provider,latency_ms,
      row_number() OVER (PARTITION BY group_key,group_provider ORDER BY latency_ms,id) rank,
      count(*) OVER (PARTITION BY group_key,group_provider) observed
    FROM scoped WHERE latency_ms IS NOT NULL
  ), quantiles AS (
    SELECT group_key,group_provider,max(observed) latency_records,
      max(CASE WHEN rank=CAST((observed*50+99)/100 AS INTEGER) THEN latency_ms END) p50_latency,
      max(CASE WHEN rank=CAST((observed*95+99)/100 AS INTEGER) THEN latency_ms END) p95_latency
    FROM ordered_latency GROUP BY group_key,group_provider
  ) SELECT a.*, coalesce(q.latency_records,0) latency_records,q.p50_latency,q.p95_latency
    FROM aggregates a LEFT JOIN quantiles q
      ON a.group_key IS q.group_key AND a.group_provider IS q.group_provider)
    ${dimension === null ? "" : `ORDER BY ${count} DESC,group_key,group_provider LIMIT 26`}`;
}
