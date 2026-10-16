import { createHash, randomUUID } from "node:crypto";
import type { DatabaseConnection as DatabaseSync } from "./database-connection";
import { PlatformError, type User } from "./types";
export const AI_HTTP_LIMITS = {
  leaseMs: 180000,
  retentionMs: 7 * 86400000,
  receiptsPerAccount: 2048,
} as const;
export type AIHttpEndpoint = "ai" | "voice" | "rag-search" | "rag-embed";
export type AIHttpReceipt = {
  requestId: string;
  endpoint: AIHttpEndpoint;
  status: "in_progress" | "completed" | "failed";
  expiresAt: string;
  tutorSessionId?: string;
};
export type AIHttpLease = {
  userId: string;
  sessionVersion: number;
  key: string;
  requestId: string;
  token: string;
};
export class AIHttpRequestError extends PlatformError {
  constructor(
    code: string,
    public receipt?: AIHttpReceipt,
  ) {
    super(code, 409);
  }
}
export function aiHttpKey(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      value,
    )
  )
    throw new PlatformError("INVALID_IDEMPOTENCY_KEY");
  return value.toLowerCase();
}
/** Canonical normalized input only; persists a digest, never source/media/output. */
export function aiHttpFingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
export const aiHttpMigration = {
  version: 14,
  sql: `
CREATE TABLE ai_http_requests (
 user_id TEXT NOT NULL REFERENCES users(id),request_key TEXT NOT NULL,session_version INTEGER NOT NULL,
 endpoint TEXT NOT NULL CHECK(endpoint IN ('ai','voice','rag-search','rag-embed')),fingerprint TEXT NOT NULL,request_id TEXT NOT NULL UNIQUE,
 status TEXT NOT NULL CHECK(status IN ('pending','completed','failed')),lease_token TEXT NOT NULL,lease_until INTEGER NOT NULL,
 tutor_session_id TEXT REFERENCES tutor_sessions(id) ON DELETE SET NULL,error_code TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,expires_at INTEGER NOT NULL,
 PRIMARY KEY(user_id,request_key)
);
CREATE INDEX ai_http_expiry ON ai_http_requests(user_id,expires_at);
`,
};
type Row = Record<string, any>;
export function createAIHttpStore({
  db,
  now,
  stamp,
  transaction,
  getUser,
  refund,
}: {
  db: DatabaseSync;
  now: () => number;
  stamp: () => string;
  transaction: <T>(fn: () => T) => T;
  getUser: (id: string) => User | null;
  refund: (input: { userId: string; reservationId: string }) => unknown;
}) {
  function actor(id: string, version: number) {
    const u = getUser(id);
    if (
      !u ||
      u.disabled ||
      !Number.isSafeInteger(version) ||
      u.sessionVersion !== version
    )
      throw new PlatformError("SESSION_REVOKED", 401);
    return u;
  }
  const row = (userId: string, key: string) =>
    db
      .prepare(
        "SELECT * FROM ai_http_requests WHERE user_id=? AND request_key=?",
      )
      .get(userId, key) as Row | undefined;
  const receipt = (r: Row): AIHttpReceipt => ({
    requestId: r.request_id,
    endpoint: r.endpoint,
    status: r.status === "pending" ? "in_progress" : r.status,
    expiresAt: new Date(Number(r.expires_at)).toISOString(),
    ...(r.tutor_session_id ? { tutorSessionId: r.tutor_session_id } : {}),
  });
  /** Fence abandoned/old-session work first. Refund outside this transaction using the existing ledger.
   * A late settlement then rolls back through assertAIHttpRequest, never revives or reruns the intent. */
  function reconcile(userId: string) {
    transaction(() => {
      const u = getUser(userId);
      db.prepare(
        "UPDATE ai_http_requests SET status='failed',error_code='REQUEST_ABANDONED',updated_at=? WHERE user_id=? AND status='pending' AND (lease_until<=? OR session_version!=? OR ?=1)",
      ).run(
        stamp(),
        userId,
        now(),
        u?.sessionVersion ?? -1,
        !u || u.disabled ? 1 : 0,
      );
    });
    const held = db
      .prepare(
        "SELECT b.id FROM billing_reservations b JOIN ai_http_requests h ON h.user_id=b.user_id AND (b.request_id=h.request_id OR b.request_id=h.request_id||'-embedding') WHERE h.user_id=? AND h.status='failed' AND b.status='reserved'",
      )
      .all(userId);
    for (const b of held) refund({ userId, reservationId: String(b.id) });
    db.prepare(
      "DELETE FROM ai_http_requests WHERE user_id=? AND expires_at<=? AND status!='pending' AND NOT EXISTS(SELECT 1 FROM billing_reservations b WHERE b.user_id=ai_http_requests.user_id AND (b.request_id=ai_http_requests.request_id OR b.request_id=ai_http_requests.request_id||'-embedding') AND b.status='reserved')",
    ).run(userId, now());
  }
  function assertAIHttpRequest(lease: AIHttpLease) {
    actor(lease.userId, lease.sessionVersion);
    const r = row(lease.userId, lease.key);
    if (
      !r ||
      r.request_id !== lease.requestId ||
      r.lease_token !== lease.token ||
      r.status !== "pending" ||
      Number(r.lease_until) <= now() ||
      Number(r.session_version) !== lease.sessionVersion
    )
      throw new PlatformError("AI_REQUEST_STALE", 409);
    return r;
  }
  function validatedKey(
    endpoint: AIHttpEndpoint,
    key: unknown,
    fingerprint: string,
  ) {
    const normalized = aiHttpKey(key);
    if (
      !["ai", "voice", "rag-search", "rag-embed"].includes(endpoint) ||
      !/^[a-f0-9]{64}$/.test(fingerprint)
    )
      throw new PlatformError("INVALID_REQUEST");
    return normalized;
  }
  function replay(
    userId: string,
    endpoint: AIHttpEndpoint,
    key: string,
    fingerprint: string,
  ) {
    const prior = row(userId, key);
    if (prior) {
      if (prior.endpoint !== endpoint || prior.fingerprint !== fingerprint)
        throw new AIHttpRequestError("AI_REQUEST_CONFLICT");
      throw new AIHttpRequestError(
        prior.status === "completed"
          ? "AI_REQUEST_COMPLETED"
          : prior.status === "pending"
            ? "AI_REQUEST_IN_PROGRESS"
            : "AI_REQUEST_FAILED",
        receipt(prior),
      );
    }
    const requestId =
      "http-" +
      createHash("sha256")
        .update(JSON.stringify([userId, key]))
        .digest("hex");
    // Receipt expiry cannot make a previously charged or dispatched intent reusable.
    const tombstone = db
      .prepare(
        "SELECT status FROM billing_reservations WHERE user_id=? AND request_id=?",
      )
      .get(userId, requestId);
    if (tombstone)
      throw new AIHttpRequestError(
        tombstone.status === "settled"
          ? "AI_REQUEST_COMPLETED"
          : "AI_REQUEST_FAILED",
      );
    return requestId;
  }
  return {
    /** Check prior paid intent before an unchanged/free fast path, without creating a paid receipt. */
    checkAIHttpReplay(
      userId: string,
      version: number,
      endpoint: AIHttpEndpoint,
      key: unknown,
      fingerprint: string,
    ) {
      actor(userId, version);
      const normalized = validatedKey(endpoint, key, fingerprint);
      reconcile(userId);
      transaction(() => {
        actor(userId, version);
        replay(userId, endpoint, normalized, fingerprint);
      });
    },
    beginAIHttpRequest(
      userId: string,
      version: number,
      endpoint: AIHttpEndpoint,
      key: unknown,
      fingerprint: string,
    ): AIHttpLease {
      actor(userId, version);
      const normalized = validatedKey(endpoint, key, fingerprint);
      reconcile(userId);
      return transaction(() => {
        actor(userId, version);
        const requestId = replay(userId, endpoint, normalized, fingerprint);
        if (
          Number(
            db
              .prepare(
                "SELECT count(*) n FROM ai_http_requests WHERE user_id=?",
              )
              .get(userId)!.n,
          ) >= AI_HTTP_LIMITS.receiptsPerAccount
        )
          throw new PlatformError("AI_REQUEST_LIMIT", 429);
        const token = randomUUID();
        db.prepare(
          "INSERT INTO ai_http_requests(user_id,request_key,session_version,endpoint,fingerprint,request_id,status,lease_token,lease_until,created_at,updated_at,expires_at) VALUES(?,?,?,?,?,?,'pending',?,?,?,?,?)",
        ).run(
          userId,
          normalized,
          version,
          endpoint,
          fingerprint,
          requestId,
          token,
          now() + AI_HTTP_LIMITS.leaseMs,
          stamp(),
          stamp(),
          now() + AI_HTTP_LIMITS.retentionMs,
        );
        return {
          userId,
          sessionVersion: version,
          key: normalized,
          requestId,
          token,
        };
      });
    },
    assertAIHttpRequest,
    /** Called ONLY inside the ledger settlement transaction, together with tutor/checkpoint writes. */
    completeAIHttpRequest(lease: AIHttpLease, tutorSessionId?: string) {
      assertAIHttpRequest(lease);
      const settled = db
        .prepare(
          "SELECT status FROM billing_reservations WHERE user_id=? AND request_id=?",
        )
        .get(lease.userId, lease.requestId);
      if (settled?.status !== "settled")
        throw new PlatformError("AI_REQUEST_UNSETTLED", 409);
      if (
        tutorSessionId !== undefined &&
        !db
          .prepare("SELECT 1 FROM tutor_sessions WHERE id=? AND user_id=?")
          .get(tutorSessionId, lease.userId)
      )
        throw new PlatformError("TUTOR_SESSION_NOT_FOUND", 404);
      db.prepare(
        "UPDATE ai_http_requests SET status='completed',tutor_session_id=?,updated_at=? WHERE user_id=? AND request_key=? AND lease_token=? AND status='pending'",
      ).run(
        tutorSessionId || null,
        stamp(),
        lease.userId,
        lease.key,
        lease.token,
      );
    },
    failAIHttpRequest(lease: AIHttpLease, code: string) {
      db.prepare(
        "UPDATE ai_http_requests SET status='failed',error_code=?,updated_at=? WHERE user_id=? AND request_key=? AND lease_token=? AND status='pending'",
      ).run(
        /^[A-Z][A-Z0-9_]{1,79}$/.test(code) ? code : "PROVIDER_UNAVAILABLE",
        stamp(),
        lease.userId,
        lease.key,
        lease.token,
      );
    },
    readAIHttpRequest(
      userId: string,
      version: number,
      key: unknown,
    ): AIHttpReceipt {
      actor(userId, version);
      const normalized = aiHttpKey(key);
      reconcile(userId);
      actor(userId, version);
      const r = row(userId, normalized);
      if (!r) throw new PlatformError("AI_REQUEST_NOT_FOUND", 404);
      return receipt(r);
    },
  };
}
