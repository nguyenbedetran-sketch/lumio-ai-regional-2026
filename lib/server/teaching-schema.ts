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
/** Preserve the current projection/IDs. Historical actors/times cannot be reconstructed. */
export const teachingGradeHistoryMigration = {
  version: 15,
  sql: `
CREATE TABLE teaching_grade_events (
 sequence INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT NOT NULL UNIQUE,
 submission_id TEXT NOT NULL REFERENCES teaching_submissions(id),
 submission_revision INTEGER NOT NULL CHECK(submission_revision>=1),
 kind TEXT NOT NULL CHECK(kind IN ('grade','publish','legacy_snapshot')),
 grade_version INTEGER NOT NULL CHECK(grade_version>=1),grade_event_id TEXT,
 grades_json TEXT,score REAL,feedback TEXT,answers_digest TEXT,
 actor_id TEXT REFERENCES users(id),recorded_at TEXT,confirmed_at TEXT,published_at TEXT,reason TEXT,
 legacy INTEGER NOT NULL DEFAULT 0 CHECK(legacy IN(0,1)),
 UNIQUE(id,submission_id),UNIQUE(submission_id,submission_revision,kind),UNIQUE(submission_id,grade_version,kind),
 FOREIGN KEY(grade_event_id,submission_id) REFERENCES teaching_grade_events(id,submission_id),
 CHECK(
  (kind='grade' AND legacy=0 AND grade_event_id IS NULL AND grades_json IS NOT NULL AND score IS NOT NULL AND score>=0 AND feedback IS NOT NULL AND answers_digest IS NOT NULL AND length(answers_digest)=64 AND actor_id IS NOT NULL AND recorded_at IS NOT NULL AND confirmed_at IS NOT NULL AND published_at IS NULL) OR
  (kind='publish' AND legacy=0 AND grade_event_id IS NOT NULL AND grades_json IS NULL AND score IS NULL AND feedback IS NULL AND answers_digest IS NULL AND actor_id IS NOT NULL AND recorded_at IS NOT NULL AND confirmed_at IS NULL AND published_at IS NOT NULL AND reason IS NULL) OR
  (kind='legacy_snapshot' AND legacy=1 AND grade_event_id IS NULL AND grades_json IS NOT NULL AND score IS NOT NULL AND score>=0 AND feedback IS NOT NULL AND answers_digest IS NULL AND actor_id IS NULL AND recorded_at IS NULL AND reason IS NULL)
 )
);
CREATE INDEX teaching_grade_events_submission ON teaching_grade_events(submission_id,sequence DESC);
INSERT INTO teaching_grade_events(id,submission_id,submission_revision,kind,grade_version,grades_json,score,feedback,confirmed_at,published_at,legacy)
 SELECT 'legacy-'||id,id,revision,'legacy_snapshot',1,grades_json,score,coalesce(feedback,''),confirmed_at,
 CASE WHEN status='published' THEN published_at ELSE NULL END,1 FROM teaching_submissions
 WHERE status IN('graded','published') AND grades_json IS NOT NULL AND score IS NOT NULL;
CREATE TRIGGER teaching_grade_events_no_update BEFORE UPDATE ON teaching_grade_events BEGIN SELECT RAISE(ABORT,'TEACHING_HISTORY_IMMUTABLE'); END;
CREATE TRIGGER teaching_grade_events_no_delete BEFORE DELETE ON teaching_grade_events BEGIN SELECT RAISE(ABORT,'TEACHING_HISTORY_IMMUTABLE'); END;
`,
};
export const teachingAssessmentWindowsMigration = {
  version: 16,
  sql: `
CREATE TABLE teaching_assessment_windows (
 assignment_id TEXT NOT NULL PRIMARY KEY REFERENCES teaching_assignments(id) ON DELETE CASCADE,
 root_assignment_id TEXT NOT NULL REFERENCES teaching_assignments(id),
 parent_assignment_id TEXT REFERENCES teaching_assignments(id),attempt_no INTEGER NOT NULL CHECK(attempt_no BETWEEN 1 AND 3),
 student_id TEXT REFERENCES users(id),available_from TEXT,available_until TEXT,
 reason TEXT,acknowledged INTEGER NOT NULL DEFAULT 0 CHECK(acknowledged IN(0,1)),
 created_by TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL,
 UNIQUE(root_assignment_id,student_id,attempt_no),
 CHECK((attempt_no=1 AND root_assignment_id=assignment_id AND parent_assignment_id IS NULL AND student_id IS NULL AND acknowledged=0 AND reason IS NULL) OR
 (attempt_no>1 AND root_assignment_id!=assignment_id AND parent_assignment_id IS NOT NULL AND parent_assignment_id=root_assignment_id AND student_id IS NOT NULL AND available_from IS NOT NULL AND available_until IS NOT NULL AND acknowledged=1 AND reason IS NOT NULL))
);
CREATE INDEX teaching_assessment_windows_root ON teaching_assessment_windows(root_assignment_id,student_id,attempt_no);
INSERT INTO teaching_assessment_windows(assignment_id,root_assignment_id,attempt_no,available_from,created_by,created_at)
 SELECT id,id,1,issued_at,created_by,created_at FROM teaching_assignments;
`,
};
