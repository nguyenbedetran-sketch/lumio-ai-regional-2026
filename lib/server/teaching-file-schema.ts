// Assessed small-file pilot only: dedicated bounded object chunks, not user records.
export const teachingFileMigration = {
  version: 19,
  sql: `
CREATE TABLE teaching_files (
 id TEXT PRIMARY KEY,request_id TEXT NOT NULL UNIQUE,fingerprint TEXT NOT NULL CHECK(length(fingerprint)=64),
 organization_id TEXT NOT NULL REFERENCES organizations(id),class_id TEXT NOT NULL REFERENCES teaching_classes(id),
 uploader_id TEXT NOT NULL REFERENCES users(id),lesson_id TEXT REFERENCES teaching_content(id),assignment_id TEXT REFERENCES teaching_assignments(id),
 purpose TEXT NOT NULL CHECK(purpose IN('reference','teacher-only','submission')),
 filename TEXT NOT NULL,mime TEXT NOT NULL,bytes INTEGER NOT NULL CHECK(bytes BETWEEN 1 AND 1048576),
 digest TEXT NOT NULL CHECK(length(digest)=64),created_at TEXT NOT NULL,expires_at INTEGER,
 submission_id TEXT REFERENCES teaching_submissions(id),submission_revision INTEGER,
 CHECK((lesson_id IS NOT NULL AND assignment_id IS NULL AND purpose!='submission') OR (lesson_id IS NULL AND assignment_id IS NOT NULL)),
 CHECK((purpose='submission' AND ((submission_id IS NULL AND submission_revision IS NULL AND expires_at IS NOT NULL) OR (submission_id IS NOT NULL AND submission_revision>=1 AND expires_at IS NULL))) OR (purpose!='submission' AND submission_id IS NULL AND submission_revision IS NULL AND expires_at IS NULL))
);
CREATE INDEX teaching_files_scope ON teaching_files(organization_id,class_id,purpose);
CREATE INDEX teaching_files_pending ON teaching_files(uploader_id,expires_at);
CREATE INDEX teaching_files_submission ON teaching_files(submission_id,submission_revision);
CREATE TABLE teaching_file_chunks (
 file_id TEXT NOT NULL REFERENCES teaching_files(id) ON DELETE CASCADE,ordinal INTEGER NOT NULL CHECK(ordinal BETWEEN 0 AND 3),
 data BLOB NOT NULL CHECK(length(data) BETWEEN 1 AND 262144),PRIMARY KEY(file_id,ordinal)
);
CREATE TRIGGER teaching_file_chunks_bound_no_delete BEFORE DELETE ON teaching_file_chunks WHEN EXISTS(SELECT 1 FROM teaching_files WHERE id=OLD.file_id AND submission_id IS NOT NULL) BEGIN SELECT RAISE(ABORT,'TEACHING_FILE_IMMUTABLE'); END;
CREATE TRIGGER teaching_file_chunks_no_update BEFORE UPDATE ON teaching_file_chunks BEGIN SELECT RAISE(ABORT,'TEACHING_FILE_IMMUTABLE'); END;
CREATE TRIGGER teaching_files_identity_no_update BEFORE UPDATE OF request_id,fingerprint,organization_id,class_id,uploader_id,lesson_id,assignment_id,purpose,filename,mime,bytes,digest,created_at ON teaching_files BEGIN SELECT RAISE(ABORT,'TEACHING_FILE_IMMUTABLE'); END;
CREATE TRIGGER teaching_files_bound_no_update BEFORE UPDATE OF submission_id,submission_revision,expires_at ON teaching_files WHEN OLD.submission_id IS NOT NULL BEGIN SELECT RAISE(ABORT,'TEACHING_FILE_IMMUTABLE'); END;
CREATE TRIGGER teaching_files_bound_no_delete BEFORE DELETE ON teaching_files WHEN OLD.submission_id IS NOT NULL BEGIN SELECT RAISE(ABORT,'TEACHING_FILE_IMMUTABLE'); END;
`,
};
