// Actual teaching/history handlers and isolated SQLite; synthetic OAuth session only, no providers or real learner records.
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  ts = require("typescript"),
  { DatabaseSync } = require("node:sqlite");
const root = path.resolve(__dirname, ".."),
  cache = new Map(),
  checks = [];
let session = null,
  clock = Date.now(),
  store;
function load(relative) {
  const file = path.resolve(root, relative);
  if (file === path.join(root, "lib/lumio/auth.ts"))
    return { authOptions: () => ({}) };
  if (cache.has(file)) return cache.get(file).exports;
  const m = { exports: {} };
  cache.set(file, m);
  new Function(
    "require",
    "module",
    "exports",
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
  )(
    (n) =>
      n === "next-auth"
        ? { getServerSession: async () => session }
        : n.startsWith(".")
          ? load(
              path.relative(root, path.resolve(path.dirname(file), n + ".ts")),
            )
          : require(n),
    m,
    m.exports,
  );
  return m.exports;
}
const env = {
    NODE_ENV: "development",
    AUTH_TRUST_HOST: "true",
    NEXTAUTH_URL: "http://127.0.0.1:3000",
    NEXTAUTH_SECRET: "synthetic-history-fixture-secret-only",
    LUMIO_COMPETITION_PREVIEW: "false",
    LUMIO_BACKGROUND_JOBS_DISABLED: "true",
  },
  saved = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]])),
  originalFetch = global.fetch;
Object.assign(process.env, env);
global.fetch = async () => {
  throw Error("EXTERNAL_NETWORK_FORBIDDEN");
};
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "lumio-v7-retakes-")),
  file = path.join(folder, "test.sqlite"),
  platform = load("lib/server/store.ts"),
  options = { adminEmails: ["grade-owner@example.test"], now: () => clock };
store = platform.createStore(file, options);
const db = new DatabaseSync(file);
db.exec("PRAGMA foreign_keys=ON");
Object.assign(platform, {
  getStore: () => store,
  getUser: (id) => store.getUser(id),
});
const api = load("app/api/teaching/route.ts"),
  history = load("app/api/teaching/grade-history/route.ts"),
  origin = "http://127.0.0.1:3000";
let serial = 0;
const user = (name, extra = {}) =>
    store.ensureIdentity({
      provider: "google",
      providerAccountId: "grade-history-" + ++serial,
      name: "Synthetic " + name,
      emailVerified: false,
      ...extra,
    }),
  owner = user("owner", {
    email: "grade-owner@example.test",
    emailVerified: true,
  }),
  teacher = user("teacher"),
  colleague = user("colleague"),
  student = user("student"),
  otherStudent = user("other student"),
  outsider = user("outsider");
