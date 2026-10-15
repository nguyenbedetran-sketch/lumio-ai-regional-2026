import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { flagDefinitions, migrations } from "./schema";
import { mayBootstrapAdmin, requirePermission } from "./policy";
import { PlatformError } from "./types";
import { createBillingStore } from "./billing-core";
import { createMobileStore } from "./mobile-core";
import { createTutorStore } from "./tutor-core";
import { createRuntimeV3Store } from "./runtime-v3-core";
import { createRagStore } from "./rag-core";
import { createSummaryJobStore } from "./job-core";
import { createTeacherStore } from "./teacher-core";
import { createTeachingStore } from "./teaching-core";
import { isPublicDemo } from "./public-demo";
import { isCompetitionPreview } from "./competition-preview";
import type {
  Actor,
  AIUsageEvent,
  AIUsageInput,
  AuditEvent,
  AuditInput,
  AuditValue,
  FeatureFlag,
  IdentityInput,
  IdentityProvider,
  IdentitySummary,
  Membership,
  SystemRole,
  User,
} from "./types";

type Row = Record<string, string | number | bigint | Uint8Array | null>;
const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const emailValue = (value: unknown) => {
  const email = text(value, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
};
function userFrom(row: Row | undefined): User | null {
  return row
    ? {
        id: String(row.id),
        storageKey: String(row.storage_key),
        name: String(row.name),
        email: row.email === null ? null : String(row.email),
        role: row.role as SystemRole,
        disabled: !!row.disabled,
        sessionVersion: Number(row.session_version),
        createdAt: String(row.created_at),
        lastSeenAt: String(row.last_seen_at),
      }
    : null;
}
function cleanMetadata(value: Record<string, AuditValue> | undefined) {
  return Object.fromEntries(
    Object.entries(value || {})
      .slice(0, 20)
      .filter(
        ([key]) =>
          /^[a-zA-Z][a-zA-Z0-9_.]{0,39}$/.test(key) &&
          !/(password|secret|token|key|prompt|content|email|cookie|authorization)/i.test(
            key,
          ),
      )
      .map(([key, val]) => [
        key,
        typeof val === "string"
          ? val
              .slice(0, 200)
              .replace(/(?:sk-proj-|xai-|GOCSPX-)[\w-]+/g, "[redacted]")
          : val,
      ]),
  );
}
const positiveMetric = (value: unknown, integer = true): number | null =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= Number.MAX_SAFE_INTEGER
    ? integer
      ? Math.round(value)
      : value
    : null;

export function createStore(
  filename: string,
  options: { adminEmails?: string[]; now?: () => number } = {},
) {
  if (filename !== ":memory:")
    mkdirSync(dirname(resolve(filename)), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(
    "PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;",
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)",
  );
  const now = options.now || Date.now;
  const stamp = () => new Date(now()).toISOString();
  function transaction<T>(fn: () => T): T {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      db.exec("COMMIT");
      return result;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
  for (const migration of migrations) {
    // A second process can initialize the same database, so check under the write lock.
    transaction(() => {
      if (
        !db
          .prepare("SELECT version FROM schema_migrations WHERE version=?")
          .get(migration.version)
      ) {
        db.exec(migration.sql);
        db.prepare(
          "INSERT INTO schema_migrations(version,applied_at) VALUES (?,?)",
        ).run(migration.version, stamp());
      }
    });
  }
  for (const flag of flagDefinitions)
    db.prepare(
      "INSERT OR IGNORE INTO feature_flags(key,enabled,description,updated_at) VALUES (?,?,?,?)",
    ).run(flag.key, Number(flag.enabled), flag.description, stamp());

  const getUser = (id: string) =>
    userFrom(db.prepare("SELECT * FROM users WHERE id=?").get(id));
  const getUserByStorageKey = (key: string) =>
    userFrom(db.prepare("SELECT * FROM users WHERE storage_key=?").get(key));
  const findIdentity = (provider: IdentityProvider, id: string) =>
    userFrom(
      db
        .prepare(
          "SELECT u.* FROM users u JOIN identities i ON u.id=i.user_id WHERE i.provider=? AND i.provider_account_id=?",
        )
        .get(provider, id),
    );
  function getMemberships(userId: string): Membership[] {
    return db
      .prepare(
        "SELECT organization_id,role FROM memberships WHERE user_id=? ORDER BY organization_id",
      )
      .all(userId)
      .map((row) => ({
        organizationId: String(row.organization_id),
        role: row.role as Membership["role"],
      }));
  }
  function actorFor(id: string): Actor {
    const user = getUser(id);
    if (!user || user.disabled) throw new PlatformError("FORBIDDEN", 403);
    return { user, memberships: getMemberships(id) };
  }
  function recordAudit(input: AuditInput) {
    if (!/^[A-Z][A-Z0-9_]{2,79}$/.test(input.action))
      throw new PlatformError("INVALID_AUDIT_ACTION");
    db.prepare(
      "INSERT INTO audit_events(id,actor_id,action,target,result,request_id,before_json,after_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
    ).run(
      randomUUID(),
      input.actorId || null,
      input.action,
      text(input.target, 180) || null,
      input.result || "success",
      text(input.requestId, 100) || randomUUID(),
      JSON.stringify(cleanMetadata(input.before)),
      JSON.stringify(cleanMetadata(input.after)),
      stamp(),
    );
  }
  function validateIdentity(input: IdentityInput) {
    if (
      !["google", "facebook"].includes(input.provider) ||
      !/^[A-Za-z0-9._:-]{1,200}$/.test(input.providerAccountId)
    )
      throw new PlatformError("INVALID_IDENTITY");
  }
  function ensureIdentity(input: IdentityInput): User {
    validateIdentity(input);
    return transaction(() => {
      const existing = findIdentity(input.provider, input.providerAccountId);
      const current = stamp(),
        email = emailValue(input.email);
      const admin = mayBootstrapAdmin(
        { ...input, email },
        options.adminEmails ||
          (process.env.LUMIO_ADMIN_EMAILS || "").split(","),
      );
      if (existing) {
        if (existing.disabled) throw new PlatformError("ACCOUNT_DISABLED", 403);
        // Authorization is based on a fresh, verified provider response, never an email from the client.
        const role = admin ? "SUPER_ADMIN" : existing.role;
        db.prepare(
          "UPDATE users SET last_seen_at=?,name=?,email=COALESCE(email,?),role=? WHERE id=?",
        ).run(
          current,
          text(input.name, 100) || existing.name,
          email,
          role,
          existing.id,
        );
        db.prepare(
          "UPDATE identities SET email=?,email_verified=? WHERE provider=? AND provider_account_id=?",
        ).run(
          email,
          Number(input.emailVerified === true),
          input.provider,
          input.providerAccountId,
        );
        if (role !== existing.role)
          recordAudit({
            actorId: existing.id,
            action: "ADMIN_BOOTSTRAPPED",
            target: existing.id,
            before: { role: existing.role },
            after: { role },
          });
        recordAudit({
          actorId: existing.id,
          action: "USER_SIGNED_IN",
          target: existing.id,
          after: { provider: input.provider },
        });
        return getUser(existing.id)!;
      }
      const id = randomUUID(),
        role = admin ? "SUPER_ADMIN" : "USER";
      db.prepare(
        "INSERT INTO users(id,storage_key,name,email,role,created_at,last_seen_at) VALUES (?,?,?,?,?,?,?)",
      ).run(
        id,
        `${input.provider}:${input.providerAccountId}`,
        text(input.name, 100) || "Lumio Learner",
        email,
        role,
        current,
        current,
      );
      db.prepare(
        "INSERT INTO identities(provider,provider_account_id,user_id,email,email_verified,linked_at) VALUES (?,?,?,?,?,?)",
      ).run(
        input.provider,
        input.providerAccountId,
        id,
        email,
        Number(input.emailVerified === true),
        current,
      );
      recordAudit({
        actorId: id,
        action: "USER_CREATED",
        target: id,
        after: { provider: input.provider, role },
      });
      if (admin)
        recordAudit({
          actorId: id,
          action: "ADMIN_BOOTSTRAPPED",
          target: id,
          after: { role },
        });
      return getUser(id)!;
    });
  }
  function listIdentities(userId: string): IdentitySummary[] {
    return db
      .prepare(
        "SELECT provider,email,email_verified,linked_at FROM identities WHERE user_id=? ORDER BY linked_at",
      )
      .all(userId)
      .map((row) => ({
        provider: row.provider as IdentityProvider,
        email: row.email === null ? null : String(row.email),
        emailVerified: !!row.email_verified,
        linkedAt: String(row.linked_at),
      }));
  }
  function isFeatureEnabled(key: string): boolean {
    const row = db
      .prepare("SELECT enabled FROM feature_flags WHERE key=?")
      .get(key);
    return !!row?.enabled;
  }
  function createLinkIntent(
    userId: string,
    provider: IdentityProvider,
    expectedSessionVersion?: number,
  ) {
    if (!["google", "facebook"].includes(provider))
      throw new PlatformError("INVALID_PROVIDER");
    const token = randomBytes(32).toString("base64url"),
      expiresAt = now() + 10 * 60 * 1000;
    transaction(() => {
      const actor = actorFor(userId);
      if (
        expectedSessionVersion !== undefined &&
        actor.user.sessionVersion !== expectedSessionVersion
      )
        throw new PlatformError("SESSION_REVOKED", 401);
      if (!isFeatureEnabled("accounts.linking"))
        throw new PlatformError("LINKING_DISABLED", 503);
      if (
        listIdentities(userId).some(
          (identity) => identity.provider === provider,
        )
      )
        throw new PlatformError("PROVIDER_ALREADY_LINKED", 409);
      db.prepare(
        "DELETE FROM identity_link_intents WHERE expires_at < ? OR (user_id=? AND provider=?)",
      ).run(now(), userId, provider);
      db.prepare(
        "INSERT INTO identity_link_intents(token_hash,user_id,provider,expires_at,created_at,session_version) VALUES (?,?,?,?,?,?)",
      ).run(
        createHash("sha256").update(token).digest("hex"),
        userId,
        provider,
        expiresAt,
        stamp(),
        actor.user.sessionVersion,
      );
      recordAudit({
        actorId: userId,
        action: "IDENTITY_LINK_STARTED",
        target: userId,
        after: { provider },
      });
    });
    return { token, expiresAt };
  }
  function claimIdentity(input: {
    userId: string;
    token: string;
    identity: IdentityInput;
  }): User {
    validateIdentity(input.identity);
    if (!/^[\w-]{43}$/.test(input.token))
      throw new PlatformError("INVALID_LINK_INTENT", 403);
    return transaction(() => {
      const actor = actorFor(input.userId);
      if (!isFeatureEnabled("accounts.linking"))
        throw new PlatformError("LINKING_DISABLED", 503);
      const hash = createHash("sha256").update(input.token).digest("hex");
      const intent = db
        .prepare(
          "SELECT * FROM identity_link_intents WHERE token_hash=? AND user_id=? AND provider=? AND consumed_at IS NULL AND expires_at>?",
        )
        .get(hash, input.userId, input.identity.provider, now());
      if (
        !intent ||
        Number(intent.session_version) !== actor.user.sessionVersion
      )
        throw new PlatformError("INVALID_LINK_INTENT", 403);
      const existing = findIdentity(
        input.identity.provider,
        input.identity.providerAccountId,
      );
      if (existing && existing.id !== input.userId)
        throw new PlatformError("IDENTITY_BELONGS_TO_ANOTHER_ACCOUNT", 409);
      if (
        listIdentities(input.userId).some(
          (i) => i.provider === input.identity.provider,
        )
      )
        throw new PlatformError("PROVIDER_ALREADY_LINKED", 409);
      db.prepare(
        "INSERT INTO identities(provider,provider_account_id,user_id,email,email_verified,linked_at) VALUES (?,?,?,?,?,?)",
      ).run(
        input.identity.provider,
        input.identity.providerAccountId,
        input.userId,
        emailValue(input.identity.email),
        Number(input.identity.emailVerified === true),
        stamp(),
      );
      db.prepare(
        "UPDATE identity_link_intents SET consumed_at=? WHERE token_hash=?",
      ).run(now(), hash);
      recordAudit({
        actorId: input.userId,
        action: "IDENTITY_LINKED",
        target: input.userId,
        after: { provider: input.identity.provider },
      });
      return actor.user;
    });
  }
  function listUsers(
    options: { query?: string; offset?: number; limit?: number } = {},
  ) {
    const limit = Math.max(1, Math.min(100, Math.floor(options.limit || 30)));
    const offset = Math.max(0, Math.floor(options.offset || 0));
    const query = text(options.query, 100).replace(/[\\%_]/g, "\\$&");
    const where = query
      ? "WHERE (name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\')"
      : "";
    const args = query ? [`%${query}%`, `%${query}%`] : [];
    return {
      users: db
        .prepare(
          `SELECT * FROM users ${where} ORDER BY created_at DESC,id LIMIT ? OFFSET ?`,
        )
        .all(...args, limit, offset)
        .map((r) => userFrom(r)!),
      total: Number(
        db.prepare(`SELECT count(*) count FROM users ${where}`).get(...args)!
          .count,
      ),
      limit,
      offset,
    };
  }
  function protectUserMutation(actor: Actor, target: User) {
    if (actor.user.id === target.id)
      throw new PlatformError("CANNOT_CHANGE_OWN_ACCESS", 409);
    if (target.role !== "USER" && actor.user.role !== "SUPER_ADMIN")
      throw new PlatformError("PRIVILEGED_ACCOUNT_PROTECTED", 403);
    if (
      target.role === "SUPER_ADMIN" &&
      !target.disabled &&
      Number(
        db
          .prepare(
            "SELECT count(*) count FROM users WHERE role='SUPER_ADMIN' AND disabled=0",
          )
          .get()!.count,
      ) <= 1
    )
      throw new PlatformError("LAST_ADMIN_PROTECTED", 409);
  }
  function updateUserAccess(
    actorId: string,
    targetId: string,
    action: "disable" | "enable" | "revoke",
    reason: string,
    expectedSessionVersion?: number,
  ) {
    if (text(reason, 301).length < 8 || reason.length > 300)
      throw new PlatformError("REASON_REQUIRED");
    return transaction(() => {
      const actor = actorFor(actorId);
      if (
        expectedSessionVersion !== undefined &&
        actor.user.sessionVersion !== expectedSessionVersion
      )
        throw new PlatformError("SESSION_REVOKED", 401);
      requirePermission(
        actor,
        action === "revoke" ? "users.sessions.revoke" : "users.suspend",
      );
      const target = getUser(targetId);
      if (!target) throw new PlatformError("USER_NOT_FOUND", 404);
      protectUserMutation(actor, target);
      if (action === "revoke")
        db.prepare(
          "UPDATE users SET session_version=session_version+1 WHERE id=?",
        ).run(targetId);
      else if (target.disabled !== (action === "disable"))
        db.prepare(
          "UPDATE users SET disabled=?,session_version=session_version+1 WHERE id=?",
        ).run(Number(action === "disable"), targetId);
      // Invalidate outstanding OAuth link flows in the same write transaction.
      // A callback already exchanging its OAuth code must not resurrect a revoked session.
      db.prepare("DELETE FROM identity_link_intents WHERE user_id=?").run(
        targetId,
      );
      recordAudit({
        actorId,
        action:
          action === "disable"
            ? "USER_SUSPENDED"
            : action === "enable"
              ? "USER_RESTORED"
              : "USER_SESSIONS_REVOKED",
        target: targetId,
        before: { disabled: target.disabled, version: target.sessionVersion },
        after: {
          disabled:
            action === "revoke" ? target.disabled : action === "disable",
          reason: text(reason, 300),
        },
      });
      return getUser(targetId)!;
    });
  }
  function listFlags(): FeatureFlag[] {
    return db
      .prepare("SELECT * FROM feature_flags ORDER BY key")
      .all()
      .map((row) => ({
        key: String(row.key),
        enabled: !!row.enabled,
        description: String(row.description),
        updatedAt: String(row.updated_at),
        updatedBy: row.updated_by === null ? null : String(row.updated_by),
      }));
  }
  function updateFlag(
    actorId: string,
    key: string,
    enabled: boolean,
    expectedSessionVersion?: number,
  ) {
    if (typeof enabled !== "boolean")
      throw new PlatformError("INVALID_FLAG_VALUE");
    return transaction(() => {
      const actor = actorFor(actorId);
      if (
        expectedSessionVersion !== undefined &&
        actor.user.sessionVersion !== expectedSessionVersion
      )
        throw new PlatformError("SESSION_REVOKED", 401);
      requirePermission(actor, "features.update");
      const current = listFlags().find((flag) => flag.key === key);
      if (!current) throw new PlatformError("FLAG_NOT_FOUND", 404);
      db.prepare(
        "UPDATE feature_flags SET enabled=?,updated_at=?,updated_by=? WHERE key=?",
      ).run(Number(enabled), stamp(), actorId, key);
      recordAudit({
        actorId,
        action: "FEATURE_FLAG_CHANGED",
        target: key,
        before: { enabled: current.enabled },
        after: { enabled },
      });
      return listFlags().find((flag) => flag.key === key)!;
    });
  }
  function recordAIUsage(input: AIUsageInput) {
    if (
      !/^[\w-]{1,100}$/.test(input.requestId) ||
      !/^[a-zA-Z0-9_.:-]{1,80}$/.test(input.task)
    )
      throw new PlatformError("INVALID_USAGE_EVENT");
    db.prepare(
      "INSERT OR IGNORE INTO ai_usage(id,request_id,user_id,task,provider,model,status,input_tokens,output_tokens,cached_tokens,estimated_cost_usd,latency_ms,error_code,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    ).run(
      randomUUID(),
      input.requestId,
      input.userId || null,
      input.task,
      text(input.provider, 60) || null,
      text(input.model, 100) || null,
      input.status,
      positiveMetric(input.inputTokens),
      positiveMetric(input.outputTokens),
      positiveMetric(input.cachedTokens),
      positiveMetric(input.estimatedCostUsd, false),
      positiveMetric(input.latencyMs) ?? 0,
      /^[A-Z0-9_.:-]{1,100}$/.test(input.errorCode || "")
        ? input.errorCode!
        : null,
      stamp(),
    );
  }
  function listUsage(limit = 30, offset = 0): AIUsageEvent[] {
    return db
      .prepare(
        "SELECT * FROM ai_usage ORDER BY created_at DESC,id LIMIT ? OFFSET ?",
      )
      .all(
        Math.max(1, Math.min(100, Math.floor(limit))),
        Math.max(0, Math.floor(offset)),
      )
      .map((row) => ({
        id: String(row.id),
        requestId: String(row.request_id),
        userId: row.user_id === null ? null : String(row.user_id),
        task: String(row.task),
        provider: row.provider === null ? null : String(row.provider),
        model: row.model === null ? null : String(row.model),
        status: row.status as "success" | "error",
        inputTokens:
          row.input_tokens === null ? null : Number(row.input_tokens),
        outputTokens:
          row.output_tokens === null ? null : Number(row.output_tokens),
        cachedTokens:
          row.cached_tokens === null ? null : Number(row.cached_tokens),
        estimatedCostUsd:
          row.estimated_cost_usd === null
            ? null
            : Number(row.estimated_cost_usd),
        latencyMs: Number(row.latency_ms),
        errorCode: row.error_code === null ? null : String(row.error_code),
        createdAt: String(row.created_at),
      }));
  }
  function listAudit(limit = 40, offset = 0): AuditEvent[] {
    return db
      .prepare(
        "SELECT * FROM audit_events ORDER BY created_at DESC,id LIMIT ? OFFSET ?",
      )
      .all(
        Math.max(1, Math.min(100, Math.floor(limit))),
        Math.max(0, Math.floor(offset)),
      )
      .map((row) => ({
        id: String(row.id),
        actorId: row.actor_id === null ? null : String(row.actor_id),
        action: String(row.action),
        target: row.target === null ? null : String(row.target),
        result: row.result as AuditEvent["result"],
        requestId: String(row.request_id),
        before: JSON.parse(String(row.before_json)),
        after: JSON.parse(String(row.after_json)),
        createdAt: String(row.created_at),
      }));
  }
  function getDashboard() {
    const users = db
      .prepare(
        "SELECT count(*) total,sum(disabled=0) active,sum(disabled=1) disabled,sum(created_at>=?) new FROM users",
      )
      .get(new Date(now() - 7 * 86400000).toISOString())!;
    const usage = db
      .prepare(
        "SELECT count(*) requests,sum(status='error') errors,sum(input_tokens) input_tokens,sum(output_tokens) output_tokens,sum(estimated_cost_usd) cost,avg(latency_ms) latency,count(input_tokens) token_records,count(estimated_cost_usd) cost_records FROM ai_usage",
      )
      .get()!;
    const daily = db
      .prepare(
        "SELECT substr(created_at,1,10) day,count(*) requests,sum(status='error') errors FROM ai_usage WHERE created_at>=? GROUP BY day ORDER BY day",
      )
      .all(new Date(now() - 13 * 86400000).toISOString().slice(0, 10));
    const days = Array.from({ length: 14 }, (_, index) => {
      const day = new Date(now() - (13 - index) * 86400000)
          .toISOString()
          .slice(0, 10),
        event = daily.find((row) => row.day === day);
      return {
        day,
        requests: Number(event?.requests || 0),
        errors: Number(event?.errors || 0),
      };
    });
    return {
      users: {
        total: Number(users.total),
        active: Number(users.active || 0),
        disabled: Number(users.disabled || 0),
        new: Number(users.new || 0),
      },
      usage: {
        requests: Number(usage.requests),
        errors: Number(usage.errors || 0),
        inputTokens:
          usage.input_tokens === null ? null : Number(usage.input_tokens),
        outputTokens:
          usage.output_tokens === null ? null : Number(usage.output_tokens),
        costUsd: usage.cost === null ? null : Number(usage.cost),
        averageLatencyMs:
          usage.latency === null ? null : Math.round(Number(usage.latency)),
        tokenRecords: Number(usage.token_records),
        costRecords: Number(usage.cost_records),
      },
      days,
      generatedAt: stamp(),
      storage: "SQLite · một máy chủ" as const,
      auditCount: Number(
        db.prepare("SELECT count(*) count FROM audit_events").get()!.count,
      ),
    };
  }
  return {
    ...createBillingStore({
      db,
      now,
      stamp,
      transaction,
      getUser,
      actorFor,
      recordAudit,
    }),
    ...createMobileStore({ db, now, stamp, transaction, getUser, recordAudit }),
    ...createTutorStore({ db, now, stamp, transaction, getUser }),
    ...createRuntimeV3Store({ db, now, stamp, transaction, getUser }),
    ...createRagStore({ db, now, stamp, transaction, getUser }),
    ...createSummaryJobStore({ db, now, stamp, transaction, getUser }),
    ...createTeacherStore({ db, now, stamp, transaction, getUser, getMemberships, recordAudit }),
    ...createTeachingStore({ db, now, stamp, transaction, getUser, recordAudit }),
    close: () => db.close(),
    getUser,
    getUserByStorageKey,
    findIdentity,
    ensureIdentity,
    listIdentities,
    createLinkIntent,
    claimIdentity,
    getMemberships,
    recordAudit,
    recordAIUsage,
    isFeatureEnabled,
    listUsers,
    updateUserAccess,
    listFlags,
    updateFlag,
    listUsage,
    listAudit,
    getDashboard,
  };
}

export type PlatformStore = ReturnType<typeof createStore>;
const rootGlobal = globalThis as typeof globalThis & {
  __lumioPlatformStore?: PlatformStore;
};
export function getStore(): PlatformStore {
  if (isPublicDemo()) throw new PlatformError("PUBLIC_DEMO_ONLY", 403);
  if (!rootGlobal.__lumioPlatformStore) {
    if (
      process.env.NODE_ENV === "production" &&
      !(
        (process.env.LUMIO_ALLOW_LOCAL_DB_PRODUCTION === "true" ||
          isCompetitionPreview()) &&
        process.env.LUMIO_DB_PATH
      )
    )
      throw new PlatformError("PERSISTENT_DATABASE_REQUIRED", 503);
    rootGlobal.__lumioPlatformStore = createStore(
      process.env.LUMIO_DB_PATH ||
        resolve(process.cwd(), ".data", "lumio.sqlite"),
    );
  }
  return rootGlobal.__lumioPlatformStore;
}
export const ensureIdentity = (input: IdentityInput) =>
  getStore().ensureIdentity(input);
export const getUser = (id: string) => getStore().getUser(id);
export const getUserByStorageKey = (key: string) =>
  getStore().getUserByStorageKey(key);
export const findIdentity = (provider: IdentityProvider, id: string) =>
  getStore().findIdentity(provider, id);
export const listIdentities = (userId: string) =>
  getStore().listIdentities(userId);
export const createLinkIntent = (
  userId: string,
  provider: IdentityProvider,
  expectedSessionVersion?: number,
) => getStore().createLinkIntent(userId, provider, expectedSessionVersion);
export const claimIdentity = (input: {
  userId: string;
  token: string;
  identity: IdentityInput;
}) => getStore().claimIdentity(input);
export const recordAudit = (input: AuditInput) => getStore().recordAudit(input);
export const recordAIUsage = (input: AIUsageInput) =>
  getStore().recordAIUsage(input);
export const isFeatureEnabled = (key: string) =>
  getStore().isFeatureEnabled(key);
