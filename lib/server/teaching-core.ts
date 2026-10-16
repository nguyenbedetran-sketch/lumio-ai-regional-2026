import type { DatabaseSync } from "node:sqlite";
import { createHash, createHmac, randomUUID } from "node:crypto";
import type { User, AuditInput, OrganizationRole } from "./types";
import type {
  TeachingRole,
  TeachingState,
  TeachingMaterial,
  TeachingQuestion,
  TeachingLesson,
  TeachingReference,
  AssignmentQuestion,
  TeachingGenerationContext,
  TeachingMutationResult,
  TeachingAnalytics,
  TeachingPreferences,
  TeachingGradeHistoryResponse,
  TeachingGradeHistoryEvent,
} from "../teaching/contracts";
import { teachingLimits as limits } from "../teaching/contracts";
import {
  obj,
  only,
  str,
  identifier,
  integer,
  number,
  bool,
  ids,
  textList,
  iso,
  mutation,
  teachingError as fail,
} from "../teaching/validation";
import { verifySourceEvidence } from "./source-evidence";
import {
  assertTeachingReviewable,
  rebuildTeachingReferences,
} from "../teaching/content-qa";
import { AIError } from "../ai/contracts";
type Row = Record<string, any>;
type Scope = {
  user: User;
  org: Row;
  role: OrganizationRole;
  admin: boolean;
  staff: boolean;
};
const hash = (value: unknown) =>
  createHash("sha256")
    .update(typeof value === "string" ? value : JSON.stringify(value))
    .digest("hex");
const roleAlias = (role: string): TeachingRole =>
  role === "OWNER" || role === "SCHOOL_ADMIN"
    ? "ORGANIZATION_ADMIN"
    : role === "TEACHER"
      ? "TEACHER"
      : "STUDENT";
