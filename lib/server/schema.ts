import { runtimeV3Migration } from "./runtime-v3-schema";
import { ragMigration } from "./rag-schema";
import { summaryJobMigration } from "./job-schema";
import { teacherMigration } from "./teacher-schema";
export const migrations = [
  {
    version: 1,
    sql: `
CREATE TABLE users (
 id TEXT PRIMARY KEY, storage_key TEXT NOT NULL UNIQUE, name TEXT NOT NULL, email TEXT,
 role TEXT NOT NULL DEFAULT 'USER' CHECK(role IN ('USER','DEV','ADMIN','SUPER_ADMIN')),
 disabled INTEGER NOT NULL DEFAULT 0 CHECK(disabled IN (0,1)),
 session_version INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL, last_seen_at TEXT NOT NULL
);
CREATE TABLE identities (
 provider TEXT NOT NULL CHECK(provider IN ('google','facebook')), provider_account_id TEXT NOT NULL,
 user_id TEXT NOT NULL REFERENCES users(id), email TEXT, email_verified INTEGER NOT NULL DEFAULT 0,
 linked_at TEXT NOT NULL, PRIMARY KEY(provider, provider_account_id), UNIQUE(user_id,provider)
);
CREATE INDEX identities_user ON identities(user_id);
CREATE TABLE organizations (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE memberships (
 user_id TEXT NOT NULL REFERENCES users(id), organization_id TEXT NOT NULL REFERENCES organizations(id),
 role TEXT NOT NULL CHECK(role IN ('OWNER','SCHOOL_ADMIN','TEACHER','PARENT','STUDENT')),
 PRIMARY KEY(user_id,organization_id)
);
CREATE TABLE identity_link_intents (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), provider TEXT NOT NULL,
 expires_at INTEGER NOT NULL, consumed_at INTEGER, created_at TEXT NOT NULL
);
CREATE INDEX identity_link_expiry ON identity_link_intents(expires_at);
CREATE TABLE audit_events (
 id TEXT PRIMARY KEY, actor_id TEXT REFERENCES users(id), action TEXT NOT NULL, target TEXT,
 result TEXT NOT NULL CHECK(result IN ('success','denied','error')),
 request_id TEXT NOT NULL, before_json TEXT NOT NULL DEFAULT '{}', after_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
);
CREATE INDEX audit_created ON audit_events(created_at DESC);
CREATE INDEX audit_actor ON audit_events(actor_id,created_at DESC);
CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_events BEGIN SELECT RAISE(ABORT,'AUDIT_APPEND_ONLY'); END;
CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit_events BEGIN SELECT RAISE(ABORT,'AUDIT_APPEND_ONLY'); END;
CREATE TABLE ai_usage (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL UNIQUE, user_id TEXT REFERENCES users(id), task TEXT NOT NULL,
 provider TEXT, model TEXT, status TEXT NOT NULL CHECK(status IN ('success','error')),
 input_tokens INTEGER CHECK(input_tokens >= 0), output_tokens INTEGER CHECK(output_tokens >= 0),
 cached_tokens INTEGER CHECK(cached_tokens >= 0), estimated_cost_usd REAL CHECK(estimated_cost_usd >= 0),
 latency_ms INTEGER NOT NULL CHECK(latency_ms >= 0), error_code TEXT, created_at TEXT NOT NULL
);
CREATE INDEX usage_created ON ai_usage(created_at DESC);
CREATE INDEX usage_user ON ai_usage(user_id,created_at DESC);
CREATE TABLE feature_flags (
 key TEXT PRIMARY KEY, enabled INTEGER NOT NULL CHECK(enabled IN (0,1)), description TEXT NOT NULL,
 updated_at TEXT NOT NULL, updated_by TEXT REFERENCES users(id)
);
`,
  },
  {
    version: 2,
    sql: `
ALTER TABLE identity_link_intents ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0;
-- Legacy intents did not bind the session version and cannot safely survive upgrade.
DELETE FROM identity_link_intents;
`,
  },
  {
    version: 3,
    sql: `
CREATE TABLE billing_accounts (
 user_id TEXT PRIMARY KEY REFERENCES users(id), balance INTEGER NOT NULL DEFAULT 0 CHECK(balance >= 0),
 reserved INTEGER NOT NULL DEFAULT 0 CHECK(reserved >= 0), plan_id TEXT NOT NULL DEFAULT 'free',
 plan_source TEXT NOT NULL DEFAULT 'free' CHECK(plan_source IN ('free','sandbox','paid')),
 period_end INTEGER, cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
 next_plan_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE billing_reservations (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL REFERENCES users(id),
 units INTEGER NOT NULL CHECK(units > 0), task TEXT NOT NULL, mode TEXT NOT NULL, kind TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('reserved','settled','refunded')), created_at TEXT NOT NULL,
 expires_at INTEGER NOT NULL, finalized_at TEXT
);
CREATE INDEX billing_reservations_user ON billing_reservations(user_id,status);
CREATE TABLE billing_ledger (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), event_key TEXT NOT NULL UNIQUE,
 kind TEXT NOT NULL, available_delta INTEGER NOT NULL, reserved_delta INTEGER NOT NULL,
 balance_after INTEGER NOT NULL CHECK(balance_after >= 0), reserved_after INTEGER NOT NULL CHECK(reserved_after >= 0),
 reservation_id TEXT REFERENCES billing_reservations(id), actor_id TEXT REFERENCES users(id),
 note TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX billing_ledger_user ON billing_ledger(user_id,created_at DESC);
CREATE TRIGGER billing_ledger_no_update BEFORE UPDATE ON billing_ledger BEGIN SELECT RAISE(ABORT,'LEDGER_APPEND_ONLY'); END;
CREATE TRIGGER billing_ledger_no_delete BEFORE DELETE ON billing_ledger BEGIN SELECT RAISE(ABORT,'LEDGER_APPEND_ONLY'); END;
CREATE TABLE billing_catalog_settings (
 item_id TEXT PRIMARY KEY, monthly_price_minor INTEGER CHECK(monthly_price_minor >= 0),
 yearly_price_minor INTEGER CHECK(yearly_price_minor >= 0), credits INTEGER CHECK(credits >= 0),
 updated_by TEXT REFERENCES users(id), updated_at TEXT NOT NULL
);
CREATE TABLE billing_actions (
 request_id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), actor_id TEXT NOT NULL REFERENCES users(id),
 action TEXT NOT NULL, fingerprint TEXT NOT NULL, created_at TEXT NOT NULL
);
`,
  },
  {
    version: 4,
    sql: `
CREATE TABLE mobile_pair_codes (
 code_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
 session_version INTEGER NOT NULL, expires_at INTEGER NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE mobile_sessions (
 id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL REFERENCES users(id),
 session_version INTEGER NOT NULL, device_name TEXT NOT NULL, expires_at INTEGER NOT NULL,
 created_at TEXT NOT NULL, last_seen_at TEXT NOT NULL
);
CREATE INDEX mobile_sessions_user ON mobile_sessions(user_id);
`,
  },
  {
    version: 5,
    sql: `
CREATE TABLE tutor_sessions (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), session_version INTEGER NOT NULL,
 problem TEXT NOT NULL, source_digest TEXT NOT NULL, language TEXT NOT NULL,
 hint_count INTEGER NOT NULL DEFAULT 0 CHECK(hint_count>=0), revision INTEGER NOT NULL DEFAULT 0,
 pending_request TEXT, pending_until INTEGER,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, expires_at INTEGER NOT NULL
);
CREATE INDEX tutor_sessions_owner ON tutor_sessions(user_id,expires_at);
CREATE TABLE tutor_turns (
 id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES tutor_sessions(id) ON DELETE CASCADE,
 request_id TEXT NOT NULL UNIQUE, ordinal INTEGER NOT NULL, student_text TEXT NOT NULL,
 assistant_text TEXT NOT NULL, hint TEXT, question TEXT, misconception TEXT, step TEXT,
 guidance TEXT NOT NULL CHECK(guidance IN ('hints','full')), created_at TEXT NOT NULL,
 UNIQUE(session_id,ordinal)
);
`,
  },
  {
    version: 6,
    sql: `
ALTER TABLE tutor_turns ADD COLUMN references_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE tutor_turns ADD COLUMN verification_json TEXT;
`,
  },
  {
    version: 7,
    sql: `
ALTER TABLE tutor_sessions ADD COLUMN needs_clarification INTEGER NOT NULL DEFAULT 0 CHECK(needs_clarification IN (0,1));
ALTER TABLE tutor_turns ADD COLUMN needs_clarification INTEGER NOT NULL DEFAULT 0 CHECK(needs_clarification IN (0,1));
`,
  },
  runtimeV3Migration,
  ragMigration,
  summaryJobMigration,
  teacherMigration,
];

export const flagDefinitions = [
  {
    key: "ai.enabled",
    enabled: true,
    description: "Cho phép yêu cầu học tập AI khi dịch vụ đã được cấu hình.",
  },
  {
    key: "ai.voice",
    enabled: true,
    description: "Cho phép chuyển giọng nói thành văn bản và đọc nội dung.",
  },
  {
    key: "accounts.linking",
    enabled: true,
    description: "Cho phép liên kết Google và Facebook vào cùng một tài khoản.",
  },
] as const;
