import { createHash, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { normalizeSyncEnvelope, type SyncSnapshot } from "../sync/contracts";
import { PlatformError, type User } from "./types";
type Context = {
  db: DatabaseSync;
  now: () => number;
  stamp: () => string;
  transaction: <T>(fn: () => T) => T;
  getUser: (id: string) => User | null;
};
type Row = Record<string, string | number | bigint | Uint8Array | null>;
const week = 7 * 86400000;
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
export function createRuntimeV3Store({
  db,
  now,
  stamp,
  transaction,
  getUser,
}: Context) {
  function owner(id: string, version: number) {
    const user = getUser(id);
    if (!user || user.disabled || user.sessionVersion !== version)
      throw new PlatformError("SESSION_REVOKED", 401);
    return user;
  }
  function purgeExpiredSync() {
    const time = now();
    db.prepare(
      "DELETE FROM sync_operations WHERE created_at<=? OR user_id IN (SELECT user_id FROM sync_snapshots WHERE expires_at<=?)",
    ).run(time - week, time);
    db.prepare("DELETE FROM sync_snapshots WHERE expires_at<=?").run(time);
  }
  function acquireRuntimeAILease(
    userId: string,
    version: number,
    competition: boolean,
  ) {
    return transaction(() => {
      owner(userId, version);
      purgeExpiredSync();
      const time = now(),
        day = new Date(time).toISOString().slice(0, 10);
      db.prepare("DELETE FROM runtime_ai_leases WHERE expires_at<=?").run(time);
      db.prepare("DELETE FROM runtime_rate_windows WHERE updated_at<?").run(
        time - 2 * 86400000,
      );
      const active = Number(
        db
          .prepare("SELECT count(*) n FROM runtime_ai_leases WHERE user_id=?")
          .get(userId)!.n,
      );
      if (active >= 1) throw new PlatformError("LOCAL_RATE_LIMIT", 429);
      function window(
        key: string,
        perMinute: number,
        perDay: number,
        code: string,
      ) {
        const old = db
          .prepare("SELECT * FROM runtime_rate_windows WHERE key=?")
          .get(key) as Row | undefined;
        const minuteStart =
          old && time - Number(old.minute_start) < 60000
            ? Number(old.minute_start)
            : time;
        const minuteCount =
          old && minuteStart === Number(old.minute_start)
            ? Number(old.minute_count)
            : 0;
        const daily = old?.day === day ? Number(old.daily_count) : 0;
        if (minuteCount >= perMinute || daily >= perDay)
          throw new PlatformError(code, 429);
        db.prepare(
          "INSERT INTO runtime_rate_windows VALUES(?,?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET minute_start=excluded.minute_start,minute_count=excluded.minute_count,day=excluded.day,daily_count=excluded.daily_count,updated_at=excluded.updated_at",
        ).run(key, minuteStart, minuteCount + 1, day, daily + 1, time);
      }
      window("account:" + userId, 15, 150, "LOCAL_RATE_LIMIT");
      if (competition) {
        const globalActive = Number(
          db
            .prepare(
              "SELECT count(*) n FROM runtime_ai_leases WHERE competition=1",
            )
            .get()!.n,
        );
        if (globalActive >= 3)
          throw new PlatformError("COMPETITION_RATE_LIMIT", 429);
        window("competition", 1000000, 200, "COMPETITION_RATE_LIMIT");
      }
      const id = randomUUID();
      db.prepare("INSERT INTO runtime_ai_leases VALUES(?,?,?,?)").run(
        id,
        userId,
        competition ? 1 : 0,
        time + 180000,
      );
      return id;
    });
  }
  function releaseRuntimeAILease(id: string) {
    db.prepare("DELETE FROM runtime_ai_leases WHERE id=?").run(id);
  }
  function syncRead(userId: string, version: number): SyncSnapshot {
    return transaction(() => {
      owner(userId, version);
      purgeExpiredSync();
      let row = db
        .prepare("SELECT * FROM sync_snapshots WHERE user_id=?")
        .get(userId) as Row | undefined;
      if (!row) {
        db.prepare(
          "INSERT INTO sync_snapshots VALUES(?,?,0,NULL,NULL,?,?)",
        ).run(userId, randomUUID(), stamp(), now() + week);
        row = db
          .prepare("SELECT * FROM sync_snapshots WHERE user_id=?")
          .get(userId) as Row;
      }
      return {
        epoch: String(row.epoch),
        revision: Number(row.revision),
        digest: row.digest ? String(row.digest) : null,
        updatedAt: String(row.updated_at),
        expiresAt: new Date(Number(row.expires_at)).toISOString(),
        data: row.payload_json
          ? normalizeSyncEnvelope(JSON.parse(String(row.payload_json)))
          : null,
      };
    });
  }
  function syncWrite(
    userId: string,
    version: number,
    input: {
      epoch: string;
      expectedRevision: number;
      requestId: string;
      data: unknown;
    },
  ) {
    if (
      !input ||
      typeof input.epoch !== "string" ||
      !Number.isSafeInteger(input.expectedRevision) ||
      input.expectedRevision < 0 ||
      input.expectedRevision > 1e9 ||
      typeof input.requestId !== "string" ||
      !/^[-\w]{16,100}$/.test(input.requestId)
    )
      throw new PlatformError("INVALID_SYNC_REQUEST", 400);
    let data;
    try {
      data = normalizeSyncEnvelope(input.data);
    } catch (e) {
      throw new PlatformError(
        e instanceof Error && e.message === "SYNC_TOO_LARGE"
          ? "SYNC_TOO_LARGE"
          : "INVALID_SYNC_DATA",
        400,
      );
    }
    const payload = JSON.stringify(data),
      hash = digest(payload),
      fingerprint = digest(
        JSON.stringify([input.epoch, input.expectedRevision, hash]),
      );
    owner(userId, version);
    transaction(purgeExpiredSync);
    return transaction(() => {
      owner(userId, version);
      const previous = db
        .prepare(
          "SELECT * FROM sync_operations WHERE user_id=? AND request_id=?",
        )
        .get(userId, input.requestId) as Row | undefined;
      if (previous) {
        if (previous.fingerprint !== fingerprint)
          throw new PlatformError("IDEMPOTENCY_CONFLICT", 409);
        return JSON.parse(String(previous.result_json)) as {
          epoch: string;
          revision: number;
          digest: string;
        };
      }
      const row = db
        .prepare("SELECT * FROM sync_snapshots WHERE user_id=?")
        .get(userId) as Row | undefined;
      if (
        !row ||
        Number(row.expires_at) <= now() ||
        row.epoch !== input.epoch ||
        Number(row.revision) !== input.expectedRevision
      )
        throw new PlatformError("SYNC_CONFLICT", 409);
      const revision = Number(row.revision) + 1,
        result = { epoch: input.epoch, revision, digest: hash };
      db.prepare(
        "UPDATE sync_snapshots SET revision=?,payload_json=?,digest=?,updated_at=?,expires_at=? WHERE user_id=?",
      ).run(revision, payload, hash, stamp(), now() + week, userId);
      db.prepare("INSERT INTO sync_operations VALUES(?,?,?,?,?)").run(
        userId,
        input.requestId,
        fingerprint,
        JSON.stringify(result),
        now(),
      );
      db.prepare(
        "DELETE FROM sync_operations WHERE user_id=? AND created_at<?",
      ).run(userId, now() - week);
      return result;
    });
  }
  function syncDelete(
    userId: string,
    version: number,
    epoch: string,
    revision: number,
  ) {
    return transaction(() => {
      owner(userId, version);
      const row = db
        .prepare("SELECT epoch,revision FROM sync_snapshots WHERE user_id=?")
        .get(userId) as Row | undefined;
      if (!row || row.epoch !== epoch || Number(row.revision) !== revision)
        throw new PlatformError("SYNC_CONFLICT", 409);
      db.prepare("DELETE FROM sync_snapshots WHERE user_id=?").run(userId);
      db.prepare("DELETE FROM sync_operations WHERE user_id=?").run(userId);
      return { deleted: true };
    });
  }
  function runtimeHealth() {
    const version = Number(
      db.prepare("SELECT max(version) version FROM schema_migrations").get()
        ?.version || 0,
    );
    for (const table of [
      "users",
      "identities",
      "feature_flags",
      "billing_accounts",
      "billing_reservations",
      "billing_ledger",
      "ai_usage",
      "mobile_sessions",
      "tutor_sessions",
      "tutor_turns",
      "runtime_rate_windows",
      "runtime_ai_leases",
      "sync_snapshots",
      "sync_operations",
      "rag_documents",
      "rag_chunks",
      "rag_snapshots",
      "summary_jobs",
      "summary_job_parts",
      "teacher_applications",
      "teacher_credentials",
      "teacher_application_operations",
    ]) {
      db.prepare("SELECT 1 FROM " + table + " LIMIT 1").get();
    }
    return { ready: version === 11, schemaVersion: version };
  }
  return {
    acquireRuntimeAILease,
    releaseRuntimeAILease,
    syncRead,
    syncWrite,
    syncDelete,
    runtimeHealth,
  };
}