export function createTeachingStore({
  db,
  now,
  stamp,
  transaction,
  getUser,
  recordAudit,
}: {
  db: DatabaseSync;
  now: () => number;
  stamp: () => string;
  transaction: <T>(fn: () => T) => T;
  getUser: (id: string) => User | null;
  recordAudit: (input: AuditInput) => void;
}) {
  const one = (sql: string, ...args: (string | number | null)[]) =>
    db.prepare(sql).get(...args) as Row | undefined;
  const all = (sql: string, ...args: (string | number | null)[]) =>
    db.prepare(sql).all(...args) as Row[];
  const run = (sql: string, ...args: (string | number | null)[]) =>
    db.prepare(sql).run(...args);
  function actor(id: string, version: number) {
    const u = getUser(id);
    if (!u || u.disabled || u.sessionVersion !== version)
      fail("SESSION_REVOKED", 401);
    return u;
  }
  const approved = (id: string) =>
    !!one(
      "SELECT 1 FROM teacher_credentials c JOIN teacher_applications a ON a.id=c.application_id WHERE c.user_id=? AND c.active=1 AND a.status='approved'",
      id,
    );
  const canCreate = (u: User) => u.role === "SUPER_ADMIN" || approved(u.id);
  function scope(u: User, orgId: string): Scope {
    const o = one(
        "SELECT o.*,t.revision,t.settings_json FROM organizations o JOIN teaching_organizations t ON t.organization_id=o.id WHERE o.id=?",
        orgId,
      ),
      m = one(
        "SELECT role FROM memberships WHERE user_id=? AND organization_id=?",
        u.id,
        orgId,
      );
    if (
      !o ||
      !m ||
      !["OWNER", "SCHOOL_ADMIN", "TEACHER", "STUDENT"].includes(m.role)
    )
      fail("TEACHING_FORBIDDEN", 403);
    const staff = m.role !== "STUDENT";
    if (staff && !canCreate(u)) fail("TEACHER_APPROVAL_REQUIRED", 403);
    return {
      user: u,
      org: o,
      role: m.role,
      admin: m.role === "OWNER" || m.role === "SCHOOL_ADMIN",
      staff,
    };
  }
  function requireStaff(s: Scope, admin = false) {
    if (!s.staff || (admin && !s.admin)) fail("TEACHING_FORBIDDEN", 403);
  }
  function classFor(s: Scope, id: string, write = false) {
    const c = one(
      "SELECT * FROM teaching_classes WHERE id=? AND organization_id=?",
      id,
      s.org.id,
    );
    if (!c) fail("TEACHING_NOT_FOUND", 404);
    if (!s.admin) {
      const allowed = s.staff
        ? one(
            "SELECT 1 FROM teaching_class_teachers WHERE class_id=? AND user_id=?",
            id,
            s.user.id,
          )
        : one(
            "SELECT 1 FROM teaching_enrollments WHERE class_id=? AND user_id=? AND active=1",
            id,
            s.user.id,
          );
      if (!allowed) fail("TEACHING_FORBIDDEN", 403);
    }
    if (write && c.archived) fail("TEACHING_CLASS_ARCHIVED", 409);
    return c;
  }
  function contentFor(s: Scope, id: string, kind?: string) {
    const row = one(
      "SELECT * FROM teaching_content WHERE id=? AND organization_id=?",
      id,
      s.org.id,
    );
    if (!row || (kind && row.kind !== kind) || row.status === "archived")
      fail("TEACHING_NOT_FOUND", 404);
    requireStaff(s);
    if (row.class_id) classFor(s, row.class_id);
    else if (!s.admin && row.created_by !== s.user.id)
      fail("TEACHING_FORBIDDEN", 403);
    return row;
  }
  const contentView = (r: Row) => ({
    ...JSON.parse(r.data_json),
    id: r.id,
    orgId: r.organization_id,
    classId: r.class_id,
    status: r.status,
    revision: Number(r.revision),
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });
  function cas(row: Row | undefined, expected: unknown) {
    if (!row) fail("TEACHING_NOT_FOUND", 404);
    if (Number(row.revision) !== integer(expected, 0))
      fail("TEACHING_CONFLICT", 409);
  }
  function currentStudents(classId: string) {
    return all(
      "SELECT e.*,u.name FROM teaching_enrollments e JOIN users u ON u.id=e.user_id JOIN teaching_classes c ON c.id=e.class_id JOIN memberships m ON m.user_id=e.user_id AND m.organization_id=c.organization_id WHERE e.class_id=? AND e.active=1 AND u.disabled=0 AND m.role='STUDENT'",
      classId,
    );
  }
  function checkRecipients(classId: string, userIds: string[]) {
    const allowed = new Set(currentStudents(classId).map((r) => r.user_id));
    if (userIds.some((id) => !allowed.has(id)))
      fail("TEACHING_INVALID_RECIPIENT", 403);
  }
  function references(s: Scope, raw: unknown): TeachingReference[] {
    if (!Array.isArray(raw) || raw.length > 12) fail("INVALID_TEACHING_DATA");
    const materials = new Map<string, TeachingMaterial>();
    for (const value of raw) {
      const ref = obj(value);
      only(ref, [
        "materialId",
        "quote",
        "paragraph",
        "materialRevision",
        "page",
        "slide",
        "heading",
        "seconds",
      ]);
      const m = contentView(
        contentFor(s, identifier(ref.materialId), "material"),
      ) as TeachingMaterial;
      if (
        ref.materialRevision !== undefined &&
        integer(ref.materialRevision, 1) !== m.revision
      )
        fail("TEACHING_SOURCE_CHANGED", 409);
      materials.set(m.id, m);
    }
    const rebuilt = rebuildTeachingReferences(raw, [...materials.values()]);
    if (rebuilt.rejected) fail("TEACHING_REFERENCE_MISMATCH", 409);
    return rebuilt.references.map((ref) => ({
      ...ref,
      materialRevision: materials.get(ref.materialId)!.revision,
    }));
  }
  function materialList(s: Scope, sourceIds: string[]) {
    return sourceIds.map(
      (id) => contentView(contentFor(s, id, "material")) as TeachingMaterial,
    );
  }
  function preferences(s: Scope): TeachingPreferences {
    const r = one(
      "SELECT data_json,revision FROM teaching_preferences WHERE organization_id=? AND user_id=?",
      s.org.id,
      s.user.id,
    );
    return r
      ? { ...JSON.parse(r.data_json), revision: Number(r.revision) }
      : {
          subjects: [],
          grades: [],
          displayName: s.user.name,
          aiLanguage: "vi",
          defaultDifficulty: "medium",
          aiEnabled: true,
          inAppNotifications: true,
          revision: 0,
        };
  }
  function assertBudgets(orgId: string) {
    const bytes = (sql: string) => Number(one(sql, orgId)!.n);
    const content = bytes(
      "SELECT coalesce(sum(length(CAST(data_json AS BLOB))),0) n FROM teaching_content WHERE organization_id=? AND status!='archived'",
    );
    const communication =
      bytes(
        "SELECT coalesce(sum(length(CAST(title||body AS BLOB))),0) n FROM teaching_announcements WHERE organization_id=?",
      ) +
      bytes(
        "SELECT coalesce(sum(length(CAST(data_json AS BLOB))),0) n FROM teaching_events WHERE organization_id=?",
      );
    const assignments = bytes(
      "SELECT coalesce(sum(length(CAST(data_json AS BLOB))),0) n FROM teaching_assignments WHERE organization_id=?",
    );
    const submissions = bytes(
      "SELECT coalesce(sum(length(CAST(s.answers_json AS BLOB))+length(CAST(coalesce(s.grades_json,'') AS BLOB))+length(CAST(coalesce(s.feedback,'') AS BLOB))),0) n FROM teaching_submissions s JOIN teaching_assignments a ON a.id=s.assignment_id WHERE a.organization_id=?",
    );
    const history = bytes(
      "SELECT coalesce(sum(length(CAST(coalesce(e.grades_json,'')||coalesce(e.feedback,'')||coalesce(e.reason,'') AS BLOB))),0) n FROM teaching_grade_events e JOIN teaching_submissions s ON s.id=e.submission_id JOIN teaching_assignments a ON a.id=s.assignment_id WHERE a.organization_id=?",
    );
    const windows = bytes(
      "SELECT coalesce(sum(length(CAST(coalesce(w.reason,'') AS BLOB))),0) n FROM teaching_assessment_windows w JOIN teaching_assignments a ON a.id=w.assignment_id WHERE a.organization_id=?",
    );
    if (
      content > limits.activeContentBytesPerOrg ||
      communication > limits.communicationBytesPerOrg ||
      history > limits.gradeHistoryBytesPerOrg ||
      content + communication + assignments + submissions + history + windows >
        limits.workspaceBytesPerOrg
    )
      fail("TEACHING_STORAGE_LIMIT", 413);
  }
  function parseDraft(s: Scope, kind: string, raw: unknown, previous?: Row) {
    const d = obj(raw),
      classId = d.classId === null ? null : identifier(d.classId);
    if (classId) classFor(s, classId, true);
    if (kind === "material") {
      only(d, ["classId", "title", "kind", "content", "url", "sourceEvidence"]);
      const k = str(d.kind, 20);
      if (
        ![
          "text",
          "link",
          "pdf",
          "docx",
          "pptx",
          "image",
          "audio",
          "video",
        ].includes(k)
      )
        fail("INVALID_TEACHING_DATA");
      const data: any = {
        classId,
        title: str(d.title, 200),
        kind: k,
        content: str(d.content, limits.sourceCharacters, 0),
      };
      if (d.url !== undefined && d.url !== "") {
        let url: URL;
        try {
          url = new URL(str(d.url, 4000));
        } catch {
          fail("INVALID_TEACHING_DATA");
        }
        if (
          !["https:", "http:"].includes(url.protocol) ||
          url.username ||
          url.password
        )
          fail("INVALID_TEACHING_DATA");
        data.url = url.href;
      }
      const stored = previous ? JSON.parse(previous.data_json) : undefined;
      // The proof was verified when saved. An authorized colleague may retain that
      // exact server-owned proof while editing metadata, never attach it to new text.
      const preserveEvidence =
        stored?.sourceEvidence &&
        stored.content === data.content &&
        (d.sourceEvidence === undefined ||
          hash(d.sourceEvidence) === hash(stored.sourceEvidence));
      if (preserveEvidence) data.sourceEvidence = stored.sourceEvidence;
      else if (d.sourceEvidence !== undefined)
        try {
          data.sourceEvidence = verifySourceEvidence(
            d.sourceEvidence,
            data.content,
            s.user.id,
          );
        } catch (error) {
          if (error instanceof AIError) fail(error.code, error.status);
          throw error;
        }
      return data;
    }
    if (kind === "lesson") {
      only(d, [
        "classId",
        "title",
        "topic",
        "grade",
        "objectives",
        "sections",
        "sourceIds",
      ]);
      const sourceIds = ids(d.sourceIds, 10);
      materialList(s, sourceIds);
      if (!Array.isArray(d.sections) || d.sections.length > 20)
        fail("INVALID_TEACHING_DATA");
      const sections = d.sections.map((v) => {
        const section = obj(v);
        only(section, ["title", "body", "references"]);
        return {
          title: str(section.title, 200),
          body: str(section.body, 10000, 0),
          references: references(s, section.references),
        };
      });
      if (sections.reduce((n, v) => n + v.body.length, 0) > 100000)
        fail("TEACHING_LIMIT", 413);
      return {
        classId,
        title: str(d.title, 200),
        topic: str(d.topic, 100),
        grade: str(d.grade, 80),
        objectives: textList(d.objectives, 12, 500),
        sections,
        sourceIds,
      };
    }
    only(d, [
      "classId",
      "prompt",
      "kind",
      "choices",
      "correctIndex",
      "modelAnswer",
      "explanation",
      "rubric",
      "maxPoints",
      "topic",
      "difficulty",
      "references",
    ]);
    const k = str(d.kind, 20),
      difficulty = str(d.difficulty, 20);
    if (
      !["mcq", "short", "essay"].includes(k) ||
      !["basic", "medium", "advanced"].includes(difficulty)
    )
      fail("INVALID_TEACHING_DATA");
    const result: any = {
      classId,
      prompt: str(d.prompt, 6000),
      kind: k,
      choices: textList(d.choices, 6, 1500),
      maxPoints: number(d.maxPoints, 0.01, 100),
      topic: str(d.topic, 100),
      difficulty,
      references: references(s, d.references),
    };
    if (d.correctIndex !== undefined)
      result.correctIndex = integer(d.correctIndex, 0, 5);
    if (d.modelAnswer !== undefined)
      result.modelAnswer = str(d.modelAnswer, 6000, 0);
    if (d.explanation !== undefined)
      result.explanation = str(d.explanation, 6000, 0);
    if (d.rubric !== undefined) {
      if (!Array.isArray(d.rubric) || d.rubric.length > 10)
        fail("INVALID_TEACHING_DATA");
      result.rubric = d.rubric.map((v) => {
        const r = obj(v);
        only(r, ["label", "points"]);
        return {
          label: str(r.label, 300),
          points: number(r.points, 0.01, 100),
        };
      });
    }
    return result;
  }
  function reviewContent(s: Scope, row: Row) {
    const data = JSON.parse(row.data_json);
    if (row.kind === "material") {
      if (!data.content.trim()) fail("TEACHING_CONTENT_BLOCKED", 409);
      return;
    }
    const refs =
      row.kind === "lesson"
        ? data.sections.flatMap((v: any) => v.references)
        : data.references;
    references(s, refs);
    const sourceIds =
      row.kind === "lesson"
        ? [
            ...new Set([
              ...data.sourceIds,
              ...refs.map((r: any) => r.materialId),
            ]),
          ]
        : [...new Set(refs.map((r: any) => r.materialId))];
    const materials = materialList(s, sourceIds as string[]);
    assertTeachingReviewable(
      data,
      materials,
      row.kind as "lesson" | "question",
    );
    if (row.kind === "question") {
      if (
        data.kind === "mcq" &&
        (!Number.isInteger(data.correctIndex) ||
          data.choices.length < 2 ||
          data.correctIndex >= data.choices.length ||
          new Set(data.choices.map((v: string) => v.trim().toLowerCase()))
            .size !== data.choices.length)
      )
        fail("TEACHING_CONTENT_BLOCKED", 409);
      if (
        data.kind !== "mcq" &&
        (!data.modelAnswer?.trim() ||
          !data.rubric?.length ||
          Math.abs(
            data.rubric.reduce((n: number, r: any) => n + r.points, 0) -
              data.maxPoints,
          ) > 0.001)
      )
        fail("TEACHING_CONTENT_BLOCKED", 409);
    }
  }
  function assignmentFor(s: Scope, id: string, staff = false) {
    const a = one(
      "SELECT * FROM teaching_assignments WHERE id=? AND organization_id=?",
      id,
      s.org.id,
    );
    if (!a) fail("TEACHING_NOT_FOUND", 404);
    if (staff) requireStaff(s);
    classFor(s, a.class_id);
    if (
      !s.staff &&
      (!["issued", "closed"].includes(a.status) ||
        !one(
          "SELECT 1 FROM teaching_assignment_targets WHERE assignment_id=? AND user_id=?",
          id,
          s.user.id,
        ))
    )
      fail("TEACHING_FORBIDDEN", 403);
    return a;
  }
  function assessmentWindow(a: Row) {
    const w = one(
      "SELECT * FROM teaching_assessment_windows WHERE assignment_id=?",
      a.id,
    );
    if (!w) fail("TEACHING_HISTORY_INCONSISTENT", 409);
    return w;
  }
  function windowTimestamp(raw: unknown) {
    const value = str(raw, 40),
      m =
        /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.exec(
          value,
        );
    if (
      !m ||
      !Number.isFinite(Date.parse(value)) ||
      Number(m[2]) < 1 ||
      Number(m[2]) > 12 ||
      Number(m[3]) < 1 ||
      Number(m[3]) >
        new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).getUTCDate() ||
      Number(m[4]) > 23 ||
      Number(m[5]) > 59 ||
      Number(m[6] || 0) > 59 ||
      /[+-]14:(?!00)/.test(value)
    )
      fail("TEACHING_INVALID_WINDOW");
    return new Date(value).toISOString();
  }
  function parseWindow(d: Row, dueAt: string, required = false) {
    const availableFrom =
        d.availableFrom == null ? null : windowTimestamp(d.availableFrom),
      availableUntil =
        d.availableUntil == null ? null : windowTimestamp(d.availableUntil),
      due = Date.parse(dueAt);
    if (
      (required && (!availableFrom || !availableUntil)) ||
      (availableFrom &&
        (Date.parse(availableFrom) > due ||
          Date.parse(availableFrom) < now() - 366 * 86400000)) ||
      (availableUntil &&
        (Date.parse(availableUntil) < due ||
          Date.parse(availableUntil) <= now() ||
          Date.parse(availableUntil) > now() + 366 * 86400000)) ||
      (availableFrom &&
        availableUntil &&
        Date.parse(availableFrom) >= Date.parse(availableUntil))
    )
      fail("TEACHING_INVALID_WINDOW");
    return { availableFrom, availableUntil };
  }
  function submissionAvailability(s: Scope, a: Row, w: Row, existing?: Row) {
    if (classFor(s, a.class_id).archived) return "class_archived" as const;
    if (a.status !== "issued") return "closed" as const;
    if (w.available_from && now() < Date.parse(w.available_from))
      return "not_open" as const;
    if (w.available_until && now() >= Date.parse(w.available_until))
      return "closed" as const;
    if (existing && existing.status !== "submitted") return "graded" as const;
    if (
      Date.parse(JSON.parse(a.data_json).dueAt) < now() &&
      !JSON.parse(s.org.settings_json).allowLateSubmissions
    )
      return "due_passed" as const;
    return "available" as const;
  }
  const assignmentData = (a: Row) => {
    const w = assessmentWindow(a),
      d = JSON.parse(a.data_json);
    return {
      ...d,
      id: a.id,
      orgId: a.organization_id,
      classId: a.class_id,
      status: a.status,
      revision: Number(a.revision),
      createdBy: a.created_by,
      createdAt: a.created_at,
      issuedAt: a.issued_at,
      rootAssignmentId: w.root_assignment_id,
      attemptNo: Number(w.attempt_no),
      practiceRetake: Number(w.attempt_no) > 1,
      availableFrom: w.available_from,
      availableUntil: w.available_until,
      questionCount: d.questions.length,
    };
  };
  function parseAssignment(s: Scope, raw: unknown) {
    const d = obj(raw);
    only(d, [
      "classId",
      "title",
      "instructions",
      "questionIds",
      "target",
      "dueAt",
      "availableFrom",
      "availableUntil",
    ]);
    const classId = identifier(d.classId);
    classFor(s, classId, true);
    const questionIds = ids(d.questionIds, limits.questionsPerAssignment);
    if (!questionIds.length) fail("INVALID_TEACHING_DATA");
    const questions = questionIds.map((id) => {
      const row = contentFor(s, id, "question");
      if (row.class_id && row.class_id !== classId)
        fail("TEACHING_FORBIDDEN", 403);
      if (row.status !== "reviewed") fail("TEACHING_REVIEW_REQUIRED", 409);
      reviewContent(s, row);
      const q = contentView(row) as TeachingQuestion;
      const {
        orgId,
        classId: unused,
        createdBy,
        createdAt,
        updatedAt,
        status,
        ...snapshot
      } = q;
      return snapshot;
    });
    if (
      new Set(
        questions.map((q) =>
          q.prompt
            .normalize("NFC")
            .trim()
            .replace(/\s+/g, " ")
            .toLocaleLowerCase("vi"),
        ),
      ).size !== questions.length
    )
      fail("TEACHING_CONTENT_BLOCKED", 422);
    const target = obj(d.target);
    only(target, ["kind", "ids"]);
    const kind = str(target.kind, 20),
      targetIds = ids(target.ids, limits.recipientsPerAssignment);
    if (
      !["class", "groups", "students"].includes(kind) ||
      (kind === "class" && targetIds.length) ||
      (kind !== "class" && !targetIds.length)
    )
      fail("INVALID_TEACHING_DATA");
    if (kind === "groups")
      for (const id of targetIds) {
        if (
          !one(
            "SELECT 1 FROM teaching_groups WHERE id=? AND class_id=?",
            id,
            classId,
          )
        )
          fail("TEACHING_FORBIDDEN", 403);
      }
    if (kind === "students") checkRecipients(classId, targetIds);
    const dueAt = iso(d.dueAt);
    if (
      Date.parse(dueAt) <= now() ||
      Date.parse(dueAt) > now() + 366 * 86400000
    )
      fail("TEACHING_INVALID_DUE_DATE");
    return {
      classId,
      title: str(d.title, 200),
      instructions: str(d.instructions, 10000, 0),
      questionIds,
      questions,
      target: { kind, ids: targetIds },
      dueAt,
      ...parseWindow(d, dueAt),
      maxPoints: questions.reduce((n, q) => n + q.maxPoints, 0),
    };
  }
  function submissionView(r: Row, staff: boolean) {
    const result: any = {
      id: r.id,
      orgId: r.organization_id,
      assignmentId: r.assignment_id,
      classId: r.class_id,
      studentId: r.student_id,
      studentName: r.student_name,
      answers: JSON.parse(r.answers_json),
      submittedAt: r.submitted_at,
      late: !!r.late,
      status: !staff && r.status !== "published" ? "submitted" : r.status,
      revision: Number(r.revision),
    };
    if (staff || r.status === "published")
      Object.assign(result, {
        autoScore: Number(r.auto_score),
        grades: r.grades_json ? JSON.parse(r.grades_json) : undefined,
        score: r.score === null ? undefined : Number(r.score),
        feedback: r.feedback || "",
        confirmedAt: r.confirmed_at,
        publishedAt: r.published_at,
      });
    return result;
  }
  function read(
    u: User,
    orgId?: string,
    query: { classId?: string; q?: string } = {},
  ): TeachingState {
    const q = query.q === undefined ? "" : str(query.q, 100, 0),
      organizations = all(
        "SELECT o.*,t.revision,m.role FROM organizations o JOIN teaching_organizations t ON t.organization_id=o.id JOIN memberships m ON m.organization_id=o.id WHERE m.user_id=? ORDER BY o.created_at,o.id",
        u.id,
      )
        .filter((r) => r.role === "STUDENT" || canCreate(u))
        .filter((r) =>
          ["OWNER", "SCHOOL_ADMIN", "TEACHER", "STUDENT"].includes(r.role),
        )
        .map((r) => ({
          id: r.id,
          name: r.name,
          role: roleAlias(r.role),
          revision: Number(r.revision),
          createdAt: r.created_at,
        }));
    const state: TeachingState = {
      version: 1,
      serverTime: stamp(),
      actor: {
        userId: u.id,
        name: u.name,
        accountKey: u.storageKey,
        systemRole: u.role,
        approvedTeacher: approved(u.id),
        canCreateOrganization: canCreate(u),
      },
      organizations,
      organization: null,
      role: null,
      permissions: { manageOrg: false, teach: false, learn: false },
      classes: [],
      members: [],
      enrollments: [],
      groups: [],
      invites: [],
      materials: [],
      lessons: [],
      questions: [],
      assignments: [],
      submissions: [],
      announcements: [],
      events: [],
      settings: null,
      preferences: null,
      dashboard: {
        classes: 0,
        students: 0,
        materials: 0,
        lessons: 0,
        questions: 0,
        assignments: 0,
        awaitingGrading: 0,
        dueSoon: 0,
        publishedAssessments: 0,
        averagePercent: null,
      },
      analytics: [],
    };
    if (!orgId) return state;
    const s = scope(u, orgId);
    if (s.staff) state.preferences = preferences(s);
    state.organization = organizations.find((o) => o.id === orgId) || null;
    state.role = roleAlias(s.role);
    state.permissions = { manageOrg: s.admin, teach: s.staff, learn: !s.staff };
    state.settings = {
      ...JSON.parse(s.org.settings_json),
      name: s.org.name,
      revision: Number(s.org.revision),
    };
    const classes = all(
      "SELECT * FROM teaching_classes WHERE organization_id=? ORDER BY created_at,id",
      orgId,
    ).filter(
      (c) =>
        s.admin ||
        (s.staff
          ? !!one(
              "SELECT 1 FROM teaching_class_teachers WHERE class_id=? AND user_id=?",
              c.id,
              u.id,
            )
          : !!one(
              "SELECT 1 FROM teaching_enrollments WHERE class_id=? AND user_id=? AND active=1",
              c.id,
              u.id,
            )),
    );
    if (query.classId) {
      identifier(query.classId);
      classFor(s, query.classId);
    }
    const chosen = classes.filter(
        (c) => !query.classId || c.id === query.classId,
      ),
      classIds = new Set(chosen.map((c) => c.id));
    state.classes = chosen.map((c) => ({
      id: c.id,
      orgId,
      name: c.name,
      subject: c.subject,
      grade: c.grade,
      description: c.description,
      archived: !!c.archived,
      revision: Number(c.revision),
      createdAt: c.created_at,
      teacherIds: all(
        "SELECT user_id FROM teaching_class_teachers WHERE class_id=? ORDER BY user_id",
        c.id,
      ).map((r) => r.user_id),
    }));
    const enrollments = all(
      "SELECT e.*,u.name FROM teaching_enrollments e JOIN teaching_classes c ON c.id=e.class_id JOIN users u ON u.id=e.user_id WHERE c.organization_id=? ORDER BY e.joined_at,e.id",
      orgId,
    ).filter(
      (r) => classIds.has(r.class_id) && (s.staff || r.user_id === u.id),
    );
    state.enrollments = enrollments.map((r) => ({
      id: r.id,
      classId: r.class_id,
      userId: r.user_id,
      name: r.name,
      active: !!r.active,
      revision: Number(r.revision),
      joinedAt: r.joined_at,
    }));
    const visibleStudentIds = new Set(enrollments.map((r) => r.user_id));
    state.members = all(
      "SELECT m.user_id,m.role,u.name FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.organization_id=? ORDER BY u.name,m.user_id",
      orgId,
    )
      .filter((r) =>
        s.staff
          ? r.role !== "STUDENT" || visibleStudentIds.has(r.user_id)
          : r.user_id === u.id,
      )
      .map((r) => ({
        userId: r.user_id,
        name: r.name,
        role: r.role,
        approvedTeacher: approved(r.user_id),
      }));
    state.groups = all(
      "SELECT g.* FROM teaching_groups g JOIN teaching_classes c ON c.id=g.class_id WHERE c.organization_id=? ORDER BY g.id",
      orgId,
    )
      .filter((r) => classIds.has(r.class_id))
      .map((r) => ({
        id: r.id,
        classId: r.class_id,
        name: r.name,
        revision: Number(r.revision),
        memberIds: all(
          "SELECT user_id FROM teaching_group_members WHERE group_id=? ORDER BY user_id",
          r.id,
        ).map((m) => m.user_id),
      }))
      .filter((g) => s.staff || g.memberIds.includes(u.id))
      .map((g) => (s.staff ? g : { ...g, memberIds: [u.id] }));
    if (s.staff)
      state.invites = all(
        "SELECT i.* FROM teaching_invites i JOIN teaching_classes c ON c.id=i.class_id WHERE c.organization_id=? ORDER BY i.id",
        orgId,
      )
        .filter((r) => classIds.has(r.class_id))
        .map((r) => ({
          id: r.id,
          classId: r.class_id,
          expiresAt: new Date(Number(r.expires_at)).toISOString(),
          maxUses: Number(r.max_uses),
          uses: Number(r.uses),
          active: !!r.active && Number(r.expires_at) > now(),
          revision: Number(r.revision),
        }));
    const like = "%" + q.replace(/[\\%_]/g, "\\$&") + "%";
    const content = all(
      "SELECT * FROM teaching_content WHERE organization_id=? AND status!='archived' AND (?='' OR data_json LIKE ? ESCAPE '\\') ORDER BY created_at,id",
      orgId,
      q,
      like,
    ).filter(
      (r) =>
        (r.class_id
          ? classIds.has(r.class_id)
          : s.admin ||
            (s.staff && r.created_by === u.id) ||
            (!s.staff && r.status === "published")) &&
        (s.staff || (r.kind !== "question" && r.status === "published")),
    );
    state.materials = content
      .filter((r) => r.kind === "material")
      .map(contentView)
      .map((m) => {
        if (!s.staff) delete m.sourceEvidence;
        return m;
      });
    state.lessons = content.filter((r) => r.kind === "lesson").map(contentView);
    if (s.staff)
      state.questions = content
        .filter((r) => r.kind === "question")
        .map(contentView);
    const assignments = all(
      "SELECT * FROM teaching_assignments WHERE organization_id=? ORDER BY created_at,id",
      orgId,
    ).filter(
      (a) =>
        classIds.has(a.class_id) &&
        (s.staff ||
          (["issued", "closed"].includes(a.status) &&
            !!one(
              "SELECT 1 FROM teaching_assignment_targets WHERE assignment_id=? AND user_id=?",
              a.id,
              u.id,
            ))),
    );
    const assignmentIds = new Set(assignments.map((a) => a.id));
    const submissions = all(
      "SELECT s.*,a.organization_id,a.class_id,u.name student_name FROM teaching_submissions s JOIN teaching_assignments a ON a.id=s.assignment_id JOIN users u ON u.id=s.student_id WHERE a.organization_id=? ORDER BY s.submitted_at,s.id",
      orgId,
    ).filter(
      (r) =>
        assignmentIds.has(r.assignment_id) &&
        (s.staff || r.student_id === u.id),
    );
    state.submissions = submissions.map((r) => submissionView(r, s.staff));
    state.assignments = assignments.map((a) => {
      const data = assignmentData(a);
      if (s.staff) {
        data.recipientIds = all(
          "SELECT user_id FROM teaching_assignment_targets WHERE assignment_id=? ORDER BY user_id",
          a.id,
        ).map((r) => r.user_id);
      } else {
        data.target = { kind: data.target.kind, ids: [] };
        const own = submissions.find(
            (r) => r.assignment_id === a.id && r.student_id === u.id,
          ),
          w = assessmentWindow(a);
        data.availability = submissionAvailability(s, a, w, own);
        data.canSubmit = data.availability === "available";
        const published = submissions.some(
          (r) =>
            r.assignment_id === a.id &&
            r.student_id === u.id &&
            r.status === "published",
        );
        if (!published)
          data.questions = data.questions.map(
            (question: AssignmentQuestion) => ({
              id: question.id,
              revision: question.revision,
              prompt: question.prompt,
              kind: question.kind,
              choices: question.choices,
              maxPoints: question.maxPoints,
              topic: question.topic,
              difficulty: question.difficulty,
            }),
          );
        if (w.available_from && now() < Date.parse(w.available_from)) {
          data.questions = [];
          data.questionIds = [];
          data.instructions = "";
        }
      }
      return data;
    });
    state.announcements = all(
      "SELECT * FROM teaching_announcements WHERE organization_id=? ORDER BY created_at,id",
      orgId,
    )
      .filter(
        (r) =>
          (!r.class_id || classIds.has(r.class_id)) &&
          (s.staff || r.status === "published"),
      )
      .map((r) => ({
        id: r.id,
        orgId,
        classId: r.class_id,
        title: r.title,
        body: r.body,
        status: r.status,
        revision: Number(r.revision),
        createdBy: r.created_by,
        createdAt: r.created_at,
      }));
    state.events = all(
      "SELECT * FROM teaching_events WHERE organization_id=? ORDER BY id",
      orgId,
    )
      .filter((r) => classIds.has(r.class_id))
      .map((r) => ({
        ...JSON.parse(r.data_json),
        id: r.id,
        orgId,
        classId: r.class_id,
        revision: Number(r.revision),
      }));
    const publishedByRoot = new Map<string, Row>();
    for (const r of submissions.filter((r) => r.status === "published")) {
      const a = assignments.find((a) => a.id === r.assignment_id)!,
        w = assessmentWindow(a),
        key = w.root_assignment_id + ":" + r.student_id,
        old = publishedByRoot.get(key);
      if (
        !old ||
        Number(
          assessmentWindow(assignments.find((a) => a.id === old.assignment_id)!)
            .attempt_no,
        ) < Number(w.attempt_no)
      )
        publishedByRoot.set(key, r);
    }
    const published = [...publishedByRoot.values()],
      evidenceIds = new Set(published.map((r) => r.id)),
      byStudent = new Map<string, Row[]>();
    state.submissions = state.submissions.map((r) => ({
      ...r,
      countsTowardAnalytics: evidenceIds.has(r.id),
    }));
    for (const r of published)
      byStudent.set(r.student_id, [...(byStudent.get(r.student_id) || []), r]);
    state.analytics = [...byStudent.entries()].map(([studentId, rows]) => {
      const topics = new Map<
        string,
        { assignments: Set<string>; points: number; max: number }
      >();
      let total = 0,
        max = 0;
      for (const r of rows) {
        const a = assignments.find((a) => a.id === r.assignment_id)!,
          d = JSON.parse(a.data_json),
          grades = JSON.parse(r.grades_json || "[]");
        total += Number(r.score);
        max += d.maxPoints;
        for (const grade of grades) {
          const question = d.questions.find(
            (v: any) => v.id === grade.questionId,
          );
          if (!question) continue;
          const t = topics.get(question.topic) || {
            assignments: new Set<string>(),
            points: 0,
            max: 0,
          };
          t.assignments.add(assessmentWindow(a).root_assignment_id);
          t.points += grade.points;
          t.max += question.maxPoints;
          topics.set(question.topic, t);
        }
      }
      return {
        studentId,
        studentName: rows[0].student_name,
        assessments: rows.length,
        averagePercent: max ? Math.round((total / max) * 10000) / 100 : null,
        topics: [...topics.entries()].map(([topic, t]) => {
          const averagePercent = t.max
            ? Math.round((t.points / t.max) * 10000) / 100
            : 0;
          return {
            topic,
            assessments: t.assignments.size,
            averagePercent,
            level:
              t.assignments.size < 3
                ? "insufficient"
                : averagePercent >= 80
                  ? "secure"
                  : "developing",
          };
        }),
      } as TeachingAnalytics;
    });
    const percentages = state.analytics
      .map((a) => a.averagePercent)
      .filter((v): v is number => v !== null);
    state.dashboard = {
      classes: state.classes.filter((c) => !c.archived).length,
      students: new Set(
        enrollments.filter((e) => e.active).map((e) => e.user_id),
      ).size,
      materials: state.materials.length,
      lessons: state.lessons.length,
      questions: state.questions.length,
      assignments: assignments.length,
      awaitingGrading: s.staff
        ? submissions.filter((r) => r.status === "submitted").length
        : 0,
      dueSoon: assignments.filter(
        (a) =>
          a.status === "issued" &&
          Date.parse(JSON.parse(a.data_json).dueAt) >= now() &&
          Date.parse(JSON.parse(a.data_json).dueAt) <= now() + 7 * 86400000,
      ).length,
      publishedAssessments: published.length,
      averagePercent: percentages.length
        ? Math.round(
            (percentages.reduce((n, v) => n + v, 0) / percentages.length) * 100,
          ) / 100
        : null,
    };
    return state;
  }
  function inviteCode(row: Row) {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret || secret.length < 32)
      fail("TEACHING_INVITES_UNAVAILABLE", 503);
    return createHmac("sha256", secret)
      .update(
        JSON.stringify([
          "lumio-class-invite-v1",
          row.id,
          row.request_id,
          row.created_by,
        ]),
      )
      .digest("base64url");
  }
  function mutate(
    userId: string,
    version: number,
    raw: unknown,
  ): TeachingMutationResult {
    const b = mutation(raw),
      fingerprint = hash(b);
    return transaction(() => {
      const u = actor(userId, version),
        old = one(
          "SELECT * FROM teaching_operations WHERE request_id=?",
          b.requestId,
        );
      if (old) {
        if (old.actor_id !== userId || old.fingerprint !== fingerprint)
          fail("TEACHING_REQUEST_REUSED", 409);
        const s = scope(u, old.organization_id);
        if (old.class_id) classFor(s, old.class_id);
        if (old.action === "submission.submit") {
          if (s.role !== "STUDENT") fail("TEACHING_STUDENT_REQUIRED", 403);
          const submission = one(
            "SELECT assignment_id FROM teaching_submissions WHERE id=? AND student_id=?",
            JSON.parse(old.result_json).id,
            u.id,
          );
          if (!submission) fail("TEACHING_NOT_FOUND", 404);
          assignmentFor(s, submission.assignment_id);
        } else if (old.action !== "class.join") requireStaff(s);
        const result = JSON.parse(old.result_json);
        if (old.action === "assignment.retake") {
          const retake = assignmentFor(s, identifier(result.id), true),
            w = assessmentWindow(retake);
          checkRecipients(retake.class_id, [w.student_id]);
        }
        if (old.action === "invite.create") {
          const invite = one(
            "SELECT * FROM teaching_invites WHERE id=?",
            result.id,
          );
          if (!invite || !invite.active || invite.expires_at <= now())
            fail("TEACHING_INVITE_EXPIRED", 409);
          const code = inviteCode(invite);
          if (hash(code) !== invite.code_hash)
            fail("TEACHING_INVITE_RECOVERY_UNAVAILABLE", 409);
          result.inviteCode = code;
        }
        return { state: read(u, old.organization_id), result, replayed: true };
      }
      if (
        Number(
          one(
            "SELECT count(*) n FROM teaching_operations WHERE actor_id=? AND created_at>=?",
            userId,
            new Date(now() - 86400000).toISOString(),
          )!.n,
        ) >= 2000
      )
        fail("TEACHING_RATE_LIMIT", 429);
      let orgId = b.orgId === undefined ? "" : identifier(b.orgId),
        classId: string | null = null,
        result: Record<string, unknown> = {},
        auditAction = "TEACHING_" + b.action.replace(/\./g, "_").toUpperCase(),
        before: Record<string, string | number | boolean | null> = {};
      if (b.action === "org.create") {
        if (!canCreate(u)) fail("TEACHER_APPROVAL_REQUIRED", 403);
        if (orgId) fail("INVALID_TEACHING_DATA");
        if (
          Number(
            one(
              "SELECT count(*) n FROM teaching_organizations WHERE created_by=?",
              userId,
            )!.n,
          ) >= limits.organizationsPerOwner
        )
          fail("TEACHING_LIMIT", 409);
        orgId = randomUUID();
        const name = str(b.name, 120),
          at = stamp();
        run(
          "INSERT INTO organizations(id,name,created_at) VALUES (?,?,?)",
          orgId,
          name,
          at,
        );
        run(
          "INSERT INTO teaching_organizations(organization_id,settings_json,created_by) VALUES (?,?,?)",
          orgId,
          JSON.stringify({
            timezone: "Asia/Ho_Chi_Minh",
            allowLateSubmissions: true,
          }),
          userId,
        );
        run(
          "INSERT INTO memberships(user_id,organization_id,role) VALUES (?,?,'OWNER')",
          userId,
          orgId,
        );
        result = { id: orgId, orgId };
      } else if (b.action === "class.join") {
        const code = str(b.code, 80),
          invite = one(
            "SELECT i.*,c.organization_id,c.archived FROM teaching_invites i JOIN teaching_classes c ON c.id=i.class_id WHERE code_hash=?",
            hash(code),
          );
        if (
          !invite ||
          !invite.active ||
          invite.expires_at <= now() ||
          invite.uses >= invite.max_uses ||
          invite.archived
        )
          fail("TEACHING_INVITE_INVALID", 403);
        if (orgId && orgId !== invite.organization_id)
          fail("TEACHING_FORBIDDEN", 403);
        orgId = invite.organization_id;
        classId = invite.class_id;
        const member = one(
            "SELECT role FROM memberships WHERE user_id=? AND organization_id=?",
            userId,
            orgId,
          ),
          enrollment = one(
            "SELECT * FROM teaching_enrollments WHERE class_id=? AND user_id=?",
            classId!,
            userId,
          );
        if (member && member.role !== "STUDENT")
          fail("TEACHING_ROLE_CONFLICT", 409);
        if (
          !member &&
          one(
            "SELECT 1 FROM teaching_enrollments e JOIN teaching_classes c ON c.id=e.class_id WHERE e.user_id=? AND c.organization_id=? LIMIT 1",
            userId,
            orgId,
          )
        )
          fail("TEACHING_ENROLLMENT_REVOKED", 403);
        if (enrollment && (!enrollment.active || !member))
          fail("TEACHING_ENROLLMENT_REVOKED", 403);
        if (!enrollment) {
          if (currentStudents(classId!).length >= limits.studentsPerClass)
            fail("TEACHING_LIMIT", 409);
          if (!member)
            run(
              "INSERT INTO memberships(user_id,organization_id,role) VALUES (?,?,'STUDENT')",
              userId,
              orgId,
            );
          const id = randomUUID();
          run(
            "INSERT INTO teaching_enrollments(id,class_id,user_id,joined_at) VALUES (?,?,?,?)",
            id,
            classId!,
            userId,
            stamp(),
          );
          run(
            "UPDATE teaching_invites SET uses=uses+1,revision=revision+1 WHERE id=?",
            invite.id,
          );
          result = { id, orgId, classId };
        } else result = { id: enrollment.id, orgId, classId };
      } else {
        if (!orgId) fail("INVALID_TEACHING_DATA");
        const s = scope(u, orgId);
        if (b.action !== "submission.submit") requireStaff(s);
        if (b.action === "class.create") {
          if (
            Number(
              one(
                "SELECT count(*) n FROM teaching_classes WHERE organization_id=?",
                orgId,
              )!.n,
            ) >= limits.classesPerOrg
          )
            fail("TEACHING_LIMIT", 409);
          classId = randomUUID();
          run(
            "INSERT INTO teaching_classes(id,organization_id,name,subject,grade,description,created_at) VALUES (?,?,?,?,?,?,?)",
            classId,
            orgId,
            str(b.name, 120),
            str(b.subject, 100),
            str(b.grade, 80),
            str(b.description, 3000, 0),
            stamp(),
          );
          run(
            "INSERT INTO teaching_class_teachers(class_id,user_id) VALUES (?,?)",
            classId,
            userId,
          );
          result = { id: classId };
        } else if (b.action === "class.update") {
          const row = classFor(s, identifier(b.id));
          cas(row, b.expectedRevision);
          classId = row.id;
          before = { revision: row.revision, archived: !!row.archived };
          run(
            "UPDATE teaching_classes SET name=?,subject=?,grade=?,description=?,archived=?,revision=revision+1 WHERE id=?",
            str(b.name, 120),
            str(b.subject, 100),
            str(b.grade, 80),
            str(b.description, 3000, 0),
            Number(bool(b.archived)),
            row.id,
          );
          result = { id: row.id };
        } else if (b.action === "invite.create") {
          const c = classFor(s, identifier(b.classId), true);
          cas(c, b.expectedRevision);
          classId = c.id;
          const invite = {
              id: randomUUID(),
              request_id: b.requestId,
              created_by: userId,
            },
            code = inviteCode(invite);
          run(
            "UPDATE teaching_invites SET active=0,revision=revision+1 WHERE class_id=? AND active=1",
            c.id,
          );
          run(
            "INSERT INTO teaching_invites(id,class_id,code_hash,request_id,created_by,expires_at,max_uses) VALUES (?,?,?,?,?,?,?)",
            invite.id,
            c.id,
            hash(code),
            b.requestId,
            userId,
            now() + integer(b.expiresInDays, 1, 30) * 86400000,
            integer(b.maxUses, 1, limits.studentsPerClass),
          );
          run(
            "UPDATE teaching_classes SET revision=revision+1 WHERE id=?",
            c.id,
          );
          result = { id: invite.id, orgId, inviteCode: code };
        } else if (b.action === "invite.revoke") {
          const row = one(
            "SELECT i.* FROM teaching_invites i JOIN teaching_classes c ON c.id=i.class_id WHERE i.id=? AND c.organization_id=?",
            identifier(b.id),
            orgId,
          );
          cas(row, b.expectedRevision);
          classFor(s, row!.class_id);
          classId = row!.class_id;
          run(
            "UPDATE teaching_invites SET active=0,revision=revision+1 WHERE id=?",
            row!.id,
          );
          result = { id: row!.id };
        } else if (
          b.action === "teacher.assign" ||
          b.action === "teacher.remove"
        ) {
          requireStaff(s, true);
          const c = classFor(s, identifier(b.classId), true);
          cas(c, b.expectedRevision);
          classId = c.id;
          const targetId = identifier(b.userId),
            target = getUser(targetId),
            member = one(
              "SELECT role FROM memberships WHERE user_id=? AND organization_id=?",
              targetId,
              orgId,
            );
          if (b.action === "teacher.assign") {
            if (!target || target.disabled || !approved(targetId))
              fail("TEACHER_APPROVAL_REQUIRED", 403);
            if (
              member &&
              !["TEACHER", "OWNER", "SCHOOL_ADMIN"].includes(member.role)
            )
              fail("TEACHING_ROLE_CONFLICT", 409);
            if (!member)
              run(
                "INSERT INTO memberships(user_id,organization_id,role) VALUES (?,?,'TEACHER')",
                targetId,
                orgId,
              );
            run(
              "INSERT OR IGNORE INTO teaching_class_teachers(class_id,user_id) VALUES (?,?)",
              c.id,
              targetId,
            );
          } else {
            if (member && ["OWNER", "SCHOOL_ADMIN"].includes(member.role))
              fail("TEACHING_PROTECTED_MEMBER", 409);
            run(
              "DELETE FROM teaching_class_teachers WHERE class_id=? AND user_id=?",
              c.id,
              targetId,
            );
          }
          run(
            "UPDATE teaching_classes SET revision=revision+1 WHERE id=?",
            c.id,
          );
          result = { id: c.id };
        } else if (b.action === "member.remove" || b.action === "member.role") {
          requireStaff(s, true);
          cas(s.org, b.expectedRevision);
          const targetId = identifier(b.userId),
            m = one(
              "SELECT role FROM memberships WHERE user_id=? AND organization_id=?",
              targetId,
              orgId,
            );
          if (!m) fail("TEACHING_NOT_FOUND", 404);
          if (m.role === "OWNER" || targetId === userId)
            fail("TEACHING_PROTECTED_MEMBER", 409);
          if (b.action === "member.role") {
            if (
              typeof b.role !== "string" ||
              !["TEACHER", "SCHOOL_ADMIN"].includes(b.role) ||
              m.role === "STUDENT"
            )
              fail("TEACHING_ROLE_CONFLICT", 409);
            const target = getUser(targetId);
            if (!target || target.disabled || !approved(targetId))
              fail("TEACHER_APPROVAL_REQUIRED", 403);
            run(
              "UPDATE memberships SET role=? WHERE user_id=? AND organization_id=?",
              b.role,
              targetId,
              orgId,
            );
          } else {
            run(
              "DELETE FROM memberships WHERE user_id=? AND organization_id=?",
              targetId,
              orgId,
            );
            run(
              "DELETE FROM teaching_class_teachers WHERE user_id=? AND class_id IN (SELECT id FROM teaching_classes WHERE organization_id=?)",
              targetId,
              orgId,
            );
            run(
              "UPDATE teaching_enrollments SET active=0,revision=revision+1 WHERE user_id=? AND class_id IN (SELECT id FROM teaching_classes WHERE organization_id=?)",
              targetId,
              orgId,
            );
            run(
              "DELETE FROM teaching_group_members WHERE user_id=? AND group_id IN (SELECT g.id FROM teaching_groups g JOIN teaching_classes c ON c.id=g.class_id WHERE c.organization_id=?)",
              targetId,
              orgId,
            );
          }
          run(
            "UPDATE teaching_organizations SET revision=revision+1 WHERE organization_id=?",
            orgId,
          );
          result = { id: targetId };
        } else if (
          b.action === "enrollment.remove" ||
          b.action === "enrollment.restore"
        ) {
          const row = one(
            "SELECT e.* FROM teaching_enrollments e JOIN teaching_classes c ON c.id=e.class_id WHERE e.id=? AND c.organization_id=?",
            identifier(b.id),
            orgId,
          );
          cas(row, b.expectedRevision);
          classFor(s, row!.class_id, true);
          classId = row!.class_id;
          const active = b.action === "enrollment.restore";
          if (active) {
            const target = getUser(row!.user_id),
              m = one(
                "SELECT role FROM memberships WHERE user_id=? AND organization_id=?",
                row!.user_id,
                orgId,
              );
            if (!target || target.disabled) fail("TEACHING_INVALID_RECIPIENT");
            if (m && m.role !== "STUDENT") fail("TEACHING_ROLE_CONFLICT", 409);
            if (!m)
              run(
                "INSERT INTO memberships(user_id,organization_id,role) VALUES (?,?,'STUDENT')",
                row!.user_id,
                orgId,
              );
            if (
              !row!.active &&
              currentStudents(classId!).length >= limits.studentsPerClass
            )
              fail("TEACHING_LIMIT", 409);
          }
          run(
            "UPDATE teaching_enrollments SET active=?,revision=revision+1 WHERE id=?",
            Number(active),
            row!.id,
          );
          if (!active) {
            run(
              "DELETE FROM teaching_group_members WHERE user_id=? AND group_id IN (SELECT id FROM teaching_groups WHERE class_id=?)",
              row!.user_id,
              classId!,
            );
            if (
              !one(
                "SELECT 1 FROM teaching_enrollments e JOIN teaching_classes c ON c.id=e.class_id WHERE e.user_id=? AND c.organization_id=? AND e.active=1",
                row!.user_id,
                orgId,
              )
            )
              run(
                "DELETE FROM memberships WHERE user_id=? AND organization_id=? AND role='STUDENT'",
                row!.user_id,
                orgId,
              );
          }
          result = { id: row!.id };
        } else if (b.action === "group.save" || b.action === "group.delete") {
          const existing =
            b.id === undefined
              ? undefined
              : one(
                  "SELECT g.* FROM teaching_groups g JOIN teaching_classes c ON c.id=g.class_id WHERE g.id=? AND c.organization_id=?",
                  identifier(b.id),
                  orgId,
                );
          if (b.id !== undefined) cas(existing, b.expectedRevision);
          else if (integer(b.expectedRevision) !== 0)
            fail("TEACHING_CONFLICT", 409);
          classId = existing?.class_id || identifier(b.classId);
          classFor(s, classId!, true);
          if (b.action === "group.delete") {
            run("DELETE FROM teaching_groups WHERE id=?", existing!.id);
            result = { id: existing!.id };
          } else {
            if (existing && identifier(b.classId) !== existing.class_id)
              fail("TEACHING_FORBIDDEN", 403);
            const members = ids(b.memberIds, limits.studentsPerClass);
            checkRecipients(classId!, members);
            const id = existing?.id || randomUUID();
            if (existing)
              run(
                "UPDATE teaching_groups SET name=?,revision=revision+1 WHERE id=?",
                str(b.name, 120),
                id,
              );
            else {
              if (
                Number(
                  one(
                    "SELECT count(*) n FROM teaching_groups WHERE class_id=?",
                    classId!,
                  )!.n,
                ) >= 30
              )
                fail("TEACHING_LIMIT", 409);
              run(
                "INSERT INTO teaching_groups(id,class_id,name) VALUES (?,?,?)",
                id,
                classId!,
                str(b.name, 120),
              );
            }
            run("DELETE FROM teaching_group_members WHERE group_id=?", id);
            for (const userId of members)
              run(
                "INSERT INTO teaching_group_members(group_id,user_id) VALUES (?,?)",
                id,
                userId,
              );
            result = { id };
          }
        } else if (/^(material|lesson|question)\./.test(b.action)) {
          const [kind, action] = b.action.split("."),
            existing =
              action === "create"
                ? undefined
                : contentFor(s, identifier(b.id), kind);
          if (existing) {
            cas(existing, b.expectedRevision);
            classId = existing.class_id;
            before = { revision: existing.revision, status: existing.status };
          }
          if (action === "create" || action === "update") {
            const data = parseDraft(s, kind, b.draft, existing);
            if (existing && data.classId !== existing.class_id)
              fail("TEACHING_CLASS_MOVE_FORBIDDEN", 409);
            classId = data.classId;
            const id = existing?.id || randomUUID();
            if (!existing) {
              const total = Number(
                  one(
                    "SELECT count(*) n FROM teaching_content WHERE organization_id=?",
                    orgId,
                  )!.n,
                ),
                materialCount = Number(
                  one(
                    "SELECT count(*) n FROM teaching_content WHERE organization_id=? AND kind='material'",
                    orgId,
                  )!.n,
                );
              if (
                total >= limits.contentPerOrg ||
                (kind === "material" && materialCount >= limits.materialsPerOrg)
              )
                fail("TEACHING_LIMIT", 409);
              run(
                "INSERT INTO teaching_content(id,organization_id,class_id,kind,data_json,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)",
                id,
                orgId,
                classId,
                kind,
                JSON.stringify(data),
                userId,
                stamp(),
                stamp(),
              );
            } else
              run(
                "UPDATE teaching_content SET data_json=?,status='draft',revision=revision+1,updated_at=? WHERE id=?",
                JSON.stringify(data),
                stamp(),
                id,
              );
            result = { id };
          } else if (action === "delete") {
            run(
              "UPDATE teaching_content SET status='archived',revision=revision+1,updated_at=? WHERE id=?",
              stamp(),
              existing!.id,
            );
            result = { id: existing!.id };
          } else {
            if (existing!.class_id) classFor(s, existing!.class_id, true);
            reviewContent(s, existing!);
            if (
              action === "publish" &&
              (existing!.status !== "reviewed" ||
                (!existing!.class_id && !s.admin))
            )
              fail("TEACHING_REVIEW_REQUIRED", 409);
            const status = action === "publish" ? "published" : "reviewed";
            if (action === "review" && existing!.status !== "draft")
              fail("TEACHING_INVALID_TRANSITION", 409);
            run(
              "UPDATE teaching_content SET status=?,revision=revision+1,updated_at=? WHERE id=?",
              status,
              stamp(),
              existing!.id,
            );
            result = { id: existing!.id };
          }
        } else if (b.action === "assignment.retake") {
          const original = assignmentFor(
              s,
              identifier(b.originalAssignmentId),
              true,
            ),
            w = assessmentWindow(original);
          cas(original, b.expectedRevision);
          classId = original.class_id;
          classFor(s, original.class_id, true);
          if (
            w.root_assignment_id !== original.id ||
            !["issued", "closed"].includes(original.status)
          )
            fail("TEACHING_RETAKE_ROOT_REQUIRED", 409);
          if (b.sameQuestionsAcknowledged !== true)
            fail("TEACHING_RETAKE_ACK_REQUIRED");
          const studentId = identifier(b.studentId),
            reason = str(b.reason, 1000),
            availableUntil = windowTimestamp(b.availableUntil),
            window = parseWindow(b, availableUntil, true);
          checkRecipients(original.class_id, [studentId]);
          if (
            !one(
              "SELECT 1 FROM teaching_assignment_targets WHERE assignment_id=? AND user_id=?",
              original.id,
              studentId,
            )
          )
            fail("TEACHING_INVALID_RECIPIENT", 403);
          if (
            !one(
              "SELECT 1 FROM teaching_submissions WHERE assignment_id=? AND student_id=? AND status IN('graded','published')",
              original.id,
              studentId,
            )
          )
            fail("TEACHING_RETAKE_GRADE_REQUIRED", 409);
          const prior = all(
            "SELECT w.*,a.status assignment_status,s.status submission_status FROM teaching_assessment_windows w JOIN teaching_assignments a ON a.id=w.assignment_id LEFT JOIN teaching_submissions s ON s.assignment_id=a.id AND s.student_id=w.student_id WHERE w.root_assignment_id=? AND w.student_id=? ORDER BY w.attempt_no",
            original.id,
            studentId,
          );
          if (
            prior.some(
              (p) =>
                p.submission_status === "submitted" ||
                (p.assignment_status === "issued" &&
                  !p.submission_status &&
                  Date.parse(p.available_until) > now()),
            )
          )
            fail("TEACHING_RETAKE_PENDING", 409);
          const attemptNo = prior.length + 2;
          if (attemptNo > 3) fail("TEACHING_RETAKE_LIMIT", 409);
          if (
            Number(
              one(
                "SELECT count(*) n FROM teaching_assignments WHERE organization_id=?",
                orgId,
              )!.n,
            ) >= 200
          )
            fail("TEACHING_LIMIT", 409);
          const id = randomUUID(),
            data = JSON.parse(original.data_json),
            createdAt = stamp(),
            retakeData = {
              ...data,
              title:
                String(data.title).slice(0, 150) +
                " · Luyện tập lại · Lần " +
                attemptNo,
              target: { kind: "students", ids: [studentId] },
              dueAt: availableUntil,
              ...window,
            };
          before = { revision: original.revision, status: original.status };
          run(
            "INSERT INTO teaching_assignments(id,organization_id,class_id,data_json,status,created_by,created_at,issued_at) VALUES(?,?,?,?,'issued',?,?,?)",
            id,
            orgId,
            classId,
            JSON.stringify(retakeData),
            userId,
            createdAt,
            createdAt,
          );
          run(
            "INSERT INTO teaching_assignment_targets(assignment_id,user_id) VALUES(?,?)",
            id,
            studentId,
          );
          run(
            "INSERT INTO teaching_assessment_windows(assignment_id,root_assignment_id,parent_assignment_id,attempt_no,student_id,available_from,available_until,reason,acknowledged,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,1,?,?)",
            id,
            original.id,
            original.id,
            attemptNo,
            studentId,
            window.availableFrom,
            window.availableUntil,
            reason,
            userId,
            createdAt,
          );
          run(
            "UPDATE teaching_assignments SET revision=revision+1 WHERE id=?",
            original.id,
          );
          result = { id, rootAssignmentId: original.id, attemptNo };
        } else if (b.action.startsWith("assignment.")) {
          const action = b.action.split(".")[1],
            existing =
              action === "create"
                ? undefined
                : assignmentFor(s, identifier(b.id), true);
          if (existing) {
            cas(existing, b.expectedRevision);
            classId = existing.class_id;
            before = { revision: existing.revision, status: existing.status };
          }
          if (action === "create" || action === "update") {
            if (existing && !["draft", "reviewed"].includes(existing.status))
              fail("TEACHING_ASSIGNMENT_IMMUTABLE", 409);
            const data = parseAssignment(s, b.draft);
            if (existing && existing.class_id !== data.classId)
              fail("TEACHING_CLASS_MOVE_FORBIDDEN", 409);
            classId = data.classId;
            const id = existing?.id || randomUUID();
            if (!existing) {
              if (
                Number(
                  one(
                    "SELECT count(*) n FROM teaching_assignments WHERE organization_id=?",
                    orgId,
                  )!.n,
                ) >= 200
              )
                fail("TEACHING_LIMIT", 409);
              run(
                "INSERT INTO teaching_assignments(id,organization_id,class_id,data_json,created_by,created_at) VALUES (?,?,?,?,?,?)",
                id,
                orgId,
                classId,
                JSON.stringify(data),
                userId,
                stamp(),
              );
            } else
              run(
                "UPDATE teaching_assignments SET data_json=?,status='draft',revision=revision+1 WHERE id=?",
                JSON.stringify(data),
                id,
              );
            if (!existing)
              run(
                "INSERT INTO teaching_assessment_windows(assignment_id,root_assignment_id,attempt_no,available_from,available_until,created_by,created_at) VALUES(?,?,1,?,?,?,?)",
                id,
                id,
                data.availableFrom,
                data.availableUntil,
                userId,
                stamp(),
              );
            else
              run(
                "UPDATE teaching_assessment_windows SET available_from=?,available_until=? WHERE assignment_id=? AND attempt_no=1",
                data.availableFrom,
                data.availableUntil,
                id,
              );
            result = { id };
          } else if (action === "delete") {
            if (!["draft", "reviewed"].includes(existing!.status))
              fail("TEACHING_ASSIGNMENT_IMMUTABLE", 409);
            run("DELETE FROM teaching_assignments WHERE id=?", existing!.id);
            result = { id: existing!.id };
          } else if (action === "close") {
            if (existing!.status !== "issued")
              fail("TEACHING_INVALID_TRANSITION", 409);
            run(
              "UPDATE teaching_assignments SET status='closed',revision=revision+1 WHERE id=?",
              existing!.id,
            );
            result = { id: existing!.id };
          } else {
            const expected = action === "review" ? "draft" : "reviewed";
            if (existing!.status !== expected)
              fail("TEACHING_REVIEW_REQUIRED", 409);
            classFor(s, existing!.class_id, true);
            const data = JSON.parse(existing!.data_json);
            if (Date.parse(data.dueAt) <= now())
              fail("TEACHING_INVALID_DUE_DATE", 409);
            for (const question of data.questions) {
              const q = contentFor(s, question.id, "question");
              if (
                q.status !== "reviewed" ||
                Number(q.revision) !== question.revision
              )
                fail("TEACHING_SOURCE_CHANGED", 409);
              reviewContent(s, q);
            }
            if (action === "issue") {
              let targets: string[] = [];
              if (data.target.kind === "class")
                targets = currentStudents(existing!.class_id).map(
                  (r) => r.user_id,
                );
              else if (data.target.kind === "students")
                targets = data.target.ids;
              else
                for (const groupId of data.target.ids) {
                  if (
                    !one(
                      "SELECT 1 FROM teaching_groups WHERE id=? AND class_id=?",
                      groupId,
                      existing!.class_id,
                    )
                  )
                    fail("TEACHING_INVALID_RECIPIENT", 409);
                  targets.push(
                    ...all(
                      "SELECT user_id FROM teaching_group_members WHERE group_id=?",
                      groupId,
                    ).map((r) => r.user_id),
                  );
                }
              targets = [...new Set(targets)];
              if (
                !targets.length ||
                targets.length > limits.recipientsPerAssignment
              )
                fail("TEACHING_INVALID_RECIPIENT", 409);
              checkRecipients(existing!.class_id, targets);
              for (const target of targets)
                run(
                  "INSERT INTO teaching_assignment_targets(assignment_id,user_id) VALUES (?,?)",
                  existing!.id,
                  target,
                );
              run(
                "UPDATE teaching_assignments SET status='issued',revision=revision+1,issued_at=? WHERE id=?",
                stamp(),
                existing!.id,
              );
              run(
                "UPDATE teaching_assessment_windows SET available_from=coalesce(available_from,?) WHERE assignment_id=?",
                stamp(),
                existing!.id,
              );
            } else
              run(
                "UPDATE teaching_assignments SET status='reviewed',revision=revision+1 WHERE id=?",
                existing!.id,
              );
            result = { id: existing!.id };
          }
        } else if (b.action === "submission.submit") {
          if (s.role !== "STUDENT") fail("TEACHING_STUDENT_REQUIRED", 403);
          const a = assignmentFor(s, identifier(b.assignmentId)),
            data = JSON.parse(a.data_json);
          classId = a.class_id;
          classFor(s, a.class_id, true);
          const availability = submissionAvailability(
            s,
            a,
            assessmentWindow(a),
          );
          if (availability === "not_open") fail("TEACHING_NOT_OPEN", 409);
          if (availability === "closed")
            fail("TEACHING_ASSIGNMENT_CLOSED", 409);
          if (a.status !== "issued") fail("TEACHING_ASSIGNMENT_CLOSED", 409);
          const late = Date.parse(data.dueAt) < now();
          if (late && !JSON.parse(s.org.settings_json).allowLateSubmissions)
            fail("TEACHING_DUE_PASSED", 409);
          if (
            !Array.isArray(b.answers) ||
            b.answers.length !== data.questions.length
          )
            fail("INVALID_TEACHING_DATA");
          const seen = new Set<string>();
          let autoScore = 0;
          const answers = b.answers.map((value) => {
            const answer = obj(value);
            only(answer, ["questionId", "response"]);
            const questionId = identifier(answer.questionId),
              q = data.questions.find((q: any) => q.id === questionId);
            if (!q || seen.has(questionId)) fail("INVALID_TEACHING_DATA");
            seen.add(questionId);
            let response = answer.response;
            if (response !== null) {
              if (q.kind === "mcq") {
                response = integer(response, 0, q.choices.length - 1);
                if (response === q.correctIndex) autoScore += q.maxPoints;
              } else response = str(response, 5000, 0);
            }
            return { questionId, response };
          });
          const existing = one(
            "SELECT * FROM teaching_submissions WHERE assignment_id=? AND student_id=?",
            a.id,
            userId,
          );
          if (existing) {
            cas(existing, b.expectedRevision);
            if (existing.status !== "submitted")
              fail("TEACHING_SUBMISSION_LOCKED", 409);
          } else if (integer(b.expectedRevision) !== 0)
            fail("TEACHING_CONFLICT", 409);
          const id = existing?.id || randomUUID();
          if (existing)
            run(
              "UPDATE teaching_submissions SET answers_json=?,submitted_at=?,late=?,auto_score=?,revision=revision+1 WHERE id=?",
              JSON.stringify(answers),
              stamp(),
              Number(late),
              Math.round(autoScore * 100) / 100,
              id,
            );
          else
            run(
              "INSERT INTO teaching_submissions(id,assignment_id,student_id,answers_json,submitted_at,late,auto_score) VALUES (?,?,?,?,?,?,?)",
              id,
              a.id,
              userId,
              JSON.stringify(answers),
              stamp(),
              Number(late),
              Math.round(autoScore * 100) / 100,
            );
          result = { id };
        } else if (
          b.action === "submission.grade" ||
          b.action === "submission.publish"
        ) {
          const row = one(
            "SELECT s.*,a.organization_id,a.class_id,a.data_json FROM teaching_submissions s JOIN teaching_assignments a ON a.id=s.assignment_id WHERE s.id=? AND a.organization_id=?",
            identifier(b.id),
            orgId,
          );
          cas(row, b.expectedRevision);
          classId = row!.class_id;
          classFor(s, classId!);
          before = { revision: row!.revision, status: row!.status };
          if (b.action === "submission.publish") {
            if (
              row!.status !== "graded" ||
              !row!.confirmed_at ||
              !row!.grades_json
            )
              fail("TEACHING_CONFIRMATION_REQUIRED", 409);
            const gradeEvent = one(
              "SELECT * FROM teaching_grade_events WHERE submission_id=? AND kind IN('grade','legacy_snapshot') ORDER BY grade_version DESC LIMIT 1",
              row!.id,
            );
            if (
              !gradeEvent ||
              gradeEvent.grades_json !== row!.grades_json ||
              Number(gradeEvent.score) !== Number(row!.score) ||
              gradeEvent.feedback !== (row!.feedback || "") ||
              (gradeEvent.answers_digest &&
                gradeEvent.answers_digest !== hash(row!.answers_json))
            )
              fail("TEACHING_HISTORY_INCONSISTENT", 409);
            const publishedAt = stamp();
            run(
              "UPDATE teaching_submissions SET status='published',published_at=?,revision=revision+1 WHERE id=?",
              publishedAt,
              row!.id,
            );
            run(
              "INSERT INTO teaching_grade_events(id,submission_id,submission_revision,kind,grade_version,grade_event_id,actor_id,recorded_at,published_at) VALUES(?,?,?,'publish',?,?,?,?,?)",
              randomUUID(),
              row!.id,
              Number(row!.revision) + 1,
              gradeEvent.grade_version,
              gradeEvent.id,
              userId,
              publishedAt,
              publishedAt,
            );
          } else {
            if (b.confirmed !== true)
              fail("TEACHING_CONFIRMATION_REQUIRED", 409);
            const reason = b.reason === undefined ? "" : str(b.reason, 1000, 0),
              priorGrade =
                row!.grades_json !== null ||
                row!.confirmed_at !== null ||
                row!.score !== null;
            if (priorGrade && !reason) fail("TEACHING_REGRADE_REASON_REQUIRED");
            const gradeVersion =
              Number(
                one(
                  "SELECT coalesce(max(grade_version),0) n FROM teaching_grade_events WHERE submission_id=?",
                  row!.id,
                )!.n,
              ) + 1;
            if (gradeVersion > limits.gradeVersionsPerSubmission)
              fail("TEACHING_HISTORY_LIMIT", 409);
            if (
              Number(
                one(
                  "SELECT count(*) n FROM teaching_grade_events e JOIN teaching_submissions s ON s.id=e.submission_id JOIN teaching_assignments a ON a.id=s.assignment_id WHERE a.organization_id=? AND e.kind IN('grade','legacy_snapshot')",
                  orgId,
                )!.n,
              ) >= limits.gradeVersionsPerOrg
            )
              fail("TEACHING_HISTORY_LIMIT", 409);
            const data = JSON.parse(row!.data_json);
            if (
              !Array.isArray(b.grades) ||
              b.grades.length !== data.questions.length
            )
              fail("INVALID_TEACHING_DATA");
            const seen = new Set<string>();
            let score = 0;
            const grades = b.grades.map((value) => {
              const g = obj(value);
              only(g, ["questionId", "points", "feedback"]);
              const questionId = identifier(g.questionId),
                q = data.questions.find((q: any) => q.id === questionId);
              if (!q || seen.has(questionId)) fail("INVALID_TEACHING_DATA");
              seen.add(questionId);
              const points = number(g.points, 0, q.maxPoints);
              score += points;
              return { questionId, points, feedback: str(g.feedback, 2000, 0) };
            });
            const feedback = str(b.feedback, 5000, 0),
              confirmedAt = stamp(),
              roundedScore = Math.round(score * 100) / 100,
              gradesJSON = JSON.stringify(grades);
            run(
              "UPDATE teaching_submissions SET grades_json=?,score=?,feedback=?,status='graded',confirmed_at=?,published_at=NULL,revision=revision+1 WHERE id=?",
              gradesJSON,
              roundedScore,
              feedback,
              confirmedAt,
              row!.id,
            );
            run(
              "INSERT INTO teaching_grade_events(id,submission_id,submission_revision,kind,grade_version,grades_json,score,feedback,answers_digest,actor_id,recorded_at,confirmed_at,reason) VALUES(?,?,?,'grade',?,?,?,?,?,?,?,?,?)",
              randomUUID(),
              row!.id,
              Number(row!.revision) + 1,
              gradeVersion,
              gradesJSON,
              roundedScore,
              feedback,
              hash(row!.answers_json),
              userId,
              confirmedAt,
              confirmedAt,
              reason || null,
            );
          }
          result = { id: row!.id };
        } else if (b.action.startsWith("announcement.")) {
          if (b.action !== "announcement.save" && b.id === undefined)
            fail("INVALID_TEACHING_DATA");
          const existing =
            b.id === undefined
              ? undefined
              : one(
                  "SELECT * FROM teaching_announcements WHERE id=? AND organization_id=?",
                  identifier(b.id),
                  orgId,
                );
          if (b.id !== undefined) cas(existing, b.expectedRevision);
          else if (integer(b.expectedRevision) !== 0)
            fail("TEACHING_CONFLICT", 409);
          if (b.action === "announcement.save") {
            classId = b.classId === null ? null : identifier(b.classId);
            if (classId) classFor(s, classId, true);
            else requireStaff(s, true);
            if (existing && existing.class_id !== classId)
              fail("TEACHING_CLASS_MOVE_FORBIDDEN", 409);
            const id = existing?.id || randomUUID();
            if (existing)
              run(
                "UPDATE teaching_announcements SET title=?,body=?,status='draft',revision=revision+1 WHERE id=?",
                str(b.title, 200),
                str(b.body, 10000),
                id,
              );
            else {
              if (
                Number(
                  one(
                    "SELECT count(*) n FROM teaching_announcements WHERE organization_id=?",
                    orgId,
                  )!.n,
                ) >= 300
              )
                fail("TEACHING_LIMIT", 409);
              run(
                "INSERT INTO teaching_announcements(id,organization_id,class_id,title,body,created_by,created_at) VALUES (?,?,?,?,?,?,?)",
                id,
                orgId,
                classId,
                str(b.title, 200),
                str(b.body, 10000),
                userId,
                stamp(),
              );
            }
            result = { id };
          } else {
            classId = existing!.class_id;
            if (classId) classFor(s, classId);
            else requireStaff(s, true);
            if (b.action === "announcement.publish") {
              if (existing!.status !== "draft")
                fail("TEACHING_INVALID_TRANSITION", 409);
              run(
                "UPDATE teaching_announcements SET status='published',revision=revision+1 WHERE id=?",
                existing!.id,
              );
            } else
              run(
                "DELETE FROM teaching_announcements WHERE id=?",
                existing!.id,
              );
            result = { id: existing!.id };
          }
        } else if (b.action.startsWith("event.")) {
          const existing =
            b.id === undefined
              ? undefined
              : one(
                  "SELECT * FROM teaching_events WHERE id=? AND organization_id=?",
                  identifier(b.id),
                  orgId,
                );
          if (b.id !== undefined) cas(existing, b.expectedRevision);
          else if (integer(b.expectedRevision) !== 0)
            fail("TEACHING_CONFLICT", 409);
          classId = existing?.class_id || identifier(b.classId);
          classFor(s, classId!, true);
          if (b.action === "event.delete") {
            run("DELETE FROM teaching_events WHERE id=?", existing!.id);
            result = { id: existing!.id };
          } else {
            if (existing && identifier(b.classId) !== classId)
              fail("TEACHING_CLASS_MOVE_FORBIDDEN", 409);
            const startAt = iso(b.startAt),
              endAt = iso(b.endAt),
              kind = str(b.kind, 20);
            if (
              Date.parse(endAt) <= Date.parse(startAt) ||
              Date.parse(endAt) - Date.parse(startAt) > 7 * 86400000 ||
              !["lesson", "deadline", "meeting"].includes(kind)
            )
              fail("INVALID_TEACHING_DATA");
            const data = {
                title: str(b.title, 200),
                description: str(b.description, 5000, 0),
                startAt,
                endAt,
                kind,
              },
              id = existing?.id || randomUUID();
            if (existing)
              run(
                "UPDATE teaching_events SET data_json=?,revision=revision+1 WHERE id=?",
                JSON.stringify(data),
                id,
              );
            else {
              if (
                Number(
                  one(
                    "SELECT count(*) n FROM teaching_events WHERE organization_id=?",
                    orgId,
                  )!.n,
                ) >= 300
              )
                fail("TEACHING_LIMIT", 409);
              run(
                "INSERT INTO teaching_events(id,organization_id,class_id,data_json) VALUES (?,?,?,?)",
                id,
                orgId,
                classId!,
                JSON.stringify(data),
              );
            }
            result = { id };
          }
        } else if (b.action === "preferences.update") {
          const current = one(
            "SELECT revision FROM teaching_preferences WHERE organization_id=? AND user_id=?",
            orgId,
            userId,
          );
          if (current) cas(current, b.expectedRevision);
          else if (integer(b.expectedRevision) !== 0)
            fail("TEACHING_CONFLICT", 409);
          const difficulty = str(b.defaultDifficulty, 20),
            language = str(b.aiLanguage, 35);
          if (
            !["basic", "medium", "advanced"].includes(difficulty) ||
            !["vi", "en", "zh-CN", "ja", "ko"].includes(language)
          )
            fail("INVALID_TEACHING_DATA");
          const data = {
            subjects: textList(b.subjects, 20, 80),
            grades: textList(b.grades, 20, 80),
            displayName: str(b.displayName, 120),
            aiLanguage: language,
            defaultDifficulty: difficulty,
            aiEnabled: bool(b.aiEnabled),
            inAppNotifications: bool(b.inAppNotifications),
          };
          run(
            "INSERT INTO teaching_preferences(organization_id,user_id,data_json) VALUES (?,?,?) ON CONFLICT(organization_id,user_id) DO UPDATE SET data_json=excluded.data_json,revision=teaching_preferences.revision+1",
            orgId,
            userId,
            JSON.stringify(data),
          );
          result = { id: userId };
        } else if (b.action === "settings.update") {
          requireStaff(s, true);
          cas(s.org, b.expectedRevision);
          const name = str(b.name, 120),
            timezone = str(b.timezone, 80);
          try {
            new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
          } catch {
            fail("INVALID_TEACHING_DATA");
          }
          run("UPDATE organizations SET name=? WHERE id=?", name, orgId);
          run(
            "UPDATE teaching_organizations SET settings_json=?,revision=revision+1 WHERE organization_id=?",
            JSON.stringify({
              timezone,
              allowLateSubmissions: bool(b.allowLateSubmissions),
            }),
            orgId,
          );
          result = { id: orgId };
        } else fail("INVALID_TEACHING_ACTION");
      }
      assertBudgets(orgId);
      // No text, student answers, scores, names or raw invitation code enter the audit log.
      recordAudit({
        actorId: userId,
        action: auditAction,
        target: String(result.id || orgId),
        requestId: b.requestId,
        before,
        after: {
          organizationId: orgId,
          ...(classId ? { classId } : {}),
          action: b.action,
        },
      });
      const storedResult = { ...result };
      delete storedResult.inviteCode;
      run(
        "INSERT INTO teaching_operations(request_id,actor_id,organization_id,class_id,action,fingerprint,result_json,created_at) VALUES (?,?,?,?,?,?,?,?)",
        b.requestId,
        userId,
        orgId,
        classId,
        b.action,
        fingerprint,
        JSON.stringify(storedResult),
        stamp(),
      );
      return { state: read(u, orgId), result, replayed: false };
    });
  }
  function generation(
    userId: string,
    version: number,
    orgId: string,
    sourceIds: string[],
  ): TeachingGenerationContext {
    const u = actor(userId, version),
      s = scope(u, identifier(orgId));
    requireStaff(s);
    if (!preferences(s).aiEnabled) fail("TEACHING_AI_DISABLED", 403);
    const selected = ids(sourceIds, 10);
    const materials = materialList(s, selected);
    return {
      userId,
      sessionVersion: version,
      orgId,
      materials,
      snapshot: hash(
        materials.map((m) => [
          m.id,
          m.revision,
          m.status,
          m.content,
          m.sourceEvidence,
        ]),
      ),
    };
  }
  function gradeHistory(
    userId: string,
    version: number,
    options: {
      orgId: string;
      submissionId: string;
      limit?: number;
      cursor?: string;
    },
  ): TeachingGradeHistoryResponse {
    const u = actor(userId, version),
      s = scope(u, identifier(options.orgId)),
      submissionId = identifier(options.submissionId),
      row = one(
        "SELECT s.* FROM teaching_submissions s JOIN teaching_assignments a ON a.id=s.assignment_id WHERE s.id=? AND a.organization_id=?",
        submissionId,
        s.org.id,
      );
    if (!row) fail("TEACHING_NOT_FOUND", 404);
    assignmentFor(s, row.assignment_id);
    if (!s.staff && row.student_id !== u.id) fail("TEACHING_FORBIDDEN", 403);
    const limit =
      options.limit === undefined ? 20 : integer(options.limit, 1, 50);
    let before = Number.MAX_SAFE_INTEGER;
    if (options.cursor !== undefined) {
      const cursor = str(options.cursor, 400);
      if (
        !/^[A-Za-z0-9_-]+$/.test(cursor) ||
        Buffer.from(cursor, "base64url").toString("base64url") !== cursor
      )
        fail("INVALID_TEACHING_DATA");
      let decoded: Record<string, unknown>;
      try {
        decoded = obj(
          JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")),
        );
      } catch {
        fail("INVALID_TEACHING_DATA");
      }
      only(decoded, ["v", "s", "b"]);
      if (decoded.v !== 1 || decoded.s !== submissionId)
        fail("INVALID_TEACHING_DATA");
      before = integer(decoded.b, 1, Number.MAX_SAFE_INTEGER);
    }
    const rows = all(
      `SELECT e.*,g.grades_json linked_grades,g.score linked_score,g.feedback linked_feedback,u.name actor_name
       FROM teaching_grade_events e LEFT JOIN teaching_grade_events g ON g.id=e.grade_event_id AND g.submission_id=e.submission_id
       LEFT JOIN users u ON u.id=e.actor_id WHERE e.submission_id=? AND e.sequence<?
       ${s.staff ? "" : "AND (e.kind='publish' OR (e.kind='legacy_snapshot' AND e.published_at IS NOT NULL))"}
       ORDER BY e.sequence DESC LIMIT ?`,
      submissionId,
      before,
      limit + 1,
    );
    const selected = rows.slice(0, limit);
    const events: TeachingGradeHistoryEvent[] = selected.map((e) => ({
      id: e.id,
      kind: e.kind,
      submissionRevision: Number(e.submission_revision),
      gradeVersion: Number(e.grade_version),
      score: Number(e.kind === "publish" ? e.linked_score : e.score),
      grades: JSON.parse(
        e.kind === "publish" ? e.linked_grades : e.grades_json,
      ),
      feedback: e.kind === "publish" ? e.linked_feedback : e.feedback,
      publishedAt: e.published_at,
      legacy: !!e.legacy,
      ...(s.staff
        ? {
            recordedAt: e.recorded_at,
            recordedBy: e.actor_id
              ? { userId: e.actor_id, name: e.actor_name }
              : null,
            confirmedAt: e.confirmed_at,
            reason: e.reason || "",
          }
        : {}),
    }));
    return {
      submissionId,
      events,
      nextCursor:
        rows.length > limit
          ? Buffer.from(
              JSON.stringify({
                v: 1,
                s: submissionId,
                b: Number(selected.at(-1)!.sequence),
              }),
            ).toString("base64url")
          : null,
    };
  }
  return {
    mutateTeaching: mutate,
    readTeachingGradeHistory(
      userId: string,
      version: number,
      options: {
        orgId: string;
        submissionId: string;
        limit?: number;
        cursor?: string;
      },
    ) {
      return transaction(() => gradeHistory(userId, version, options));
    },
    readTeaching(
      userId: string,
      version: number,
      options: { orgId?: string; classId?: string; q?: string } = {},
    ) {
      return transaction(() =>
        read(actor(userId, version), options.orgId, options),
      );
    },
    getTeachingGenerationContext(
      userId: string,
      version: number,
      orgId: string,
      sourceIds: string[],
    ) {
      return transaction(() => generation(userId, version, orgId, sourceIds));
    },
    // Read-only: the AI service also invokes this inside the ledger settlement transaction.
    assertTeachingGenerationContext(context: TeachingGenerationContext) {
      const current = generation(
        context.userId,
        context.sessionVersion,
        context.orgId,
        context.materials.map((m) => m.id),
      );
      if (current.snapshot !== context.snapshot)
        fail("TEACHING_SOURCE_CHANGED", 409);
      return current;
    },
    exportTeaching(
      userId: string,
      version: number,
      options: { orgId: string; classId?: string; format?: "csv" | "json" },
    ) {
      return transaction(() => {
        const u = actor(userId, version),
          orgId = identifier(options.orgId),
          state = read(u, orgId, { classId: options.classId });
        const rows = state.submissions
          .filter((r) => state.permissions.teach || r.status === "published")
          .map((r) => {
            const a = state.assignments.find((a) => a.id === r.assignmentId)!;
            return {
              assignmentId: a.id,
              assignment: a.title,
              studentId: r.studentId,
              student: r.studentName,
              status: r.status,
              score: r.score ?? null,
              maxPoints: a.maxPoints,
              autoScore: r.autoScore ?? null,
              submittedAt: r.submittedAt,
              publishedAt: r.publishedAt ?? null,
              late: r.late,
              rootAssignmentId: a.rootAssignmentId,
              attemptNo: a.attemptNo,
              practiceRetake: a.practiceRetake,
              countsTowardAnalytics: r.countsTowardAnalytics === true,
            };
          });
        recordAudit({
          actorId: userId,
          action: "TEACHING_GRADES_EXPORTED",
          target: orgId,
          after: { rows: rows.length },
        });
        if (options.format === "json")
          return {
            content: JSON.stringify(
              { organizationId: orgId, exportedAt: stamp(), rows },
              null,
              2,
            ),
            contentType: "application/json; charset=utf-8",
            filename: "lumio-grades.json",
          };
        const fields = [
          "assignmentId",
          "assignment",
          "studentId",
          "student",
          "status",
          "score",
          "maxPoints",
          "autoScore",
          "submittedAt",
          "publishedAt",
          "late",
          "rootAssignmentId",
          "attemptNo",
          "practiceRetake",
          "countsTowardAnalytics",
        ] as const;
        const cell = (value: unknown) => {
          let s = value === null || value === undefined ? "" : String(value);
          if (/^(?:[\t\r\n]|[\s\uFEFF]*[=+\-@])/u.test(s)) s = "'" + s;
          return '"' + s.replace(/"/g, '""') + '"';
        };
        return {
          content:
            "\ufeff" +
            [
              fields.map(cell).join(","),
              ...rows.map((row) =>
                fields.map((key) => cell(row[key])).join(","),
              ),
            ].join("\r\n"),
          contentType: "text/csv; charset=utf-8",
          filename: "lumio-grades.csv",
        };
      });
    },
  };
}
