import type { DatabaseConnection as DatabaseSync } from "./database-connection";

// Canonical metadata derived from migrations1–18 using SQLite itself.
// Update together with a reviewed migration; tests compare against fresh schema.
export const DATABASE_SCHEMA_VERSION = 18;
export const DATABASE_TABLES: readonly {
  name: string;
  since: number;
  definitions: readonly { since: number; sql: string }[];
}[] = [
  {
    name: "ai_usage",
    since: 1,
    definitions: [
      {
        since: 1,
        sql: "CREATE TABLE ai_usage (\n id TEXT PRIMARY KEY, request_id TEXT NOT NULL UNIQUE, user_id TEXT REFERENCES users(id), task TEXT NOT NULL,\n provider TEXT, model TEXT, status TEXT NOT NULL CHECK(status IN ('success','error')),\n input_tokens INTEGER CHECK(input_tokens >= 0), output_tokens INTEGER CHECK(output_tokens >= 0),\n cached_tokens INTEGER CHECK(cached_tokens >= 0), estimated_cost_usd REAL CHECK(estimated_cost_usd >= 0),\n latency_ms INTEGER NOT NULL CHECK(latency_ms >= 0), error_code TEXT, created_at TEXT NOT NULL\n)",
      },
    ],
  },
  {
    name: "audit_events",
    since: 1,
    definitions: [
      {
        since: 1,
        sql: "CREATE TABLE audit_events (\n id TEXT PRIMARY KEY, actor_id TEXT REFERENCES users(id), action TEXT NOT NULL, target TEXT,\n result TEXT NOT NULL CHECK(result IN ('success','denied','error')),\n request_id TEXT NOT NULL, before_json TEXT NOT NULL DEFAULT '{}', after_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL\n)",
      },
    ],
  },
  {
    name: "feature_flags",
    since: 1,
    definitions: [
      {
        since: 1,
        sql: "CREATE TABLE feature_flags (\n key TEXT PRIMARY KEY, enabled INTEGER NOT NULL CHECK(enabled IN (0,1)), description TEXT NOT NULL,\n updated_at TEXT NOT NULL, updated_by TEXT REFERENCES users(id)\n)",
      },
    ],
  },
  {
    name: "identities",
    since: 1,
    definitions: [
      {
        since: 1,
        sql: "CREATE TABLE identities (\n provider TEXT NOT NULL CHECK(provider IN ('google','facebook')), provider_account_id TEXT NOT NULL,\n user_id TEXT NOT NULL REFERENCES users(id), email TEXT, email_verified INTEGER NOT NULL DEFAULT 0,\n linked_at TEXT NOT NULL, PRIMARY KEY(provider, provider_account_id), UNIQUE(user_id,provider)\n)",
      },
    ],
  },
  {
    name: "identity_link_intents",
    since: 1,
    definitions: [
      {
        since: 1,
        sql: "CREATE TABLE identity_link_intents (\n token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), provider TEXT NOT NULL,\n expires_at INTEGER NOT NULL, consumed_at INTEGER, created_at TEXT NOT NULL\n)",
      },
      {
        since: 2,
        sql: "CREATE TABLE identity_link_intents (\n token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), provider TEXT NOT NULL,\n expires_at INTEGER NOT NULL, consumed_at INTEGER, created_at TEXT NOT NULL\n, session_version INTEGER NOT NULL DEFAULT 0)",
      },
    ],
  },
  {
    name: "memberships",
    since: 1,
    definitions: [
      {
        since: 1,
        sql: "CREATE TABLE memberships (\n user_id TEXT NOT NULL REFERENCES users(id), organization_id TEXT NOT NULL REFERENCES organizations(id),\n role TEXT NOT NULL CHECK(role IN ('OWNER','SCHOOL_ADMIN','TEACHER','PARENT','STUDENT')),\n PRIMARY KEY(user_id,organization_id)\n)",
      },
    ],
  },
  {
    name: "organizations",
    since: 1,
    definitions: [
      {
        since: 1,
        sql: "CREATE TABLE organizations (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL)",
      },
    ],
  },
  {
    name: "schema_migrations",
    since: 1,
    definitions: [
      {
        since: 1,
        sql: "CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL)",
      },
    ],
  },
  {
    name: "users",
    since: 1,
    definitions: [
      {
        since: 1,
        sql: "CREATE TABLE users (\n id TEXT PRIMARY KEY, storage_key TEXT NOT NULL UNIQUE, name TEXT NOT NULL, email TEXT,\n role TEXT NOT NULL DEFAULT 'USER' CHECK(role IN ('USER','DEV','ADMIN','SUPER_ADMIN')),\n disabled INTEGER NOT NULL DEFAULT 0 CHECK(disabled IN (0,1)),\n session_version INTEGER NOT NULL DEFAULT 1,\n created_at TEXT NOT NULL, last_seen_at TEXT NOT NULL\n)",
      },
    ],
  },
  {
    name: "billing_accounts",
    since: 3,
    definitions: [
      {
        since: 3,
        sql: "CREATE TABLE billing_accounts (\n user_id TEXT PRIMARY KEY REFERENCES users(id), balance INTEGER NOT NULL DEFAULT 0 CHECK(balance >= 0),\n reserved INTEGER NOT NULL DEFAULT 0 CHECK(reserved >= 0), plan_id TEXT NOT NULL DEFAULT 'free',\n plan_source TEXT NOT NULL DEFAULT 'free' CHECK(plan_source IN ('free','sandbox','paid')),\n period_end INTEGER, cancel_at_period_end INTEGER NOT NULL DEFAULT 0,\n next_plan_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL\n)",
      },
    ],
  },
  {
    name: "billing_actions",
    since: 3,
    definitions: [
      {
        since: 3,
        sql: "CREATE TABLE billing_actions (\n request_id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), actor_id TEXT NOT NULL REFERENCES users(id),\n action TEXT NOT NULL, fingerprint TEXT NOT NULL, created_at TEXT NOT NULL\n)",
      },
    ],
  },
  {
    name: "billing_catalog_settings",
    since: 3,
    definitions: [
      {
        since: 3,
        sql: "CREATE TABLE billing_catalog_settings (\n item_id TEXT PRIMARY KEY, monthly_price_minor INTEGER CHECK(monthly_price_minor >= 0),\n yearly_price_minor INTEGER CHECK(yearly_price_minor >= 0), credits INTEGER CHECK(credits >= 0),\n updated_by TEXT REFERENCES users(id), updated_at TEXT NOT NULL\n)",
      },
    ],
  },
  {
    name: "billing_ledger",
    since: 3,
    definitions: [
      {
        since: 3,
        sql: "CREATE TABLE billing_ledger (\n id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), event_key TEXT NOT NULL UNIQUE,\n kind TEXT NOT NULL, available_delta INTEGER NOT NULL, reserved_delta INTEGER NOT NULL,\n balance_after INTEGER NOT NULL CHECK(balance_after >= 0), reserved_after INTEGER NOT NULL CHECK(reserved_after >= 0),\n reservation_id TEXT REFERENCES billing_reservations(id), actor_id TEXT REFERENCES users(id),\n note TEXT NOT NULL, created_at TEXT NOT NULL\n)",
      },
    ],
  },
  {
    name: "billing_reservations",
    since: 3,
    definitions: [
      {
        since: 3,
        sql: "CREATE TABLE billing_reservations (\n id TEXT PRIMARY KEY, request_id TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL REFERENCES users(id),\n units INTEGER NOT NULL CHECK(units > 0), task TEXT NOT NULL, mode TEXT NOT NULL, kind TEXT NOT NULL,\n status TEXT NOT NULL CHECK(status IN ('reserved','settled','refunded')), created_at TEXT NOT NULL,\n expires_at INTEGER NOT NULL, finalized_at TEXT\n)",
      },
    ],
  },
  {
    name: "mobile_pair_codes",
    since: 4,
    definitions: [
      {
        since: 4,
        sql: "CREATE TABLE mobile_pair_codes (\n code_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),\n session_version INTEGER NOT NULL, expires_at INTEGER NOT NULL, created_at TEXT NOT NULL\n)",
      },
    ],
  },
  {
    name: "mobile_sessions",
    since: 4,
    definitions: [
      {
        since: 4,
        sql: "CREATE TABLE mobile_sessions (\n id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL REFERENCES users(id),\n session_version INTEGER NOT NULL, device_name TEXT NOT NULL, expires_at INTEGER NOT NULL,\n created_at TEXT NOT NULL, last_seen_at TEXT NOT NULL\n)",
      },
    ],
  },
  {
    name: "tutor_sessions",
    since: 5,
    definitions: [
      {
        since: 5,
        sql: "CREATE TABLE tutor_sessions (\n id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), session_version INTEGER NOT NULL,\n problem TEXT NOT NULL, source_digest TEXT NOT NULL, language TEXT NOT NULL,\n hint_count INTEGER NOT NULL DEFAULT 0 CHECK(hint_count>=0), revision INTEGER NOT NULL DEFAULT 0,\n pending_request TEXT, pending_until INTEGER,\n created_at TEXT NOT NULL, updated_at TEXT NOT NULL, expires_at INTEGER NOT NULL\n)",
      },
      {
        since: 7,
        sql: "CREATE TABLE tutor_sessions (\n id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), session_version INTEGER NOT NULL,\n problem TEXT NOT NULL, source_digest TEXT NOT NULL, language TEXT NOT NULL,\n hint_count INTEGER NOT NULL DEFAULT 0 CHECK(hint_count>=0), revision INTEGER NOT NULL DEFAULT 0,\n pending_request TEXT, pending_until INTEGER,\n created_at TEXT NOT NULL, updated_at TEXT NOT NULL, expires_at INTEGER NOT NULL\n, needs_clarification INTEGER NOT NULL DEFAULT 0 CHECK(needs_clarification IN (0,1)))",
      },
    ],
  },
  {
    name: "tutor_turns",
    since: 5,
    definitions: [
      {
        since: 5,
        sql: "CREATE TABLE tutor_turns (\n id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES tutor_sessions(id) ON DELETE CASCADE,\n request_id TEXT NOT NULL UNIQUE, ordinal INTEGER NOT NULL, student_text TEXT NOT NULL,\n assistant_text TEXT NOT NULL, hint TEXT, question TEXT, misconception TEXT, step TEXT,\n guidance TEXT NOT NULL CHECK(guidance IN ('hints','full')), created_at TEXT NOT NULL,\n UNIQUE(session_id,ordinal)\n)",
      },
      {
        since: 6,
        sql: "CREATE TABLE tutor_turns (\n id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES tutor_sessions(id) ON DELETE CASCADE,\n request_id TEXT NOT NULL UNIQUE, ordinal INTEGER NOT NULL, student_text TEXT NOT NULL,\n assistant_text TEXT NOT NULL, hint TEXT, question TEXT, misconception TEXT, step TEXT,\n guidance TEXT NOT NULL CHECK(guidance IN ('hints','full')), created_at TEXT NOT NULL, references_json TEXT NOT NULL DEFAULT '[]', verification_json TEXT,\n UNIQUE(session_id,ordinal)\n)",
      },
      {
        since: 7,
        sql: "CREATE TABLE tutor_turns (\n id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES tutor_sessions(id) ON DELETE CASCADE,\n request_id TEXT NOT NULL UNIQUE, ordinal INTEGER NOT NULL, student_text TEXT NOT NULL,\n assistant_text TEXT NOT NULL, hint TEXT, question TEXT, misconception TEXT, step TEXT,\n guidance TEXT NOT NULL CHECK(guidance IN ('hints','full')), created_at TEXT NOT NULL, references_json TEXT NOT NULL DEFAULT '[]', verification_json TEXT, needs_clarification INTEGER NOT NULL DEFAULT 0 CHECK(needs_clarification IN (0,1)),\n UNIQUE(session_id,ordinal)\n)",
      },
      {
        since: 18,
        sql: "CREATE TABLE tutor_turns (\n id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES tutor_sessions(id) ON DELETE CASCADE,\n request_id TEXT NOT NULL UNIQUE, ordinal INTEGER NOT NULL, student_text TEXT NOT NULL,\n assistant_text TEXT NOT NULL, hint TEXT, question TEXT, misconception TEXT, step TEXT,\n guidance TEXT NOT NULL CHECK(guidance IN ('hints','full')), created_at TEXT NOT NULL, references_json TEXT NOT NULL DEFAULT '[]', verification_json TEXT, needs_clarification INTEGER NOT NULL DEFAULT 0 CHECK(needs_clarification IN (0,1)), intent TEXT NOT NULL DEFAULT 'progress' CHECK(intent IN('progress','simpler','example','approach')),\n UNIQUE(session_id,ordinal)\n)",
      },
    ],
  },
  {
    name: "runtime_ai_leases",
    since: 8,
    definitions: [
      {
        since: 8,
        sql: "CREATE TABLE runtime_ai_leases (\n id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), competition INTEGER NOT NULL,\n expires_at INTEGER NOT NULL\n)",
      },
    ],
  },
  {
    name: "runtime_rate_windows",
    since: 8,
    definitions: [
      {
        since: 8,
        sql: "CREATE TABLE runtime_rate_windows (\n key TEXT PRIMARY KEY, minute_start INTEGER NOT NULL, minute_count INTEGER NOT NULL,\n day TEXT NOT NULL, daily_count INTEGER NOT NULL, updated_at INTEGER NOT NULL\n)",
      },
    ],
  },
  {
    name: "sync_operations",
    since: 8,
    definitions: [
      {
        since: 8,
        sql: "CREATE TABLE sync_operations (\n user_id TEXT NOT NULL REFERENCES users(id), request_id TEXT NOT NULL, fingerprint TEXT NOT NULL,\n result_json TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(user_id,request_id)\n)",
      },
    ],
  },
  {
    name: "sync_snapshots",
    since: 8,
    definitions: [
      {
        since: 8,
        sql: "CREATE TABLE sync_snapshots (\n user_id TEXT PRIMARY KEY REFERENCES users(id), epoch TEXT NOT NULL, revision INTEGER NOT NULL,\n payload_json TEXT, digest TEXT, updated_at TEXT NOT NULL, expires_at INTEGER NOT NULL\n)",
      },
    ],
  },
  {
    name: "rag_chunks",
    since: 9,
    definitions: [
      {
        since: 9,
        sql: "CREATE TABLE rag_chunks (\n id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), workspace_id TEXT NOT NULL,\n document_id TEXT NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE, ordinal INTEGER NOT NULL,\n segment_json TEXT NOT NULL, vector_json TEXT, UNIQUE(document_id,ordinal)\n)",
      },
    ],
  },
  {
    name: "rag_documents",
    since: 9,
    definitions: [
      {
        since: 9,
        sql: "CREATE TABLE rag_documents (\n id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), workspace_id TEXT NOT NULL,\n client_item_id TEXT NOT NULL, title TEXT NOT NULL, source_text TEXT NOT NULL, digest TEXT NOT NULL,\n evidence_json TEXT, revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, expires_at INTEGER NOT NULL,\n embedding_model TEXT, embedding_dimensions INTEGER,\n UNIQUE(user_id,workspace_id,client_item_id)\n)",
      },
    ],
  },
  {
    name: "rag_snapshots",
    since: 9,
    definitions: [
      {
        since: 9,
        sql: "CREATE TABLE rag_snapshots (\n id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), session_version INTEGER NOT NULL,\n workspace_id TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL, expires_at INTEGER NOT NULL\n)",
      },
    ],
  },
  {
    name: "summary_job_parts",
    since: 10,
    definitions: [
      {
        since: 10,
        sql: "CREATE TABLE summary_job_parts (\n job_id TEXT NOT NULL REFERENCES summary_jobs(id) ON DELETE CASCADE, ordinal INTEGER NOT NULL,\n input_json TEXT NOT NULL, char_start INTEGER, char_end INTEGER,\n status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','completed')),\n attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3), lease_sequence INTEGER NOT NULL DEFAULT 0,\n lease_token TEXT, lease_until INTEGER, attempt_request_id TEXT, reservation_id TEXT,\n result_json TEXT, PRIMARY KEY(job_id,ordinal)\n)",
      },
    ],
  },
  {
    name: "summary_jobs",
    since: 10,
    definitions: [
      {
        since: 10,
        sql: "CREATE TABLE summary_jobs (\n id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), session_version INTEGER NOT NULL,\n request_key TEXT NOT NULL, fingerprint TEXT NOT NULL, source_digest TEXT NOT NULL,\n title TEXT NOT NULL, client_item_id TEXT, source_type TEXT NOT NULL CHECK(source_type IN ('text','youtube')),\n input_json TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('queued','running','retry_wait','paused','completed','cancelled','failed')),\n completed INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL CHECK(total BETWEEN 1 AND 12),\n error_code TEXT, available_at INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,\n expires_at INTEGER NOT NULL, result_json TEXT, UNIQUE(user_id,request_key)\n)",
      },
    ],
  },
  {
    name: "teacher_application_operations",
    since: 11,
    definitions: [
      {
        since: 11,
        sql: "CREATE TABLE teacher_application_operations (\n request_id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES users(id),\n target_user_id TEXT NOT NULL REFERENCES users(id), application_id TEXT NOT NULL REFERENCES teacher_applications(id),\n action TEXT NOT NULL CHECK(action IN ('submit','approve','reject','revoke')),\n fingerprint TEXT NOT NULL, result_revision INTEGER NOT NULL, created_at TEXT NOT NULL\n)",
      },
    ],
  },
  {
    name: "teacher_applications",
    since: 11,
    definitions: [
      {
        since: 11,
        sql: "CREATE TABLE teacher_applications (\n id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(id),\n status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected','revoked')),\n revision INTEGER NOT NULL CHECK(revision>=1), profile_json TEXT NOT NULL,\n submitted_at TEXT NOT NULL, updated_at TEXT NOT NULL,\n reviewed_at TEXT, reviewed_by TEXT REFERENCES users(id), review_note TEXT\n)",
      },
    ],
  },
  {
    name: "teacher_credentials",
    since: 11,
    definitions: [
      {
        since: 11,
        sql: "CREATE TABLE teacher_credentials (\n user_id TEXT PRIMARY KEY REFERENCES users(id),\n application_id TEXT NOT NULL UNIQUE REFERENCES teacher_applications(id),\n active INTEGER NOT NULL DEFAULT 0 CHECK(active IN (0,1)),\n approved_at TEXT, revoked_at TEXT, reviewed_by TEXT REFERENCES users(id)\n)",
      },
    ],
  },
  {
    name: "teaching_announcements",
    since: 12,
    definitions: [
      {
        since: 12,
        sql: "CREATE TABLE teaching_announcements (\n id TEXT PRIMARY KEY,organization_id TEXT NOT NULL REFERENCES organizations(id),class_id TEXT REFERENCES teaching_classes(id),\n title TEXT NOT NULL,body TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),\n revision INTEGER NOT NULL DEFAULT 1,created_by TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL\n)",
      },
    ],
  },
  {
    name: "teaching_assignment_targets",
    since: 12,
    definitions: [
      {
        since: 12,
        sql: "CREATE TABLE teaching_assignment_targets (assignment_id TEXT NOT NULL REFERENCES teaching_assignments(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id),PRIMARY KEY(assignment_id,user_id))",
      },
    ],
  },
  {
    name: "teaching_assignments",
    since: 12,
    definitions: [
      {
        since: 12,
        sql: "CREATE TABLE teaching_assignments (\n id TEXT PRIMARY KEY,organization_id TEXT NOT NULL REFERENCES organizations(id),class_id TEXT NOT NULL REFERENCES teaching_classes(id),\n data_json TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','reviewed','issued','closed')),\n revision INTEGER NOT NULL DEFAULT 1,created_by TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL,issued_at TEXT\n)",
      },
    ],
  },
  {
    name: "teaching_class_teachers",
    since: 12,
    definitions: [
      {
        since: 12,
        sql: "CREATE TABLE teaching_class_teachers (\n class_id TEXT NOT NULL REFERENCES teaching_classes(id),user_id TEXT NOT NULL REFERENCES users(id),PRIMARY KEY(class_id,user_id)\n)",
      },
    ],
  },
  {
    name: "teaching_classes",
    since: 12,
    definitions: [
      {
        since: 12,
        sql: "CREATE TABLE teaching_classes (\n id TEXT PRIMARY KEY,organization_id TEXT NOT NULL REFERENCES organizations(id),name TEXT NOT NULL,\n subject TEXT NOT NULL,grade TEXT NOT NULL,description TEXT NOT NULL,archived INTEGER NOT NULL DEFAULT 0,\n revision INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL\n)",
      },
    ],
  },
  {
    name: "teaching_content",
    since: 12,
    definitions: [
      {
        since: 12,
        sql: "CREATE TABLE teaching_content (\n id TEXT PRIMARY KEY,organization_id TEXT NOT NULL REFERENCES organizations(id),class_id TEXT REFERENCES teaching_classes(id),\n kind TEXT NOT NULL CHECK(kind IN ('material','lesson','question')),data_json TEXT NOT NULL,\n status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','reviewed','published','archived')),\n revision INTEGER NOT NULL DEFAULT 1,created_by TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL,updated_at TEXT NOT NULL\n)",
      },
    ],
  },
  {
    name: "teaching_enrollments",
    since: 12,
    definitions: [
      {
        since: 12,
        sql: "CREATE TABLE teaching_enrollments (\n id TEXT PRIMARY KEY,class_id TEXT NOT NULL REFERENCES teaching_classes(id),user_id TEXT NOT NULL REFERENCES users(id),\n active INTEGER NOT NULL DEFAULT 1,revision INTEGER NOT NULL DEFAULT 1,joined_at TEXT NOT NULL,UNIQUE(class_id,user_id)\n)",
      },
    ],
  },
  {
    name: "teaching_events",
    since: 12,
    definitions: [
      {
        since: 12,
        sql: "CREATE TABLE teaching_events (\n id TEXT PRIMARY KEY,organization_id TEXT NOT NULL REFERENCES organizations(id),class_id TEXT NOT NULL REFERENCES teaching_classes(id),\n data_json TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1\n)",
      },
    ],
  },
  {
    name: "teaching_group_members",
    since: 12,
    definitions: [
      {
        since: 12,
        sql: "CREATE TABLE teaching_group_members (group_id TEXT NOT NULL REFERENCES teaching_groups(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id),PRIMARY KEY(group_id,user_id))",
      },
    ],
  },
  {
    name: "teaching_groups",
    since: 12,
    definitions: [
      {
        since: 12,
        sql: "CREATE TABLE teaching_groups (id TEXT PRIMARY KEY,class_id TEXT NOT NULL REFERENCES teaching_classes(id),name TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1)",
      },
    ],
  },
  {
    name: "teaching_invites",
    since: 12,
    definitions: [
      {
        since: 12,
        sql: "CREATE TABLE teaching_invites (\n id TEXT PRIMARY KEY,class_id TEXT NOT NULL REFERENCES teaching_classes(id),code_hash TEXT NOT NULL UNIQUE,\n request_id TEXT NOT NULL UNIQUE,created_by TEXT NOT NULL REFERENCES users(id),expires_at INTEGER NOT NULL,\n max_uses INTEGER NOT NULL,uses INTEGER NOT NULL DEFAULT 0,active INTEGER NOT NULL DEFAULT 1,revision INTEGER NOT NULL DEFAULT 1\n)",
      },
    ],
  },
  {
    name: "teaching_operations",
    since: 12,
    definitions: [
      {
        since: 12,
        sql: "CREATE TABLE teaching_operations (\n request_id TEXT PRIMARY KEY,actor_id TEXT NOT NULL REFERENCES users(id),organization_id TEXT NOT NULL REFERENCES organizations(id),\n class_id TEXT REFERENCES teaching_classes(id),action TEXT NOT NULL,fingerprint TEXT NOT NULL,result_json TEXT NOT NULL,created_at TEXT NOT NULL\n)",
      },
    ],
  },
  {
    name: "teaching_organizations",
    since: 12,
    definitions: [
      {
        since: 12,
        sql: "CREATE TABLE teaching_organizations (\n organization_id TEXT PRIMARY KEY REFERENCES organizations(id), revision INTEGER NOT NULL DEFAULT 1,\n settings_json TEXT NOT NULL, created_by TEXT NOT NULL REFERENCES users(id)\n)",
      },
    ],
  },
  {
    name: "teaching_submissions",
    since: 12,
    definitions: [
      {
        since: 12,
        sql: "CREATE TABLE teaching_submissions (\n id TEXT PRIMARY KEY,assignment_id TEXT NOT NULL REFERENCES teaching_assignments(id),student_id TEXT NOT NULL REFERENCES users(id),\n answers_json TEXT NOT NULL,submitted_at TEXT NOT NULL,late INTEGER NOT NULL,\n status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','graded','published')),\n revision INTEGER NOT NULL DEFAULT 1,auto_score REAL NOT NULL DEFAULT 0,grades_json TEXT,score REAL,feedback TEXT,\n confirmed_at TEXT,published_at TEXT,UNIQUE(assignment_id,student_id)\n)",
      },
    ],
  },
  {
    name: "teaching_preferences",
    since: 13,
    definitions: [
      {
        since: 13,
        sql: "CREATE TABLE teaching_preferences (\n organization_id TEXT NOT NULL REFERENCES organizations(id),user_id TEXT NOT NULL REFERENCES users(id),\n data_json TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,\n PRIMARY KEY(organization_id,user_id)\n)",
      },
    ],
  },
  {
    name: "ai_http_requests",
    since: 14,
    definitions: [
      {
        since: 14,
        sql: "CREATE TABLE ai_http_requests (\n user_id TEXT NOT NULL REFERENCES users(id),request_key TEXT NOT NULL,session_version INTEGER NOT NULL,\n endpoint TEXT NOT NULL CHECK(endpoint IN ('ai','voice','rag-search','rag-embed')),fingerprint TEXT NOT NULL,request_id TEXT NOT NULL UNIQUE,\n status TEXT NOT NULL CHECK(status IN ('pending','completed','failed')),lease_token TEXT NOT NULL,lease_until INTEGER NOT NULL,\n tutor_session_id TEXT REFERENCES tutor_sessions(id) ON DELETE SET NULL,error_code TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,expires_at INTEGER NOT NULL,\n PRIMARY KEY(user_id,request_key)\n)",
      },
    ],
  },
  {
    name: "teaching_grade_events",
    since: 15,
    definitions: [
      {
        since: 15,
        sql: "CREATE TABLE teaching_grade_events (\n sequence INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT NOT NULL UNIQUE,\n submission_id TEXT NOT NULL REFERENCES teaching_submissions(id),\n submission_revision INTEGER NOT NULL CHECK(submission_revision>=1),\n kind TEXT NOT NULL CHECK(kind IN ('grade','publish','legacy_snapshot')),\n grade_version INTEGER NOT NULL CHECK(grade_version>=1),grade_event_id TEXT,\n grades_json TEXT,score REAL,feedback TEXT,answers_digest TEXT,\n actor_id TEXT REFERENCES users(id),recorded_at TEXT,confirmed_at TEXT,published_at TEXT,reason TEXT,\n legacy INTEGER NOT NULL DEFAULT 0 CHECK(legacy IN(0,1)),\n UNIQUE(id,submission_id),UNIQUE(submission_id,submission_revision,kind),UNIQUE(submission_id,grade_version,kind),\n FOREIGN KEY(grade_event_id,submission_id) REFERENCES teaching_grade_events(id,submission_id),\n CHECK(\n  (kind='grade' AND legacy=0 AND grade_event_id IS NULL AND grades_json IS NOT NULL AND score IS NOT NULL AND score>=0 AND feedback IS NOT NULL AND answers_digest IS NOT NULL AND length(answers_digest)=64 AND actor_id IS NOT NULL AND recorded_at IS NOT NULL AND confirmed_at IS NOT NULL AND published_at IS NULL) OR\n  (kind='publish' AND legacy=0 AND grade_event_id IS NOT NULL AND grades_json IS NULL AND score IS NULL AND feedback IS NULL AND answers_digest IS NULL AND actor_id IS NOT NULL AND recorded_at IS NOT NULL AND confirmed_at IS NULL AND published_at IS NOT NULL AND reason IS NULL) OR\n  (kind='legacy_snapshot' AND legacy=1 AND grade_event_id IS NULL AND grades_json IS NOT NULL AND score IS NOT NULL AND score>=0 AND feedback IS NOT NULL AND answers_digest IS NULL AND actor_id IS NULL AND recorded_at IS NULL AND reason IS NULL)\n )\n)",
      },
    ],
  },
  {
    name: "teaching_assessment_windows",
    since: 16,
    definitions: [
      {
        since: 16,
        sql: "CREATE TABLE teaching_assessment_windows (\n assignment_id TEXT NOT NULL PRIMARY KEY REFERENCES teaching_assignments(id) ON DELETE CASCADE,\n root_assignment_id TEXT NOT NULL REFERENCES teaching_assignments(id),\n parent_assignment_id TEXT REFERENCES teaching_assignments(id),attempt_no INTEGER NOT NULL CHECK(attempt_no BETWEEN 1 AND 3),\n student_id TEXT REFERENCES users(id),available_from TEXT,available_until TEXT,\n reason TEXT,acknowledged INTEGER NOT NULL DEFAULT 0 CHECK(acknowledged IN(0,1)),\n created_by TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL,\n UNIQUE(root_assignment_id,student_id,attempt_no),\n CHECK((attempt_no=1 AND root_assignment_id=assignment_id AND parent_assignment_id IS NULL AND student_id IS NULL AND acknowledged=0 AND reason IS NULL) OR\n (attempt_no>1 AND root_assignment_id!=assignment_id AND parent_assignment_id IS NOT NULL AND parent_assignment_id=root_assignment_id AND student_id IS NOT NULL AND available_from IS NOT NULL AND available_until IS NOT NULL AND acknowledged=1 AND reason IS NOT NULL))\n)",
      },
    ],
  },
  {
    name: "ai_provider_attempts",
    since: 17,
    definitions: [
      {
        since: 17,
        sql: "CREATE TABLE ai_provider_attempts (\n id TEXT NOT NULL PRIMARY KEY,logical_request_id TEXT NOT NULL CHECK(length(logical_request_id) BETWEEN 1 AND 100),\n dispatch_ordinal INTEGER NOT NULL CHECK(dispatch_ordinal>=1),user_id TEXT NOT NULL REFERENCES users(id),\n session_version INTEGER NOT NULL CHECK(session_version>=1),reservation_id TEXT NOT NULL REFERENCES billing_reservations(id),\n feature TEXT NOT NULL CHECK(feature IN('learner.chat','learner.tutor','learner.summary','learner.cards','learner.quiz','teacher.lesson','teacher.questions','teacher.feedback','teacher.assistant','job.summary-part')),\n provider TEXT NOT NULL CHECK(provider IN('openai','gemini')),endpoint_kind TEXT NOT NULL CHECK(endpoint_kind IN('responses','generate-content')),\n requested_model TEXT NOT NULL CHECK(length(requested_model) BETWEEN 1 AND 100),response_model TEXT CHECK(length(response_model) BETWEEN 1 AND 100),\n provider_request_id TEXT CHECK(length(provider_request_id) BETWEEN 1 AND 100),\n status TEXT NOT NULL DEFAULT 'prepared' CHECK(status IN('prepared','response_received','network_unknown','timeout_unknown','cancelled_unknown')),\n http_status INTEGER CHECK(http_status BETWEEN 100 AND 599),\n input_tokens INTEGER CHECK(input_tokens>=0),output_tokens INTEGER CHECK(output_tokens>=0),cached_tokens INTEGER CHECK(cached_tokens>=0),\n total_tokens INTEGER CHECK(total_tokens>=0),reasoning_tokens INTEGER CHECK(reasoning_tokens>=0),latency_ms INTEGER CHECK(latency_ms>=0),\n safe_error_code TEXT CHECK(length(safe_error_code) BETWEEN 1 AND 80),\n usage_source TEXT CHECK(usage_source IN('openai-response-usage','gemini-usage-metadata')),\n estimated_cost_usd REAL CHECK(estimated_cost_usd IS NULL),prepared_at TEXT NOT NULL,ended_at TEXT,\n UNIQUE(logical_request_id,dispatch_ordinal),\n CHECK((status='prepared' AND ended_at IS NULL) OR (status!='prepared' AND ended_at IS NOT NULL)),\n CHECK((provider='openai' AND endpoint_kind='responses') OR (provider='gemini' AND endpoint_kind='generate-content'))\n)",
      },
    ],
  },
  {
    name: "tutor_feedback",
    since: 18,
    definitions: [
      {
        since: 18,
        sql: "CREATE TABLE tutor_feedback (\n turn_id TEXT NOT NULL PRIMARY KEY REFERENCES tutor_turns(id) ON DELETE CASCADE,\n session_id TEXT NOT NULL REFERENCES tutor_sessions(id) ON DELETE CASCADE,\n revision INTEGER NOT NULL CHECK(revision>=1),\n usefulness TEXT CHECK(usefulness IN('helpful','not_helpful')),\n correctness TEXT CHECK(correctness IN('possible_error','not_sure')),\n updated_at TEXT NOT NULL,\n CHECK(usefulness IS NOT NULL OR correctness IS NOT NULL)\n)",
      },
    ],
  },
  {
    name: "tutor_feedback_actions",
    since: 18,
    definitions: [
      {
        since: 18,
        sql: "CREATE TABLE tutor_feedback_actions (\n user_id TEXT NOT NULL REFERENCES users(id),request_id TEXT NOT NULL,\n session_id TEXT NOT NULL REFERENCES tutor_sessions(id) ON DELETE CASCADE,\n turn_id TEXT NOT NULL REFERENCES tutor_turns(id) ON DELETE CASCADE,\n fingerprint TEXT NOT NULL CHECK(length(fingerprint)=64),\n result_revision INTEGER NOT NULL CHECK(result_revision>=1),\n deleted INTEGER NOT NULL CHECK(deleted IN(0,1)),created_at TEXT NOT NULL,\n PRIMARY KEY(user_id,request_id)\n)",
      },
    ],
  },
];
export const DATABASE_GUARDS: readonly {
  name: string;
  table: string;
  since: number;
  sql: string;
}[] = [
  {
    name: "audit_no_delete",
    table: "audit_events",
    since: 1,
    sql: "CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit_events BEGIN SELECT RAISE(ABORT,'AUDIT_APPEND_ONLY'); END",
  },
  {
    name: "audit_no_update",
    table: "audit_events",
    since: 1,
    sql: "CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_events BEGIN SELECT RAISE(ABORT,'AUDIT_APPEND_ONLY'); END",
  },
  {
    name: "billing_ledger_no_delete",
    table: "billing_ledger",
    since: 3,
    sql: "CREATE TRIGGER billing_ledger_no_delete BEFORE DELETE ON billing_ledger BEGIN SELECT RAISE(ABORT,'LEDGER_APPEND_ONLY'); END",
  },
  {
    name: "billing_ledger_no_update",
    table: "billing_ledger",
    since: 3,
    sql: "CREATE TRIGGER billing_ledger_no_update BEFORE UPDATE ON billing_ledger BEGIN SELECT RAISE(ABORT,'LEDGER_APPEND_ONLY'); END",
  },
  {
    name: "teaching_grade_events_no_delete",
    table: "teaching_grade_events",
    since: 15,
    sql: "CREATE TRIGGER teaching_grade_events_no_delete BEFORE DELETE ON teaching_grade_events BEGIN SELECT RAISE(ABORT,'TEACHING_HISTORY_IMMUTABLE'); END",
  },
  {
    name: "teaching_grade_events_no_update",
    table: "teaching_grade_events",
    since: 15,
    sql: "CREATE TRIGGER teaching_grade_events_no_update BEFORE UPDATE ON teaching_grade_events BEGIN SELECT RAISE(ABORT,'TEACHING_HISTORY_IMMUTABLE'); END",
  },
];

