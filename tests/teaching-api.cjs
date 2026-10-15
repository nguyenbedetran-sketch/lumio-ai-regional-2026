// Actual handlers and SQLite; only OAuth session is synthetic. No network/provider calls.
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
  if (file === path.resolve(root, "lib/lumio/auth.ts"))
    return { authOptions: () => ({}) };
  if (cache.has(file)) return cache.get(file).exports;
  const m = { exports: {} };
  cache.set(file, m);
  const js = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  new Function("require", "module", "exports", js)(
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
    NEXTAUTH_SECRET: "synthetic-only-teaching-test-secret-at-least32chars",
    LUMIO_COMPETITION_PREVIEW: "false",
    LUMIO_BACKGROUND_JOBS_DISABLED: "true",
  },
  saved = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]])),
  originalFetch = global.fetch;
Object.assign(process.env, env);
global.fetch = async () => {
  throw Error("NETWORK_FORBIDDEN");
};
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "lumio-teaching-api-")),
  file = path.join(folder, "isolated.sqlite"),
  platform = load("lib/server/store.ts"),
  options = { adminEmails: ["workspace-admin@example.test"], now: () => clock };
store = platform.createStore(file, options);
const db = new DatabaseSync(file);
db.exec("PRAGMA foreign_keys=ON");
Object.assign(platform, {
  getStore: () => store,
  getUser: (id) => store.getUser(id),
});
const api = load("app/api/teaching/route.ts"),
  exportApi = load("app/api/teaching/export/route.ts"),
  evidence = load("lib/server/source-evidence.ts"),
  validation = load("lib/teaching/validation.ts"),
  origin = "http://127.0.0.1:3000";
const identity = (name, extra = {}) =>
  store.ensureIdentity({
    provider: "google",
    providerAccountId: "teaching-fixture-" + name,
    name: "Synthetic " + name,
    email: name + "@example.test",
    emailVerified: false,
    ...extra,
  });
const admin = identity("owner", {
    email: "workspace-admin@example.test",
    emailVerified: true,
  }),
  teacher = identity("teacher"),
  colleague = identity("colleague"),
  outsider = identity("outsider"),
  pending = identity("pending"),
  student = identity("student"),
  otherStudent = identity("other-student"),
  lateStudent = identity("late-student");