const profile = {
  applicantName: "Synthetic teacher declaration",
  countryCode: "VN",
  country: "Việt Nam",
  provinceCity: "Tỉnh kiểm thử",
  ward: "Phường kiểm thử",
  school: "Synthetic school",
  teachingLevel: "lower_secondary",
  subjects: ["Toán"],
  teacherDeclaration: true,
  storageConsent: true,
};
function approve(u) {
  const a = store.submitTeacherApplication(u.id, u.sessionVersion, {
    requestId: crypto.randomUUID(),
    expectedRevision: 0,
    profile,
  }).application;
  store.reviewTeacherApplication(owner.id, owner.sessionVersion, {
    requestId: crypto.randomUUID(),
    applicationId: a.id,
    expectedRevision: a.revision,
    action: "approve",
    note: "Synthetic fixture only",
  });
}
function req(u, pathName, method = "GET", body, headers = {}) {
  session = u ? { userId: u.id, sessionVersion: u.sessionVersion } : null;
  return new Request(origin + pathName, {
    method,
    headers: {
      ...(u ? { "x-lumio-account": u.storageKey } : {}),
      ...(method === "GET"
        ? {}
        : { origin, "content-type": "application/json" }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function call(route, r, status = 200, code) {
  const response = await route[r.method](r),
    body = await response.json();
  assert.equal(response.status, status, JSON.stringify(body));
  assert.match(response.headers.get("cache-control"), /no-store/);
  if (code) assert.equal(body.error, code);
  return body;
}
const post = (u, b, status = 200, code) =>
  call(
    api,
    req(u, "/api/teaching", "POST", { requestId: crypto.randomUUID(), ...b }),
    status,
    code,
  );
let orgId, classId, questionId, assignmentId, submissionId;
const state = (u = teacher) =>
    store.readTeaching(u.id, u.sessionVersion, { orgId }),
  sub = () => state().submissions.find((s) => s.id === submissionId),
  events = () =>
    db
      .prepare(
        "SELECT * FROM teaching_grade_events WHERE submission_id=? ORDER BY sequence",
      )
      .all(submissionId),
  read = (u = teacher, extra = "", status = 200, code) =>
    call(
      history,
      req(
        u,
        "/api/teaching/grade-history?orgId=" +
          orgId +
          "&submissionId=" +
          submissionId +
          extra,
      ),
      status,
      code,
    );
const grade = (patch = {}) => ({
    action: "submission.grade",
    orgId,
    id: submissionId,
    expectedRevision: sub().revision,
    grades: [{ questionId, points: 1, feedback: "Public question feedback" }],
    feedback: "Public overall feedback",
    confirmed: true,
    ...patch,
  }),
  publish = () => ({
    action: "submission.publish",
    orgId,
    id: submissionId,
    expectedRevision: sub().revision,
  });
async function newSubmission() {
  const a = await post(teacher, {
    action: "assignment.create",
    orgId,
    draft: {
      classId,
      title: "Authored assessment " + serial++,
      instructions: "Synthetic task",
      questionIds: [questionId],
      target: { kind: "students", ids: [student.id] },
      dueAt: new Date(clock + 86400000).toISOString(),
    },
  });
  assignmentId = a.result.id;
  await post(teacher, {
    action: "assignment.review",
    orgId,
    id: assignmentId,
    expectedRevision: 1,
  });
  await post(teacher, {
    action: "assignment.issue",
    orgId,
    id: assignmentId,
    expectedRevision: 2,
  });
  submissionId = (
    await post(student, {
      action: "submission.submit",
      orgId,
      assignmentId,
      expectedRevision: 0,
      answers: [{ questionId, response: 0 }],
    })
  ).result.id;
}
async function check(name, fn) {
  await fn();
  checks.push({ name, status: "PASS" });
  console.log("PASS " + name);
}
const assignment = (id) => state().assignments.find((a) => a.id === id),
  count = (table) =>
    Number(db.prepare("SELECT count(*) n FROM " + table).get().n);
async function issueWindow(extra = {}) {
  const r = await post(teacher, {
      action: "assignment.create",
      orgId,
      draft: {
        classId,
        title: "Synthetic immutable assessment " + serial++,
        instructions: "Private scheduled question instructions",
        questionIds: [questionId],
        target: { kind: "students", ids: [student.id] },
        dueAt: new Date(clock + 86400000).toISOString(),
        ...extra,
      },
    }),
    id = r.result.id;
  await post(teacher, {
    action: "assignment.review",
    orgId,
    id,
    expectedRevision: 1,
  });
  await post(teacher, {
    action: "assignment.issue",
    orgId,
    id,
    expectedRevision: 2,
  });
  return id;
}
async function submitAssignment(id) {
  assignmentId = id;
  submissionId = (
    await post(student, {
      action: "submission.submit",
      orgId,
      assignmentId: id,
      expectedRevision: 0,
      answers: [{ questionId, response: 0 }],
    })
  ).result.id;
  return submissionId;
}
async function confirmResult(points = 1) {
  await post(
    teacher,
    grade({
      grades: [
        { questionId, points, feedback: "Synthetic confirmed public feedback" },
      ],
    }),
  );
  await post(teacher, publish());
}
const grant = (root, patch = {}) => ({
  action: "assignment.retake",
  orgId,
  originalAssignmentId: root,
  expectedRevision: assignment(root).revision,
  studentId: student.id,
  availableFrom: new Date(clock + 60000).toISOString(),
  availableUntil: new Date(clock + 180000).toISOString(),
  reason: "Private teacher practice rationale",
  sameQuestionsAcknowledged: true,
  ...patch,
});
const childRows = (root) =>
  db
    .prepare(
      "SELECT * FROM teaching_assessment_windows WHERE root_assignment_id=? AND attempt_no>1 ORDER BY attempt_no",
    )
    .all(root);
let rootAssessment, child2, child3, grantOperation, originalSnapshot;
(async () => {
  try {
    approve(teacher);
    approve(colleague);
    orgId = (
      await post(teacher, {
        action: "org.create",
        name: "Synthetic practice organization",
      })
    ).result.id;
    classId = (
      await post(teacher, {
        action: "class.create",
        orgId,
        name: "Synthetic class",
        subject: "Math",
        grade: "9",
        description: "No real learner records",
      })
    ).result.id;
    const invite = await post(teacher, {
      action: "invite.create",
      orgId,
      classId,
      expectedRevision: state().classes[0].revision,
      expiresInDays: 7,
      maxUses: 5,
    });
    await post(student, {
      action: "class.join",
      code: invite.result.inviteCode,
    });
    await post(otherStudent, {
      action: "class.join",
      code: invite.result.inviteCode,
    });
    questionId = (
      await post(teacher, {
        action: "question.create",
        orgId,
        draft: {
          classId,
          prompt: "Tính 2 + 2.",
          kind: "mcq",
          choices: ["4", "3", "5", "6"],
          correctIndex: 0,
          explanation: "2 + 2 = 4.",
          maxPoints: 1,
          topic: "Số học",
          difficulty: "basic",
          references: [],
        },
      })
    ).result.id;
    await post(teacher, {
      action: "question.review",
      orgId,
      id: questionId,
      expectedRevision: 1,
    });
    await check(
      "Scheduled GET hides actual questions, IDs, keys and instructions before the server start",
      async () => {
        const start = clock + 60000,
          end = clock + 180000,
          id = await issueWindow({
            availableFrom: new Date(start).toISOString(),
            availableUntil: new Date(end).toISOString(),
            dueAt: new Date(clock + 120000).toISOString(),
          });
        const a = state(student).assignments.find((a) => a.id === id);
        assert.equal(a.availability, "not_open");
        assert.equal(a.canSubmit, false);
        assert.deepEqual(a.questions, []);
        assert.deepEqual(a.questionIds, []);
        assert.equal(a.instructions, "");
        assert.equal(a.questionCount, 1);
        assert.equal(a.attemptNo, 1);
        await post(
          student,
          {
            action: "submission.submit",
            orgId,
            assignmentId: id,
            expectedRevision: 0,
            answers: [{ questionId, response: 0 }],
          },
          409,
          "TEACHING_NOT_OPEN",
        );
        clock = start;
        await submitAssignment(id);
        assert.equal(
          state(student).assignments.find((a) => a.id === id).availability,
          "available",
        );
        clock = end;
        await post(
          student,
          {
            action: "submission.submit",
            orgId,
            assignmentId: id,
            expectedRevision: 1,
            answers: [{ questionId, response: 0 }],
          },
          409,
          "TEACHING_ASSIGNMENT_CLOSED",
        );
      },
    );
    await check(
      "Explicitly closed future work is labelled closed and never promises a later opening",
      async () => {
        const id = await issueWindow({
          availableFrom: new Date(clock + 60000).toISOString(),
          availableUntil: new Date(clock + 180000).toISOString(),
          dueAt: new Date(clock + 120000).toISOString(),
        });
        await post(teacher, {
          action: "assignment.close",
          orgId,
          id,
          expectedRevision: assignment(id).revision,
        });
        const closed = state(student).assignments.find((a) => a.id === id);
        assert.equal(closed.availability, "closed");
        assert.equal(closed.canSubmit, false);
        assert.deepEqual(closed.questions, []);
        await post(
          student,
          {
            action: "submission.submit",
            orgId,
            assignmentId: id,
            expectedRevision: 0,
            answers: [{ questionId, response: 0 }],
          },
          409,
          "TEACHING_ASSIGNMENT_CLOSED",
        );
      },
    );
    await check(
      "A hard end is exclusive and overrides allowLateSubmissions while pre-end late work is labelled",
      async () => {
        await post(teacher, {
          action: "settings.update",
          orgId,
          expectedRevision: state().organization.revision,
          name: state().organization.name,
          timezone: "Asia/Ho_Chi_Minh",
          allowLateSubmissions: true,
        });
        const due = clock + 60000,
          end = clock + 120000,
          id = await issueWindow({
            availableFrom: new Date(clock).toISOString(),
            availableUntil: new Date(end).toISOString(),
            dueAt: new Date(due).toISOString(),
          });
        clock = due + 1;
        await submitAssignment(id);
        assert.equal(sub().late, true);
        clock = end;
        await post(
          student,
          {
            action: "submission.submit",
            orgId,
            assignmentId: id,
            expectedRevision: 1,
            answers: [{ questionId, response: 0 }],
          },
          409,
          "TEACHING_ASSIGNMENT_CLOSED",
        );
        assert.equal(
          state(student).assignments.find((a) => a.id === id).canSubmit,
          false,
        );
      },
    );
    await check(
      "Draft windows normalize explicit offset to UTC and reject naive/reversed/out-of-range data",
      async () => {
        const from = new Date(clock + 60000).toISOString(),
          until = new Date(clock + 180000).toISOString(),
          due = new Date(clock + 120000).toISOString();
        for (const extra of [
          { availableFrom: "2026-10-17T08:00:00" },
          { availableFrom: until, availableUntil: from },
          { availableUntil: from },
          { availableFrom: "2026-02-30T00:00:00Z" },
        ]) {
          const before = count("teaching_assignments");
          await post(
            teacher,
            {
              action: "assignment.create",
              orgId,
              draft: {
                classId,
                title: "Invalid synthetic window",
                instructions: "",
                questionIds: [questionId],
                target: { kind: "students", ids: [student.id] },
                dueAt: due,
                availableFrom: from,
                availableUntil: until,
                ...extra,
              },
            },
            400,
            "TEACHING_INVALID_WINDOW",
          );
          assert.equal(count("teaching_assignments"), before);
        }
        const offset = new Date(clock + 60000)
            .toISOString()
            .replace("Z", "+00:00"),
          id = await issueWindow({
            availableFrom: offset,
            availableUntil: until,
            dueAt: due,
          });
        assert.equal(
          assignment(id).availableFrom,
          new Date(offset).toISOString(),
        );
      },
    );
    await check(
      "Issued window, questions and targets cannot be edited via the existing update action",
      async () => {
        const id = await issueWindow(),
          old = db
            .prepare(
              "SELECT * FROM teaching_assessment_windows WHERE assignment_id=?",
            )
            .get(id),
          a = assignment(id);
        await post(
          teacher,
          {
            action: "assignment.update",
            orgId,
            id,
            expectedRevision: a.revision,
            draft: {
              classId,
              title: a.title,
              instructions: a.instructions,
              questionIds: [questionId],
              target: { kind: "students", ids: [student.id] },
              dueAt: a.dueAt,
              availableFrom: new Date(clock + 60000).toISOString(),
            },
          },
          409,
          "TEACHING_ASSIGNMENT_IMMUTABLE",
        );
        assert.deepEqual(
          db
            .prepare(
              "SELECT * FROM teaching_assessment_windows WHERE assignment_id=?",
            )
            .get(id),
          old,
        );
      },
    );
    rootAssessment = await issueWindow();
    await submitAssignment(rootAssessment);
    await check(
      "Practice retake requires a previously teacher-graded original attempt",
      async () => {
        await post(
          teacher,
          grant(rootAssessment),
          409,
          "TEACHING_RETAKE_GRADE_REQUIRED",
        );
        assert.equal(childRows(rootAssessment).length, 0);
        await confirmResult();
        originalSnapshot = db
          .prepare("SELECT data_json FROM teaching_assignments WHERE id=?")
          .get(rootAssessment).data_json;
      },
    );
    await check(
      "Retake grant requires literal acknowledgement and eligible original student; no forged snapshot input",
      async () => {
        for (const sameQuestionsAcknowledged of [
          undefined,
          false,
          [],
          ["true"],
        ])
          await post(
            teacher,
            grant(rootAssessment, { sameQuestionsAcknowledged }),
            400,
            "TEACHING_RETAKE_ACK_REQUIRED",
          );
        await post(
          teacher,
          grant(rootAssessment, { studentId: otherStudent.id }),
          403,
          "TEACHING_INVALID_RECIPIENT",
        );
        await post(
          teacher,
          { ...grant(rootAssessment), questions: [] },
          400,
          "INVALID_TEACHING_DATA",
        );
        await post(
          teacher,
          grant(rootAssessment, { reason: "" }),
          400,
          "INVALID_TEACHING_DATA",
        );
        assert.equal(childRows(rootAssessment).length, 0);
      },
    );
    await check(
      "Source edits do not rewrite the issued retake question snapshot",
      async () => {
        const q = state().questions.find((q) => q.id === questionId);
        await post(teacher, {
          action: "question.update",
          orgId,
          id: questionId,
          expectedRevision: q.revision,
          draft: {
            classId,
            prompt: "Tính 3 + 3.",
            kind: "mcq",
            choices: ["6", "4", "5", "7"],
            correctIndex: 0,
            explanation: "3 + 3 = 6.",
            maxPoints: 1,
            topic: "Số học",
            difficulty: "basic",
            references: [],
          },
        });
        await post(teacher, {
          action: "question.review",
          orgId,
          id: questionId,
          expectedRevision: q.revision + 1,
        });
        grantOperation = {
          ...grant(rootAssessment),
          requestId: crypto.randomUUID(),
        };
        const r = await post(teacher, grantOperation);
        child2 = r.result.id;
        assert.equal(r.result.attemptNo, 2);
        assert.equal(assignment(child2).practiceRetake, true);
        assert.deepEqual(
          JSON.parse(
            db
              .prepare("SELECT data_json FROM teaching_assignments WHERE id=?")
              .get(child2).data_json,
          ).questions,
          JSON.parse(originalSnapshot).questions,
        );
        assert.equal(
          db
            .prepare("SELECT data_json FROM teaching_assignments WHERE id=?")
            .get(rootAssessment).data_json,
          originalSnapshot,
        );
      },
    );
    await check(
      "Lost ACK and a second SQLite connection replay one child without a consumed extra attempt",
      async () => {
        const before = count("teaching_assignments"),
          r = await post(teacher, grantOperation);
        assert.equal(r.replayed, true);
        assert.equal(r.result.id, child2);
        const second = platform.createStore(file, options);
        try {
          assert.equal(
            second.mutateTeaching(teacher.id, teacher.sessionVersion, {
              requestId: grantOperation.requestId,
              ...grantOperation,
            }).replayed,
            true,
          );
        } finally {
          second.close();
        }
        assert.equal(count("teaching_assignments"), before);
        assert.equal(childRows(rootAssessment).length, 1);
        await post(
          teacher,
          { ...grantOperation, requestId: crypto.randomUUID() },
          409,
          "TEACHING_CONFLICT",
        );
        await post(
          teacher,
          grant(rootAssessment),
          409,
          "TEACHING_RETAKE_PENDING",
        );
      },
    );
    await check(
      "Child has one target, hides future question content and private reason, including when class is archived",
      async () => {
        assert.deepEqual(assignment(child2).recipientIds, [student.id]);
        assert.equal(
          state(otherStudent).assignments.some((a) => a.id === child2),
          false,
        );
        const own = state(student).assignments.find((a) => a.id === child2);
        assert.deepEqual(own.questions, []);
        assert.doesNotMatch(
          JSON.stringify(state(student)),
          /Private teacher practice rationale|acknowledged/,
        );
        const c = state().classes[0],
          base = {
            action: "class.update",
            orgId,
            id: classId,
            name: c.name,
            subject: c.subject,
            grade: c.grade,
            description: c.description,
          };
        await post(teacher, {
          ...base,
          expectedRevision: c.revision,
          archived: true,
        });
        assert.deepEqual(
          state(student).assignments.find((a) => a.id === child2).questions,
          [],
        );
        await post(teacher, {
          ...base,
          expectedRevision: c.revision + 1,
          archived: false,
        });
      },
    );
    await check(
      "Cached child submission is rejected before start; an ungraded child remains the only pending attempt",
      async () => {
        await post(
          student,
          {
            action: "submission.submit",
            orgId,
            assignmentId: child2,
            expectedRevision: 0,
            answers: [{ questionId, response: 0 }],
          },
          409,
          "TEACHING_NOT_OPEN",
        );
        clock = Date.parse(assignment(child2).availableFrom);
        await submitAssignment(child2);
        await post(
          teacher,
          grant(rootAssessment),
          409,
          "TEACHING_RETAKE_PENDING",
        );
        await post(teacher, {
          action: "assignment.close",
          orgId,
          id: child2,
          expectedRevision: assignment(child2).revision,
        });
        await post(
          teacher,
          grant(rootAssessment),
          409,
          "TEACHING_RETAKE_PENDING",
        );
        await confirmResult(0.29);
      },
    );
    await check(
      "A third practice attempt preserves the original and second submitted answer/grade/history rows",
      async () => {
        const before = db
            .prepare(
              "SELECT * FROM teaching_submissions WHERE assignment_id IN(?,?) ORDER BY id",
            )
            .all(rootAssessment, child2),
          r = await post(
            teacher,
            grant(rootAssessment, {
              availableFrom: new Date(clock).toISOString(),
              availableUntil: new Date(clock + 300000).toISOString(),
            }),
          );
        child3 = r.result.id;
        assert.equal(r.result.attemptNo, 3);
        await submitAssignment(child3);
        await confirmResult();
        assert.deepEqual(
          db
            .prepare(
              "SELECT * FROM teaching_submissions WHERE assignment_id IN(?,?) ORDER BY id",
            )
            .all(rootAssessment, child2),
          before,
        );
        assert.equal(childRows(rootAssessment).length, 2);
        await post(
          teacher,
          grant(rootAssessment),
          409,
          "TEACHING_RETAKE_LIMIT",
        );
        await post(
          teacher,
          grant(child3),
          409,
          "TEACHING_RETAKE_ROOT_REQUIRED",
        );
      },
    );
    await check(
      "Three attempts of one root remain one assessment and only the newest published attempt counts",
      async () => {
        const a = state().analytics.find((a) => a.studentId === student.id);
        assert.equal(a.assessments, 1);
        assert.equal(a.topics[0].assessments, 1);
        assert.equal(a.topics[0].level, "insufficient");
        const family = state().submissions.filter((s) =>
          [rootAssessment, child2, child3].includes(s.assignmentId),
        );
        assert.equal(family.length, 3);
        assert.deepEqual(
          family
            .filter((s) => s.countsTowardAnalytics)
            .map((s) => s.assignmentId),
          [child3],
        );
        assert.equal(
          state(student).submissions.filter((s) => s.countsTowardAnalytics)
            .length,
          1,
        );
      },
    );
    await check(
      "An unpublished correction selects the previous published attempt without multiplying evidence",
      async () => {
        assignmentId = child3;
        submissionId = state().submissions.find(
          (s) => s.assignmentId === child3,
        ).id;
        await post(
          teacher,
          grade({
            reason: "Synthetic latest-attempt correction",
            grades: [
              {
                questionId,
                points: 0.5,
                feedback: "Private pending correction",
              },
            ],
          }),
        );
        const family = state().submissions.filter((s) =>
          [rootAssessment, child2, child3].includes(s.assignmentId),
        );
        assert.deepEqual(
          family
            .filter((s) => s.countsTowardAnalytics)
            .map((s) => s.assignmentId),
          [child2],
        );
        assert.equal(
          state().analytics.find((a) => a.studentId === student.id).assessments,
          1,
        );
        assert.equal(
          state(student).submissions.find((s) => s.assignmentId === child3)
            .score,
          undefined,
        );
        await post(teacher, publish());
      },
    );
    await check(
      "Exports label immutable root/attempt and evidence selection without leaking other students",
      async () => {
        const data = JSON.parse(
            store.exportTeaching(student.id, student.sessionVersion, {
              orgId,
              format: "json",
            }).content,
          ),
          family = data.rows.filter(
            (r) => r.rootAssignmentId === rootAssessment,
          );
        assert.equal(family.length, 3);
        assert.deepEqual(family.map((r) => r.attemptNo).sort(), [1, 2, 3]);
        assert.equal(family.filter((r) => r.countsTowardAnalytics).length, 1);
        assert.equal(
          data.rows.every((r) => r.studentId === student.id),
          true,
        );
      },
    );
    await check(
      "Three distinct roots are still required for a mastery label after practice retakes",
      async () => {
        for (let i = 0; i < 2; i++) {
          const id = await issueWindow();
          await submitAssignment(id);
          await confirmResult();
        }
        const a = state().analytics.find((a) => a.studentId === student.id);
        assert.equal(a.assessments, 3);
        assert.equal(a.topics[0].assessments, 3);
        assert.equal(a.topics[0].level, "secure");
      },
    );
    await check(
      "An unused expired child consumes its attempt but permits the last explicit grant without fake submissions",
      async () => {
        const root = await issueWindow();
        await submitAssignment(root);
        await confirmResult();
        const end = clock + 1000,
          r = await post(
            teacher,
            grant(root, {
              availableFrom: new Date(clock).toISOString(),
              availableUntil: new Date(end).toISOString(),
            }),
          );
        clock = end;
        const third = await post(teacher, grant(root));
        assert.equal(third.result.attemptNo, 3);
        assert.equal(
          db
            .prepare(
              "SELECT count(*) n FROM teaching_submissions WHERE assignment_id=?",
            )
            .get(r.result.id).n,
          0,
        );
      },
    );
    await check(
      "Retake insert/audit faults rollback child, target, window, parent revision and operation together",
      async () => {
        const root = await issueWindow();
        await submitAssignment(root);
        await confirmResult();
        for (const trigger of [
          "CREATE TRIGGER fail_retake BEFORE INSERT ON teaching_assessment_windows WHEN NEW.attempt_no>1 BEGIN SELECT RAISE(ABORT,'SYNTHETIC_WINDOW_FAILURE'); END",
          "CREATE TRIGGER fail_retake BEFORE INSERT ON audit_events WHEN NEW.action='TEACHING_ASSIGNMENT_RETAKE' BEGIN SELECT RAISE(ABORT,'SYNTHETIC_AUDIT_FAILURE'); END",
        ]) {
          const counts = [
              "teaching_assignments",
              "teaching_assignment_targets",
              "teaching_assessment_windows",
            ].map(count),
            rev = assignment(root).revision,
            requestId = crypto.randomUUID();
          db.exec(trigger);
          try {
            await post(
              teacher,
              { ...grant(root), requestId },
              503,
              "PLATFORM_UNAVAILABLE",
            );
          } finally {
            db.exec("DROP TRIGGER fail_retake");
          }
          assert.deepEqual(
            [
              "teaching_assignments",
              "teaching_assignment_targets",
              "teaching_assessment_windows",
            ].map(count),
            counts,
          );
          assert.equal(assignment(root).revision, rev);
          assert.equal(
            db
              .prepare(
                "SELECT count(*) n FROM teaching_operations WHERE request_id=?",
              )
              .get(requestId).n,
            0,
          );
        }
        const r = await post(teacher, grant(root));
        assert.equal(r.result.attemptNo, 2);
      },
    );
    await check(
      "Current enrollment, bound account, role and credential protect grant/read/replay",
      async () => {
        const enrollment = state().enrollments.find(
          (e) => e.userId === student.id && e.classId === classId,
        );
        await post(teacher, {
          action: "enrollment.remove",
          orgId,
          id: enrollment.id,
          expectedRevision: enrollment.revision,
        });
        await post(teacher, grantOperation, 403, "TEACHING_INVALID_RECIPIENT");
        assert.throws(
          () =>
            store.readTeaching(student.id, student.sessionVersion, {
              orgId,
              classId,
            }),
          (e) => e.code === "TEACHING_FORBIDDEN",
        );
        const removed = state().enrollments.find((e) => e.id === enrollment.id);
        await post(teacher, {
          action: "enrollment.restore",
          orgId,
          id: removed.id,
          expectedRevision: removed.revision,
        });
        await call(
          api,
          req(teacher, "/api/teaching", "POST", grantOperation, {
            "x-lumio-account": student.storageKey,
          }),
          401,
          "SESSION_REVOKED",
        );
        await post(student, grant(rootAssessment), 403, "TEACHING_FORBIDDEN");
        await post(colleague, grant(rootAssessment), 403, "TEACHING_FORBIDDEN");
        const a = store.readTeacherApplication(
          teacher.id,
          teacher.sessionVersion,
        ).application;
        store.reviewTeacherApplication(owner.id, owner.sessionVersion, {
          requestId: crypto.randomUUID(),
          applicationId: a.id,
          expectedRevision: a.revision,
          action: "revoke",
          note: "Synthetic retake revoke",
        });
        await post(teacher, grantOperation, 403, "TEACHER_APPROVAL_REQUIRED");
        db.prepare(
          "UPDATE teacher_applications SET status='approved' WHERE id=?",
        ).run(a.id);
        db.prepare(
          "UPDATE teacher_credentials SET active=1 WHERE user_id=?",
        ).run(teacher.id);
        assert.equal((await post(teacher, grantOperation)).replayed, true);
      },
    );
    await check(
      "Distinct concurrent HTTP grants create only one child and a closed original can issue practice",
      async () => {
        const root = await issueWindow();
        await submitAssignment(root);
        await confirmResult();
        await post(teacher, {
          action: "assignment.close",
          orgId,
          id: root,
          expectedRevision: assignment(root).revision,
        });
        const body = grant(root),
          responses = await Promise.all([
            post(teacher, body),
            call(
              api,
              req(teacher, "/api/teaching", "POST", {
                requestId: crypto.randomUUID(),
                ...body,
              }),
              409,
              "TEACHING_CONFLICT",
            ),
          ]);
        assert.equal(responses[0].result.attemptNo, 2);
        assert.equal(childRows(root).length, 1);
        assert.equal(assignment(root).status, "closed");
      },
    );
    await check(
      "Foreign-organization and unassigned-class teachers cannot grant, read or replay a practice child",
      async () => {
        const foreign = (
          await post(colleague, {
            action: "org.create",
            name: "Synthetic unrelated organization",
          })
        ).result.id;
        await post(
          colleague,
          { ...grant(rootAssessment), orgId: foreign },
          404,
          "TEACHING_NOT_FOUND",
        );
        const sibling = (
          await post(teacher, {
            action: "class.create",
            orgId,
            name: "Sibling synthetic class",
            subject: "Math",
            grade: "9",
            description: "",
          })
        ).result.id;
        await post(teacher, {
          action: "teacher.assign",
          orgId,
          classId: sibling,
          userId: colleague.id,
          expectedRevision: state().classes.find((c) => c.id === sibling)
            .revision,
        });
        await post(colleague, grant(rootAssessment), 403, "TEACHING_FORBIDDEN");
        await call(
          api,
          req(
            colleague,
            "/api/teaching?orgId=" + orgId + "&classId=" + classId,
          ),
          403,
          "TEACHING_FORBIDDEN",
        );
        await post(teacher, {
          action: "teacher.assign",
          orgId,
          classId,
          userId: colleague.id,
          expectedRevision: state().classes.find((c) => c.id === classId)
            .revision,
        });
        const root = await issueWindow();
        await submitAssignment(root);
        await confirmResult();
        const operation = { ...grant(root), requestId: crypto.randomUUID() };
        await post(colleague, operation);
        await post(teacher, {
          action: "teacher.remove",
          orgId,
          classId,
          userId: colleague.id,
          expectedRevision: state().classes.find((c) => c.id === classId)
            .revision,
        });
        await post(colleague, operation, 403, "TEACHING_FORBIDDEN");
      },
    );
    await check(
      "Session revocation rejects both current JSON reads and a previously accepted grant replay",
      async () => {
        const before = count("teaching_assessment_windows");
        db.prepare(
          "UPDATE users SET session_version=session_version+1 WHERE id=?",
        ).run(teacher.id);
        await post(teacher, grantOperation, 401, "SESSION_REVOKED");
        await call(
          api,
          req(teacher, "/api/teaching?orgId=" + orgId),
          401,
          "SESSION_REVOKED",
        );
        teacher.sessionVersion = store.getUser(teacher.id).sessionVersion;
        assert.equal(count("teaching_assessment_windows"), before);
      },
    );
    await check(
      "Schema15 upgrade backfills windows while preserving issued bytes, submission IDs and immutable grade events",
      () => {
        const legacyFile = path.join(folder, "genuine15.sqlite"),
          d = new DatabaseSync(legacyFile),
          stamp = new Date(clock).toISOString();
        d.exec(
          "PRAGMA foreign_keys=ON;CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL)",
        );
        for (const m of load("lib/server/schema.ts").migrations.filter(
          (m) => m.version <= 15,
        )) {
          d.exec(m.sql);
          d.prepare("INSERT INTO schema_migrations VALUES(?,?)").run(
            m.version,
            stamp,
          );
        }
        for (const [id, role] of [
          ["legacy-teacher", "SUPER_ADMIN"],
          ["legacy-student", "USER"],
        ])
          d.prepare(
            "INSERT INTO users(id,storage_key,name,role,created_at,last_seen_at) VALUES(?,?,?,?,?,?)",
          ).run(id, "synthetic-" + id, "Synthetic " + id, role, stamp, stamp);
        d.prepare(
          "INSERT INTO organizations VALUES('legacy-org','Synthetic legacy practice',?)",
        ).run(stamp);
        d.prepare(
          "INSERT INTO memberships VALUES('legacy-teacher','legacy-org','OWNER')",
        ).run();
        d.prepare(
          "INSERT INTO memberships VALUES('legacy-student','legacy-org','STUDENT')",
        ).run();
        d.prepare(
          "INSERT INTO teaching_organizations VALUES('legacy-org',1,?,'legacy-teacher')",
        ).run('{"timezone":"UTC","allowLateSubmissions":false}');
        d.prepare(
          "INSERT INTO teaching_classes(id,organization_id,name,subject,grade,description,created_at) VALUES('legacy-class','legacy-org','Synthetic legacy class','Math','9','',?)",
        ).run(stamp);
        d.prepare(
          "INSERT INTO teaching_enrollments(id,class_id,user_id,joined_at) VALUES('legacy-enrollment','legacy-class','legacy-student',?)",
        ).run(stamp);
        const data = JSON.stringify({
          title: "Synthetic frozen assessment",
          instructions: "Original exact instructions",
          questionIds: ["legacy-q"],
          questions: [
            {
              id: "legacy-q",
              revision: 1,
              prompt: "Tính 2 + 2.",
              kind: "mcq",
              choices: ["4", "3"],
              correctIndex: 0,
              maxPoints: 1,
              topic: "Math",
              difficulty: "basic",
            },
          ],
          target: { kind: "students", ids: ["legacy-student"] },
          dueAt: new Date(clock + 86400000).toISOString(),
          maxPoints: 1,
        });
        d.prepare(
          "INSERT INTO teaching_assignments(id,organization_id,class_id,data_json,status,revision,created_by,created_at,issued_at) VALUES('legacy-assignment','legacy-org','legacy-class',?,'issued',3,'legacy-teacher',?,?)",
        ).run(data, stamp, stamp);
        d.prepare(
          "INSERT INTO teaching_assignment_targets VALUES('legacy-assignment','legacy-student')",
        ).run();
        const answers = '[{"questionId":"legacy-q","response":0}]',
          grades =
            '[{"questionId":"legacy-q","points":1,"feedback":"Synthetic public grade"}]';
        d.prepare(
          "INSERT INTO teaching_submissions(id,assignment_id,student_id,answers_json,submitted_at,late,status,revision,grades_json,score,feedback,confirmed_at,published_at) VALUES('legacy-submission','legacy-assignment','legacy-student',?,?,0,'published',3,?,1,'Synthetic public feedback',?,?)",
        ).run(answers, stamp, grades, stamp, stamp);
        d.prepare(
          "INSERT INTO teaching_grade_events(id,submission_id,submission_revision,kind,grade_version,grades_json,score,feedback,answers_digest,actor_id,recorded_at,confirmed_at) VALUES('legacy-grade','legacy-submission',2,'grade',1,?,1,'Synthetic public feedback',?,'legacy-teacher',?,?)",
        ).run(
          grades,
          require("node:crypto")
            .createHash("sha256")
            .update(answers)
            .digest("hex"),
          stamp,
          stamp,
        );
        d.prepare(
          "INSERT INTO teaching_grade_events(id,submission_id,submission_revision,kind,grade_version,grade_event_id,actor_id,recorded_at,published_at) VALUES('legacy-publish','legacy-submission',3,'publish',1,'legacy-grade','legacy-teacher',?,?)",
        ).run(stamp, stamp);
        const before = d
          .prepare("SELECT * FROM teaching_grade_events ORDER BY sequence")
          .all();
        d.close();
        const upgraded = platform.createStore(legacyFile, options),
          verify = new DatabaseSync(legacyFile);
        try {
          const state = upgraded.readTeaching("legacy-teacher", 1, {
              orgId: "legacy-org",
            }),
            a = state.assignments[0];
          assert.equal(a.rootAssignmentId, "legacy-assignment");
          assert.equal(a.attemptNo, 1);
          assert.equal(a.availableFrom, stamp);
          assert.equal(a.availableUntil, null);
          assert.equal(state.submissions[0].id, "legacy-submission");
          assert.equal(
            verify
              .prepare(
                "SELECT data_json FROM teaching_assignments WHERE id='legacy-assignment'",
              )
              .get().data_json,
            data,
          );
          assert.deepEqual(
            verify
              .prepare("SELECT * FROM teaching_grade_events ORDER BY sequence")
              .all(),
            before,
          );
          assert.equal(
            upgraded.readTeachingGradeHistory("legacy-student", 1, {
              orgId: "legacy-org",
              submissionId: "legacy-submission",
            }).events.length,
            1,
          );
        } finally {
          verify.close();
          upgraded.close();
        }
        const reopened = platform.createStore(legacyFile, options),
          again = new DatabaseSync(legacyFile);
        try {
          assert.equal(
            again
              .prepare("SELECT count(*) n FROM teaching_assessment_windows")
              .get().n,
            1,
          );
          assert.equal(
            again
              .prepare(
                "SELECT count(*) n FROM schema_migrations WHERE version=16",
              )
              .get().n,
            1,
          );
        } finally {
          again.close();
          reopened.close();
        }
      },
    );
    await check(
      "No retake/window/grade operation calls providers or modifies AI credit balances",
      () => {
        for (const u of [teacher, student, otherStudent])
          assert.equal(
            store.getBillingSnapshot(u.id, u.sessionVersion).account.balance,
            200,
          );
        const reopened = platform.createStore(file, options);
        try {
          assert.equal(reopened.runtimeHealth().schemaVersion, 20);
          assert.equal(
            reopened
              .readTeaching(teacher.id, teacher.sessionVersion, { orgId })
              .assignments.find((a) => a.id === child3).attemptNo,
            3,
          );
        } finally {
          reopened.close();
        }
      },
    );
    const report = {
      status: "PASS",
      checkedAt: new Date().toISOString(),
      passed: checks.length,
      checks,
      schemaVersion: 20,
      providerRequests: 0,
      scope:
        "Actual teaching handlers and isolated SQLite; synthetic OAuth accounts, server clock, source questions and confirmed grades only. No provider/credit usage, real learner records, UI/deployment or secure-exam claim.",
      notImplemented: [
        "Timed/proctored exams",
        "Accommodations",
        "Different-question automatic retakes",
        "Automatic deadline/background scheduling",
      ],
    };
    fs.mkdirSync(path.join(root, "docs/v7/reports"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "docs/v7/reports/retakes.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log("Practice retakes: " + checks.length + " checks passed.");
  } finally {
    db.close();
    store.close();
    fs.rmSync(folder, { recursive: true, force: true });
    global.fetch = originalFetch;
    for (const [k, v] of Object.entries(saved))
      v === undefined ? delete process.env[k] : (process.env[k] = v);
  }
})().catch((e) => {
  console.error("Passed before failure: " + checks.length);
  console.error(e);
  process.exitCode = 1;
});