type DatabaseReader = Pick<DatabaseSync, "prepare">;
type IntegrityOptions = { allowPrefix?: boolean; maximumVersion?: number };
type SchemaRow = { name: unknown; type: unknown; tbl_name: unknown; sql: unknown };
// A fresh read per invocation, not a cache. Remote health needs two round trips
// (schema + history), while preserving every existing SQL/type/guard check.
function readSchema(db: DatabaseReader): SchemaRow[] {
  return db.prepare("SELECT name,type,tbl_name,sql FROM sqlite_schema").all() as SchemaRow[];
}
// Preserve literal contents and SQL structure. Only normalize platform line
// endings, surrounding whitespace and SQLite's discarded terminal semicolon.
export function normalizedGuardSQL(value: unknown): string {
  return typeof value === "string"
    ? value.replace(/\r\n?/g, "\n").trim().replace(/;$/, "")
    : "";
}
/** Token boundaries and SQL literals survive formatting normalization. This
 * includes column types, PK/UNIQUE/FK/CHECK constraints, not just table names. */
export function normalizedTableSQL(value: unknown): string {
  if (typeof value !== "string") return "";
  const tokens =
    value.match(
      /'(?:''|[^'])*'|"(?:""|[^"])*"|--[^\r\n]*|\/\*[\s\S]*?\*\/|[A-Za-z_][A-Za-z0-9_$]*|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[^\s]/g,
    ) || [];
  const meaningful = tokens.filter(
    (token) => !token.startsWith("--") && !token.startsWith("/*"),
  );
  if (meaningful.at(-1) === ";") meaningful.pop();
  return JSON.stringify(
    meaningful.map((token) =>
      /^['"]/.test(token) ? token : token.toLowerCase(),
    ),
  );
}
/** Read-only: run before WAL, CREATE, migrations, seeding or any application write. */
export function assertDatabaseHistory(
  db: DatabaseReader,
  options: IntegrityOptions = {},
): number {
  return historyFromSchema(db, options, readSchema(db));
}
function historyFromSchema(
  db: DatabaseReader,
  options: IntegrityOptions,
  schema: SchemaRow[],
): number {
  const maximum = options.maximumVersion ?? DATABASE_SCHEMA_VERSION;
  if (
    !Number.isSafeInteger(maximum) ||
    maximum < 1 ||
    maximum > DATABASE_SCHEMA_VERSION
  )
    throw new Error("SCHEMA_CONTRACT_OUTDATED");
  const tables = schema.filter((row) => row.type === "table");
  const present = tables.some((row) => row.name === "schema_migrations");
  // Only SQLite's literal reserved prefix is internal. SQL LIKE 'sqlite_%'
  // treats '_' as a wildcard and could disguise a foreign table named sqlitex.
  const applicationTables = tables.filter((row) => !/^sqlite_/i.test(String(row.name)));
  if (!present) {
    const populated = applicationTables.length > 0;
    if (populated || !options.allowPrefix)
      throw new Error("SCHEMA_NOT_SUPPORTED");
    return 0;
  }
  const versions = db
    .prepare("SELECT version FROM schema_migrations ORDER BY version")
    .all()
    .map((row) => row.version);
  if (
    versions.length === 0 &&
    applicationTables.some((row) => row.name !== "schema_migrations")
  )
    throw new Error("SCHEMA_NOT_SUPPORTED");
  if (
    versions.length > maximum ||
    versions.some(
      (value, index) =>
        typeof value !== "number" ||
        !Number.isSafeInteger(value) ||
        value !== index + 1,
    ) ||
    (!options.allowPrefix && versions.length !== maximum)
  )
    throw new Error("SCHEMA_NOT_SUPPORTED");
  return versions.length;
}
/** No writes, temporary triggers, migrations, source content or secrets in health. */
export function assertDatabaseIntegrity(
  db: DatabaseReader,
  options: IntegrityOptions = {},
) {
  const schema = readSchema(db);
  const version = historyFromSchema(db, options, schema);
  for (const table of DATABASE_TABLES) {
    const actual = schema.find((row) => row.name === table.name);
    // The empty bootstrap migration table is valid before migration1; any
    // known future application object contradicts the declared history.
    const bootstrap = version === 0 && table.name === "schema_migrations";
    if (table.since > version && !bootstrap) {
      if (actual) throw new Error("DATABASE_FUTURE_OBJECT:" + table.name);
      continue;
    }
    if (bootstrap && !actual) continue;
    const expected =
      table.definitions
        .filter((definition) => definition.since <= version)
        .at(-1) || (bootstrap ? table.definitions[0] : undefined);
    if (
      !actual ||
      actual.type !== "table" ||
      !expected ||
      normalizedTableSQL(actual.sql) !== normalizedTableSQL(expected.sql)
    )
      throw new Error("DATABASE_TABLE_INVALID:" + table.name);
  }
  for (const guard of DATABASE_GUARDS) {
    const actual = schema.find((row) => row.name === guard.name);
    if (guard.since > version) {
      if (actual) throw new Error("DATABASE_FUTURE_OBJECT:" + guard.name);
      continue;
    }
    if (
      !actual ||
      actual.type !== "trigger" ||
      actual.tbl_name !== guard.table ||
      normalizedGuardSQL(actual.sql) !== normalizedGuardSQL(guard.sql)
    )
      throw new Error("DATABASE_GUARD_INVALID:" + guard.name);
  }
  return {
    schemaVersion: version,
    guardsChecked: DATABASE_GUARDS.filter((guard) => guard.since <= version)
      .length,
  };
}
