import type { DatabaseSync } from "node:sqlite";

export const jobStatuses = [
  "queued",
  "running",
  "retry_wait",
  "paused",
  "completed",
  "cancelled",
  "failed",
] as const;
export interface JobHealth {
  scope: "stored-summary-job-metadata";
  generatedAt: string;
  retainedJobs: number;
  statuses: Record<(typeof jobStatuses)[number], number>;
  eligiblePending: number;
  readyNow: number;
  delayedRetries: number;
  expiredRetained: number;
  revokedPending: number;
  oldestEligibleWaitSeconds: number | null;
  runningParts: number;
  expiredRunningLeases: number;
  missingRunningLeases: number;
  nextRetryAt: string | null;
  backgroundJobsConfigured: boolean;
  recovery: "owner-access-driven";
}
/** Aggregate metadata only. Caller owns authorization + consistent read transaction. Never starts/reclaims work. */
export function readJobHealth(
  db: DatabaseSync,
  now: number,
  backgroundJobsConfigured: boolean,
): JobHealth {
  const grouped = db
    .prepare("SELECT status,count(*) n FROM summary_jobs GROUP BY status")
    .all();
  const statuses = Object.fromEntries(
    jobStatuses.map((status) => [
      status,
      Number(grouped.find((r) => r.status === status)?.n || 0),
    ]),
  ) as JobHealth["statuses"];
  const jobs = db
    .prepare(
      `SELECT
    count(*) total,
    sum(j.expires_at<=?) expired,
    sum(j.status IN ('queued','running','retry_wait','paused') AND (u.disabled=1 OR j.session_version!=u.session_version)) revoked,
    sum(j.status IN ('queued','retry_wait') AND j.expires_at>? AND u.disabled=0 AND j.session_version=u.session_version) eligible,
    sum(j.status IN ('queued','retry_wait') AND j.available_at<=? AND j.expires_at>? AND u.disabled=0 AND j.session_version=u.session_version) ready,
    sum(j.status='retry_wait' AND j.available_at>? AND j.expires_at>? AND u.disabled=0 AND j.session_version=u.session_version) delayed,
    min(CASE WHEN j.status IN ('queued','retry_wait') AND j.expires_at>? AND u.disabled=0 AND j.session_version=u.session_version THEN j.created_at END) oldest,
    min(CASE WHEN j.status='retry_wait' AND j.available_at>? AND j.expires_at>? AND u.disabled=0 AND j.session_version=u.session_version THEN j.available_at END) next_retry
    FROM summary_jobs j JOIN users u ON u.id=j.user_id`,
    )
    .get(now, now, now, now, now, now, now, now, now)!;
  const leases = db
    .prepare(
      `SELECT count(*) total,
    sum(p.lease_until IS NOT NULL AND p.lease_until<=?) expired,
    sum(p.lease_until IS NULL OR p.lease_token IS NULL) missing
    FROM summary_job_parts p JOIN summary_jobs j ON j.id=p.job_id WHERE p.status='running' AND j.status='running'`,
    )
    .get(now)!;
  const oldest = jobs.oldest === null ? NaN : Date.parse(String(jobs.oldest));
  return {
    scope: "stored-summary-job-metadata",
    generatedAt: new Date(now).toISOString(),
    retainedJobs: Number(jobs.total),
    statuses,
    eligiblePending: Number(jobs.eligible || 0),
    readyNow: Number(jobs.ready || 0),
    delayedRetries: Number(jobs.delayed || 0),
    expiredRetained: Number(jobs.expired || 0),
    revokedPending: Number(jobs.revoked || 0),
    oldestEligibleWaitSeconds: Number.isFinite(oldest)
      ? Math.max(0, Math.floor((now - oldest) / 1000))
      : null,
    runningParts: Number(leases.total),
    expiredRunningLeases: Number(leases.expired || 0),
    missingRunningLeases: Number(leases.missing || 0),
    nextRetryAt:
      jobs.next_retry === null
        ? null
        : new Date(Number(jobs.next_retry)).toISOString(),
    backgroundJobsConfigured,
    recovery: "owner-access-driven",
  };
}
