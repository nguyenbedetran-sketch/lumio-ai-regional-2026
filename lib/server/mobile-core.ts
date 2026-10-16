import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { DatabaseConnection as DatabaseSync } from "./database-connection";
import { PlatformError, type User, type AuditInput } from "./types";

const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const validSecret = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);

/** Independent mobile sessions; no provider credentials or reusable OAuth tokens leave the server. */
export function createMobileStore({
  db,
  now,
  stamp,
  transaction,
  getUser,
  recordAudit,
}: {
  db: DatabaseSync;
  now: () => number;
  stamp: () => string;
  transaction: <T>(fn: () => T) => T;
  getUser: (id: string) => User | null;
  recordAudit: (input: AuditInput) => unknown;
}) {
  function current(userId: string, version: number) {
    const user = getUser(userId);
    if (!user || user.disabled || user.sessionVersion !== version)
      throw new PlatformError("SESSION_REVOKED", 401);
    return user;
  }
  function createMobileCode(userId: string, version: number) {
    return transaction(() => {
      current(userId, version);
      db.prepare(
        "DELETE FROM mobile_pair_codes WHERE user_id=? OR expires_at<=?",
      ).run(userId, now());
      const code = randomBytes(32).toString("base64url"),
        expiresAt = now() + 5 * 60_000;
      db.prepare("INSERT INTO mobile_pair_codes VALUES (?,?,?,?,?)").run(
        digest(code),
        userId,
        version,
        expiresAt,
        stamp(),
      );
      return { code, expiresAt };
    });
  }
  function exchangeMobileCode(code: unknown, deviceName: unknown) {
    if (!validSecret(code)) throw new PlatformError("PAIR_CODE_INVALID", 401);
    const name = typeof deviceName === "string" ? deviceName.trim() : "";
    if (!name || name.length > 80 || /[\u0000-\u001f]/.test(name))
      throw new PlatformError("INVALID_DEVICE_NAME");
    return transaction(() => {
      const row = db
        .prepare(
          "SELECT * FROM mobile_pair_codes WHERE code_hash=? AND expires_at>?",
        )
        .get(digest(code), now());
      if (!row) throw new PlatformError("PAIR_CODE_INVALID", 401);
      const user = current(String(row.user_id), Number(row.session_version));
      db.prepare("DELETE FROM mobile_sessions WHERE expires_at<=?").run(now());
      const count = db
        .prepare(
          "SELECT count(*) n FROM mobile_sessions WHERE user_id=? AND session_version=?",
        )
        .get(user.id, user.sessionVersion);
      if (Number(count?.n) >= 5) throw new PlatformError("DEVICE_LIMIT", 409);
      db.prepare("DELETE FROM mobile_pair_codes WHERE code_hash=?").run(
        digest(code),
      );
      const accessToken = randomBytes(32).toString("base64url"),
        id = randomUUID(),
        expiresAt = now() + 7 * 86_400_000;
      db.prepare("INSERT INTO mobile_sessions VALUES (?,?,?,?,?,?,?,?)").run(
        id,
        digest(accessToken),
        user.id,
        user.sessionVersion,
        name,
        expiresAt,
        stamp(),
        stamp(),
      );
      recordAudit({ actorId: user.id, action: "MOBILE_PAIRED", target: id });
      return {
        accessToken,
        expiresAt,
        user: { id: user.id, name: user.name, email: user.email },
      };
    });
  }
  function mobileIdentity(token: unknown) {
    if (!validSecret(token)) throw new PlatformError("SIGN_IN_REQUIRED", 401);
    const row = db
      .prepare(
        "SELECT * FROM mobile_sessions WHERE token_hash=? AND expires_at>?",
      )
      .get(digest(token), now());
    if (!row) throw new PlatformError("SESSION_REVOKED", 401);
    const user = current(String(row.user_id), Number(row.session_version));
    db.prepare("UPDATE mobile_sessions SET last_seen_at=? WHERE id=?").run(
      stamp(),
      String(row.id),
    );
    return {
      user,
      deviceId: String(row.id),
      expiresAt: Number(row.expires_at),
    };
  }
  function listMobileSessions(userId: string, version: number) {
    current(userId, version);
    return db
      .prepare(
        "SELECT id,device_name,created_at,last_seen_at,expires_at FROM mobile_sessions WHERE user_id=? AND session_version=? AND expires_at>? ORDER BY created_at DESC",
      )
      .all(userId, version, now())
      .map((row) => ({
        id: String(row.id),
        name: String(row.device_name),
        createdAt: String(row.created_at),
        lastSeenAt: String(row.last_seen_at),
        expiresAt: Number(row.expires_at),
      }));
  }
  function revokeMobileSession(userId: string, version: number, id: string) {
    transaction(() => {
      current(userId, version);
      const result = db
        .prepare("DELETE FROM mobile_sessions WHERE id=? AND user_id=?")
        .run(id, userId);
      if (result.changes)
        recordAudit({ actorId: userId, action: "MOBILE_REVOKED", target: id });
    });
  }
  return {
    createMobileCode,
    exchangeMobileCode,
    mobileIdentity,
    listMobileSessions,
    revokeMobileSession,
  };
}
