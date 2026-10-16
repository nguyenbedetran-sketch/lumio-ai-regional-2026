// Real teaching handlers + temporary SQLite. Synthetic identities only; all network is forbidden.
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
  NEXTAUTH_SECRET: "synthetic-v8-assessment-secret-only",
  LUMIO_COMPETITION_PREVIEW: "false",
  LUMIO_BACKGROUND_JOBS_DISABLED: "true",
};
const saved = Object.fromEntries(
    Object.keys(env).map((k) => [k, process.env[k]]),
  ),
  originalFetch = global.fetch;
Object.assign(process.env, env);
global.fetch = async () => {
  throw Error("EXTERNAL_NETWORK_FORBIDDEN");
};
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "lumio-v8-assessment-")),
  file = path.join(folder, "isolated.sqlite");
const platform = load("lib/server/store.ts");
store = platform.createStore(file, {
  adminEmails: ["assessment-owner@example.test"],
  now: () => clock,
});
const db = new DatabaseSync(file);
db.exec("PRAGMA foreign_keys=ON");
Object.assign(platform, {
  getStore: () => store,
  getUser: (id) => store.getUser(id),
});
const api = load("app/api/teaching/route.ts"),
  plan = load("lib/teaching/assessment-plan.ts"),
  origin = "http://127.0.0.1:3000";
let serial = 0;
const user = (name, extra = {}) =>
  store.ensureIdentity({
    provider: "google",
    providerAccountId: "assessment-" + ++serial,
    name: "Synthetic " + name,
    emailVerified: false,
    ...extra,
  });
const owner = user("owner", {
    email: "assessment-owner@example.test",
    emailVerified: true,
  }),
  teacher = user("teacher"),
  colleague = user("colleague"),
  student = user("student"),
  outsider = user("outsider");
