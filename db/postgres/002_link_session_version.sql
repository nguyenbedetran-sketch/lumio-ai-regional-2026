-- Companion blueprint for the not-yet-implemented PostgreSQL adapter.
BEGIN;
ALTER TABLE identity_link_intents ADD COLUMN session_version integer NOT NULL DEFAULT 0;
DELETE FROM identity_link_intents;
INSERT INTO schema_migrations(version) VALUES (2);
COMMIT;
