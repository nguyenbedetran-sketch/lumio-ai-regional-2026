import type { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
import { requirePermission } from "./policy";
import {
  PlatformError,
  type AuditInput,
  type Membership,
  type User,
} from "./types";
import {
  parseTeacherProfile,
  parseTeacherSubmission,
  parseTeacherReview,
  parseTeacherListQuery,
  type TeacherApplication,
  type TeacherCredential,
  type TeacherSelfState,
  type TeacherStatus,
  type TeacherListQuery,
} from "../teachers/contracts";
type Row = Record<string, unknown>;
export function createTeacherStore({
  db,
  now,
  stamp,
  transaction,
  getUser,
  getMemberships,
  recordAudit,
}: {
  db: DatabaseSync;
  now: () => number;
  stamp: () => string;
  transaction: <T>(fn: () => T) => T;
  getUser: (id: string) => User | null;
  getMemberships: (id: string) => Membership[];
  recordAudit: (input: AuditInput) => void;
}) {
  function actor(userId: string, version: number) {
    const user = getUser(userId);
    if (!user || user.disabled || user.sessionVersion !== version)
      throw new PlatformError("SESSION_REVOKED", 401);
    return { user, memberships: getMemberships(user.id) };
  }
  function application(row: Row | undefined): TeacherApplication | null {
    if (!row) return null;
    const profile = parseTeacherProfile(JSON.parse(String(row.profile_json)));
    return {
      id: String(row.id),
      userId: String(row.user_id),
      applicantName: profile.applicantName,
      profile,
      status: row.status as TeacherStatus,
      revision: Number(row.revision),
      submittedAt: String(row.submitted_at),
      updatedAt: String(row.updated_at),
      reviewedAt: row.reviewed_at === null ? null : String(row.reviewed_at),
      reviewNote: row.review_note === null ? null : String(row.review_note),
    };
  }
  const byUser = (userId: string) =>
    db
      .prepare("SELECT * FROM teacher_applications WHERE user_id=?")
      .get(userId);
  const byId = (id: string) =>
    db.prepare("SELECT * FROM teacher_applications WHERE id=?").get(id);
  function state(userId: string): TeacherSelfState {
    const current = application(byUser(userId)),
      credential = db
        .prepare("SELECT * FROM teacher_credentials WHERE user_id=?")
        .get(userId);
    const result: TeacherCredential = {
      active: !!credential?.active && current?.status === "approved",
      basis: "manual-review-of-declaration",
      identityVerified: false,
      approvedAt: credential?.approved_at
        ? String(credential.approved_at)
        : null,
      revokedAt: credential?.revoked_at ? String(credential.revoked_at) : null,
    };
    return { application: current, credential: result };
  }
  function duplicate(requestId: string, actorId: string, fingerprint: string) {
    const previous = db
      .prepare(
        "SELECT * FROM teacher_application_operations WHERE request_id=?",
      )
      .get(requestId);
    if (!previous) return null;
    if (previous.actor_id !== actorId || previous.fingerprint !== fingerprint)
      throw new PlatformError("TEACHER_REQUEST_REUSED", 409);
    return String(previous.target_user_id);
  }
  function operation(
    requestId: string,
    actorId: string,
    targetUserId: string,
    id: string,
    action: string,
    fingerprint: string,
    revision: number,
  ) {
    db.prepare(
      "INSERT INTO teacher_application_operations(request_id,actor_id,target_user_id,application_id,action,fingerprint,result_revision,created_at) VALUES (?,?,?,?,?,?,?,?)",
    ).run(
      requestId,
      actorId,
      targetUserId,
      id,
      action,
      fingerprint,
      revision,
      stamp(),
    );
  }
  const fingerprint = (value: unknown) =>
    createHash("sha256").update(JSON.stringify(value)).digest("hex");
  return {
    readTeacherApplication(userId: string, version: number) {
      return transaction(() => {
        actor(userId, version);
        return state(userId);
      });
    },
    /** An app privilege only; never a system-admin grant or private-student access. */
    isApprovedTeacher(userId: string, version: number) {
      return transaction(() => {
        actor(userId, version);
        return state(userId).credential.active;
      });
    },
    submitTeacherApplication(userId: string, version: number, raw: unknown) {
      const input = parseTeacherSubmission(raw),
        hash = fingerprint({ action: "submit", input });
      return transaction(() => {
        actor(userId, version);
        const replay = duplicate(input.requestId, userId, hash);
        if (replay) return state(replay);
        const before = application(byUser(userId));
        if ((before?.revision || 0) !== input.expectedRevision)
          throw new PlatformError("TEACHER_CONFLICT", 409);
        if (before?.status === "approved")
          throw new PlatformError("TEACHER_ALREADY_APPROVED", 409);
        const daily = Number(
          db
            .prepare(
              "SELECT count(*) n FROM teacher_application_operations WHERE actor_id=? AND action='submit' AND created_at>=?",
            )
            .get(userId, new Date(now() - 86400000).toISOString())!.n,
        );
        if (daily >= 10) throw new PlatformError("TEACHER_RATE_LIMIT", 429);
        const id = before?.id || randomUUID(),
          revision = (before?.revision || 0) + 1,
          at = stamp();
        if (before)
          db.prepare(
            "UPDATE teacher_applications SET status='pending',revision=?,profile_json=?,submitted_at=?,updated_at=?,reviewed_at=NULL,reviewed_by=NULL,review_note=NULL WHERE id=?",
          ).run(revision, JSON.stringify(input.profile), at, at, id);
        else
          db.prepare(
            "INSERT INTO teacher_applications(id,user_id,status,revision,profile_json,submitted_at,updated_at) VALUES (?,?,'pending',?,?,?,?)",
          ).run(id, userId, revision, JSON.stringify(input.profile), at, at);
        db.prepare(
          "UPDATE teacher_credentials SET active=0 WHERE user_id=?",
        ).run(userId);
        recordAudit({
          actorId: userId,
          action: "TEACHER_APPLICATION_SUBMITTED",
          target: id,
          requestId: input.requestId,
          before: {
            status: before?.status || "none",
            revision: before?.revision || 0,
          },
          after: { status: "pending", revision },
        });
        operation(
          input.requestId,
          userId,
          userId,
          id,
          "submit",
          hash,
          revision,
        );
        return state(userId);
      });
    },
    listTeacherApplications(
      actorId: string,
      version: number,
      raw: TeacherListQuery = {},
    ) {
      const input = parseTeacherListQuery(raw);
      return transaction(() => {
        requirePermission(actor(actorId, version), "teachers.read");
        const where: string[] = [],
          values: (string | number)[] = [];
        if (input.status !== "all") {
          where.push("status=?");
          values.push(input.status);
        }
        if (input.q) {
          // Escape wildcard metacharacters: search is literal, never SQL syntax.
          where.push(
            "(json_extract(profile_json,'$.applicantName') LIKE ? ESCAPE '\\' OR json_extract(profile_json,'$.country') LIKE ? ESCAPE '\\' OR json_extract(profile_json,'$.provinceCity') LIKE ? ESCAPE '\\' OR json_extract(profile_json,'$.ward') LIKE ? ESCAPE '\\' OR json_extract(profile_json,'$.school') LIKE ? ESCAPE '\\' OR json_extract(profile_json,'$.subjects') LIKE ? ESCAPE '\\')",
          );
          const query = "%" + input.q.replace(/[\\%_]/g, "\\$&") + "%";
          values.push(query, query, query, query, query, query);
        }
        const clause = where.length ? " WHERE " + where.join(" AND ") : "",
          direction = input.sort === "oldest" ? "ASC" : "DESC";
        const total = Number(
          db
            .prepare("SELECT count(*) n FROM teacher_applications" + clause)
            .get(...values)!.n,
        );
        const items = db
          .prepare(
            "SELECT * FROM teacher_applications" +
              clause +
              ` ORDER BY submitted_at ${direction},id ${direction} LIMIT 30 OFFSET ?`,
          )
          .all(...values, input.offset)
          .map((row) => application(row)!);
        return { items, total, offset: input.offset, limit: 30 };
      });
    },
    reviewTeacherApplication(actorId: string, version: number, raw: unknown) {
      const input = parseTeacherReview(raw),
        hash = fingerprint({ action: "review", input });
      try {
        return transaction(() => {
          requirePermission(actor(actorId, version), "teachers.review");
          const replay = duplicate(input.requestId, actorId, hash);
          if (replay) return state(replay);
          const before = application(byId(input.applicationId));
          if (!before)
            throw new PlatformError("TEACHER_APPLICATION_NOT_FOUND", 404);
          if (before.userId === actorId)
            throw new PlatformError("TEACHER_SELF_REVIEW_FORBIDDEN", 403);
          if (before.revision !== input.expectedRevision)
            throw new PlatformError("TEACHER_CONFLICT", 409);
          if (
            (input.action === "revoke" && before.status !== "approved") ||
            (input.action !== "revoke" && before.status !== "pending")
          )
            throw new PlatformError("TEACHER_INVALID_TRANSITION", 409);
          const target = getUser(before.userId);
          if (input.action === "approve" && (!target || target.disabled))
            throw new PlatformError("TEACHER_APPLICANT_UNAVAILABLE", 409);
          const status: TeacherStatus =
            input.action === "approve"
              ? "approved"
              : input.action === "reject"
                ? "rejected"
                : "revoked";
          const revision = before.revision + 1,
            at = stamp();
          db.prepare(
            "UPDATE teacher_applications SET status=?,revision=?,updated_at=?,reviewed_at=?,reviewed_by=?,review_note=? WHERE id=?",
          ).run(status, revision, at, at, actorId, input.note, before.id);
          if (status === "approved")
            db.prepare(
              "INSERT INTO teacher_credentials(user_id,application_id,active,approved_at,revoked_at,reviewed_by) VALUES (?,?,1,?,NULL,?) ON CONFLICT(user_id) DO UPDATE SET application_id=excluded.application_id,active=1,approved_at=excluded.approved_at,revoked_at=NULL,reviewed_by=excluded.reviewed_by",
            ).run(before.userId, before.id, at, actorId);
          else
            db.prepare(
              "UPDATE teacher_credentials SET active=0,revoked_at=?,reviewed_by=? WHERE user_id=?",
            ).run(at, actorId, before.userId);
          recordAudit({
            actorId,
            action:
              status === "approved"
                ? "TEACHER_APPLICATION_APPROVED"
                : status === "rejected"
                  ? "TEACHER_APPLICATION_REJECTED"
                  : "TEACHER_CREDENTIAL_REVOKED",
            target: before.id,
            requestId: input.requestId,
            before: { status: before.status, revision: before.revision },
            after: {
              status,
              revision,
              credentialActive: status === "approved",
            },
          });
          operation(
            input.requestId,
            actorId,
            before.userId,
            before.id,
            input.action,
            hash,
            revision,
          );
          return state(before.userId);
        });
      } catch (error) {
        // Denied transitions are auditable without retaining declarations or reviewer prose.
        if (error instanceof PlatformError && getUser(actorId)) {
          try {
            recordAudit({
              actorId,
              action: "TEACHER_REVIEW_DENIED",
              target: input.applicationId,
              result: "denied",
              requestId: input.requestId,
              after: { code: error.code },
            });
          } catch {}
        }
        throw error;
      }
    },
  };
}
