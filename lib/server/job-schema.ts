export const summaryJobMigration = {
  version: 10,
  sql: `
CREATE TABLE summary_jobs (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), session_version INTEGER NOT NULL,
 request_key TEXT NOT NULL, fingerprint TEXT NOT NULL, source_digest TEXT NOT NULL,
 title TEXT NOT NULL, client_item_id TEXT, source_type TEXT NOT NULL CHECK(source_type IN ('text','youtube')),
 input_json TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('queued','running','retry_wait','paused','completed','cancelled','failed')),
 completed INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL CHECK(total BETWEEN 1 AND 12),
 error_code TEXT, available_at INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 expires_at INTEGER NOT NULL, result_json TEXT, UNIQUE(user_id,request_key)
);
CREATE INDEX summary_jobs_ready ON summary_jobs(user_id,status,available_at);
CREATE INDEX summary_jobs_expiry ON summary_jobs(expires_at);
CREATE TABLE summary_job_parts (
 job_id TEXT NOT NULL REFERENCES summary_jobs(id) ON DELETE CASCADE, ordinal INTEGER NOT NULL,
 input_json TEXT NOT NULL, char_start INTEGER, char_end INTEGER,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','completed')),
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3), lease_sequence INTEGER NOT NULL DEFAULT 0,
 lease_token TEXT, lease_until INTEGER, attempt_request_id TEXT, reservation_id TEXT,
 result_json TEXT, PRIMARY KEY(job_id,ordinal)
);
CREATE INDEX summary_parts_lease ON summary_job_parts(status,lease_until);
`,
};
