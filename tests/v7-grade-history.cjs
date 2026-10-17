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
const folder = fs.mkdtempSync(
    path.join(os.tmpdir(), "lumio-v7-grade-history-"),
  ),
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
(async () => {
  try {
    approve(teacher);
    approve(colleague);
    orgId = (
      await post(teacher, {
        action: "org.create",
        name: "Synthetic history organization",
      })
    ).result.id;
    classId = (
      await post(teacher, {
        action: "class.create",
        orgId,
        name: "Synthetic class",
        subject: "Math",
        grade: "9",
        description: "No real students",
      })
    ).result.id;
    let c = state().classes[0];
    const invite = await post(teacher, {
      action: "invite.create",
      orgId,
      classId,
      expectedRevision: c.revision,
      expiresInDays: 2,
      maxUses: 4,
    });
    await post(student, {
      action: "class.join",
      code: invite.result.inviteCode,
    });
    await post(otherStudent, {
      action: "class.join",
      code: invite.result.inviteCode,
    });
    const q = await post(teacher, {
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
    });
    questionId = q.result.id;
    await post(teacher, {
      action: "question.review",
      orgId,
      id: questionId,
      expectedRevision: 1,
    });
    await newSubmission();
    await check(
      "First grade appends private immutable event; student sees no unpublished grade/history",
      async () => {
        await post(teacher, grade());
        const t = await read();
        assert.equal(t.events.length, 1);
        assert.equal(t.events[0].kind, "grade");
        assert.equal(t.events[0].gradeVersion, 1);
        assert.equal(t.events[0].recordedBy.userId, teacher.id);
        assert.equal(t.events[0].score, 1);
        assert.equal(t.events[0].legacy, false);
        assert.equal((await read(student)).events.length, 0);
        assert.equal(events()[0].answers_digest.length, 64);
      },
    );
    await check(
      "Explicit publish exposes only own public grade projection without reason/actor/hash/rubric",
      async () => {
        await post(teacher, publish());
        const r = await read(student);
        assert.equal(r.events.length, 1);
        assert.equal(r.events[0].kind, "publish");
        assert.equal(r.events[0].score, 1);
        assert.equal(r.events[0].feedback, "Public overall feedback");
        assert.doesNotMatch(
          JSON.stringify(r),
          /recordedBy|recordedAt|confirmedAt|reason|answersDigest|answers_digest|correctIndex|rubric|Public internal/,
        );
        assert.equal(events().length, 2);
      },
    );
    await check(
      "Regrade requires bounded explicit reason and leaves current and historical state unchanged on rejection",
      async () => {
        const before = sub(),
          old = events();
        for (const reason of [undefined, "", "   "])
          await post(
            teacher,
            grade({ reason }),
            400,
            "TEACHING_REGRADE_REASON_REQUIRED",
          );
        for (const reason of [[], 123, "x".repeat(1001), "bad\u0000reason"])
          await post(teacher, grade({ reason }), 400, "INVALID_TEACHING_DATA");
        assert.deepEqual(sub(), before);
        assert.deepEqual(events(), old);
      },
    );
    await check(
      "Regrade preserves original published event and hides new draft until explicit republish",
      async () => {
        const old = events();
        await post(
          teacher,
          grade({
            grades: [
              { questionId, points: 0.29, feedback: "New public feedback" },
            ],
            feedback: "Updated public feedback",
            reason: "Public internal review reason",
          }),
        );
        assert.equal(sub().status, "graded");
        assert.equal(sub().publishedAt, null);
        assert.equal(events().length, 3);
        assert.deepEqual(events().slice(0, 2), old);
        const own = await read(student);
        assert.equal(own.events.length, 1);
        assert.equal(own.events[0].score, 1);
        assert.doesNotMatch(
          JSON.stringify(own),
          /"(?:score|points)":0\.29(?:[,}])|Updated public|Public internal/,
        );
        const t = await read();
        assert.equal(t.events[0].gradeVersion, 2);
        assert.equal(t.events[0].reason, "Public internal review reason");
        await post(teacher, publish());
        const next = await read(student);
        assert.deepEqual(
          next.events.map((e) => e.score),
          [0.29, 1],
        );
        assert.doesNotMatch(JSON.stringify(next), /Public internal/);
      },
    );
    await check(
      "CAS and request replay append exactly one grade/publication event",
      async () => {
        const g = grade({
            reason: "Synthetic CAS correction",
            requestId: crypto.randomUUID(),
          }),
          before = events().length;
        await post(teacher, g);
        const replay = await post(teacher, g);
        assert.equal(replay.replayed, true);
        assert.equal(events().length, before + 1);
        await post(
          teacher,
          { ...g, requestId: crypto.randomUUID() },
          409,
          "TEACHING_CONFLICT",
        );
        const p = { ...publish(), requestId: crypto.randomUUID() };
        await post(teacher, p);
        await post(teacher, p);
        assert.equal(events().length, before + 2);
        await post(
          teacher,
          { ...g, reason: "Changed reason same UUID" },
          409,
          "TEACHING_REQUEST_REUSED",
        );
      },
    );
    await check(
      "History rejects tenant, sibling student, unrelated approved teacher and global admin without membership",
      async () => {
        await read(otherStudent, "", 403, "TEACHING_FORBIDDEN");
        await read(outsider, "", 403, "TEACHING_FORBIDDEN");
        await read(colleague, "", 403, "TEACHING_FORBIDDEN");
        await read(owner, "", 403, "TEACHING_FORBIDDEN");
        const foreign = (
          await post(colleague, {
            action: "org.create",
            name: "Unrelated synthetic organization",
          })
        ).result.id;
        await call(
          history,
          req(
            colleague,
            "/api/teaching/grade-history?orgId=" +
              foreign +
              "&submissionId=" +
              submissionId,
          ),
          404,
          "TEACHING_NOT_FOUND",
        );
      },
    );
    await check(
      "Canonical account headers, Origin/fetch-site/native boundaries protect read and mutation",
      async () => {
        for (const h of ["", student.storageKey])
          await call(
            history,
            req(
              teacher,
              "/api/teaching/grade-history?orgId=" +
                orgId +
                "&submissionId=" +
                submissionId,
              "GET",
              undefined,
              { "x-lumio-account": h },
            ),
            401,
            "SESSION_REVOKED",
          );
        await call(
          history,
          req(
            null,
            "/api/teaching/grade-history?orgId=" +
              orgId +
              "&submissionId=" +
              submissionId,
          ),
          401,
          "SIGN_IN_REQUIRED",
        );
        await call(
          history,
          req(
            teacher,
            "/api/teaching/grade-history?orgId=" +
              orgId +
              "&submissionId=" +
              submissionId,
            "GET",
            undefined,
            { "sec-fetch-site": "cross-site" },
          ),
          403,
          "INVALID_ORIGIN",
        );
        await call(
          history,
          req(
            teacher,
            "/api/teaching/grade-history?orgId=" +
              orgId +
              "&submissionId=" +
              submissionId,
            "GET",
            undefined,
            { authorization: "Bearer synthetic" },
          ),
          401,
          "SIGN_IN_REQUIRED",
        );
        const before = events();
        await call(
          api,
          req(
            teacher,
            "/api/teaching",
            "POST",
            {
              ...grade({ reason: "Hostile origin" }),
              requestId: crypto.randomUUID(),
            },
            { origin: "https://evil.invalid" },
          ),
          403,
          "INVALID_ORIGIN",
        );
        assert.deepEqual(events(), before);
      },
    );
    await check(
      "Bounded cursor pagination has no duplicates and cannot be moved to another submission",
      async () => {
        const first = await read(teacher, "&limit=2");
        assert.equal(first.events.length, 2);
        assert.equal(typeof first.nextCursor, "string");
        const second = await read(
          teacher,
          "&limit=2&cursor=" + encodeURIComponent(first.nextCursor),
        );
        assert.equal(second.events.length, 2);
        assert.equal(
          new Set([...first.events, ...second.events].map((e) => e.id)).size,
          4,
        );
        const prev = submissionId;
        await newSubmission();
        await read(
          teacher,
          "&cursor=" + encodeURIComponent(first.nextCursor),
          400,
          "INVALID_TEACHING_DATA",
        );
        submissionId = prev;
        for (const extra of [
          "&limit=0",
          "&limit=51",
          "&limit=1e1",
          "&limit=2&limit=3",
          "&unknown=x",
          "&cursor=bad",
          "&cursor=",
          "&orgId=" + orgId,
        ])
          await read(teacher, extra, 400, "INVALID_TEACHING_DATA");
      },
    );
    await check(
      "Append-only database triggers reject UPDATE/DELETE without changing event bytes",
      async () => {
        const before = events(),
          id = before[0].id;
        assert.throws(
          () =>
            db
              .prepare("UPDATE teaching_grade_events SET feedback=? WHERE id=?")
              .run("Tampered", id),
          /IMMUTABLE/,
        );
        assert.throws(
          () =>
            db.prepare("DELETE FROM teaching_grade_events WHERE id=?").run(id),
          /IMMUTABLE/,
        );
        assert.deepEqual(events(), before);
      },
    );
    await check(
      "Event-insert fault rolls back grade projection, event, audit and idempotency atomically",
      async () => {
        const before = sub(),
          old = events(),
          op = crypto.randomUUID(),
          audits = db.prepare("SELECT count(*) n FROM audit_events").get().n;
        db.exec(
          "CREATE TRIGGER fail_grade_event BEFORE INSERT ON teaching_grade_events WHEN NEW.kind='grade' BEGIN SELECT RAISE(ABORT,'SYNTHETIC_GRADE_EVENT_FAILURE'); END",
        );
        try {
          await post(
            teacher,
            grade({ reason: "Synthetic event fault", requestId: op }),
            503,
            "PLATFORM_UNAVAILABLE",
          );
        } finally {
          db.exec("DROP TRIGGER fail_grade_event");
        }
        assert.deepEqual(sub(), before);
        assert.deepEqual(events(), old);
        assert.equal(
          db
            .prepare(
              "SELECT count(*) n FROM teaching_operations WHERE request_id=?",
            )
            .get(op).n,
          0,
        );
        assert.equal(
          db.prepare("SELECT count(*) n FROM audit_events").get().n,
          audits,
        );
      },
    );
    await check(
      "Publish-event fault restores graded/private status and permits explicit retry",
      async () => {
        await post(
          teacher,
          grade({ reason: "Prepare explicit publish fault" }),
        );
        const before = sub(),
          old = events(),
          op = crypto.randomUUID();
        db.exec(
          "CREATE TRIGGER fail_grade_publish BEFORE INSERT ON teaching_grade_events WHEN NEW.kind='publish' BEGIN SELECT RAISE(ABORT,'SYNTHETIC_PUBLISH_FAILURE'); END",
        );
        try {
          await post(
            teacher,
            { ...publish(), requestId: op },
            503,
            "PLATFORM_UNAVAILABLE",
          );
        } finally {
          db.exec("DROP TRIGGER fail_grade_publish");
        }
        assert.deepEqual(sub(), before);
        assert.deepEqual(events(), old);
        assert.equal(
          db
            .prepare(
              "SELECT count(*) n FROM teaching_operations WHERE request_id=?",
            )
            .get(op).n,
          0,
        );
        await post(teacher, { ...publish(), requestId: op });
      },
    );
    await check(
      "Audit failure rolls back otherwise valid new history and projection",
      async () => {
        const before = sub(),
          old = events(),
          op = crypto.randomUUID();
        db.exec(
          "CREATE TRIGGER fail_history_audit BEFORE INSERT ON audit_events WHEN NEW.action='TEACHING_SUBMISSION_GRADE' BEGIN SELECT RAISE(ABORT,'SYNTHETIC_AUDIT_FAILURE'); END",
        );
        try {
          await post(
            teacher,
            grade({ reason: "Audit failure test", requestId: op }),
            503,
            "PLATFORM_UNAVAILABLE",
          );
        } finally {
          db.exec("DROP TRIGGER fail_history_audit");
        }
        assert.deepEqual(sub(), before);
        assert.deepEqual(events(), old);
        assert.equal(
          db
            .prepare(
              "SELECT count(*) n FROM teaching_operations WHERE request_id=?",
            )
            .get(op).n,
          0,
        );
      },
    );
    await check(
      "An assigned teacher can read; removing the class assignment blocks history and old operation replay",
      async () => {
        await post(teacher, {
          action: "teacher.assign",
          orgId,
          classId,
          userId: colleague.id,
          expectedRevision: state().classes[0].revision,
        });
        assert.ok((await read(colleague)).events.length);
        const operation = grade({
          reason: "Synthetic colleague review",
          requestId: crypto.randomUUID(),
        });
        await post(colleague, operation);
        await post(teacher, {
          action: "teacher.remove",
          orgId,
          classId,
          userId: colleague.id,
          expectedRevision: state().classes[0].revision,
        });
        await read(colleague, "", 403, "TEACHING_FORBIDDEN");
        await post(colleague, operation, 403, "TEACHING_FORBIDDEN");
        await post(teacher, publish());
      },
    );
    await check(
      "Student enrollment removal blocks own published history and prior submit replay; restore preserves history",
      async () => {
        const before = events(),
          enrollment = state().enrollments.find(
            (e) => e.userId === student.id && e.classId === classId,
          );
        await post(teacher, {
          action: "enrollment.remove",
          orgId,
          id: enrollment.id,
          expectedRevision: enrollment.revision,
        });
        await read(student, "", 403, "TEACHING_FORBIDDEN");
        await post(
          student,
          grade({ reason: "Forged student grade" }),
          403,
          "TEACHING_FORBIDDEN",
        );
        const removed = state().enrollments.find((e) => e.id === enrollment.id);
        await post(teacher, {
          action: "enrollment.restore",
          orgId,
          id: removed.id,
          expectedRevision: removed.revision,
        });
        assert.ok((await read(student)).events.length);
        assert.deepEqual(events(), before);
      },
    );
    await check(
      "Revoked session blocks history and grading before any new event",
      async () => {
        const before = events(),
          body = grade({ reason: "Session race" });
        db.prepare(
          "UPDATE users SET session_version=session_version+1 WHERE id=?",
        ).run(teacher.id);
        await read(teacher, "", 401, "SESSION_REVOKED");
        await post(teacher, body, 401, "SESSION_REVOKED");
        teacher.sessionVersion = store.getUser(teacher.id).sessionVersion;
        assert.deepEqual(events(), before);
      },
    );
    await check(
      "Current teacher credential revocation blocks history, grade and lost-ACK replay",
      async () => {
        const operation = grade({
          reason: "Credential before revoke",
          requestId: crypto.randomUUID(),
        });
        await post(teacher, operation);
        const before = events(),
          a = store.readTeacherApplication(
            teacher.id,
            teacher.sessionVersion,
          ).application;
        store.reviewTeacherApplication(owner.id, owner.sessionVersion, {
          requestId: crypto.randomUUID(),
          applicationId: a.id,
          expectedRevision: a.revision,
          action: "revoke",
          note: "Synthetic credential revoke",
        });
        await read(teacher, "", 403, "TEACHER_APPROVAL_REQUIRED");
        await post(teacher, operation, 403, "TEACHER_APPROVAL_REQUIRED");
        assert.deepEqual(events(), before);
        // Restore only synthetic fixture records so later independent regression cases can run.
        db.prepare(
          "UPDATE teacher_applications SET status='approved' WHERE id=?",
        ).run(a.id);
        db.prepare(
          "UPDATE teacher_credentials SET active=1 WHERE user_id=?",
        ).run(teacher.id);
        await post(teacher, publish());
      },
    );
    await check(
      "Independent SQLite connection sees grade CAS/replay without duplicating an event",
      () => {
        const second = platform.createStore(file, options),
          body = {
            ...grade({ reason: "Second connection CAS" }),
            requestId: crypto.randomUUID(),
          },
          before = events().length;
        try {
          store.mutateTeaching(teacher.id, teacher.sessionVersion, body);
          assert.equal(
            second.mutateTeaching(teacher.id, teacher.sessionVersion, body)
              .replayed,
            true,
          );
          assert.throws(
            () =>
              second.mutateTeaching(teacher.id, teacher.sessionVersion, {
                ...body,
                requestId: crypto.randomUUID(),
              }),
            (e) => e.code === "TEACHING_CONFLICT",
          );
          assert.equal(events().length, before + 1);
        } finally {
          second.close();
        }
      },
    );
    await check(
      "A disabled actor cannot read history or replay a previously successful grade",
      async () => {
        const operation = {
          ...grade({ reason: "Before synthetic disable" }),
          requestId: crypto.randomUUID(),
        };
        await post(teacher, operation);
        const before = events();
        db.prepare("UPDATE users SET disabled=1 WHERE id=?").run(teacher.id);
        try {
          await read(teacher, "", 401, "SESSION_REVOKED");
          await post(teacher, operation, 401, "SESSION_REVOKED");
        } finally {
          db.prepare("UPDATE users SET disabled=0 WHERE id=?").run(teacher.id);
        }
        assert.deepEqual(events(), before);
        await post(teacher, publish());
      },
    );
    await check(
      "Removing organization membership blocks history and successful grade replay",
      async () => {
        await post(teacher, {
          action: "teacher.assign",
          orgId,
          classId,
          userId: colleague.id,
          expectedRevision: state().classes[0].revision,
        });
        const operation = {
          ...grade({ reason: "Before synthetic org removal" }),
          requestId: crypto.randomUUID(),
        };
        await post(colleague, operation);
        const before = events();
        await post(teacher, {
          action: "member.remove",
          orgId,
          userId: colleague.id,
          expectedRevision: state().organization.revision,
        });
        await read(colleague, "", 403, "TEACHING_FORBIDDEN");
        await post(colleague, operation, 403, "TEACHING_FORBIDDEN");
        assert.deepEqual(events(), before);
        await post(teacher, publish());
      },
    );
    await check(
      "Archived classes preserve authorized history but do not expose it to sibling students",
      async () => {
        const klass = state().classes.find((c) => c.id === classId),
          base = {
            action: "class.update",
            orgId,
            id: classId,
            name: klass.name,
            subject: klass.subject,
            grade: klass.grade,
            description: klass.description,
          };
        await post(teacher, {
          ...base,
          expectedRevision: klass.revision,
          archived: true,
        });
        assert.ok((await read()).events.length);
        assert.ok((await read(student)).events.length);
        await read(otherStudent, "", 403, "TEACHING_FORBIDDEN");
        await post(teacher, {
          ...base,
          expectedRevision: klass.revision + 1,
          archived: false,
        });
      },
    );
    await check(
      "Publication refuses a projection/history mismatch and leaves history/private status unchanged",
      async () => {
        await post(
          teacher,
          grade({ reason: "Synthetic consistency precheck" }),
        );
        const before = sub(),
          old = events();
        db.prepare("UPDATE teaching_submissions SET score=? WHERE id=?").run(
          0.12,
          submissionId,
        );
        try {
          await post(teacher, publish(), 409, "TEACHING_HISTORY_INCONSISTENT");
          assert.deepEqual(events(), old);
          assert.equal(
            (await read(student)).events.some((e) => e.score === 0.12),
            false,
          );
        } finally {
          db.prepare("UPDATE teaching_submissions SET score=? WHERE id=?").run(
            before.score,
            submissionId,
          );
        }
        await post(teacher, publish());
      },
    );
    await check(
      "Grade version bound rejects further regrades without changing projection/history/audit/request log",
      async () => {
        await newSubmission();
        for (let i = 0; i < 50; i++)
          await post(
            teacher,
            grade({
              reason: i ? "Synthetic bounded revision " + i : undefined,
            }),
          );
        const before = sub(),
          old = events(),
          op = crypto.randomUUID(),
          audits = db.prepare("SELECT count(*) n FROM audit_events").get().n;
        await post(
          teacher,
          grade({ reason: "Over bounded grade history", requestId: op }),
          409,
          "TEACHING_HISTORY_LIMIT",
        );
        assert.deepEqual(sub(), before);
        assert.deepEqual(events(), old);
        assert.equal(
          db.prepare("SELECT count(*) n FROM audit_events").get().n,
          audits,
        );
        assert.equal(
          db
            .prepare(
              "SELECT count(*) n FROM teaching_operations WHERE request_id=?",
            )
            .get(op).n,
          0,
        );
      },
    );
    await check(
      "Schema14 migration seeds truthful legacy snapshot without modifying original submission/source/private data",
      () => {
        const legacyFile = path.join(folder, "legacy14.sqlite"),
          legacy = new DatabaseSync(legacyFile);
        legacy.exec(
          "PRAGMA foreign_keys=ON;CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL)",
        );
        for (const m of load("lib/server/schema.ts").migrations.filter(
          (m) => m.version <= 14,
        )) {
          legacy.exec(m.sql);
          legacy
            .prepare("INSERT INTO schema_migrations VALUES(?,?)")
            .run(m.version, new Date(clock).toISOString());
        }
        const stamp = new Date(clock).toISOString(),
          questions = JSON.stringify({
            questions: [
              {
                id: "legacy-question",
                prompt: "Synthetic immutable source",
                correctIndex: 0,
              },
            ],
            maxPoints: 1,
            dueAt: stamp,
          }),
          answers = '[{"questionId":"legacy-question","response":0}]',
          grades =
            '[{"questionId":"legacy-question","points":1,"feedback":"Legacy public feedback"}]';
        for (const id of ["legacy-teacher", "legacy-student"])
          legacy
            .prepare(
              "INSERT INTO users(id,storage_key,name,role,created_at,last_seen_at) VALUES(?,?,?,'USER',?,?)",
            )
            .run(id, "private-" + id, "Synthetic " + id, stamp, stamp);
        legacy
          .prepare(
            "INSERT INTO organizations VALUES('legacy-org','Synthetic legacy org',?)",
          )
          .run(stamp);
        legacy
          .prepare(
            "INSERT INTO memberships VALUES('legacy-student','legacy-org','STUDENT')",
          )
          .run();
        legacy
          .prepare(
            "INSERT INTO teaching_organizations VALUES('legacy-org',1,?,'legacy-teacher')",
          )
          .run('{"timezone":"Asia/Ho_Chi_Minh","allowLateSubmissions":false}');
        legacy
          .prepare(
            "INSERT INTO teaching_classes(id,organization_id,name,subject,grade,description,created_at) VALUES('legacy-class','legacy-org','Legacy','Math','9','Synthetic',?)",
          )
          .run(stamp);
        legacy
          .prepare(
            "INSERT INTO teaching_enrollments(id,class_id,user_id,joined_at) VALUES('legacy-enrollment','legacy-class','legacy-student',?)",
          )
          .run(stamp);
        legacy
          .prepare(
            "INSERT INTO teaching_assignments(id,organization_id,class_id,data_json,status,created_by,created_at,issued_at) VALUES('legacy-assignment','legacy-org','legacy-class',?,'issued','legacy-teacher',?,?)",
          )
          .run(questions, stamp, stamp);
        legacy
          .prepare(
            "INSERT INTO teaching_assignment_targets VALUES('legacy-assignment','legacy-student')",
          )
          .run();
        legacy
          .prepare(
            "INSERT INTO teaching_submissions(id,assignment_id,student_id,answers_json,submitted_at,late,status,revision,grades_json,score,feedback,confirmed_at,published_at) VALUES('legacy-submission','legacy-assignment','legacy-student',?,?,0,'published',4,?,1,'Legacy public result',?,?)",
          )
          .run(answers, stamp, grades, stamp, stamp);
        for (const status of ["graded", "submitted"]) {
          const aid = "legacy-" + status + "-assignment",
            sid = "legacy-" + status + "-submission";
          legacy
            .prepare(
              "INSERT INTO teaching_assignments(id,organization_id,class_id,data_json,status,created_by,created_at,issued_at) VALUES(?,'legacy-org','legacy-class',?,'issued','legacy-teacher',?,?)",
            )
            .run(aid, questions, stamp, stamp);
          legacy
            .prepare(
              "INSERT INTO teaching_assignment_targets VALUES(?,'legacy-student')",
            )
            .run(aid);
          legacy
            .prepare(
              "INSERT INTO teaching_submissions(id,assignment_id,student_id,answers_json,submitted_at,late,status,revision,grades_json,score,feedback,confirmed_at) VALUES(?,?,'legacy-student',?,?,0,?,1,?,?,?,?)",
            )
            .run(
              sid,
              aid,
              answers,
              stamp,
              status,
              status === "graded" ? grades : null,
              status === "graded" ? 1 : null,
              status === "graded" ? "Private legacy grade" : null,
              status === "graded" ? stamp : null,
            );
        }
        const privateBytes = '{"syntheticPrivate":"unchanged"}';
        legacy
          .prepare(
            "INSERT INTO sync_snapshots(user_id,epoch,revision,payload_json,digest,updated_at,expires_at) VALUES('legacy-student','legacy-epoch',1,?,'digest',?,?)",
          )
          .run(privateBytes, stamp, clock + 86400000);
        legacy.close();
        const upgraded = platform.createStore(legacyFile, options),
          verify = new DatabaseSync(legacyFile);
        try {
          const row = verify
            .prepare(
              "SELECT * FROM teaching_grade_events WHERE submission_id='legacy-submission'",
            )
            .get();
          assert.equal(row.kind, "legacy_snapshot");
          assert.equal(row.actor_id, null);
          assert.equal(row.recorded_at, null);
          assert.equal(row.answers_digest, null);
          assert.equal(row.published_at, stamp);
          assert.equal(row.confirmed_at, stamp);
          assert.equal(row.legacy, 1);
          assert.equal(
            verify
              .prepare(
                "SELECT data_json FROM teaching_assignments WHERE id='legacy-assignment'",
              )
              .get().data_json,
            questions,
          );
          assert.equal(
            verify
              .prepare(
                "SELECT answers_json FROM teaching_submissions WHERE id='legacy-submission'",
              )
              .get().answers_json,
            answers,
          );
          assert.equal(
            verify
              .prepare(
                "SELECT payload_json FROM sync_snapshots WHERE user_id='legacy-student'",
              )
              .get().payload_json,
            privateBytes,
          );
          const own = upgraded.readTeachingGradeHistory("legacy-student", 1, {
            orgId: "legacy-org",
            submissionId: "legacy-submission",
          });
          assert.equal(own.events.length, 1);
          assert.equal(own.events[0].legacy, true);
          assert.doesNotMatch(
            JSON.stringify(own),
            /recordedBy|recordedAt|reason|rubric|correctIndex/,
          );
          for (const status of ["graded", "submitted"]) {
            const hidden = upgraded.readTeachingGradeHistory(
              "legacy-student",
              1,
              {
                orgId: "legacy-org",
                submissionId: "legacy-" + status + "-submission",
              },
            );
            assert.equal(hidden.events.length, 0);
          }
          assert.equal(
            verify
              .prepare(
                "SELECT count(*) n FROM teaching_grade_events WHERE submission_id='legacy-submitted-submission'",
              )
              .get().n,
            0,
          );
        } finally {
          verify.close();
          upgraded.close();
        }
        const reopened = platform.createStore(legacyFile, options),
          again = new DatabaseSync(legacyFile);
        try {
          assert.equal(
            again.prepare("SELECT count(*) n FROM teaching_grade_events").get()
              .n,
            2,
          );
          assert.equal(
            again
              .prepare(
                "SELECT count(*) n FROM schema_migrations WHERE version=15",
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
      "Actual bounded grade writes reach the organization history quota and rollback the denied write",
      async () => {
        let rejected = false;
        for (let i = 0; i < 700; i++) {
          if (i % 50 === 0) await newSubmission();
          const before = sub(),
            old = events(),
            op = crypto.randomUUID(),
            b = {
              ...grade({
                grades: [{ questionId, points: 1, feedback: "Q".repeat(2000) }],
                feedback: "F".repeat(5000),
                reason: "R".repeat(1000),
              }),
              requestId: op,
            };
          const r = await api.POST(req(teacher, "/api/teaching", "POST", b)),
            body = await r.json();
          if (r.status === 200) continue;
          assert.equal(r.status, 413, JSON.stringify(body));
          assert.equal(body.error, "TEACHING_STORAGE_LIMIT");
          assert.deepEqual(sub(), before);
          assert.deepEqual(events(), old);
          assert.equal(
            db
              .prepare(
                "SELECT count(*) n FROM teaching_operations WHERE request_id=?",
              )
              .get(op).n,
            0,
          );
          rejected = true;
          break;
        }
        assert.equal(
          rejected,
          true,
          "bounded real writes must reach the quota before700 grades",
        );
      },
    );
    const report = {
      status: "PASS",
      checkedAt: new Date().toISOString(),
      passed: checks.length,
      checks,
      scope:
        "Actual teaching/history Request handlers and temporary SQLite, synthetic users and OAuth session. No network/provider calls or real student/teacher records.",
      providerRequests: 0,
      productionDeployment: "NOT_TESTED",
    };
    fs.mkdirSync(path.join(root, "docs/v7/reports"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "docs/v7/reports/grade-history.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log("Grade history: " + checks.length + " checks passed.");
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
