export const teacherMigration = {
  version: 11,
  sql: `
CREATE TABLE teacher_applications (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
 status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected','revoked')),
 revision INTEGER NOT NULL CHECK(revision>=1), profile_json TEXT NOT NULL,
 submitted_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 reviewed_at TEXT, reviewed_by TEXT REFERENCES users(id), review_note TEXT
);
CREATE INDEX teacher_applications_queue ON teacher_applications(status,submitted_at,id);
CREATE TABLE teacher_credentials (
 user_id TEXT PRIMARY KEY REFERENCES users(id),
 application_id TEXT NOT NULL UNIQUE REFERENCES teacher_applications(id),
 active INTEGER NOT NULL DEFAULT 0 CHECK(active IN (0,1)),
 approved_at TEXT, revoked_at TEXT, reviewed_by TEXT REFERENCES users(id)
);
CREATE TABLE teacher_application_operations (
 request_id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES users(id),
 target_user_id TEXT NOT NULL REFERENCES users(id), application_id TEXT NOT NULL REFERENCES teacher_applications(id),
 action TEXT NOT NULL CHECK(action IN ('submit','approve','reject','revoke')),
 fingerprint TEXT NOT NULL, result_revision INTEGER NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX teacher_operations_actor ON teacher_application_operations(actor_id,created_at);
`,
};
