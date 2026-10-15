export const teachingMigration = {
  version: 12,
  sql: `
CREATE TABLE teaching_organizations (
 organization_id TEXT PRIMARY KEY REFERENCES organizations(id), revision INTEGER NOT NULL DEFAULT 1,
 settings_json TEXT NOT NULL, created_by TEXT NOT NULL REFERENCES users(id)
);
CREATE TABLE teaching_classes (
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL REFERENCES organizations(id),name TEXT NOT NULL,
 subject TEXT NOT NULL,grade TEXT NOT NULL,description TEXT NOT NULL,archived INTEGER NOT NULL DEFAULT 0,
 revision INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL
);
CREATE INDEX teaching_classes_org ON teaching_classes(organization_id);
CREATE TABLE teaching_class_teachers (
 class_id TEXT NOT NULL REFERENCES teaching_classes(id),user_id TEXT NOT NULL REFERENCES users(id),PRIMARY KEY(class_id,user_id)
);
CREATE TABLE teaching_enrollments (
 id TEXT PRIMARY KEY,class_id TEXT NOT NULL REFERENCES teaching_classes(id),user_id TEXT NOT NULL REFERENCES users(id),
 active INTEGER NOT NULL DEFAULT 1,revision INTEGER NOT NULL DEFAULT 1,joined_at TEXT NOT NULL,UNIQUE(class_id,user_id)
);
CREATE INDEX teaching_enrollments_user ON teaching_enrollments(user_id,active);
CREATE TABLE teaching_groups (id TEXT PRIMARY KEY,class_id TEXT NOT NULL REFERENCES teaching_classes(id),name TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1);
CREATE TABLE teaching_group_members (group_id TEXT NOT NULL REFERENCES teaching_groups(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id),PRIMARY KEY(group_id,user_id));
CREATE TABLE teaching_invites (
 id TEXT PRIMARY KEY,class_id TEXT NOT NULL REFERENCES teaching_classes(id),code_hash TEXT NOT NULL UNIQUE,
 request_id TEXT NOT NULL UNIQUE,created_by TEXT NOT NULL REFERENCES users(id),expires_at INTEGER NOT NULL,
 max_uses INTEGER NOT NULL,uses INTEGER NOT NULL DEFAULT 0,active INTEGER NOT NULL DEFAULT 1,revision INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE teaching_content (
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL REFERENCES organizations(id),class_id TEXT REFERENCES teaching_classes(id),
 kind TEXT NOT NULL CHECK(kind IN ('material','lesson','question')),data_json TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','reviewed','published','archived')),
 revision INTEGER NOT NULL DEFAULT 1,created_by TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL,updated_at TEXT NOT NULL
);
CREATE INDEX teaching_content_org ON teaching_content(organization_id,kind,status);
CREATE TABLE teaching_assignments (
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL REFERENCES organizations(id),class_id TEXT NOT NULL REFERENCES teaching_classes(id),
 data_json TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','reviewed','issued','closed')),
 revision INTEGER NOT NULL DEFAULT 1,created_by TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL,issued_at TEXT
);
CREATE INDEX teaching_assignments_class ON teaching_assignments(class_id,status);
CREATE TABLE teaching_assignment_targets (assignment_id TEXT NOT NULL REFERENCES teaching_assignments(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id),PRIMARY KEY(assignment_id,user_id));
CREATE TABLE teaching_submissions (
 id TEXT PRIMARY KEY,assignment_id TEXT NOT NULL REFERENCES teaching_assignments(id),student_id TEXT NOT NULL REFERENCES users(id),
 answers_json TEXT NOT NULL,submitted_at TEXT NOT NULL,late INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','graded','published')),
 revision INTEGER NOT NULL DEFAULT 1,auto_score REAL NOT NULL DEFAULT 0,grades_json TEXT,score REAL,feedback TEXT,
 confirmed_at TEXT,published_at TEXT,UNIQUE(assignment_id,student_id)
);
CREATE TABLE teaching_announcements (
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL REFERENCES organizations(id),class_id TEXT REFERENCES teaching_classes(id),
 title TEXT NOT NULL,body TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
 revision INTEGER NOT NULL DEFAULT 1,created_by TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL
);
CREATE TABLE teaching_events (
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL REFERENCES organizations(id),class_id TEXT NOT NULL REFERENCES teaching_classes(id),
 data_json TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE teaching_operations (
 request_id TEXT PRIMARY KEY,actor_id TEXT NOT NULL REFERENCES users(id),organization_id TEXT NOT NULL REFERENCES organizations(id),
 class_id TEXT REFERENCES teaching_classes(id),action TEXT NOT NULL,fingerprint TEXT NOT NULL,result_json TEXT NOT NULL,created_at TEXT NOT NULL
);
CREATE INDEX teaching_operations_actor ON teaching_operations(actor_id,created_at);
`,
};
export const teachingPreferencesMigration = {
  version: 13,
  sql: `CREATE TABLE teaching_preferences (
 organization_id TEXT NOT NULL REFERENCES organizations(id),user_id TEXT NOT NULL REFERENCES users(id),
 data_json TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,
 PRIMARY KEY(organization_id,user_id)
);`,
};
