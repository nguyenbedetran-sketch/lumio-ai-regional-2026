-- PostgreSQL reference only. The running billing adapter uses local SQLite.
-- The future adapter must lock billing_accounts FOR UPDATE for every ledger mutation,
-- recheck users.session_version inside that same transaction, and use verified webhooks.
BEGIN;
CREATE TABLE billing_accounts (
 user_id uuid PRIMARY KEY REFERENCES users(id), balance bigint NOT NULL DEFAULT 0 CHECK(balance>=0),
 reserved bigint NOT NULL DEFAULT 0 CHECK(reserved>=0), plan_id text NOT NULL DEFAULT 'free',
 plan_source text NOT NULL DEFAULT 'free' CHECK(plan_source IN ('free','sandbox','paid')),
 period_end timestamptz, cancel_at_period_end boolean NOT NULL DEFAULT false, next_plan_id text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE billing_reservations (
 id uuid PRIMARY KEY, request_id varchar(100) NOT NULL UNIQUE, user_id uuid NOT NULL REFERENCES users(id),
 units bigint NOT NULL CHECK(units>0), task text NOT NULL, mode text NOT NULL, kind text NOT NULL,
 status text NOT NULL CHECK(status IN ('reserved','settled','refunded')),
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL, finalized_at timestamptz
);
CREATE INDEX billing_reservations_user ON billing_reservations(user_id,status);
CREATE TABLE billing_ledger (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), event_key text NOT NULL UNIQUE,
 kind text NOT NULL, available_delta bigint NOT NULL, reserved_delta bigint NOT NULL,
 balance_after bigint NOT NULL CHECK(balance_after>=0), reserved_after bigint NOT NULL CHECK(reserved_after>=0),
 reservation_id uuid REFERENCES billing_reservations(id), actor_id uuid REFERENCES users(id),
 note text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX billing_ledger_user ON billing_ledger(user_id,created_at DESC);
CREATE FUNCTION protect_billing_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'LEDGER_APPEND_ONLY'; END;
$$;
CREATE TRIGGER billing_ledger_append_only BEFORE UPDATE OR DELETE ON billing_ledger FOR EACH ROW EXECUTE FUNCTION protect_billing_ledger();
CREATE TABLE billing_catalog_settings (
 item_id text PRIMARY KEY, monthly_price_minor bigint CHECK(monthly_price_minor>=0),
 yearly_price_minor bigint CHECK(yearly_price_minor>=0), credits bigint CHECK(credits>=0),
 updated_by uuid REFERENCES users(id), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE billing_actions (
 request_id varchar(100) PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), actor_id uuid NOT NULL REFERENCES users(id),
 action text NOT NULL, fingerprint char(64) NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO schema_migrations(version) VALUES (3);
COMMIT;