const profile = {
  applicantName: "Synthetic teaching declaration",
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
  const s = store.submitTeacherApplication(u.id, u.sessionVersion, {
    requestId: crypto.randomUUID(),
    expectedRevision: 0,
    profile,
  });
  store.reviewTeacherApplication(admin.id, admin.sessionVersion, {
    requestId: crypto.randomUUID(),
    applicationId: s.application.id,
    expectedRevision: s.application.revision,
    action: "approve",
    note: "Synthetic fixture approval only",
  });
}
function request(
  u,
  method = "GET",
  body,
  query = "",
  headers = {},
  exp = false,
) {
  session = u ? { userId: u.id, sessionVersion: u.sessionVersion } : null;
  return new Request(
    origin + "/api/teaching" + (exp ? "/export" : "") + query,
    {
      method,
      headers: {
        ...(u ? { "x-lumio-account": u.storageKey } : {}),
        ...(method === "GET"
          ? {}
          : { origin, "content-type": "application/json" }),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
  );
}
async function response(req, status = 200, code, exp = false) {
  const r = await (exp ? exportApi : api)[req.method](req),
    text = await r.text();
  assert.equal(r.status, status, text);
  assert.match(r.headers.get("cache-control"), /no-store/);
  const body = r.headers.get("content-type")?.includes("json")
    ? JSON.parse(text)
    : text;
  if (code) {
    assert.equal(body.error, code);
    assert.deepEqual(Object.keys(body).sort(), ["error", "requestId"]);
  }
  return body;
}
const post = (u, b, status = 200, code) =>
  response(
    request(u, "POST", { requestId: crypto.randomUUID(), ...b }),
    status,
    code,
  );
const get = (u, org, extra = "", status = 200, code) =>
  response(
    request(u, "GET", undefined, org ? "?orgId=" + org + extra : extra),
    status,
    code,
  );
const state = (u = teacher) =>
  store.readTeaching(u.id, u.sessionVersion, { orgId });
const find = (kind, id, u = teacher) => state(u)[kind].find((r) => r.id === id);
const check = async (name, f) => {
  await f();
  checks.push({ name, status: "PASS" });
};
const fail = (code) => (e) => {
  assert.equal(e.code, code);
  return true;
};
const classDraft = (name = "Lớp tổng hợp") => ({
  name,
  subject: "Toán",
  grade: "9",
  description: "Synthetic class, no real student records.",
});
const materialDraft = (classId, extra = {}) => ({
  classId,
  title: "Nguồn tự soạn",
  kind: "text",
  content: "Phép cộng hai số tự nhiên. Hai cộng hai bằng bốn.",
  ...extra,
});
const questionDraft = (classId, extra = {}) => ({
  classId,
  prompt: "Tính 2 + 2.",
  kind: "mcq",
  choices: ["4", "5", "3", "2"],
  correctIndex: 0,
  explanation: "2 + 2 = 4.",
  maxPoints: 1,
  topic: "Số học",
  difficulty: "basic",
  references: [],
  ...extra,
});
const shortDraft = (classId) => ({
  classId,
  prompt: "Giải thích ý nghĩa của phép cộng bằng lời của em.",
  kind: "short",
  choices: [],
  modelAnswer: "Gộp hai nhóm đối tượng để tìm tổng.",
  explanation: "Nêu ý nghĩa gộp nhóm.",
  rubric: [
    { label: "Nêu ý nghĩa", points: 1.15 },
    { label: "Ví dụ", points: 0.29 },
  ],
  maxPoints: 1.44,
  topic: "Số học",
  difficulty: "basic",
  references: [],
});
const lessonDraft = (classId) => ({
  classId,
  title: "Phép cộng số tự nhiên",
  topic: "Số học",
  grade: "9",
  objectives: ["Giải thích được phép cộng."],
  sections: [
    {
      title: "Khái niệm",
      body: "Phép cộng gộp các nhóm đối tượng.",
      references: [],
    },
    {
      title: "Thực hành",
      body: "Học sinh tự đặt một ví dụ rồi giải thích.",
      references: [],
    },
  ],
  sourceIds: [],
});
const assignmentDraft = (classId, questionIds, extra = {}) => ({
  classId,
  title: "Bài tập tổng hợp",
  instructions: "Tự làm và kiểm tra trước khi nộp.",
  questionIds,
  target: { kind: "class", ids: [] },
  dueAt: new Date(clock + 86400000).toISOString(),
  ...extra,
});
async function makeQuestion(classId, draft = questionDraft(classId)) {
  const r = await post(teacher, { action: "question.create", orgId, draft }),
    id = r.result.id;
  await post(teacher, {
    action: "question.review",
    orgId,
    id,
    expectedRevision: 1,
  });
  return id;
}
async function issue(classId, questionIds, extra = {}) {
  const r = await post(teacher, {
      action: "assignment.create",
      orgId,
      draft: assignmentDraft(classId, questionIds, extra),
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
const submit = (u, assignmentId, answers, revision = 0) =>
  post(u, {
    action: "submission.submit",
    orgId,
    assignmentId,
    expectedRevision: revision,
    answers,
  });
async function gradePublish(id, grades) {
  const r = find("submissions", id);
  await post(teacher, {
    action: "submission.grade",
    orgId,
    id,
    expectedRevision: r.revision,
    grades,
    feedback: "Synthetic confirmed feedback",
    confirmed: true,
  });
  await post(teacher, {
    action: "submission.publish",
    orgId,
    id,
    expectedRevision: r.revision + 1,
  });
}
let orgId,
  foreignOrg,
  classId,
  siblingClass,
  groupId,
  inviteCode,
  materialId,
  questionId,
  shortId,
  assignmentId,
  submissionId,
  lessonId;
(async () => {
  try {
    approve(teacher);
    approve(colleague);
    approve(outsider);
    await check(
      "Migration12 persists14 teaching tables and preserves existing credentials",
      () => {
        assert.equal(
          db
            .prepare(
              "SELECT count(*) n FROM schema_migrations WHERE version=12",
            )
            .get().n,
          1,
        );
        assert.equal(
          db
            .prepare(
              "SELECT count(*) n FROM sqlite_master WHERE type='table' AND name LIKE 'teaching_%' AND name!='teaching_preferences'",
            )
            .get().n,
          14,
        );
        assert.equal(
          store.isApprovedTeacher(teacher.id, teacher.sessionVersion),
          true,
        );
      },
    );
    await check(
      "Guest, wrong account, cross-site GET and bearer cannot read",
      async () => {
        await response(request(null), 401, "SIGN_IN_REQUIRED");
        await response(
          request(teacher, "GET", undefined, "", {
            "x-lumio-account": student.storageKey,
          }),
          401,
          "SESSION_REVOKED",
        );
        await response(
          request(teacher, "GET", undefined, "", {
            "sec-fetch-site": "cross-site",
          }),
          403,
          "INVALID_ORIGIN",
        );
        await response(
          request(teacher, "GET", undefined, "", {
            authorization: "Bearer synthetic",
          }),
          401,
          "SIGN_IN_REQUIRED",
        );
      },
    );
    await check(
      "Teacher privilege cannot be self-granted; origin and strict schema enforced",
      async () => {
        assert.equal((await get(pending)).actor.canCreateOrganization, false);
        await post(
          pending,
          { action: "org.create", name: "Forbidden" },
          403,
          "TEACHER_APPROVAL_REQUIRED",
        );
        await post(
          teacher,
          { action: "org.create", name: "Bad", role: "OWNER" },
          400,
          "INVALID_TEACHING_DATA",
        );
        await response(
          request(
            teacher,
            "POST",
            {
              action: "org.create",
              requestId: crypto.randomUUID(),
              name: "Bad",
            },
            "",
            { origin: "https://evil.example.test" },
          ),
          403,
          "INVALID_ORIGIN",
        );
        await post(
          teacher,
          { action: "org.create", name: "Bad", requestId: 3 },
          400,
          "INVALID_TEACHING_DATA",
        );
        await response(
          request(teacher, "GET", undefined, "?orgId=a&orgId=b"),
          400,
          "INVALID_TEACHING_DATA",
        );
      },
    );
    await check(
      "Explicit own organization; no cross-tenant access even for SUPER_ADMIN",
      async () => {
        orgId = (
          await post(teacher, {
            action: "org.create",
            name: "Synthetic workspace",
          })
        ).result.orgId;
        foreignOrg = (
          await post(outsider, {
            action: "org.create",
            name: "Foreign workspace",
          })
        ).result.orgId;
        await get(teacher, foreignOrg, "", 403, "TEACHING_FORBIDDEN");
        await get(admin, orgId, "", 403, "TEACHING_FORBIDDEN");
        assert.equal((await get(teacher, orgId)).role, "ORGANIZATION_ADMIN");
        assert.equal(store.getUser(teacher.id).role, "USER");
      },
    );
    await check(
      "Lost-ACK mutation replay exactly once rejects payload and actor reuse",
      async () => {
        const b = {
            action: "org.create",
            name: "Idempotent workspace",
            requestId: crypto.randomUUID(),
          },
          a = await post(teacher, b),
          r = await post(teacher, b);
        assert.equal(r.replayed, true);
        assert.equal(a.result.orgId, r.result.orgId);
        await post(
          teacher,
          { ...b, name: "Different" },
          409,
          "TEACHING_REQUEST_REUSED",
        );
        await post(colleague, b, 409, "TEACHING_REQUEST_REUSED");
      },
    );
    await check("Classes persist ownership and reject stale CAS", async () => {
      classId = (
        await post(teacher, { action: "class.create", orgId, ...classDraft() })
      ).result.id;
      siblingClass = (
        await post(teacher, {
          action: "class.create",
          orgId,
          ...classDraft("Lớp khác"),
        })
      ).result.id;
      assert.deepEqual(find("classes", classId).teacherIds, [teacher.id]);
      await post(
        teacher,
        {
          action: "class.update",
          orgId,
          id: classId,
          expectedRevision: 99,
          ...classDraft("Lost update"),
          archived: false,
        },
        409,
        "TEACHING_CONFLICT",
      );
    });
    await check(
      "Co-teacher approval and class isolation enforced",
      async () => {
        await post(
          teacher,
          {
            action: "teacher.assign",
            orgId,
            classId,
            userId: pending.id,
            expectedRevision: 1,
          },
          403,
          "TEACHER_APPROVAL_REQUIRED",
        );
        await post(teacher, {
          action: "teacher.assign",
          orgId,
          classId,
          userId: colleague.id,
          expectedRevision: 1,
        });
        assert.deepEqual(
          (await get(colleague, orgId)).classes.map((c) => c.id),
          [classId],
        );
        await get(
          colleague,
          orgId,
          "&classId=" + siblingClass,
          403,
          "TEACHING_FORBIDDEN",
        );
        await post(
          colleague,
          {
            action: "teacher.assign",
            orgId,
            classId,
            userId: outsider.id,
            expectedRevision: 2,
          },
          403,
          "TEACHING_FORBIDDEN",
        );
      },
    );
    await check(
      "Invite only hash stored; lost-ACK code recovery and join uses exactly once",
      async () => {
        const b = {
            action: "invite.create",
            orgId,
            classId,
            expectedRevision: find("classes", classId).revision,
            expiresInDays: 7,
            maxUses: 5,
            requestId: crypto.randomUUID(),
          },
          a = await post(teacher, b),
          r = await post(teacher, b);
        inviteCode = a.result.inviteCode;
        assert.equal(r.result.inviteCode, inviteCode);
        assert.equal(
          JSON.stringify(
            db.prepare("SELECT * FROM teaching_invites").all(),
          ).includes(inviteCode),
          false,
        );
        assert.equal(
          JSON.stringify(
            db.prepare("SELECT * FROM teaching_operations").all(),
          ).includes(inviteCode),
          false,
        );
        assert.equal(
          JSON.stringify(await get(teacher, orgId)).includes(inviteCode),
          false,
        );
        const j = {
          action: "class.join",
          code: inviteCode,
          requestId: crypto.randomUUID(),
        };
        await post(student, j);
        await post(student, j);
        assert.equal(
          db
            .prepare("SELECT uses FROM teaching_invites WHERE id=?")
            .get(a.result.id).uses,
          1,
        );
        await post(otherStudent, { action: "class.join", code: inviteCode });
      },
    );
    await check(
      "Invite cannot bind foreign org or make staff impersonate student",
      async () => {
        await post(
          lateStudent,
          { action: "class.join", orgId: foreignOrg, code: inviteCode },
          403,
          "TEACHING_FORBIDDEN",
        );
        await post(
          colleague,
          { action: "class.join", code: inviteCode },
          409,
          "TEACHING_ROLE_CONFLICT",
        );
        await post(
          lateStudent,
          { action: "class.join", code: "not-valid" },
          403,
          "TEACHING_INVITE_INVALID",
        );
      },
    );
    await check(
      "Group membership current; student payload omits peer roster and emails",
      async () => {
        await post(
          teacher,
          {
            action: "group.save",
            orgId,
            classId,
            expectedRevision: 0,
            name: "Bad",
            memberIds: [outsider.id],
          },
          403,
          "TEACHING_INVALID_RECIPIENT",
        );
        groupId = (
          await post(teacher, {
            action: "group.save",
            orgId,
            classId,
            expectedRevision: 0,
            name: "Nhóm tổng hợp",
            memberIds: [student.id, otherStudent.id],
          })
        ).result.id;
        const r = await get(student, orgId);
        assert.deepEqual(r.groups[0].memberIds, [student.id]);
        assert.deepEqual(
          r.members.map((m) => m.userId),
          [student.id],
        );
        assert.equal(r.invites.length, 0);
        assert.equal(r.enrollments.length, 1);
        assert.doesNotMatch(JSON.stringify(r), /@example\.test/);
      },
    );
    await check(
      "SourceEvidence rejects spoofed page and cross-actor proof",
      async () => {
        const text = materialDraft(classId).content,
          proof = evidence.signSourceEvidence(
            {
              kind: "pdf",
              filename: "synthetic.pdf",
              text,
              units: [{ start: 0, end: text.length, page: 2 }],
            },
            teacher.id,
          );
        await post(
          colleague,
          {
            action: "material.create",
            orgId,
            draft: materialDraft(classId, {
              kind: "pdf",
              sourceEvidence: proof,
            }),
          },
          400,
          "INVALID_SOURCE_EVIDENCE",
        );
        materialId = (
          await post(teacher, {
            action: "material.create",
            orgId,
            draft: materialDraft(classId, {
              kind: "pdf",
              sourceEvidence: proof,
            }),
          })
        ).result.id;
        await post(
          teacher,
          {
            action: "material.create",
            orgId,
            draft: materialDraft(classId, {
              sourceEvidence: {
                ...proof,
                units: [{ start: 0, end: text.length, page: 99 }],
              },
            }),
          },
          400,
          "INVALID_SOURCE_EVIDENCE",
        );
      },
    );
    await check(
      "Co-teacher metadata edit keeps exact server proof; changed text cannot reuse proof",
      async () => {
        const m = find("materials", materialId),
          draft = materialDraft(classId, {
            kind: m.kind,
            content: m.content,
            title: "Đồng giáo viên sửa tên",
            sourceEvidence: m.sourceEvidence,
          });
        await post(colleague, {
          action: "material.update",
          orgId,
          id: m.id,
          expectedRevision: m.revision,
          draft,
        });
        const next = find("materials", materialId);
        assert.deepEqual(next.sourceEvidence, m.sourceEvidence);
        await post(
          colleague,
          {
            action: "material.update",
            orgId,
            id: m.id,
            expectedRevision: next.revision,
            draft: { ...draft, content: draft.content + " Nội dung khác." },
          },
          400,
          "INVALID_SOURCE_EVIDENCE",
        );
      },
    );
    await check(
      "Locators rebuilt by server; source edits invalidate stale reviewed reference",
      async () => {
        const m = find("materials", materialId),
          q = await post(teacher, {
            action: "question.create",
            orgId,
            draft: questionDraft(classId, {
              references: [
                {
                  materialId,
                  quote: "Hai cộng hai bằng bốn.",
                  paragraph: 999,
                  page: 999,
                },
              ],
            }),
          }),
          qr = find("questions", q.result.id);
        assert.equal(qr.references[0].page, 2);
        assert.equal(qr.references[0].paragraph, 1);
        assert.equal(qr.references[0].materialRevision, m.revision);
        await post(teacher, {
          action: "material.update",
          orgId,
          id: materialId,
          expectedRevision: m.revision,
          draft: materialDraft(classId, { title: "Đã đổi" }),
        });
        await post(
          teacher,
          {
            action: "question.review",
            orgId,
            id: q.result.id,
            expectedRevision: 1,
          },
          409,
          "TEACHING_SOURCE_CHANGED",
        );
      },
    );
    await check(
      "Invalid drafts save for editing; wrong supported answer and duplicate choices blocked at review",
      async () => {
        const a = await post(teacher, {
          action: "question.create",
          orgId,
          draft: questionDraft(classId, { correctIndex: 1 }),
        });
        assert.equal(find("questions", a.result.id).status, "draft");
        await post(
          teacher,
          {
            action: "question.review",
            orgId,
            id: a.result.id,
            expectedRevision: 1,
          },
          422,
          "TEACHING_CONTENT_BLOCKED",
        );
        const b = await post(teacher, {
          action: "question.create",
          orgId,
          draft: questionDraft(classId, { choices: ["4", "4"] }),
        });
        await post(
          teacher,
          {
            action: "question.review",
            orgId,
            id: b.result.id,
            expectedRevision: 1,
          },
          422,
          "TEACHING_CONTENT_BLOCKED",
        );
      },
    );
    await check(
      "Explicit review resets on edit; valid decimal rubric values accepted",
      async () => {
        questionId = await makeQuestion(classId);
        shortId = await makeQuestion(classId, shortDraft(classId));
        assert.equal(find("questions", shortId).maxPoints, 1.44);
        const q = find("questions", questionId);
        await post(teacher, {
          action: "question.update",
          orgId,
          id: questionId,
          expectedRevision: q.revision,
          draft: questionDraft(classId),
        });
        assert.equal(find("questions", questionId).status, "draft");
        await post(teacher, {
          action: "question.review",
          orgId,
          id: questionId,
          expectedRevision: q.revision + 1,
        });
        assert.equal(validation.number(0.29), 0.29);
        assert.equal(validation.number(1.15), 1.15);
        assert.throws(
          () => validation.number(1.001),
          fail("INVALID_TEACHING_DATA"),
        );
      },
    );
    await check(
      "Draft content hidden from students; publish requires review",
      async () => {
        lessonId = (
          await post(teacher, {
            action: "lesson.create",
            orgId,
            draft: lessonDraft(classId),
          })
        ).result.id;
        const r = await get(student, orgId);
        assert.equal(r.materials.length, 0);
        assert.equal(r.lessons.length, 0);
        assert.equal(r.questions.length, 0);
        await post(
          student,
          { action: "lesson.review", orgId, id: lessonId, expectedRevision: 1 },
          403,
          "TEACHING_FORBIDDEN",
        );
        await post(
          teacher,
          {
            action: "lesson.publish",
            orgId,
            id: lessonId,
            expectedRevision: 1,
          },
          409,
          "TEACHING_REVIEW_REQUIRED",
        );
        await post(teacher, {
          action: "lesson.review",
          orgId,
          id: lessonId,
          expectedRevision: 1,
        });
        await post(teacher, {
          action: "lesson.publish",
          orgId,
          id: lessonId,
          expectedRevision: 2,
        });
        const m = find("materials", materialId);
        await post(teacher, {
          action: "material.review",
          orgId,
          id: materialId,
          expectedRevision: m.revision,
        });
        await post(teacher, {
          action: "material.publish",
          orgId,
          id: materialId,
          expectedRevision: m.revision + 1,
        });
        const next = await get(student, orgId);
        assert.equal(next.lessons.length, 1);
        assert.equal(next.materials.length, 1);
        assert.equal(next.materials[0].sourceEvidence, undefined);
      },
    );
    await check(
      "Assignments require reviewed questions and explicit review/issue transitions",
      async () => {
        const q = (
          await post(teacher, {
            action: "question.create",
            orgId,
            draft: questionDraft(classId),
          })
        ).result.id;
        await post(
          teacher,
          {
            action: "assignment.create",
            orgId,
            draft: assignmentDraft(classId, [q]),
          },
          409,
          "TEACHING_REVIEW_REQUIRED",
        );
        assignmentId = (
          await post(teacher, {
            action: "assignment.create",
            orgId,
            draft: assignmentDraft(classId, [questionId, shortId], {
              target: { kind: "groups", ids: [groupId] },
            }),
          })
        ).result.id;
        await post(
          teacher,
          {
            action: "assignment.issue",
            orgId,
            id: assignmentId,
            expectedRevision: 1,
          },
          409,
          "TEACHING_REVIEW_REQUIRED",
        );
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
      },
    );
    await check(
      "Issued snapshots and recipients immutable after group and question edits",
      async () => {
        const a = find("assignments", assignmentId),
          snapshot = JSON.stringify(a.questions);
        assert.deepEqual(
          [...a.recipientIds].sort(),
          [student.id, otherStudent.id].sort(),
        );
        await post(
          teacher,
          {
            action: "assignment.update",
            orgId,
            id: assignmentId,
            expectedRevision: a.revision,
            draft: assignmentDraft(classId, [questionId]),
          },
          409,
          "TEACHING_ASSIGNMENT_IMMUTABLE",
        );
        await post(
          teacher,
          {
            action: "assignment.delete",
            orgId,
            id: assignmentId,
            expectedRevision: a.revision,
          },
          409,
          "TEACHING_ASSIGNMENT_IMMUTABLE",
        );
        await post(teacher, {
          action: "group.save",
          orgId,
          id: groupId,
          expectedRevision: 1,
          classId,
          name: "Nhóm thay đổi",
          memberIds: [student.id],
        });
        const q = find("questions", questionId);
        await post(teacher, {
          action: "question.update",
          orgId,
          id: questionId,
          expectedRevision: q.revision,
          draft: questionDraft(classId, {
            prompt: "Tính 3 + 3.",
            choices: ["6", "5", "4", "3"],
            explanation: "3 + 3 = 6.",
          }),
        });
        assert.equal(
          JSON.stringify(find("assignments", assignmentId).questions),
          snapshot,
        );
        assert(
          find("assignments", assignmentId).recipientIds.includes(
            otherStudent.id,
          ),
        );
        await post(teacher, {
          action: "question.review",
          orgId,
          id: questionId,
          expectedRevision: q.revision + 1,
        });
      },
    );
    await check(
      "Unpublished student assignment recursively omits answer keys, rubric and private target roster",
      async () => {
        const r = await get(student, orgId),
          a = r.assignments.find((a) => a.id === assignmentId);
        assert.equal(a.recipientIds, undefined);
        assert.deepEqual(a.target.ids, []);
        assert.doesNotMatch(
          JSON.stringify(a),
          /correctIndex|modelAnswer|explanation|rubric|references|recipientIds/,
        );
        assert.equal(r.questions.length, 0);
      },
    );
    await check(
      "Late joiner cannot see historical issue; teacher cannot submit as student",
      async () => {
        await post(lateStudent, { action: "class.join", code: inviteCode });
        assert.equal((await get(lateStudent, orgId)).assignments.length, 0);
        await post(
          lateStudent,
          {
            action: "submission.submit",
            orgId,
            assignmentId,
            expectedRevision: 0,
            answers: [],
          },
          403,
          "TEACHING_FORBIDDEN",
        );
        await post(
          teacher,
          {
            action: "submission.submit",
            orgId,
            assignmentId,
            expectedRevision: 0,
            answers: [],
          },
          403,
          "TEACHING_STUDENT_REQUIRED",
        );
      },
    );
    await check(
      "Canonical submission ownership; complete unique answers and hidden provisional MCQ mark",
      async () => {
        await post(
          student,
          {
            action: "submission.submit",
            orgId,
            assignmentId,
            expectedRevision: 0,
            studentId: otherStudent.id,
            answers: [],
          },
          400,
          "INVALID_TEACHING_DATA",
        );
        await post(
          student,
          {
            action: "submission.submit",
            orgId,
            assignmentId,
            expectedRevision: 0,
            answers: [
              { questionId, response: 0 },
              { questionId, response: 1 },
            ],
          },
          400,
          "INVALID_TEACHING_DATA",
        );
        const r = await submit(student, assignmentId, [
          { questionId, response: 0 },
          { questionId: shortId, response: "Gộp hai nhóm." },
        ]);
        submissionId = r.result.id;
        const s = r.state.submissions[0];
        assert.equal(s.studentId, student.id);
        for (const k of [
          "autoScore",
          "score",
          "grades",
          "feedback",
          "confirmedAt",
          "publishedAt",
        ])
          assert.equal(s[k], undefined);
        assert.equal(find("submissions", submissionId).autoScore, 1);
        assert.equal((await get(otherStudent, orgId)).submissions.length, 0);
      },
    );
    await check(
      "Lost-ACK student submission update replays once without requiring staff role",
      async () => {
        const b = {
            action: "submission.submit",
            orgId,
            assignmentId,
            expectedRevision: 1,
            answers: [
              { questionId, response: 0 },
              { questionId: shortId, response: "Gộp hai nhóm và lấy tổng." },
            ],
            requestId: crypto.randomUUID(),
          },
          a = await post(student, b),
          r = await post(student, b);
        assert.equal(r.replayed, true);
        assert.equal(a.result.id, r.result.id);
        assert.equal(find("submissions", submissionId).revision, 2);
        assert.equal(
          db
            .prepare(
              "SELECT count(*) n FROM teaching_submissions WHERE assignment_id=? AND student_id=?",
            )
            .get(assignmentId, student.id).n,
          1,
        );
      },
    );
    await check(
      "Manual bounded grades require teacher confirmation and remain hidden until publication",
      async () => {
        await post(
          teacher,
          {
            action: "submission.publish",
            orgId,
            id: submissionId,
            expectedRevision: 2,
          },
          409,
          "TEACHING_CONFIRMATION_REQUIRED",
        );
        await post(
          student,
          {
            action: "submission.grade",
            orgId,
            id: submissionId,
            expectedRevision: 2,
            grades: [],
            feedback: "",
            confirmed: true,
          },
          403,
          "TEACHING_FORBIDDEN",
        );
        const grades = [
          { questionId, points: 1, feedback: "Đúng." },
          { questionId: shortId, points: 1.15, feedback: "Thiếu ví dụ." },
        ];
        await post(
          teacher,
          {
            action: "submission.grade",
            orgId,
            id: submissionId,
            expectedRevision: 2,
            grades,
            feedback: "Synthetic unpublished note",
            confirmed: false,
          },
          409,
          "TEACHING_CONFIRMATION_REQUIRED",
        );
        await post(
          teacher,
          {
            action: "submission.grade",
            orgId,
            id: submissionId,
            expectedRevision: 2,
            grades: [{ ...grades[0], points: 2 }, grades[1]],
            feedback: "",
            confirmed: true,
          },
          400,
          "INVALID_TEACHING_DATA",
        );
        await post(teacher, {
          action: "submission.grade",
          orgId,
          id: submissionId,
          expectedRevision: 2,
          grades,
          feedback: "Synthetic unpublished note",
          confirmed: true,
        });
        const r = await get(student, orgId);
        assert.equal(r.submissions[0].status, "submitted");
        assert.equal(r.submissions[0].score, undefined);
        assert.doesNotMatch(
          JSON.stringify(r.assignments),
          /correctIndex|rubric/,
        );
      },
    );
    await check(
      "Publication exposes only own confirmed result and issued answer snapshot",
      async () => {
        await post(teacher, {
          action: "submission.publish",
          orgId,
          id: submissionId,
          expectedRevision: 3,
        });
        const r = await get(student, orgId);
        assert.equal(r.submissions[0].status, "published");
        assert.equal(r.submissions[0].score, 2.15);
        assert.equal(
          r.assignments.find((a) => a.id === assignmentId).questions[0]
            .correctIndex,
          0,
        );
        assert.equal(r.analytics[0].topics[0].level, "insufficient");
        const other = await get(otherStudent, orgId);
        assert.equal(other.submissions.length, 0);
        assert.doesNotMatch(
          JSON.stringify(other.assignments),
          /correctIndex|rubric/,
        );
        await post(
          student,
          {
            action: "submission.submit",
            orgId,
            assignmentId,
            expectedRevision: 4,
            answers: [
              { questionId, response: 0 },
              { questionId: shortId, response: "Edit after grade" },
            ],
          },
          409,
          "TEACHING_SUBMISSION_LOCKED",
        );
      },
    );
    await check(
      "Regrading withdraws result and answer visibility until explicit republish",
      async () => {
        await post(teacher, {
          action: "submission.grade",
          orgId,
          id: submissionId,
          expectedRevision: 4,
          grades: [
            { questionId, points: 1, feedback: "Đúng." },
            { questionId: shortId, points: 1.44, feedback: "Đủ." },
          ],
          feedback: "Updated confirmation",
          confirmed: true,
        });
        const r = await get(student, orgId);
        assert.equal(r.submissions[0].score, undefined);
        assert.equal(r.analytics.length, 0);
        assert.doesNotMatch(
          JSON.stringify(r.assignments),
          /correctIndex|rubric/,
        );
        await post(teacher, {
          action: "submission.publish",
          orgId,
          id: submissionId,
          expectedRevision: 5,
        });
      },
    );
    await check(
      "Audit fault rolls back grade, status, idempotency and revision atomically",
      async () => {
        const before = find("submissions", submissionId),
          count = db
            .prepare("SELECT count(*) n FROM teaching_operations")
            .get().n;
        db.exec(
          "CREATE TRIGGER test_teaching_audit_fail BEFORE INSERT ON audit_events WHEN NEW.action='TEACHING_SUBMISSION_GRADE' BEGIN SELECT RAISE(ABORT,'SYNTHETIC_AUDIT_FAILURE'); END",
        );
        try {
          await post(
            teacher,
            {
              action: "submission.grade",
              orgId,
              id: submissionId,
              expectedRevision: before.revision,
              grades: [
                { questionId, points: 0, feedback: "" },
                { questionId: shortId, points: 0, feedback: "" },
              ],
              feedback: "Should roll back",
              confirmed: true,
            },
            503,
            "PLATFORM_UNAVAILABLE",
          );
        } finally {
          db.exec("DROP TRIGGER test_teaching_audit_fail");
        }
        assert.deepEqual(find("submissions", submissionId), before);
        assert.equal(
          db.prepare("SELECT count(*) n FROM teaching_operations").get().n,
          count,
        );
      },
    );
    await check(
      "Secure topic label requires three distinct published assessments",
      async () => {
        for (let i = 0; i < 2; i++) {
          const a = await issue(classId, [questionId], {
              title: "Assessment " + i,
              target: { kind: "students", ids: [student.id] },
            }),
            r = await submit(student, a, [{ questionId, response: 0 }]);
          await gradePublish(r.result.id, [
            { questionId, points: 1, feedback: "Đúng." },
          ]);
          const m = state().analytics.find((r) => r.studentId === student.id);
          assert.equal(m.assessments, i + 2);
          assert.equal(m.topics[0].level, i === 0 ? "insufficient" : "secure");
        }
        assert.equal(state(student).analytics.length, 1);
      },
    );
    await check(
      "Announcement draft/publish/edit and calendar remain scoped",
      async () => {
        const a = await post(colleague, {
          action: "announcement.save",
          orgId,
          expectedRevision: 0,
          classId,
          title: "Thông báo",
          body: "Nội dung nội bộ lớp.",
        });
        assert.equal((await get(student, orgId)).announcements.length, 0);
        await post(colleague, {
          action: "announcement.publish",
          orgId,
          id: a.result.id,
          expectedRevision: 1,
        });
        assert.equal((await get(student, orgId)).announcements.length, 1);
        await post(colleague, {
          action: "announcement.save",
          orgId,
          id: a.result.id,
          expectedRevision: 2,
          classId,
          title: "Đã sửa",
          body: "Cần công bố lại.",
        });
        assert.equal((await get(student, orgId)).announcements.length, 0);
        await post(
          colleague,
          {
            action: "announcement.save",
            orgId,
            expectedRevision: 0,
            classId: null,
            title: "Org wide",
            body: "Forbidden",
          },
          403,
          "TEACHING_FORBIDDEN",
        );
        const e = await post(teacher, {
          action: "event.save",
          orgId,
          expectedRevision: 0,
          classId,
          title: "Buổi học",
          description: "Synthetic event",
          startAt: new Date(clock).toISOString(),
          endAt: new Date(clock + 3600000).toISOString(),
          kind: "lesson",
        });
        assert.equal((await get(student, orgId)).events.length, 1);
        await post(teacher, {
          action: "event.delete",
          orgId,
          id: e.result.id,
          expectedRevision: 1,
        });
      },
    );
    await check(
      "Settings require organization admin, valid timezone and current CAS",
      async () => {
        const s = state().settings;
        await post(
          colleague,
          {
            action: "settings.update",
            orgId,
            expectedRevision: s.revision,
            name: "Forbidden",
            timezone: "UTC",
            allowLateSubmissions: false,
          },
          403,
          "TEACHING_FORBIDDEN",
        );
        await post(
          teacher,
          {
            action: "settings.update",
            orgId,
            expectedRevision: s.revision,
            name: "Synthetic workspace",
            timezone: "Not/AZone",
            allowLateSubmissions: false,
          },
          400,
          "INVALID_TEACHING_DATA",
        );
        await post(teacher, {
          action: "settings.update",
          orgId,
          expectedRevision: s.revision,
          name: "Synthetic workspace",
          timezone: "UTC",
          allowLateSubmissions: false,
        });
        await post(
          teacher,
          {
            action: "settings.update",
            orgId,
            expectedRevision: s.revision,
            name: "Lost update",
            timezone: "UTC",
            allowLateSubmissions: true,
          },
          409,
          "TEACHING_CONFLICT",
        );
      },
    );
    await check(
      "Due date policy and closed status reject submissions without grading",
      async () => {
        const a = await issue(classId, [questionId], {
          target: { kind: "students", ids: [otherStudent.id] },
          dueAt: new Date(clock + 1000).toISOString(),
        });
        clock += 2000;
        await post(
          otherStudent,
          {
            action: "submission.submit",
            orgId,
            assignmentId: a,
            expectedRevision: 0,
            answers: [{ questionId, response: 0 }],
          },
          409,
          "TEACHING_DUE_PASSED",
        );
        await post(teacher, {
          action: "assignment.close",
          orgId,
          id: a,
          expectedRevision: find("assignments", a).revision,
        });
        await post(
          otherStudent,
          {
            action: "submission.submit",
            orgId,
            assignmentId: a,
            expectedRevision: 0,
            answers: [{ questionId, response: 0 }],
          },
          409,
          "TEACHING_ASSIGNMENT_CLOSED",
        );
      },
    );
    await check(
      "Allowed late submission recorded but provisional mark private",
      async () => {
        const s = state().settings;
        await post(teacher, {
          action: "settings.update",
          orgId,
          expectedRevision: s.revision,
          name: s.name,
          timezone: s.timezone,
          allowLateSubmissions: true,
        });
        const a = await issue(classId, [questionId], {
          target: { kind: "students", ids: [otherStudent.id] },
          dueAt: new Date(clock + 1000).toISOString(),
        });
        clock += 2000;
        const r = await submit(otherStudent, a, [{ questionId, response: 0 }]);
        assert.equal(r.state.submissions[0].late, true);
        assert.equal(r.state.submissions[0].autoScore, undefined);
      },
    );
    await check(
      "CSV formula safety; student exports own published results only",
      async () => {
        const name = store.getUser(student.id).name;
        db.prepare("UPDATE users SET name=? WHERE id=?").run(
          "=SYNTHETIC_FORMULA()",
          student.id,
        );
        try {
          const csv = await response(
            request(
              teacher,
              "GET",
              undefined,
              "?orgId=" + orgId + "&format=csv",
              {},
              true,
            ),
            200,
            undefined,
            true,
          );
          assert(csv.includes("'=SYNTHETIC_FORMULA()"));
          const r = await response(
            request(
              student,
              "GET",
              undefined,
              "?orgId=" + orgId + "&format=json",
              {},
              true,
            ),
            200,
            undefined,
            true,
          );
          assert.equal(r.rows.length, 3);
          assert(
            r.rows.every(
              (r) => r.studentId === student.id && r.status === "published",
            ),
          );
          const other = await response(
            request(
              otherStudent,
              "GET",
              undefined,
              "?orgId=" + orgId + "&format=json",
              {},
              true,
            ),
            200,
            undefined,
            true,
          );
          assert.equal(other.rows.length, 0);
          await response(
            request(outsider, "GET", undefined, "?orgId=" + orgId, {}, true),
            403,
            "TEACHING_FORBIDDEN",
            true,
          );
        } finally {
          db.prepare("UPDATE users SET name=? WHERE id=?").run(
            name,
            student.id,
          );
        }
      },
    );
    await check(
      "Enrollment removal blocks history/export/invite bypass until explicit restore",
      async () => {
        const e = state().enrollments.find((e) => e.userId === student.id);
        await post(teacher, {
          action: "enrollment.remove",
          orgId,
          id: e.id,
          expectedRevision: e.revision,
        });
        await get(student, orgId, "", 403, "TEACHING_FORBIDDEN");
        await response(
          request(student, "GET", undefined, "?orgId=" + orgId, {}, true),
          403,
          "TEACHING_FORBIDDEN",
          true,
        );
        await post(
          student,
          { action: "class.join", code: inviteCode },
          403,
          "TEACHING_ENROLLMENT_REVOKED",
        );
        const next = state().enrollments.find((r) => r.id === e.id);
        await post(teacher, {
          action: "enrollment.restore",
          orgId,
          id: e.id,
          expectedRevision: next.revision,
        });
        assert.equal((await get(student, orgId)).submissions.length, 3);
        assert.equal((await get(student, orgId)).groups.length, 0);
      },
    );
    await check(
      "Organization membership removal blocks prior class and invite bypass",
      async () => {
        await post(teacher, {
          action: "member.remove",
          orgId,
          userId: lateStudent.id,
          expectedRevision: state().organization.revision,
        });
        await get(lateStudent, orgId, "", 403, "TEACHING_FORBIDDEN");
        await post(
          lateStudent,
          { action: "class.join", code: inviteCode },
          403,
          "TEACHING_ENROLLMENT_REVOKED",
        );
        const freshClassCode = (
          await post(teacher, {
            action: "invite.create",
            orgId,
            classId: siblingClass,
            expectedRevision: find("classes", siblingClass).revision,
            expiresInDays: 7,
            maxUses: 5,
          })
        ).result.inviteCode;
        await post(
          lateStudent,
          { action: "class.join", code: freshClassCode },
          403,
          "TEACHING_ENROLLMENT_REVOKED",
        );
      },
    );
    await check(
      "Teacher removal ends class/source access; cannot self-escalate org role",
      async () => {
        await post(teacher, {
          action: "teacher.remove",
          orgId,
          classId,
          userId: colleague.id,
          expectedRevision: find("classes", classId).revision,
        });
        assert.equal((await get(colleague, orgId)).classes.length, 0);
        await post(
          colleague,
          {
            action: "material.update",
            orgId,
            id: materialId,
            expectedRevision: find("materials", materialId).revision,
            draft: materialDraft(classId),
          },
          403,
          "TEACHING_FORBIDDEN",
        );
        await post(
          colleague,
          {
            action: "member.role",
            orgId,
            userId: colleague.id,
            expectedRevision: state().organization.revision,
            role: "SCHOOL_ADMIN",
          },
          403,
          "TEACHING_FORBIDDEN",
        );
        assert.throws(
          () =>
            store.getTeachingGenerationContext(
              colleague.id,
              colleague.sessionVersion,
              orgId,
              [materialId],
            ),
          fail("TEACHING_FORBIDDEN"),
        );
      },
    );
    await check(
      "Org role requires strict string and active teacher, protects owner, changes no system role",
      async () => {
        const rev = state().organization.revision;
        await post(
          teacher,
          {
            action: "member.role",
            orgId,
            userId: colleague.id,
            expectedRevision: rev,
            role: ["SCHOOL_ADMIN"],
          },
          409,
          "TEACHING_ROLE_CONFLICT",
        );
        await post(
          teacher,
          {
            action: "member.role",
            orgId,
            userId: teacher.id,
            expectedRevision: rev,
            role: "SCHOOL_ADMIN",
          },
          409,
          "TEACHING_PROTECTED_MEMBER",
        );
        await post(teacher, {
          action: "member.role",
          orgId,
          userId: colleague.id,
          expectedRevision: rev,
          role: "SCHOOL_ADMIN",
        });
        assert.equal((await get(colleague, orgId)).role, "ORGANIZATION_ADMIN");
        assert.equal(store.getUser(colleague.id).role, "USER");
        await post(teacher, {
          action: "member.role",
          orgId,
          userId: colleague.id,
          expectedRevision: rev + 1,
          role: "TEACHER",
        });
      },
    );
    await check(
      "Canonical session and teacher credential revocation enforced on all access",
      async () => {
        const old = teacher.sessionVersion;
        db.prepare(
          "UPDATE users SET session_version=session_version+1 WHERE id=?",
        ).run(teacher.id);
        await get(teacher, orgId, "", 401, "SESSION_REVOKED");
        teacher.sessionVersion = store.getUser(teacher.id).sessionVersion;
        const a = store.readTeacherApplication(
          teacher.id,
          teacher.sessionVersion,
        ).application;
        store.reviewTeacherApplication(admin.id, admin.sessionVersion, {
          requestId: crypto.randomUUID(),
          applicationId: a.id,
          expectedRevision: a.revision,
          action: "revoke",
          note: "Synthetic revocation",
        });
        await get(teacher, orgId, "", 403, "TEACHER_APPROVAL_REQUIRED");
        const r = await get(teacher);
        assert.equal(r.organizations.length, 0);
        assert.equal(r.actor.canCreateOrganization, false);
        assert.equal(teacher.sessionVersion, old + 1);
        db.prepare(
          "UPDATE teacher_applications SET status='approved' WHERE id=?",
        ).run(a.id);
        db.prepare(
          "UPDATE teacher_credentials SET active=1 WHERE user_id=?",
        ).run(teacher.id);
      },
    );
    await check(
      "Second SQLite connection shares CAS and lost-ACK operation atomically",
      () => {
        const second = platform.createStore(file, options);
        try {
          const c = find("classes", siblingClass),
            b = {
              action: "class.update",
              orgId,
              id: c.id,
              expectedRevision: c.revision,
              ...classDraft("Concurrent winner"),
              archived: false,
              requestId: crypto.randomUUID(),
            },
            a = store.mutateTeaching(teacher.id, teacher.sessionVersion, b),
            r = second.mutateTeaching(teacher.id, teacher.sessionVersion, b);
          assert.equal(r.replayed, true);
          assert.equal(a.result.id, r.result.id);
          assert.throws(
            () =>
              second.mutateTeaching(teacher.id, teacher.sessionVersion, {
                ...b,
                requestId: crypto.randomUUID(),
                name: "Stale loser",
              }),
            fail("TEACHING_CONFLICT"),
          );
        } finally {
          second.close();
        }
      },
    );
    await check(
      "Archive blocks new writes and invites but preserves history",
      async () => {
        let c = find("classes", classId);
        await post(teacher, {
          action: "class.update",
          orgId,
          id: c.id,
          expectedRevision: c.revision,
          ...classDraft(),
          archived: true,
        });
        await post(
          teacher,
          { action: "material.create", orgId, draft: materialDraft(classId) },
          409,
          "TEACHING_CLASS_ARCHIVED",
        );
        await post(
          student,
          { action: "class.join", code: inviteCode },
          403,
          "TEACHING_INVITE_INVALID",
        );
        assert.equal((await get(student, orgId)).submissions.length, 3);
        c = find("classes", classId);
        await post(teacher, {
          action: "class.update",
          orgId,
          id: c.id,
          expectedRevision: c.revision,
          ...classDraft(),
          archived: false,
        });
      },
    );
    await check(
      "Invite max uses, revoke, expiry and secret rotation fail safely",
      async () => {
        let c = find("classes", siblingClass);
        const a = await post(teacher, {
          action: "invite.create",
          orgId,
          classId: c.id,
          expectedRevision: c.revision,
          expiresInDays: 1,
          maxUses: 1,
        });
        await post(pending, {
          action: "class.join",
          code: a.result.inviteCode,
        });
        await post(
          lateStudent,
          { action: "class.join", code: a.result.inviteCode },
          403,
          "TEACHING_INVITE_INVALID",
        );
        c = find("classes", siblingClass);
        const b = {
            action: "invite.create",
            orgId,
            classId: c.id,
            expectedRevision: c.revision,
            expiresInDays: 1,
            maxUses: 2,
            requestId: crypto.randomUUID(),
          },
          r = await post(teacher, b),
          secret = process.env.NEXTAUTH_SECRET;
        process.env.NEXTAUTH_SECRET = secret + "-rotated";
        try {
          await post(teacher, b, 409, "TEACHING_INVITE_RECOVERY_UNAVAILABLE");
        } finally {
          process.env.NEXTAUTH_SECRET = secret;
        }
        await post(teacher, {
          action: "invite.revoke",
          orgId,
          id: r.result.id,
          expectedRevision: 1,
        });
        await post(
          lateStudent,
          { action: "class.join", code: r.result.inviteCode },
          403,
          "TEACHING_INVITE_INVALID",
        );
        c = find("classes", siblingClass);
        const e = await post(teacher, {
            action: "invite.create",
            orgId,
            classId: c.id,
            expectedRevision: c.revision,
            expiresInDays: 1,
            maxUses: 2,
          }),
          prev = clock;
        clock += 86400001;
        try {
          await post(
            lateStudent,
            { action: "class.join", code: e.result.inviteCode },
            403,
            "TEACHING_INVITE_INVALID",
          );
        } finally {
          clock = prev;
        }
      },
    );
    await check(
      "Literal SQL search does not expand wildcard or tenant scope",
      async () => {
        assert(state().materials.length > 0);
        assert.equal(
          (await get(teacher, orgId, "&q=" + encodeURIComponent("%_")))
            .materials.length,
          0,
        );
        assert.equal(
          (await get(teacher, orgId, "&q=" + encodeURIComponent("' OR 1=1 --")))
            .questions.length,
          0,
        );
        assert.equal((await get(colleague, orgId)).materials.length, 0);
      },
    );
    await check(
      "Audit and idempotency metadata omit raw sources, grades, answers and invitation",
      () => {
        const logs = JSON.stringify(
          db
            .prepare(
              "SELECT * FROM audit_events WHERE action LIKE 'TEACHING_%'",
            )
            .all(),
        );
        assert.doesNotMatch(
          logs,
          /Synthetic unpublished note|Đồng giáo viên|Gộp hai nhóm|correctIndex|modelAnswer|rubric|grades_json|sourceEvidence/,
        );
        assert.equal(logs.includes(inviteCode), false);
        const ops = JSON.stringify(
          db.prepare("SELECT * FROM teaching_operations").all(),
        );
        assert.equal(ops.includes(inviteCode), false);
        assert.doesNotMatch(
          ops,
          /Gộp hai nhóm|Synthetic unpublished note|sourceEvidence|correctIndex/,
        );
      },
    );
    await check(
      "Stale pre-issue question snapshot is rejected and creates no recipients",
      async () => {
        const q = await makeQuestion(classId),
          draft = assignmentDraft(classId, [q]);
        const created = await post(teacher, {
          action: "assignment.create",
          orgId,
          draft,
        });
        await post(teacher, {
          action: "assignment.review",
          orgId,
          id: created.result.id,
          expectedRevision: 1,
        });
        await post(teacher, {
          action: "question.update",
          orgId,
          id: q,
          expectedRevision: 2,
          draft: questionDraft(classId, {
            explanation: "Nội dung được giáo viên chỉnh lại.",
          }),
        });
        await post(
          teacher,
          {
            action: "assignment.issue",
            orgId,
            id: created.result.id,
            expectedRevision: 2,
          },
          409,
          "TEACHING_SOURCE_CHANGED",
        );
        assert.equal(find("assignments", created.result.id).status, "reviewed");
        assert.equal(
          db
            .prepare(
              "SELECT count(*) n FROM teaching_assignment_targets WHERE assignment_id=?",
            )
            .get(created.result.id).n,
          0,
        );
      },
    );
    await check(
      "Per-teacher preferences persist self-only, CAS and AI opt-out are canonical",
      async () => {
        const initial = state().preferences;
        assert.equal(initial.revision, 0);
        assert.equal(state(student).preferences, null);
        const body = {
          action: "preferences.update",
          orgId,
          expectedRevision: 0,
          subjects: ["Toán"],
          grades: ["9"],
          displayName: "Tên trong workspace",
          aiLanguage: "vi",
          defaultDifficulty: "basic",
          aiEnabled: false,
          inAppNotifications: false,
          requestId: crypto.randomUUID(),
        };
        await post(student, body, 403, "TEACHING_FORBIDDEN");
        await post(
          teacher,
          { ...body, userId: colleague.id },
          400,
          "INVALID_TEACHING_DATA",
        );
        const saved = await post(teacher, body);
        assert.equal(saved.state.preferences.revision, 1);
        assert.equal((await post(teacher, body)).replayed, true);
        assert.equal(store.getUser(teacher.id).name, "Synthetic teacher");
        assert.equal(state(colleague).preferences.revision, 0);
        assert.throws(
          () =>
            store.getTeachingGenerationContext(
              teacher.id,
              teacher.sessionVersion,
              orgId,
              [],
            ),
          fail("TEACHING_AI_DISABLED"),
        );
        await post(
          teacher,
          { ...body, requestId: crypto.randomUUID(), aiEnabled: true },
          409,
          "TEACHING_CONFLICT",
        );
        await post(teacher, {
          ...body,
          expectedRevision: 1,
          requestId: crypto.randomUUID(),
          aiEnabled: true,
        });
        assert.equal(
          store.getTeachingGenerationContext(
            teacher.id,
            teacher.sessionVersion,
            orgId,
            [],
          ).materials.length,
          0,
        );
        assert.equal(
          db
            .prepare(
              "SELECT count(*) n FROM schema_migrations WHERE version=13",
            )
            .get().n,
          1,
        );
      },
    );
    await check(
      "Aggregate content quota accounts for replacements and rolls back failed request/replay",
      async () => {
        const quotaOrg = (
          await post(teacher, {
            action: "org.create",
            name: "Synthetic bounded workspace",
          })
        ).result.orgId;
        const large = "a".repeat(100000),
          ids = [];
        for (let i = 0; i < 20; i++)
          ids.push(
            (
              await post(teacher, {
                action: "material.create",
                orgId: quotaOrg,
                draft: materialDraft(null, { content: large }),
              })
            ).result.id,
          );
        const before = db
          .prepare("SELECT count(*) n FROM teaching_operations")
          .get().n;
        const payload = {
          action: "material.create",
          orgId: quotaOrg,
          draft: materialDraft(null, { content: large }),
          requestId: crypto.randomUUID(),
        };
        await post(teacher, payload, 413, "TEACHING_STORAGE_LIMIT");
        await post(teacher, payload, 413, "TEACHING_STORAGE_LIMIT");
        assert.equal(
          db.prepare("SELECT count(*) n FROM teaching_operations").get().n,
          before,
        );
        assert.equal((await get(teacher, quotaOrg)).materials.length, 20);
        await post(teacher, {
          action: "material.update",
          orgId: quotaOrg,
          id: ids[1],
          expectedRevision: 1,
          draft: materialDraft(null, { content: "b".repeat(99000) }),
        });
        await post(teacher, {
          action: "material.delete",
          orgId: quotaOrg,
          id: ids[0],
          expectedRevision: 1,
        });
        const added = await post(teacher, payload),
          replay = await post(teacher, payload);
        assert.equal(replay.replayed, true);
        assert.equal(added.result.id, replay.result.id);
        assert.equal((await get(teacher, quotaOrg)).materials.length, 20);
      },
    );
    await check(
      "Communication payload has an independent cumulative quota with atomic rollback",
      async () => {
        const quotaOrg = (
          await post(teacher, {
            action: "org.create",
            name: "Synthetic message quota",
          })
        ).result.orgId;
        for (let i = 0; i < 26; i++)
          await post(teacher, {
            action: "announcement.save",
            orgId: quotaOrg,
            expectedRevision: 0,
            classId: null,
            title: "Fixture",
            body: "a".repeat(10000),
          });
        const n = db
          .prepare(
            "SELECT count(*) n FROM teaching_announcements WHERE organization_id=?",
          )
          .get(quotaOrg).n;
        await post(
          teacher,
          {
            action: "announcement.save",
            orgId: quotaOrg,
            expectedRevision: 0,
            classId: null,
            title: "Excess",
            body: "a".repeat(10000),
          },
          413,
          "TEACHING_STORAGE_LIMIT",
        );
        assert.equal(
          db
            .prepare(
              "SELECT count(*) n FROM teaching_announcements WHERE organization_id=?",
            )
            .get(quotaOrg).n,
          n,
        );
      },
    );
    await check(
      "Total workspace budget also bounds repeated immutable question snapshots",
      async () => {
        const boundedOrg = (
          await post(teacher, {
            action: "org.create",
            name: "Snapshot capacity fixture",
          })
        ).result.orgId;
        const c = (
            await post(teacher, {
              action: "class.create",
              orgId: boundedOrg,
              ...classDraft(),
            })
          ).result.id,
          questions = [];
        for (let i = 0; i < 20; i++) {
          const draft = {
            ...shortDraft(c),
            prompt: "Giải thích bằng lời ví dụ " + i + ". " + "a".repeat(4900),
            modelAnswer: "b".repeat(5900),
            explanation: "c".repeat(5900),
          };
          const id = (
            await post(teacher, {
              action: "question.create",
              orgId: boundedOrg,
              draft,
            })
          ).result.id;
          await post(teacher, {
            action: "question.review",
            orgId: boundedOrg,
            id,
            expectedRevision: 1,
          });
          questions.push(id);
        }
        let stopped = false,
          accepted = 0;
        for (let i = 0; i < 30; i++) {
          const body = {
            action: "assignment.create",
            orgId: boundedOrg,
            draft: assignmentDraft(c, questions, {
              title: "Capacity snapshot " + i,
            }),
            requestId: crypto.randomUUID(),
          };
          const r = await api.POST(request(teacher, "POST", body)),
            data = await r.json();
          if (r.status === 413) {
            assert.equal(data.error, "TEACHING_STORAGE_LIMIT");
            assert.equal(
              db
                .prepare(
                  "SELECT count(*) n FROM teaching_operations WHERE request_id=?",
                )
                .get(body.requestId).n,
              0,
            );
            stopped = true;
            break;
          }
          assert.equal(r.status, 200, JSON.stringify(data));
          accepted++;
        }
        assert.equal(stopped, true);
        assert(accepted > 0 && accepted < 30);
        assert.equal(
          db
            .prepare(
              "SELECT count(*) n FROM teaching_assignments WHERE organization_id=?",
            )
            .get(boundedOrg).n,
          accepted,
        );
      },
    );
    await check(
      "Upgrade from schema11 preserves legacy private snapshot and applies12/13 once",
      () => {
        const oldFile = path.join(folder, "upgrade11.sqlite"),
          old = new DatabaseSync(oldFile),
          migrations = load("lib/server/schema.ts").migrations;
        old.exec(
          "PRAGMA foreign_keys=ON; CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL)",
        );
        for (const m of migrations.filter((m) => m.version <= 11)) {
          old.exec(m.sql);
          old
            .prepare("INSERT INTO schema_migrations VALUES (?,?)")
            .run(m.version, new Date(clock).toISOString());
        }
        old
          .prepare(
            "INSERT INTO users(id,storage_key,name,role,created_at,last_seen_at) VALUES ('legacy','legacy-storage','Legacy synthetic','USER',?,?)",
          )
          .run(new Date(clock).toISOString(), new Date(clock).toISOString());
        const privateText = '{"syntheticPrivate":"not a class source"}';
        old
          .prepare(
            "INSERT INTO sync_snapshots(user_id,epoch,revision,payload_json,digest,updated_at,expires_at) VALUES ('legacy','legacy-epoch',1,?,'legacy-digest',?,?)",
          )
          .run(privateText, new Date(clock).toISOString(), clock + 86400000);
        old.close();
        const upgraded = platform.createStore(oldFile, options);
        try {
          assert.equal(upgraded.getUser("legacy").storageKey, "legacy-storage");
          assert.equal(
            upgraded.readTeaching("legacy", 1).organizations.length,
            0,
          );
        } finally {
          upgraded.close();
        }
        const verify = new DatabaseSync(oldFile);
        try {
          assert.equal(
            verify
              .prepare(
                "SELECT payload_json FROM sync_snapshots WHERE user_id='legacy'",
              )
              .get().payload_json,
            privateText,
          );
          assert.equal(
            verify
              .prepare(
                "SELECT count(*) n FROM schema_migrations WHERE version IN(12,13)",
              )
              .get().n,
            2,
          );
        } finally {
          verify.close();
        }
      },
    );
    await check(
      "Reopen preserves assignments, snapshots, grades and migration once only",
      () => {
        const before = state(),
          count = db
            .prepare("SELECT count(*) n FROM teaching_assignments")
            .get().n;
        store.close();
        store = platform.createStore(file, options);
        assert.deepEqual(state().submissions, before.submissions);
        assert.deepEqual(state().preferences, before.preferences);
        assert.equal(state().assignments.length, before.assignments.length);
        assert.equal(
          db.prepare("SELECT count(*) n FROM teaching_assignments").get().n,
          count,
        );
        assert.equal(
          db
            .prepare(
              "SELECT count(*) n FROM schema_migrations WHERE version=12",
            )
            .get().n,
          1,
        );
      },
    );
    const report = {
      status: "PASS",
      checkedAt: new Date().toISOString(),
      passed: checks.length,
      checks,
      fixture:
        "Actual Request/Response, temporary SQLite, canonical synthetic users/manual teacher approvals and real source proofs/transactions/CAS/exports. OAuth session only synthetic. No network/providers/real teacher or student PII.",
      publicDeployment: "NOT TESTED",
      realSchoolTrials: "NOT TESTED",
    };
    fs.mkdirSync(path.join(root, "docs/teacher-workspace"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(root, "docs/teacher-workspace/backend-api-report.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(
      "Teaching API: " + checks.length + " real SQLite/handler checks passed.",
    );
  } finally {
    db.close();
    store.close();
    fs.rmSync(folder, { recursive: true, force: true });
    global.fetch = originalFetch;
    for (const [k, v] of Object.entries(saved))
      v === undefined ? delete process.env[k] : (process.env[k] = v);
  }
})().catch((e) => {
  console.error("Passed before failure:", checks.length);
  console.error(e);
  process.exitCode = 1;
});
