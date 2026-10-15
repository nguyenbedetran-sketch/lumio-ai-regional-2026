export const runtimeV3Migration = {
  version: 8,
  sql: `
CREATE TABLE runtime_rate_windows (
 key TEXT PRIMARY KEY, minute_start INTEGER NOT NULL, minute_count INTEGER NOT NULL,
 day TEXT NOT NULL, daily_count INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE runtime_ai_leases (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), competition INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE INDEX runtime_leases_expiry ON runtime_ai_leases(expires_at);
CREATE TABLE sync_snapshots (
 user_id TEXT PRIMARY KEY REFERENCES users(id), epoch TEXT NOT NULL, revision INTEGER NOT NULL,
 payload_json TEXT, digest TEXT, updated_at TEXT NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE sync_operations (
 user_id TEXT NOT NULL REFERENCES users(id), request_id TEXT NOT NULL, fingerprint TEXT NOT NULL,
 result_json TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(user_id,request_id)
);
`,
};