function approve(u) {
  const a = store.submitTeacherApplication(u.id, u.sessionVersion, {
    requestId: crypto.randomUUID(),
    expectedRevision: 0,
    profile: {
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
    },
  }).application;
  store.reviewTeacherApplication(owner.id, owner.sessionVersion, {
    requestId: crypto.randomUUID(),
    applicationId: a.id,
    expectedRevision: a.revision,
    action: "approve",
    note: "Synthetic fixture only",
  });
}
function req(u, method, body, headers = {}) {
  session = u ? { userId: u.id, sessionVersion: u.sessionVersion } : null;
  return new Request(origin + "/api/teaching", {
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
async function post(u, body, status = 200, code, headers = {}) {
  const response = await api.POST(
      req(u, "POST", { requestId: crypto.randomUUID(), ...body }, headers),
    ),
    data = await response.json();
  assert.equal(response.status, status, JSON.stringify(data));
  assert.match(response.headers.get("cache-control"), /no-store/);
  if (code) assert.equal(data.error, code);
  return data;
}
async function check(name, fn) {
  await fn();
  checks.push({ name, status: "PASS" });
  console.log("PASS " + name);
}
const count = (table) =>
  Number(db.prepare("SELECT count(*) n FROM " + table).get().n);
const footprint = () =>
  [
    "teaching_assignments",
    "teaching_assessment_windows",
    "teaching_assignment_targets",
    "teaching_operations",
    "audit_events",
  ].map(count);
let orgId, classId, otherClassId, q1, q2, q3, composedId;
const state = (u = teacher) =>
  store.readTeaching(u.id, u.sessionVersion, { orgId });
const draft = (extra = {}) => ({
  classId,
  title: "Synthetic blueprint assessment",
  instructions: "Teacher will check before issuing",
  dueAt: new Date(clock + 86400000).toISOString(),
  target: { kind: "class", ids: [] },
  ...extra,
});
const cell = (extra = {}) => ({
  topic: "Số học",
  difficulty: "basic",
  kind: "mcq",
  count: 2,
  ...extra,
});
const command = (extra = {}) => ({
  action: "assignment.compose",
  orgId,
  expectedClassRevision: state().classes.find((c) => c.id === classId).revision,
  draft: draft(),
  blueprint: [cell()],
  ...extra,
});
async function makeQuestion(
  actor,
  extra = {},
  review = true,
  targetOrg = orgId,
) {
  const result = await post(actor, {
    action: "question.create",
    orgId: targetOrg,
    draft: {
      classId,
      prompt: "Câu hỏi kiểm thử " + ++serial,
      kind: "mcq",
      choices: [
        "Lựa chọn đúng",
        "Lựa chọn khác",
        "Lựa chọn thứ ba",
        "Lựa chọn thứ tư",
      ],
      correctIndex: 0,
      explanation: "Giải thích kiểm thử để giáo viên đối chiếu.",
      maxPoints: 1,
      topic: "Số học",
      difficulty: "basic",
      references: [],
      ...extra,
    },
  });
  if (review)
    await post(actor, {
      action: "question.review",
      orgId: targetOrg,
      id: result.result.id,
      expectedRevision: 1,
    });
  return result.result.id;
}
const bankQ = (id, prompt, extra = {}) => ({
  id,
  revision: 2,
  prompt,
  kind: "mcq",
  choices: ["A", "B"],
  correctIndex: 0,
  maxPoints: 1,
  topic: "Số học",
  difficulty: "basic",
  references: [],
  ...extra,
});
(async () => {
  try {
    await check(
      "Blueprint rejects extra keys, duplicate normalized cells, oversized counts and invalid dimensions",
      () => {
        for (const raw of [
          [],
          Array(13).fill(cell()),
          [cell({ count: 31 })],
          [cell({ count: 1.5 })],
          [cell({ kind: "all" })],
          [cell({ difficulty: "any" })],
          [cell({ questionIds: ["forged"] })],
          [cell({ count: 20 }), cell({ topic: "Other", count: 20 })],
          [cell(), cell({ topic: " SỐ   HỌC " })],
        ])
          assert.throws(() => plan.parseAssessmentBlueprint(raw));
      },
    );
    await check(
      "Deterministic matching satisfies overlapping prompt cells without a greedy false shortage",
      () => {
        const cells = plan.parseAssessmentBlueprint([
          cell({ count: 1 }),
          cell({ topic: "Hình học", count: 1 }),
        ]);
        const bank = [
          bankQ("a", "Shared prompt"),
          bankQ("b", "Alternative prompt"),
          bankQ("c", "Shared prompt", { topic: "Hình học" }),
        ];
        const selected = plan.composeAssessment(cells, bank);
        assert.deepEqual(selected.shortages, []);
        assert.deepEqual(selected.questionIds, ["b", "c"]);
        assert.deepEqual(
          plan.composeAssessment(cells, [...bank].reverse()),
          selected,
        );
        const duplicate = plan.composeAssessment(
          [cell({ count: 2 })],
          [bankQ("a", " Same  prompt "), bankQ("b", "same prompt")],
        );
        assert.equal(duplicate.questionIds.length, 1);
        assert.equal(duplicate.shortages[0].missing, 1);
      },
    );
    await check(
      "Preflight blocks duplicate IDs/prompts and total mismatch but labels coverage and answer concentration as review",
      () => {
        assert.equal(
          plan.inspectAssessment([bankQ("a", "Tính x²"), bankQ("b", "Tính x2")])
            .blocked,
          false,
          "Math superscripts must not be collapsed into different literal questions",
        );
        assert.equal(
          plan.inspectAssessment([bankQ("a", "Same"), bankQ("b", " SAME ")])
            .blocked,
          true,
        );
        assert.equal(
          plan.inspectAssessment([bankQ("a", "One"), bankQ("a", "Two")])
            .blocked,
          true,
        );
        assert.equal(
          plan.inspectAssessment([bankQ("a", "One")], 99).blocked,
          true,
        );
        assert.equal(
          plan.inspectAssessment([bankQ("a", "One", { maxPoints: NaN })])
            .blocked,
          true,
        );
        const good = plan.inspectAssessment(
          [0, 1, 2, 3].map((i) => bankQ(String(i), "Question " + i)),
        );
        assert.equal(good.blocked, false);
        assert.equal(good.maxPoints, 4);
        assert.ok(
          good.issues.some((i) => i.code === "ANSWER_POSITION_CONCENTRATION"),
        );
        assert.ok(good.issues.some((i) => i.code === "SOURCE_COVERAGE"));
        assert.equal(
          plan.inspectAssessment(
            [
              bankQ("a", "One", { maxPoints: 0.1 }),
              bankQ("b", "Two", { maxPoints: 0.2 }),
            ],
            0.3,
          ).blocked,
          false,
        );
      },
    );
    approve(teacher);
    approve(colleague);
    orgId = (
      await post(owner, {
        action: "org.create",
        name: "Synthetic assessment school",
      })
    ).result.id;
    classId = (
      await post(owner, {
        action: "class.create",
        orgId,
        name: "Class A",
        subject: "Toán",
        grade: "9",
        description: "Synthetic",
      })
    ).result.id;
    otherClassId = (
      await post(owner, {
        action: "class.create",
        orgId,
        name: "Private class B",
        subject: "Toán",
        grade: "9",
        description: "Synthetic",
      })
    ).result.id;
    // Synthetic membership provisioning only. Real access is exercised through actual handlers below.
    for (const u of [teacher, colleague])
      db.prepare(
        "INSERT INTO memberships(user_id,organization_id,role) VALUES (?,?,'TEACHER')",
      ).run(u.id, orgId);
    await post(owner, {
      action: "teacher.assign",
      orgId,
      classId,
      userId: teacher.id,
      expectedRevision: 1,
    });
    const invite = await post(owner, {
      action: "invite.create",
      orgId,
      classId,
      expectedRevision: state(owner).classes.find((c) => c.id === classId)
        .revision,
      expiresInDays: 7,
      maxUses: 3,
    });
    await post(student, {
      action: "class.join",
      code: invite.result.inviteCode,
    });
    q1 = await makeQuestion(teacher);
    q2 = await makeQuestion(teacher, { classId: null });
    q3 = await makeQuestion(teacher, {
      kind: "short",
      choices: [],
      correctIndex: undefined,
      modelAnswer: "Đáp án cần giáo viên xem lại",
      rubric: [{ label: "Đúng lập luận", points: 2 }],
      maxPoints: 2,
      topic: "Lập luận",
      difficulty: "medium",
    });
    await makeQuestion(teacher, { topic: "Chưa duyệt" }, false);
    await makeQuestion(owner, { classId: otherClassId, topic: "Riêng tư" });
    await makeQuestion(colleague, { classId: null, topic: "Riêng tư" });
    await check(
      "Unauthorized requests fail before any bank/shortage disclosure or mutation",
      async () => {
        const before = footprint();
        for (const [u, status, code] of [
          [null, 401, "SIGN_IN_REQUIRED"],
          [student, 403, "TEACHING_FORBIDDEN"],
          [outsider, 403, "TEACHING_FORBIDDEN"],
          [colleague, 403, "TEACHING_FORBIDDEN"],
        ]) {
          const r = await post(u, command(), status, code);
          assert.equal(r.shortages, undefined);
        }
        await post(teacher, command(), 403, "INVALID_ORIGIN", {
          origin: "https://attacker.invalid",
        });
        await post(teacher, command(), 401, "SESSION_REVOKED", {
          "x-lumio-account": "google:wrong",
        });
        assert.deepEqual(footprint(), before);
      },
    );
    await check(
      "Insufficient rows report only authorized distinct questions and leave no assignment/audit/receipt residue",
      async () => {
        const before = footprint();
        const r = await post(
          teacher,
          command({
            blueprint: [
              cell({ count: 3 }),
              cell({ topic: "Riêng tư", count: 1 }),
              cell({ topic: "Chưa duyệt", count: 1 }),
            ],
          }),
          422,
          "TEACHING_BLUEPRINT_SHORTAGE",
        );
        assert.deepEqual(r.shortages, [
          { row: 1, requested: 3, available: 2, missing: 1 },
          { row: 2, requested: 1, available: 0, missing: 1 },
          { row: 3, requested: 1, available: 0, missing: 1 },
        ]);
        assert.deepEqual(footprint(), before);
      },
    );
    await check(
      "Forged cross-class/org and injected IDs are rejected; class CAS is enforced",
      async () => {
        await post(
          teacher,
          command({ draft: draft({ classId: otherClassId }) }),
          403,
          "TEACHING_FORBIDDEN",
        );
        const elsewhere = (
          await post(owner, {
            action: "org.create",
            name: "Another synthetic school",
          })
        ).result.id;
        await post(
          teacher,
          command({ orgId: elsewhere }),
          403,
          "TEACHING_FORBIDDEN",
        );
        await post(
          teacher,
          command({ draft: draft({ questionIds: [q1] }) }),
          400,
          "INVALID_TEACHING_DATA",
        );
        await post(
          teacher,
          command({ expectedClassRevision: 999 }),
          409,
          "TEACHING_CONFLICT",
        );
      },
    );
    let composeCommand;
    await check(
      "Composition creates one editable draft with exact count/points and no recipients or credit activity",
      async () => {
        const money = db
          .prepare("SELECT count(*) n FROM billing_ledger")
          .get().n;
        composeCommand = {
          ...command({
            blueprint: [
              cell(),
              cell({
                topic: "Lập luận",
                difficulty: "medium",
                kind: "short",
                count: 1,
              }),
            ],
          }),
          requestId: crypto.randomUUID(),
        };
        const result = await post(teacher, composeCommand);
        composedId = result.result.id;
        const a = result.state.assignments.find((a) => a.id === composedId);
        assert.equal(a.status, "draft");
        assert.equal(a.revision, 1);
        assert.equal(a.maxPoints, 4);
        assert.equal(a.questions.length, 3);
        assert.deepEqual(new Set(a.questionIds), new Set([q1, q2, q3]));
        assert.deepEqual(a.recipientIds, []);
        assert.equal(a.issuedAt, null);
        assert.equal(
          db.prepare("SELECT count(*) n FROM billing_ledger").get().n,
          money,
        );
        const hidden = store.readTeaching(student.id, student.sessionVersion, {
          orgId,
        });
        assert.equal(
          hidden.assignments.some((a) => a.id === composedId),
          false,
        );
      },
    );
    await check(
      "Lost-ACK replay returns the same draft; changed payload UUID is rejected",
      async () => {
        const before = footprint(),
          replay = await post(teacher, composeCommand);
        assert.equal(replay.replayed, true);
        assert.equal(replay.result.id, composedId);
        assert.deepEqual(footprint(), before);
        await post(
          teacher,
          { ...composeCommand, draft: draft({ title: "Changed request" }) },
          409,
          "TEACHING_REQUEST_REUSED",
        );
      },
    );
    await check(
      "Replay rechecks current class assignment and membership instead of returning cached private data",
      async () => {
        db.prepare(
          "DELETE FROM teaching_class_teachers WHERE class_id=? AND user_id=?",
        ).run(classId, teacher.id);
        await post(teacher, composeCommand, 403, "TEACHING_FORBIDDEN");
        db.prepare(
          "INSERT INTO teaching_class_teachers(class_id,user_id) VALUES (?,?)",
        ).run(classId, teacher.id);
        db.prepare(
          "DELETE FROM memberships WHERE organization_id=? AND user_id=?",
        ).run(orgId, teacher.id);
        await post(teacher, composeCommand, 403, "TEACHING_FORBIDDEN");
        db.prepare(
          "INSERT INTO memberships(user_id,organization_id,role) VALUES (?,?,'TEACHER')",
        ).run(teacher.id, orgId);
      },
    );
    await check(
      "Failed operation persistence rolls back composed draft and audit together",
      async () => {
        const before = footprint();
        db.exec(
          "CREATE TRIGGER assessment_test_fault BEFORE INSERT ON teaching_operations WHEN NEW.action='assignment.compose' BEGIN SELECT RAISE(ABORT,'synthetic failure'); END",
        );
        try {
          await post(teacher, command(), 503, "PLATFORM_UNAVAILABLE");
        } finally {
          db.exec("DROP TRIGGER assessment_test_fault");
        }
        assert.deepEqual(footprint(), before);
      },
    );
    await check(
      "Reviewed source changes prevent issuing an older draft; no recipient write leaks through",
      async () => {
        await post(teacher, {
          action: "assignment.review",
          orgId,
          id: composedId,
          expectedRevision: 1,
        });
        const old = state().questions.find((q) => q.id === q2);
        const {
          id,
          orgId: unusedOrg,
          status,
          revision,
          createdBy,
          createdAt,
          updatedAt,
          ...question
        } = old;
        await post(teacher, {
          action: "question.update",
          orgId,
          id: q2,
          expectedRevision: old.revision,
          draft: {
            ...question,
            prompt: "Revised question for teacher approval",
          },
        });
        const before = footprint();
        await post(
          teacher,
          {
            action: "assignment.issue",
            orgId,
            id: composedId,
            expectedRevision: 2,
          },
          409,
          "TEACHING_SOURCE_CHANGED",
        );
        assert.deepEqual(footprint(), before);
        await post(teacher, {
          action: "question.review",
          orgId,
          id: q2,
          expectedRevision: old.revision + 1,
        });
        await post(teacher, {
          action: "assignment.update",
          orgId,
          id: composedId,
          expectedRevision: 2,
          draft: { ...draft(), questionIds: [q1, q2, q3] },
        });
      },
    );
    await check(
      "Whole-set checks run on review and issue, including legacy/corrupt totals, without partial state changes",
      async () => {
        const row = db
            .prepare("SELECT data_json FROM teaching_assignments WHERE id=?")
            .get(composedId),
          original = JSON.parse(row.data_json);
        const mutateStored = (data) =>
          db
            .prepare("UPDATE teaching_assignments SET data_json=? WHERE id=?")
            .run(JSON.stringify(data), composedId);
        mutateStored({ ...original, maxPoints: 999 });
        await post(
          teacher,
          {
            action: "assignment.review",
            orgId,
            id: composedId,
            expectedRevision: 3,
          },
          422,
          "TEACHING_CONTENT_BLOCKED",
        );
        mutateStored(original);
        await post(teacher, {
          action: "assignment.review",
          orgId,
          id: composedId,
          expectedRevision: 3,
        });
        const duplicate = structuredClone(original);
        duplicate.questions[1].prompt = duplicate.questions[0].prompt;
        mutateStored(duplicate);
        const before = footprint();
        await post(
          teacher,
          {
            action: "assignment.issue",
            orgId,
            id: composedId,
            expectedRevision: 4,
          },
          422,
          "TEACHING_CONTENT_BLOCKED",
        );
        assert.deepEqual(footprint(), before);
        mutateStored(original);
      },
    );
    await check(
      "Explicit issue freezes snapshots/recipients and students receive no keys/rubrics before publication",
      async () => {
        await post(teacher, {
          action: "assignment.issue",
          orgId,
          id: composedId,
          expectedRevision: 4,
        });
        const frozen = db
          .prepare("SELECT data_json FROM teaching_assignments WHERE id=?")
          .get(composedId).data_json;
        const own = store
          .readTeaching(student.id, student.sessionVersion, { orgId })
          .assignments.find((a) => a.id === composedId);
        assert.equal(own.questions.length, 3);
        assert.equal(
          own.questions.every(
            (q) =>
              q.correctIndex === undefined &&
              q.modelAnswer === undefined &&
              q.rubric === undefined &&
              q.explanation === undefined,
          ),
          true,
        );
        assert.deepEqual(
          state().assignments.find((a) => a.id === composedId).recipientIds,
          [student.id],
        );
        await post(
          teacher,
          {
            action: "assignment.update",
            orgId,
            id: composedId,
            expectedRevision: 5,
            draft: { ...draft(), questionIds: [q1] },
          },
          409,
          "TEACHING_ASSIGNMENT_IMMUTABLE",
        );
        assert.equal(
          db
            .prepare("SELECT data_json FROM teaching_assignments WHERE id=?")
            .get(composedId).data_json,
          frozen,
        );
      },
    );
    await check(
      "Revoked credential, session and disabled actor block composition and replay",
      async () => {
        const freshCommand = command();
        db.prepare(
          "UPDATE teacher_credentials SET active=0 WHERE user_id=?",
        ).run(teacher.id);
        await post(teacher, composeCommand, 403, "TEACHER_APPROVAL_REQUIRED");
        await post(teacher, freshCommand, 403, "TEACHER_APPROVAL_REQUIRED");
        db.prepare(
          "UPDATE teacher_credentials SET active=1 WHERE user_id=?",
        ).run(teacher.id);
        db.prepare(
          "UPDATE users SET session_version=session_version+1 WHERE id=?",
        ).run(teacher.id);
        await post(teacher, freshCommand, 401, "SESSION_REVOKED");
        await post(teacher, composeCommand, 401, "SESSION_REVOKED");
        const freshActor = store.getUser(teacher.id);
        db.prepare("UPDATE users SET disabled=1 WHERE id=?").run(teacher.id);
        await post(freshActor, freshCommand, 401, "SESSION_REVOKED");
      },
    );
    const report = {
      status: "PASS",
      checkedAt: new Date().toISOString(),
      passed: checks.length,
      checks,
      providerRequests: 0,
      scope:
        "Actual teaching handlers + isolated SQLite with synthetic accounts and sources. No private data, provider calls, browser, public deployment, or exam-accuracy claim.",
    };
    fs.mkdirSync(path.join(root, "docs/v8/reports"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "docs/v8/reports/teacher-assessment.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log("V8 assessment: " + checks.length + " checks passed.");
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
