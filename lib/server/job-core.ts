import { createHash, randomUUID } from "node:crypto";
import type { DatabaseConnection as DatabaseSync } from "./database-connection";
import { validateInput, type AIInput, type AIResult } from "../ai/contracts";
import { sourceSegments, validateReferences } from "../ai/grounding";
import { validateSummary, type StudySummary } from "../ai/summary";
import { mergeWholeVideo, wholeVideoParts } from "../ai/full-summary";
import { youtubeURL } from "../ingestion/youtube";
import {
  SUMMARY_JOB_LIMITS as LIMIT,
  type SummaryJobInput,
  type SummaryJobView,
  type SummaryJobDetail,
  type SummaryJobResult,
  type SummaryJobStatus,
} from "../jobs/contracts";
import { PlatformError, type User } from "./types";
type Row = Record<string, string | number | bigint | Uint8Array | null>;
type Context = {
  db: DatabaseSync;
  now: () => number;
  stamp: () => string;
  transaction: <T>(fn: () => T) => T;
  getUser: (id: string) => User | null;
};
export type SummaryJobLease = {
  jobId: string;
  userId: string;
  sessionVersion: number;
  ordinal: number;
  token: string;
  sequence: number;
  requestId: string;
  input: AIInput;
};
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const terminal = (status: unknown) =>
  ["completed", "cancelled", "failed"].includes(String(status));
