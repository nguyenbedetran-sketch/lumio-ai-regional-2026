import { createHash, randomUUID } from "node:crypto";
import type { DatabaseConnection } from "./database-connection";
import type { AuditInput } from "./types";
import type { TeachingFile } from "../teaching/file-contracts";
import { teachingFileLimits as limits } from "../teaching/file-contracts";
import { teachingError as fail, ids } from "../teaching/validation";
import { validateTeachingFile } from "./teaching-file-validation";

export type FileRow = Record<string, any>;
export function teachingFileView(row: FileRow): TeachingFile {
  return {
    id: row.id,
    name: row.filename,
    mime: row.mime,
    bytes: Number(row.bytes),
    sha256: row.digest,
    createdAt: row.created_at,
    orgId: row.organization_id,
    classId: row.class_id,
    uploaderId: row.uploader_id,
    targetKind:
      row.purpose === "submission"
        ? "submission"
        : row.lesson_id
          ? "lesson"
          : "assignment",
    targetId: row.lesson_id || row.assignment_id,
    purpose: row.purpose,
    status: row.expires_at === null ? "attached" : "pending",
    ...(row.submission_id
      ? {
          submissionId: row.submission_id,
          submissionRevision: Number(row.submission_revision),
        }
      : {}),
  };
}

// Internal object port. Canonical authorization and transaction are supplied by
// teaching-core; routes never call this helper directly.
export function createTeachingFiles({
  db,
  now,
  stamp,
  recordAudit,
}: {
  db: DatabaseConnection;
  now: () => number;
  stamp: () => string;
  recordAudit: (input: AuditInput) => void;
}) {
  const get = (id: string) =>
    db.prepare("SELECT * FROM teaching_files WHERE id=?").get(id) as
      FileRow | undefined;
  return {
    get,
    rows(orgId: string) {
      return db
        .prepare(
          "SELECT * FROM teaching_files WHERE organization_id=? ORDER BY created_at,id LIMIT 201",
        )
        .all(orgId) as FileRow[];
    },
    purge(orgId: string) {
      db.prepare(
        "DELETE FROM teaching_files WHERE organization_id=? AND purpose='submission' AND submission_id IS NULL AND expires_at<=?",
      ).run(orgId, now());
    },
    upload(
      raw: { requestId: string; filename: unknown; dataBase64: unknown },
      context: {
        orgId: string;
        classId: string;
        uploaderId: string;
        lessonId?: string;
        assignmentId?: string;
        purpose: TeachingFile["purpose"];
      },
    ) {
      const file = validateTeachingFile(raw.filename, raw.dataBase64),
        digest = createHash("sha256").update(file.bytes).digest("hex"),
        fingerprint = createHash("sha256")
          .update(JSON.stringify([context, file.name, file.mime, digest]))
          .digest("hex");
      const old = db
        .prepare("SELECT * FROM teaching_files WHERE request_id=?")
        .get(raw.requestId) as FileRow | undefined;
      if (old) {
        if (
          old.uploader_id !== context.uploaderId ||
          old.fingerprint !== fingerprint
        )
          fail("TEACHING_REQUEST_REUSED", 409);
        return teachingFileView(old);
      }
      const receipt = db
        .prepare(
          'SELECT actor_id,action AS "action",fingerprint FROM teaching_operations WHERE request_id=?',
        )
        .get(raw.requestId) as FileRow | undefined;
      if (receipt) {
        if (
          receipt.actor_id !== context.uploaderId ||
          receipt.action !== "file.upload" ||
          receipt.fingerprint !== fingerprint
        )
          fail("TEACHING_REQUEST_REUSED", 409);
        // Deleting/expiring a file must not let a delayed retry resurrect it.
        fail("TEACHING_FILE_REQUEST_FINALIZED", 409);
      }
      const quota = db
        .prepare(
          "SELECT coalesce(sum(bytes),0) bytes,count(*) files FROM teaching_files WHERE organization_id=?",
        )
        .get(context.orgId) as FileRow;
      if (
        Number(quota.bytes) + file.bytes.length > limits.organizationBytes ||
        Number(quota.files) >= 200
      )
        fail("TEACHING_FILE_QUOTA", 409);
      const rate = db
        .prepare(
          "SELECT count(*) n FROM audit_events WHERE actor_id=? AND action='TEACHING_FILE_UPLOADED' AND created_at>=?",
        )
        .get(
          context.uploaderId,
          new Date(now() - 86400000).toISOString(),
        ) as FileRow;
      if (Number(rate.n) >= limits.uploadsPerDay)
        fail("TEACHING_FILE_RATE_LIMIT", 429);
      const count = db
        .prepare(
          "SELECT count(*) n FROM teaching_files WHERE organization_id=? AND coalesce(lesson_id,'')=? AND coalesce(assignment_id,'')=? AND ((purpose='submission' AND uploader_id=? AND submission_id IS NULL) OR (purpose!='submission' AND ?!='submission'))",
        )
        .get(
          context.orgId,
          context.lessonId || "",
          context.assignmentId || "",
          context.uploaderId,
          context.purpose,
        ) as FileRow;
      if (Number(count.n) >= limits.filesPerTarget)
        fail("TEACHING_FILE_COUNT", 409);
      const id = randomUUID();
      db.prepare(
        "INSERT INTO teaching_files(id,request_id,fingerprint,organization_id,class_id,uploader_id,lesson_id,assignment_id,purpose,filename,mime,bytes,digest,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      ).run(
        id,
        raw.requestId,
        fingerprint,
        context.orgId,
        context.classId,
        context.uploaderId,
        context.lessonId || null,
        context.assignmentId || null,
        context.purpose,
        file.name,
        file.mime,
        file.bytes.length,
        digest,
        stamp(),
        context.purpose === "submission" ? now() + limits.pendingMs : null,
      );
      for (
        let offset = 0, ordinal = 0;
        offset < file.bytes.length;
        offset += limits.chunkBytes, ordinal++
      )
        db.prepare(
          "INSERT INTO teaching_file_chunks(file_id,ordinal,data) VALUES(?,?,?)",
        ).run(
          id,
          ordinal,
          file.bytes.subarray(offset, offset + limits.chunkBytes),
        );
      recordAudit({
        actorId: context.uploaderId,
        action: "TEACHING_FILE_UPLOADED",
        target: id,
        requestId: raw.requestId,
        after: { bytes: file.bytes.length, purpose: context.purpose },
      });
      db.prepare(
        "INSERT INTO teaching_operations(request_id,actor_id,organization_id,class_id,action,fingerprint,result_json,created_at) VALUES(?,?,?,?,'file.upload',?,?,?)",
      ).run(
        raw.requestId,
        context.uploaderId,
        context.orgId,
        context.classId,
        fingerprint,
        JSON.stringify({ id }),
        stamp(),
      );
      return teachingFileView(get(id)!);
    },
    bytes(row: FileRow) {
      const chunks = db
        .prepare(
          "SELECT ordinal,data FROM teaching_file_chunks WHERE file_id=? ORDER BY ordinal",
        )
        .all(row.id) as FileRow[];
      if (
        !chunks.length ||
        chunks.some((chunk, i) => Number(chunk.ordinal) !== i)
      )
        fail("TEACHING_FILE_UNAVAILABLE", 503);
      const bytes = Buffer.concat(
        chunks.map((chunk) => Buffer.from(chunk.data)),
      );
      if (
        bytes.length !== Number(row.bytes) ||
        createHash("sha256").update(bytes).digest("hex") !== row.digest
      )
        fail("TEACHING_FILE_UNAVAILABLE", 503);
      return bytes;
    },
    finalize(
      rawIds: unknown,
      context: {
        userId: string;
        orgId: string;
        assignmentId: string;
        submissionId: string;
        revision: number;
      },
    ) {
      const selected = ids(rawIds ?? [], limits.filesPerTarget);
      if (!selected.length) return;
      const placeholders = selected.map(() => "?").join(",");
      const rows = db
        .prepare(`SELECT * FROM teaching_files WHERE id IN (${placeholders})`)
        .all(...selected) as FileRow[];
      if (rows.length !== selected.length) fail("TEACHING_FILE_FORBIDDEN", 403);
      for (const row of rows) {
        if (
          row.purpose !== "submission" ||
          row.uploader_id !== context.userId ||
          row.organization_id !== context.orgId ||
          row.assignment_id !== context.assignmentId ||
          row.submission_id ||
          Number(row.expires_at) <= now()
        )
          fail("TEACHING_FILE_FORBIDDEN", 403);
      }
      // Validation and binding share the caller's transaction: at most two RPCs
      // for three attachments, without weakening per-file owner/target checks.
      db.prepare(
        `UPDATE teaching_files SET submission_id=?,submission_revision=?,expires_at=NULL WHERE id IN (${placeholders})`,
      ).run(context.submissionId, context.revision, ...selected);
    },
    remove(row: FileRow, actorId: string) {
      if (row.submission_id) fail("TEACHING_FILE_IMMUTABLE", 409);
      db.prepare(
        "INSERT OR IGNORE INTO teaching_operations(request_id,actor_id,organization_id,class_id,action,fingerprint,result_json,created_at) VALUES(?,?,?,?,'file.upload',?,?,?)",
      ).run(
        row.request_id,
        row.uploader_id,
        row.organization_id,
        row.class_id,
        row.fingerprint,
        JSON.stringify({ id: row.id }),
        row.created_at,
      );
      db.prepare("DELETE FROM teaching_files WHERE id=?").run(row.id);
      recordAudit({
        actorId,
        action: "TEACHING_FILE_DELETED",
        target: row.id,
        after: { bytes: Number(row.bytes) },
      });
    },
  };
}
