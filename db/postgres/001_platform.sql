-- Lumio platform schema, PostgreSQL 15+. Reviewed migration blueprint.
-- The current application adapter is SQLite. Do NOT point DATABASE_URL here and
-- assume deployment is configured: a PostgreSQL transaction/query adapter is still required.
-- Run migrations using a dedicated owner role; the application role must not own tables.
BEGIN;
CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE users (
  id uuid PRIMARY KEY, storage_key text NOT NULL UNIQUE, name varchar(100) NOT NULL,
  email varchar(254), role text NOT NULL DEFAULT 'USER' CHECK (role IN ('USER','DEV','ADMIN','SUPER_ADMIN')),
  disabled boolean NOT NULL DEFAULT false, session_version integer NOT NULL DEFAULT 1 CHECK(session_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE identities (
  provider text NOT NULL CHECK(provider IN ('google','facebook')), provider_account_id varchar(200) NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id), email varchar(254), email_verified boolean NOT NULL DEFAULT false,
  linked_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(provider,provider_account_id), UNIQUE(user_id,provider)
);
CREATE INDEX identities_user ON identities(user_id);
CREATE TABLE organizations (id uuid PRIMARY KEY, name varchar(200) NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE memberships (
  user_id uuid NOT NULL REFERENCES users(id), organization_id uuid NOT NULL REFERENCES organizations(id),
  role text NOT NULL CHECK(role IN ('OWNER','SCHOOL_ADMIN','TEACHER','PARENT','STUDENT')),
  PRIMARY KEY(user_id,organization_id)
);
CREATE INDEX memberships_org ON memberships(organization_id,user_id);
CREATE TABLE identity_link_intents (
  token_hash char(64) PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id),
  provider text NOT NULL CHECK(provider IN ('google','facebook')),
  expires_at timestamptz NOT NULL, consumed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX identity_link_expiry ON identity_link_intents(expires_at);
CREATE TABLE audit_events (
  id uuid PRIMARY KEY, actor_id uuid REFERENCES users(id), action varchar(80) NOT NULL, target varchar(180),
  result text NOT NULL CHECK(result IN ('success','denied','error')), request_id varchar(100) NOT NULL,
  before_json jsonb NOT NULL DEFAULT '{}', after_json jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_created ON audit_events(created_at DESC);
CREATE INDEX audit_actor ON audit_events(actor_id,created_at DESC);
CREATE FUNCTION protect_audit_events() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'AUDIT_APPEND_ONLY'; END;
$$;
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION protect_audit_events();
CREATE TABLE ai_usage (
  id uuid PRIMARY KEY, request_id varchar(100) NOT NULL UNIQUE, user_id uuid REFERENCES users(id), task varchar(80) NOT NULL,
  provider varchar(60), model varchar(100), status text NOT NULL CHECK(status IN ('success','error')),
  input_tokens bigint CHECK(input_tokens>=0), output_tokens bigint CHECK(output_tokens>=0), cached_tokens bigint CHECK(cached_tokens>=0),
  estimated_cost_usd numeric(20,10) CHECK(estimated_cost_usd>=0), latency_ms integer NOT NULL CHECK(latency_ms>=0),
  error_code varchar(100), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX usage_created ON ai_usage(created_at DESC);
CREATE INDEX usage_user ON ai_usage(user_id,created_at DESC);
CREATE TABLE feature_flags (
  key varchar(100) PRIMARY KEY, enabled boolean NOT NULL, description text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES users(id)
);
INSERT INTO feature_flags(key,enabled,description) VALUES
 ('ai.enabled',true,'Cho phép yêu cầu học tập AI khi dịch vụ đã được cấu hình.'),
 ('ai.voice',true,'Cho phép chuyển giọng nói thành văn bản và đọc nội dung.'),
 ('accounts.linking',true,'Cho phép liên kết Google và Facebook vào cùng một tài khoản.');
INSERT INTO schema_migrations(version) VALUES (1);
COMMIT;

-- Before use: add adapter integration tests for row locking/linking, restricted
-- application DB credentials, backup/restore, and RLS or tenant-bound repository
-- queries for every future organization resource. No public grants are added here.