function id(value: unknown) {
  if (typeof value !== "string" || !/^[a-f0-9-]{36}$/.test(value))
    throw new PlatformError("INVALID_JOB_ID");
  return value;
}
export function normalizeSummaryJob(raw: unknown): {
  input: SummaryJobInput;
  parts: { input: AIInput; start?: number; end?: number }[];
  sourceDigest: string;
} {
  const v = raw as SummaryJobInput | null;
  if (
    !v ||
    typeof v !== "object" ||
    Array.isArray(v) ||
    Object.keys(v).some(
      (key) =>
        ![
          "title",
          "clientItemId",
          "source",
          "youtubeUrl",
          "durationSeconds",
          "language",
        ].includes(key),
    )
  )
    throw new PlatformError("INVALID_SUMMARY_JOB");
  if (
    typeof v.title !== "string" ||
    !v.title.trim() ||
    v.title.length > 180 ||
    !["vi", "en", "ja", "ko", "zh-CN"].includes(v.language) ||
    (v.clientItemId !== undefined &&
      (typeof v.clientItemId !== "string" ||
        !/^[\w-]{1,100}$/.test(v.clientItemId)))
  )
    throw new PlatformError("INVALID_SUMMARY_JOB");
  const base = {
    task: "summary" as const,
    question: "",
    language: v.language,
    mode: "quick" as const,
    history: [],
  };
  let input: SummaryJobInput,
    parts: { input: AIInput; start?: number; end?: number }[];
  if (v.youtubeUrl !== undefined) {
    const url =
      typeof v.youtubeUrl === "string" ? youtubeURL(v.youtubeUrl) : null;
    if (
      !url ||
      v.source?.trim() ||
      !Number.isInteger(v.durationSeconds) ||
      v.durationSeconds! <= 0 ||
      v.durationSeconds! > LIMIT.videoSeconds
    )
      throw new PlatformError("INVALID_JOB_VIDEO");
    input = {
      title: v.title.trim(),
      clientItemId: v.clientItemId,
      language: v.language,
      youtubeUrl: url,
      durationSeconds: v.durationSeconds,
    };
    parts = wholeVideoParts(v.durationSeconds!).map((videoRange) => ({
      input: validateInput({
        ...base,
        source: "",
        youtubeUrl: url,
        videoRange,
      }),
    }));
  } else {
    if (
      typeof v.source !== "string" ||
      !v.source.trim() ||
      v.source.length > LIMIT.sourceCharacters ||
      v.durationSeconds !== undefined
    )
      throw new PlatformError("INVALID_JOB_TEXT");
    input = {
      title: v.title.trim(),
      clientItemId: v.clientItemId,
      language: v.language,
      source: v.source,
    };
    parts = [];
    for (let start = 0; start < v.source.length;) {
      let end = Math.min(v.source.length, start + LIMIT.chunkCharacters);
      if (end < v.source.length && /[\uD800-\uDBFF]/.test(v.source[end - 1]))
        end++;
      parts.push({
        start,
        end,
        input: validateInput({ ...base, source: v.source.slice(start, end) }),
      });
      start = end;
    }
  }
  if (parts.length > LIMIT.parts) throw new PlatformError("JOB_TOO_MANY_PARTS");
  return {
    input,
    parts,
    sourceDigest: hash(
      JSON.stringify([
        input.source || "",
        input.youtubeUrl || "",
        input.durationSeconds || null,
        input.language,
      ]),
    ),
  };
}
function mergeText(title: string, source: string, parts: Row[]): StudySummary {
  const originalSegments = sourceSegments(source);
  const summaries = parts.map((part) => {
    const input = JSON.parse(String(part.input_json)) as AIInput;
    const summary = validateSummary(JSON.parse(String(part.result_json)), {
      source: input.source,
      restore: true,
    });
    const offset = Number(part.char_start);
    return {
      ...summary,
      chapters: summary.chapters.map((chapter) => ({
        ...chapter,
        references: validateReferences(
          chapter.references?.map((ref) => {
            const start = offset + ref.start,
              end = offset + ref.end;
            const segment = originalSegments.find(
              (s) => start >= s.start && end <= s.end,
            );
            return source.slice(start, end) === ref.quote && segment
              ? { segmentId: segment.id, quote: ref.quote }
              : null;
          }),
          source,
        ),
      })),
    };
  });
  let chapterIndex = 0;
  const nodes: StudySummary["mindMap"]["nodes"] = [
    {
      id: "whole",
      label: title.slice(0, 100),
      detail: `${parts.length} parts`,
    },
  ];
  const edges: StudySummary["mindMap"]["edges"] = [];
  summaries.forEach((s, index) => {
    nodes.push({
      id: `p${index}`,
      label: s.title.slice(0, 100),
      detail: s.overview.slice(0, 1500),
      chapterIndex,
    });
    edges.push({ source: "whole", target: `p${index}` });
    chapterIndex += s.chapters.length;
  });
  return validateSummary(
    {
      title,
      overview: summaries
        .map((s, i) => `${i + 1}. ${s.overview.slice(0, 2500)}`)
        .join("\n\n"),
      keyPoints: summaries.map((s) =>
        (s.keyPoints[0] || s.chapters[0].summary).slice(0, 1500),
      ),
      chapters: summaries.flatMap((s) => s.chapters),
      mindMap: { nodes, edges },
    },
    { source, restore: true, aggregate: true },
  );
}
export function createSummaryJobStore({
  db,
  now,
  stamp,
  transaction,
  getUser,
}: Context) {
  const owner = (userId: string, version: number) => {
    const user = getUser(userId);
    if (!user || user.disabled || user.sessionVersion !== version)
      throw new PlatformError("SESSION_REVOKED", 401);
    return user;
  };
  const owned = (userId: string, version: number, jobId: string) => {
    owner(userId, version);
    const row = db
      .prepare(
        "SELECT * FROM summary_jobs WHERE id=? AND user_id=? AND session_version=? AND expires_at>?",
      )
      .get(id(jobId), userId, version, now()) as Row | undefined;
    if (!row) throw new PlatformError("JOB_NOT_FOUND", 404);
    return row;
  };
  function view(row: Row): SummaryJobView {
    const attempt = db
      .prepare(
        "SELECT COALESCE(sum(attempts),0) n FROM summary_job_parts WHERE job_id=?",
      )
      .get(row.id)!;
    return {
      id: String(row.id),
      title: String(row.title),
      clientItemId: row.client_item_id ? String(row.client_item_id) : undefined,
      sourceDigest: String(row.source_digest),
      sourceType: row.source_type as "text" | "youtube",
      status: row.status as SummaryJobStatus,
      completed: Number(row.completed),
      total: Number(row.total),
      attempts: Number(attempt.n),
      error: row.error_code ? String(row.error_code) : undefined,
      nextAttemptAt:
        row.status === "retry_wait"
          ? new Date(Number(row.available_at)).toISOString()
          : undefined,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      expiresAt: new Date(Number(row.expires_at)).toISOString(),
    };
  }
  function createSummaryJob(
    userId: string,
    version: number,
    requestKey: string,
    raw: unknown,
  ): SummaryJobView {
    if (typeof requestKey !== "string" || !/^[\w-]{16,100}$/.test(requestKey))
      throw new PlatformError("INVALID_IDEMPOTENCY_KEY");
    const plan = normalizeSummaryJob(raw),
      fingerprint = hash(JSON.stringify(plan.input));
    return transaction(() => {
      owner(userId, version);
      const old = db
        .prepare("SELECT * FROM summary_jobs WHERE user_id=? AND request_key=?")
        .get(userId, requestKey) as Row | undefined;
      if (old) {
        if (
          old.fingerprint !== fingerprint ||
          Number(old.session_version) !== version
        )
          throw new PlatformError("IDEMPOTENCY_CONFLICT", 409);
        if (Number(old.expires_at) <= now())
          throw new PlatformError("JOB_EXPIRED", 410);
        return view(old);
      }
      const active = Number(
        db
          .prepare(
            "SELECT count(*) n FROM summary_jobs WHERE user_id=? AND status IN ('queued','running','retry_wait','paused') AND expires_at>?",
          )
          .get(userId, now())!.n,
      );
      const retained = Number(
        db
          .prepare("SELECT count(*) n FROM summary_jobs WHERE user_id=?")
          .get(userId)!.n,
      );
      if (
        active >= LIMIT.activePerAccount ||
        retained >= LIMIT.retainedPerAccount
      )
        throw new PlatformError("JOB_LIMIT_REACHED", 429);
      const jobId = randomUUID();
      db.prepare(
        "INSERT INTO summary_jobs(id,user_id,session_version,request_key,fingerprint,source_digest,title,client_item_id,source_type,input_json,status,total,available_at,created_at,updated_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,'queued',?,?,?,?,?)",
      ).run(
        jobId,
        userId,
        version,
        requestKey,
        fingerprint,
        plan.sourceDigest,
        plan.input.title,
        plan.input.clientItemId || null,
        plan.input.youtubeUrl ? "youtube" : "text",
        JSON.stringify(plan.input),
        plan.parts.length,
        now(),
        stamp(),
        stamp(),
        now() + LIMIT.retentionMs,
      );
      const insert = db.prepare(
        "INSERT INTO summary_job_parts(job_id,ordinal,input_json,char_start,char_end) VALUES(?,?,?,?,?)",
      );
      plan.parts.forEach((part, ordinal) =>
        insert.run(
          jobId,
          ordinal,
          JSON.stringify(part.input),
          part.start ?? null,
          part.end ?? null,
        ),
      );
      return view(owned(userId, version, jobId));
    });
  }
  function listSummaryJobs(userId: string, version: number): SummaryJobView[] {
    owner(userId, version);
    return (
      db
        .prepare(
          "SELECT * FROM summary_jobs WHERE user_id=? AND session_version=? AND expires_at>? ORDER BY created_at DESC LIMIT 12",
        )
        .all(userId, version, now()) as Row[]
    ).map(view);
  }
  function readSummaryJob(
    userId: string,
    version: number,
    jobId: string,
  ): SummaryJobDetail {
    const row = owned(userId, version, jobId);
    return {
      ...view(row),
      ...(row.result_json
        ? { result: JSON.parse(String(row.result_json)) as SummaryJobResult }
        : {}),
    };
  }
  function claimSummaryJob(
    userId: string,
    version: number,
  ): SummaryJobLease | null {
    return transaction(() => {
      owner(userId, version);
      // Serialize one account even if separate Node workers share this database.
      if (
        db
          .prepare(
            "SELECT 1 FROM summary_jobs WHERE user_id=? AND status='running' AND expires_at>?",
          )
          .get(userId, now())
      )
        return null;
      const row = db
        .prepare(
          "SELECT * FROM summary_jobs WHERE user_id=? AND session_version=? AND status IN ('queued','retry_wait') AND available_at<=? AND expires_at>? ORDER BY created_at,id LIMIT 1",
        )
        .get(userId, version, now(), now()) as Row | undefined;
      if (!row) return null;
      const part = db
        .prepare(
          "SELECT * FROM summary_job_parts WHERE job_id=? AND status!='completed' ORDER BY ordinal LIMIT 1",
        )
        .get(row.id) as Row | undefined;
      if (
        !part ||
        part.status !== "pending" ||
        Number(part.attempts) >= LIMIT.attempts
      )
        throw new PlatformError("JOB_RETRIES_EXHAUSTED", 409);
      const token = randomUUID(),
        sequence = Number(part.lease_sequence) + 1,
        requestId = `job-${row.id}-${part.ordinal}-${sequence}`;
      db.prepare(
        "UPDATE summary_jobs SET status='running',error_code=NULL,updated_at=? WHERE id=?",
      ).run(stamp(), row.id);
      db.prepare(
        "UPDATE summary_job_parts SET status='running',lease_sequence=?,lease_token=?,lease_until=?,attempt_request_id=?,reservation_id=NULL WHERE job_id=? AND ordinal=?",
      ).run(
        sequence,
        token,
        now() + LIMIT.leaseMs,
        requestId,
        row.id,
        part.ordinal,
      );
      return {
        jobId: String(row.id),
        userId,
        sessionVersion: version,
        ordinal: Number(part.ordinal),
        token,
        sequence,
        requestId,
        input: JSON.parse(String(part.input_json)) as AIInput,
      };
    });
  }
  function assertLease(lease: SummaryJobLease, checkOwner = true) {
    if (checkOwner) owner(lease.userId, lease.sessionVersion);
    const part = db
      .prepare(
        "SELECT p.*,j.status job_status,j.session_version,j.user_id,j.expires_at FROM summary_job_parts p JOIN summary_jobs j ON j.id=p.job_id WHERE p.job_id=? AND p.ordinal=?",
      )
      .get(lease.jobId, lease.ordinal) as Row | undefined;
    if (
      !part ||
      part.user_id !== lease.userId ||
      Number(part.session_version) !== lease.sessionVersion ||
      part.job_status !== "running" ||
      part.status !== "running" ||
      part.lease_token !== lease.token ||
      Number(part.lease_sequence) !== lease.sequence ||
      Number(part.lease_until) <= now() ||
      Number(part.expires_at) <= now()
    )
      throw new PlatformError("JOB_LEASE_STALE", 409);
    return part;
  }
  function startSummaryJobAttempt(
    lease: SummaryJobLease,
    reservationId: string,
  ) {
    return transaction(() => {
      const part = assertLease(lease),
        reservation = db
          .prepare(
            "SELECT * FROM billing_reservations WHERE id=? AND user_id=? AND request_id=? AND status='reserved'",
          )
          .get(reservationId, lease.userId, lease.requestId);
      if (
        !reservation ||
        part.reservation_id ||
        Number(part.attempts) >= LIMIT.attempts
      )
        throw new PlatformError("JOB_LEASE_STALE", 409);
      db.prepare(
        "UPDATE summary_job_parts SET attempts=attempts+1,reservation_id=? WHERE job_id=? AND ordinal=?",
      ).run(reservationId, lease.jobId, lease.ordinal);
    });
  }
  /** Atomic callback of settleUsage; do NOT open a nested SQLite transaction here. */
  function completeSummaryJobPart(lease: SummaryJobLease, result: AIResult) {
    const part = assertLease(lease);
    if (!part.reservation_id || !result.summary)
      throw new PlatformError("INVALID_JOB_RESULT", 502);
    if (
      !db
        .prepare(
          "SELECT 1 FROM billing_reservations WHERE id=? AND user_id=? AND request_id=? AND status='settled'",
        )
        .get(part.reservation_id, lease.userId, lease.requestId)
    )
      throw new PlatformError("JOB_SETTLEMENT_REQUIRED", 409);
    const input = JSON.parse(String(part.input_json)) as AIInput;
    const summary = validateSummary(result.summary, {
      source: input.source,
      video: !!input.youtubeUrl,
      range: input.videoRange,
      restore: true,
    });
    const encoded = JSON.stringify(summary);
    if (encoded.length > 60000)
      throw new PlatformError("INVALID_JOB_RESULT", 502);
    db.prepare(
      "UPDATE summary_job_parts SET status='completed',result_json=?,lease_token=NULL,lease_until=NULL WHERE job_id=? AND ordinal=?",
    ).run(encoded, lease.jobId, lease.ordinal);
    const job = db
        .prepare("SELECT * FROM summary_jobs WHERE id=?")
        .get(lease.jobId) as Row,
      completed = Number(job.completed) + 1;
    let aggregate: SummaryJobResult | undefined;
    if (completed === Number(job.total)) {
      const parts = db
          .prepare(
            "SELECT * FROM summary_job_parts WHERE job_id=? ORDER BY ordinal",
          )
          .all(lease.jobId) as Row[],
        source = JSON.parse(String(job.input_json)) as SummaryJobInput;
      if (parts.some((p) => p.status !== "completed"))
        throw new PlatformError("INVALID_JOB_RESULT", 502);
      aggregate = source.youtubeUrl
        ? {
            summary: mergeWholeVideo(
              source.title,
              wholeVideoParts(source.durationSeconds!),
              parts.map((p) => JSON.parse(String(p.result_json))),
            ),
            coverage: {
              type: "youtube",
              durationSeconds: source.durationSeconds!,
              durationBasis: "declared",
              parts: wholeVideoParts(source.durationSeconds!),
            },
          }
        : {
            summary: mergeText(source.title, source.source!, parts),
            coverage: {
              type: "text",
              characters: source.source!.length,
              parts: parts.map((p) => ({
                start: Number(p.char_start),
                end: Number(p.char_end),
              })),
            },
          };
      if (JSON.stringify(aggregate).length > 1000000)
        throw new PlatformError("INVALID_JOB_RESULT", 502);
    }
    db.prepare(
      "UPDATE summary_jobs SET completed=?,status=?,available_at=?,error_code=NULL,updated_at=?,result_json=? WHERE id=?",
    ).run(
      completed,
      aggregate ? "completed" : "queued",
      now(),
      stamp(),
      aggregate ? JSON.stringify(aggregate) : null,
      lease.jobId,
    );
  }
  function failSummaryJobPart(lease: SummaryJobLease, errorCode: string) {
    return transaction(() => {
      let part: Row;
      try {
        part = assertLease(lease, false);
      } catch {
        return;
      }
      const reservation = db
        .prepare(
          "SELECT status FROM billing_reservations WHERE request_id=? AND user_id=?",
        )
        .get(lease.requestId, lease.userId);
      if (reservation?.status === "reserved")
        throw new PlatformError("JOB_REFUND_REQUIRED", 409);
      const code = /^[A-Z_]{3,60}$/.test(errorCode)
        ? errorCode
        : "PROVIDER_UNAVAILABLE";
      const pause = [
        "CREDITS_INSUFFICIENT",
        "PLAN_ACCESS_REQUIRED",
        "AI_DISABLED",
        "LOCAL_RATE_LIMIT",
        "COMPETITION_RATE_LIMIT",
        "PROVIDER_NOT_CONFIGURED",
        "PROVIDER_AUTH_ERROR",
      ].includes(code);
      const transient = [
        "PROVIDER_UNAVAILABLE",
        "PROVIDER_TIMEOUT",
        "PROVIDER_ERROR",
        "PROVIDER_RATE_LIMIT",
        "REQUEST_CANCELLED",
        "INCOMPLETE_RESPONSE",
      ].includes(code);
      const status =
        code === "SESSION_REVOKED"
          ? "failed"
          : pause
            ? "paused"
            : transient && Number(part.attempts) < LIMIT.attempts
              ? "retry_wait"
              : "failed";
      db.prepare(
        "UPDATE summary_job_parts SET status='pending',lease_token=NULL,lease_until=NULL WHERE job_id=? AND ordinal=?",
      ).run(lease.jobId, lease.ordinal);
      db.prepare(
        "UPDATE summary_jobs SET status=?,error_code=?,available_at=?,updated_at=? WHERE id=?",
      ).run(
        status,
        code,
        now() +
          (status === "retry_wait"
            ? Number(part.attempts) <= 1
              ? 5000
              : 15000
            : 0),
        stamp(),
        lease.jobId,
      );
    });
  }
  function controlSummaryJob(
    userId: string,
    version: number,
    jobId: string,
    action: "cancel" | "resume" | "delete",
  ) {
    if (
      typeof action !== "string" ||
      !["cancel", "resume", "delete"].includes(action)
    )
      throw new PlatformError("INVALID_JOB_ACTION");
    return transaction(() => {
      const row = owned(userId, version, jobId);
      if (action === "resume") {
        if (!["paused", "retry_wait"].includes(String(row.status)))
          throw new PlatformError("JOB_NOT_RESUMABLE", 409);
        const part = db
          .prepare(
            "SELECT attempts FROM summary_job_parts WHERE job_id=? AND status!='completed' ORDER BY ordinal LIMIT 1",
          )
          .get(jobId);
        if (!part || Number(part.attempts) >= LIMIT.attempts)
          throw new PlatformError("JOB_RETRIES_EXHAUSTED", 409);
        db.prepare(
          "UPDATE summary_jobs SET status='queued',available_at=?,error_code=NULL,updated_at=? WHERE id=?",
        ).run(now(), stamp(), jobId);
      } else {
        if (action === "delete" && !terminal(row.status))
          throw new PlatformError("JOB_CANCEL_FIRST", 409);
        if (action === "delete") {
          if (
            db
              .prepare(
                "SELECT 1 FROM summary_job_parts p JOIN billing_reservations b ON b.request_id=p.attempt_request_id AND b.user_id=? WHERE p.job_id=? AND b.status='reserved'",
              )
              .get(userId, jobId)
          )
            throw new PlatformError("JOB_REFUND_REQUIRED", 409);
          db.prepare("DELETE FROM summary_jobs WHERE id=?").run(jobId);
          return { deleted: true };
        }
        if (row.status === "completed")
          throw new PlatformError("JOB_ALREADY_COMPLETED", 409);
        db.prepare(
          "UPDATE summary_jobs SET status='cancelled',updated_at=?,error_code=NULL WHERE id=?",
        ).run(stamp(), jobId);
      }
      return {
        job: view(
          db.prepare("SELECT * FROM summary_jobs WHERE id=?").get(jobId) as Row,
        ),
      };
    });
  }
  /** Internal maintenance: refund candidates must be finalized before stale work can be reclaimed. */
  function summaryJobRefunds(
    userId: string,
  ): { userId: string; reservationId: string }[] {
    return db
      .prepare(
        "SELECT b.id FROM summary_job_parts p JOIN summary_jobs j ON j.id=p.job_id JOIN billing_reservations b ON b.request_id=p.attempt_request_id AND b.user_id=j.user_id JOIN users u ON u.id=j.user_id WHERE j.user_id=? AND b.status='reserved' AND (j.status IN ('cancelled','failed') OR j.expires_at<=? OR p.lease_until<=? OR u.disabled=1 OR j.session_version!=u.session_version)",
      )
      .all(userId, now(), now())
      .map((row) => ({ userId, reservationId: String(row.id) }));
  }
  function recoverSummaryJobs(userId: string) {
    return transaction(() => {
      const user = getUser(userId);
      const rows = db
        .prepare(
          "SELECT j.id,j.session_version,j.expires_at,p.ordinal,p.attempts,p.attempt_request_id,p.lease_until FROM summary_jobs j JOIN summary_job_parts p ON p.job_id=j.id WHERE j.user_id=? AND j.status='running' AND p.status='running'",
        )
        .all(userId) as Row[];
      for (const row of rows) {
        const revoked =
          !user ||
          user.disabled ||
          Number(row.session_version) !== user.sessionVersion;
        if (
          !revoked &&
          Number(row.expires_at) > now() &&
          Number(row.lease_until) > now()
        )
          continue;
        const held = db
          .prepare(
            "SELECT 1 FROM billing_reservations WHERE request_id=? AND user_id=? AND status='reserved'",
          )
          .get(row.attempt_request_id, userId);
        if (held) continue;
        db.prepare(
          "UPDATE summary_job_parts SET status='pending',lease_token=NULL,lease_until=NULL WHERE job_id=? AND ordinal=?",
        ).run(row.id, row.ordinal);
        db.prepare(
          "UPDATE summary_jobs SET status=?,error_code=?,available_at=?,updated_at=? WHERE id=?",
        ).run(
          revoked || Number(row.attempts) >= LIMIT.attempts
            ? "failed"
            : "retry_wait",
          revoked ? "SESSION_REVOKED" : "WORKER_INTERRUPTED",
          now(),
          stamp(),
          row.id,
        );
      }
      if (user)
        db.prepare(
          "UPDATE summary_jobs SET status='failed',error_code='SESSION_REVOKED',updated_at=? WHERE user_id=? AND (session_version!=? OR ?=1) AND status IN ('queued','retry_wait','paused')",
        ).run(stamp(), userId, user.sessionVersion, user.disabled ? 1 : 0);
      db.prepare(
        "DELETE FROM summary_jobs WHERE user_id=? AND expires_at<=? AND NOT EXISTS(SELECT 1 FROM summary_job_parts p JOIN billing_reservations b ON b.request_id=p.attempt_request_id AND b.user_id=summary_jobs.user_id WHERE p.job_id=summary_jobs.id AND b.status='reserved')",
      ).run(userId, now());
    });
  }
  function nextSummaryJobWake(userId: string, version: number): number | null {
    const row = db
      .prepare(
        "SELECT min(at) at FROM (SELECT available_at at FROM summary_jobs WHERE user_id=? AND session_version=? AND status IN ('queued','retry_wait') AND expires_at>? UNION ALL SELECT p.lease_until at FROM summary_jobs j JOIN summary_job_parts p ON p.job_id=j.id WHERE j.user_id=? AND j.session_version=? AND j.status='running' AND p.status='running' AND j.expires_at>?)",
      )
      .get(userId, version, now(), userId, version, now());
    return row?.at === null || row?.at === undefined ? null : Number(row.at);
  }
  return {
    createSummaryJob,
    listSummaryJobs,
    readSummaryJob,
    claimSummaryJob,
    startSummaryJobAttempt,
    completeSummaryJobPart,
    failSummaryJobPart,
    controlSummaryJob,
    summaryJobRefunds,
    recoverSummaryJobs,
    nextSummaryJobWake,
  };
}
