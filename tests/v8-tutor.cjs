const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  ts = require("typescript");
const root = path.resolve(__dirname, ".."),
  cache = new Map();
let session = null;
function load(relative) {
  const file = path.resolve(root, relative);
  if (file === path.resolve(root, "lib/lumio/auth.ts"))
    return {
      authOptions: () => ({}),
      providerStatus: () => ({ google: true, facebook: false }),
    };
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
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
    (name) =>
      name === "next-auth"
        ? { getServerSession: async () => session }
        : name.startsWith(".")
          ? load(
              path.relative(
                root,
                path.resolve(path.dirname(file), name + ".ts"),
              ),
            )
          : require(name),
    module,
    module.exports,
  );
  return module.exports;
}
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "lumio-v8-tutor-"));
const env = {
  NODE_ENV: "development",
  NEXTAUTH_URL: "http://127.0.0.1:3000",
  NEXTAUTH_SECRET: "test-only-secret-32-characters-long",
  LUMIO_AI_ENABLED: "true",
  LUMIO_DESKTOP: "false",
  LUMIO_PUBLIC_DEMO: "false",
  OPENAI_API_KEY: "test-only-not-a-key",
  OPENAI_MODEL: "test-model",
  GEMINI_API_KEY: "",
  GEMINI_MODEL: "",
};
const before = Object.fromEntries(
  Object.keys(env).map((k) => [k, process.env[k]]),
);
Object.assign(process.env, env);
const platform = load("lib/server/store.ts"),
  store = platform.createStore(path.join(directory, "isolated.sqlite"));
Object.assign(platform, {
  getStore: () => store,
  getUser: (id) => store.getUser(id),
  isFeatureEnabled: (key) => store.isFeatureEnabled(key),
  recordAIUsage: (event) => store.recordAIUsage(event),
});
const feedback = load("app/api/tutor/feedback/route.ts");
const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync(path.join(directory, "isolated.sqlite"));
db.exec("PRAGMA foreign_keys=ON");
const api = load("app/api/ai/route.ts"),
  sessions = load("app/api/tutor/session/route.ts");
const create = (name) =>
    store.ensureIdentity({
      provider: "google",
      providerAccountId: name,
      name,
      emailVerified: false,
    }),
  a = create("a"),
  b = create("b");
const login = (user) =>
  (session = { userId: user.id, sessionVersion: user.sessionVersion });
const request = (body, path = "/api/ai", method = "POST") =>
  new Request("http://127.0.0.1:3000" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-lumio-account": session
        ? store.getUser(session.userId)?.storageKey || ""
        : "",
      "idempotency-key": crypto.randomUUID(),
      Origin: "http://127.0.0.1:3000",
    },
    body: method === "GET" ? undefined : JSON.stringify(body),
  });
const originalFetch = global.fetch;
let calls = 0,
  output,
  passed = 0;
global.fetch = async () => {
  calls++;
  return Response.json({
    output: [
      {
        content: [
          {
            type: "output_text",
            text: typeof output === "string" ? output : JSON.stringify(output),
          },
        ],
      },
    ],
  });
};
const send = (patch) =>
  api.POST(
    request({
      task: "chat",
      mode: "tutor",
      language: "vi",
      source: "",
      question: "Giải phương trình 2x+3=11",
      ...patch,
    }),
  );
const hint = [
  {
    hint: "Hãy tìm phép toán ngược để tách số hạng tự do đang đứng cùng ẩn.",
    question: "Em cần làm phép toán nào ở cả hai vế?",
  },
  {
    hint: "Hệ số của ẩn cho biết cần chia hai vế cho cùng một số khác không.",
    question: "Số nào là hệ số của ẩn sau bước trước?",
  },
  {
    hint: "Dùng giá trị dự kiến thay vào biểu thức ban đầu, rồi tính riêng hai vế.",
    question: "Khi thế lại, hai vế có cùng giá trị không?",
  },
];
async function test(name, fn) {
  await fn();
  passed++;
  console.log("PASS " + name);
}
// Actual isolated SQLite and handlers; network is intercepted, never a real provider.
const checks = [];
const oldTest = test;
test = async (name, fn) => {
  await oldTest(name, fn);
  checks.push(name);
};
let sequence = 0;
function direct(patch = {}, reply = hint[0]) {
  const input = load("lib/ai/contracts.ts").validateInput({
    task: "chat",
    question: "2x+3=11",
    source: "",
    language: "vi",
    ...patch,
  });
  const lease = store.prepareTutorTurn(
    a.id,
    a.sessionVersion,
    input,
    `local-${++sequence}`,
  );
  try {
    const state = store.commitTutorTurn(
      lease,
      reply,
      [reply.hint, reply.question].join("\n"),
    );
    return { state, lease };
  } catch (e) {
    store.abortTutorTurn(lease);
    throw e;
  }
}
function mutation(sessionId, turnId, patch = {}) {
  return {
    sessionId,
    turnId,
    expectedRevision: 0,
    requestId: crypto.randomUUID(),
    action: "set",
    usefulness: "helpful",
    ...patch,
  };
}
async function fb(body, headers = {}) {
  const req = request(body, "/api/tutor/feedback");
  for (const [k, v] of Object.entries(headers)) req.headers.set(k, v);
  return feedback.POST(req);
}
(async () => {
  try {
    login(a);
    let id, turnId;
    await test("Legacy missing intent stays absent from normalized receipt payload; strict enum rejects arrays/objects/numbers", () => {
      const validate = load("lib/ai/contracts.ts").validateInput;
      const legacy = validate({
        task: "chat",
        question: "2x+3=11",
        source: "",
        language: "vi",
      });
      assert.equal(Object.hasOwn(legacy, "tutorIntent"), false);
      for (const tutorIntent of [[], ["simpler"], {}, 1, "", null, "deep"]) {
        assert.throws(
          () => validate({ ...legacy, tutorIntent }),
          (e) => e.code === "INVALID_TUTOR_INTENT",
        );
      }
    });
    await test("Fifty re-explanations cannot advance the canonical three-progress gate or forge learner understanding", () => {
      let state = direct().state;
      id = state.sessionId;
      for (let i = 0; i < 50; i++)
        state = direct({
          tutorSessionId: id,
          tutorIntent: ["simpler", "example", "approach"][i % 3],
          question: "Em chưa hiểu",
        }).state;
      assert.equal(state.hintCount, 1);
      assert.equal(state.canUnlock, false);
      assert.equal(state.latestTurn.counted, false);
      assert.equal(state.latestTurn.ordinal, 51);
      const view = store.getTutorSession(a.id, a.sessionVersion, id);
      assert.equal(view.turns.length, 51);
      assert.equal(view.turns.filter((t) => t.counted).length, 1);
      assert.equal(view.continuity.lastStudentAttempt, "Em chưa hiểu");
      assert.equal(view.continuity.lastQuestion, hint[0].question);
      assert.equal(view.continuity.note, "recorded-not-verified");
    });
    await test("Full solution is still denied before provider or credit reservation after fifty help turns", async () => {
      const before = calls,
        balance = store.getBillingSnapshot(a.id, a.sessionVersion).account
          .balance;
      const r = await send({
        tutorSessionId: id,
        tutorIntent: "approach",
        guidance: "full",
      });
      assert.equal(r.status, 409);
      assert.equal(calls, before);
      assert.equal(
        store.getBillingSnapshot(a.id, a.sessionVersion).account.balance,
        balance,
      );
    });
    await test("Distinct canonical progress turns still unlock at exactly three, with stable IDs on reload", () => {
      direct({ tutorSessionId: id }, hint[1]);
      const { state } = direct({ tutorSessionId: id }, hint[2]);
      assert.equal(state.hintCount, 3);
      assert.equal(state.canUnlock, true);
      const view = store.getTutorSession(a.id, a.sessionVersion, id);
      turnId = state.latestTurn.id;
      assert.equal(view.turns.at(-1).id, turnId);
      assert.equal(view.latestTurn.id, turnId);
      assert.equal(view.turns.at(-1).counted, true);
    });
    await test("Help repeat is accepted but identical progress is rejected by parser without changing the gate", () => {
      const policy = load("lib/tutor/policy.ts"),
        ctx = {
          problem: "2x+3=11",
          hints: [hint[0].hint],
          hintCount: 1,
          guidance: "hints",
        };
      assert.throws(
        () =>
          policy.parseTutorResponse(JSON.stringify(hint[0]), {
            tutorContext: ctx,
          }),
        (e) => e.code === "TUTOR_REPEATED_HINT",
      );
      assert.ok(
        policy.parseTutorResponse(JSON.stringify(hint[0]), {
          tutorContext: { ...ctx, intent: "simpler" },
        }).text,
      );
    });
    await test("Adaptive help retains deterministic final-answer leakage guard", () => {
      const policy = load("lib/tutor/policy.ts");
      assert.throws(
        () =>
          policy.parseTutorResponse(
            JSON.stringify({
              hint: "Hãy dùng kết quả x=4 để giải bài toán này.",
              question: "Em có hiểu không?",
            }),
            {
              tutorContext: {
                problem: "2x+3=11",
                hints: [],
                hintCount: 0,
                guidance: "hints",
                intent: "example",
              },
            },
          ),
        (e) => e.code === "TUTOR_SOLUTION_LEAK",
      );
    });
    await test("Help cannot clear a prior missing-data clarification lock even after recorded progress", () => {
      let state = direct(
        { question: "Tính diện tích tam giác" },
        { ...hint[0], needsClarification: true },
      ).state;
      assert.equal(state.needsClarification, true);
      state = direct(
        {
          question: "Em chưa hiểu",
          tutorSessionId: state.sessionId,
          tutorIntent: "simpler",
        },
        hint[0],
      ).state;
      assert.equal(state.needsClarification, true);
      assert.equal(state.hintCount, 0);
      assert.equal(state.canUnlock, false);
    });
    await test("Feedback stores closed categories privately without provider calls or credit cost, even while AI is disabled", async () => {
      const before = calls,
        balance = store.getBillingSnapshot(a.id, a.sessionVersion).account
          .balance;
      process.env.LUMIO_AI_ENABLED = "false";
      const r = await fb(mutation(id, turnId));
      assert.equal(r.status, 200);
      const b = await r.json();
      assert.equal(b.revision, 1);
      assert.equal(b.feedback.usefulness, "helpful");
      assert.equal(calls, before);
      assert.equal(
        store.getBillingSnapshot(a.id, a.sessionVersion).account.balance,
        balance,
      );
      process.env.LUMIO_AI_ENABLED = "true";
    });
    let key;
    await test("Feedback edits use CAS and a lost-ACK replay returns current state rather than overwriting later edits", async () => {
      key = mutation(id, turnId, {
        expectedRevision: 1,
        usefulness: "not_helpful",
        correctness: "possible_error",
      });
      let r = await fb(key);
      assert.equal(r.status, 200);
      assert.equal((await r.json()).revision, 2);
      r = await fb(
        mutation(id, turnId, { expectedRevision: 2, correctness: "not_sure" }),
      );
      assert.equal(r.status, 200);
      r = await fb(key);
      const b = await r.json();
      assert.equal(r.status, 200);
      assert.equal(b.replayed, true);
      assert.equal(b.appliedRevision, 2);
      assert.equal(b.revision, 3);
      assert.equal(b.feedback.correctness, "not_sure");
    });
    await test("Stale revision and reused UUID with changed category cannot mutate feedback", async () => {
      assert.equal(
        (await fb(mutation(id, turnId, { expectedRevision: 1 }))).status,
        409,
      );
      assert.equal((await fb({ ...key, usefulness: "helpful" })).status, 409);
      assert.equal(
        store.getTutorSession(a.id, a.sessionVersion, id).latestTurn
          .feedbackRevision,
        3,
      );
    });
    await test("Feedback rejects free text, unknown fields, coercible category arrays and action arrays", async () => {
      for (const patch of [
        { comment: "private text" },
        { action: ["set"] },
        { usefulness: ["helpful"] },
        { correctness: 42 },
        { usefulness: null, correctness: null },
        { action: "delete", correctness: null },
      ])
        assert.equal(
          (await fb(mutation(id, turnId, { expectedRevision: 3, ...patch })))
            .status,
          400,
        );
      assert.equal(
        db.prepare("SELECT count(*) n FROM tutor_feedback").get().n,
        1,
      );
    });
    await test("Owner/category-only GET projection persists, another account and stale tab account cannot read or write it", async () => {
      const view = store.getTutorSession(a.id, a.sessionVersion, id);
      assert.equal(view.latestTurn.feedback.correctness, "not_sure");
      assert.equal(JSON.stringify(view).includes(key.requestId), false);
      login(b);
      assert.equal(
        (await fb(mutation(id, turnId, { expectedRevision: 3 }))).status,
        404,
      );
      login(a);
      assert.equal(
        (
          await fb(mutation(id, turnId, { expectedRevision: 3 }), {
            "x-lumio-account": b.storageKey,
          })
        ).status,
        401,
      );
      assert.equal(
        (
          await fb(mutation(id, turnId, { expectedRevision: 3 }), {
            origin: "https://other.invalid",
          })
        ).status,
        403,
      );
    });
    await test("Feedback deletion erases categories while keeping only revision/hash replay metadata; repeated empty deletion is bounded", async () => {
      const body = mutation(id, turnId, {
        expectedRevision: 3,
        action: "delete",
      });
      delete body.usefulness;
      const r = await fb(body);
      assert.equal(r.status, 200);
      const v = await r.json();
      assert.equal(v.feedback, null);
      assert.equal(v.revision, 4);
      assert.equal(
        db.prepare("SELECT count(*) n FROM tutor_feedback").get().n,
        0,
      );
      const actions = db
        .prepare("SELECT count(*) n FROM tutor_feedback_actions")
        .get().n;
      for (let i = 0; i < 5; i++)
        assert.equal(
          (
            await fb({
              ...body,
              expectedRevision: 4,
              requestId: crypto.randomUUID(),
            })
          ).status,
          200,
        );
      assert.equal(
        db.prepare("SELECT count(*) n FROM tutor_feedback_actions").get().n,
        actions,
      );
      assert.equal((await (await fb(key)).json()).feedback, null);
    });
    await test("Invalid tutor intent fails before provider and credit movement at actual AI handler", async () => {
      const count = calls,
        balance = store.getBillingSnapshot(a.id, a.sessionVersion).account
          .balance;
      assert.equal((await send({ tutorIntent: ["simpler"] })).status, 400);
      assert.equal(calls, count);
      assert.equal(
        store.getBillingSnapshot(a.id, a.sessionVersion).account.balance,
        balance,
      );
    });
    await test("Accepted adaptive API turn keeps structural count, stable identity and exact source provenance", async () => {
      const source =
        "Khi biến đổi phương trình, thực hiện cùng một phép toán trên cả hai vế.";
      output = {
        ...hint[0],
        references: [
          {
            segmentId: "s1",
            quote: "thực hiện cùng một phép toán trên cả hai vế",
          },
        ],
      };
      let r = await send({ source });
      assert.equal(r.status, 200);
      const first = await r.json();
      r = await send({
        source,
        tutorSessionId: first.tutor.sessionId,
        tutorIntent: "simpler",
        question: "Giải thích dễ hơn",
      });
      assert.equal(r.status, 200);
      const second = await r.json();
      assert.equal(second.tutor.hintCount, 1);
      assert.equal(second.tutor.latestTurn.intent, "simpler");
      assert.equal(second.tutor.latestTurn.counted, false);
      assert.equal(second.references.length, 1);
      const saved = store.getTutorSession(
        a.id,
        a.sessionVersion,
        first.tutor.sessionId,
      );
      assert.deepEqual(saved.turns[1].references, second.references);
      assert.equal(saved.turns[1].id, second.tutor.latestTurn.id);
    });
    await test("Disabled user and revoked canonical session cannot replay feedback", async () => {
      db.prepare("UPDATE users SET disabled=1 WHERE id=?").run(a.id);
      assert.equal((await fb(key)).status, 401);
      db.prepare("UPDATE users SET disabled=0 WHERE id=?").run(a.id);
      db.prepare(
        "UPDATE users SET session_version=session_version+1 WHERE id=?",
      ).run(a.id);
      assert.equal((await fb(key)).status, 401);
      db.prepare("UPDATE users SET session_version=? WHERE id=?").run(
        a.sessionVersion,
        a.id,
      );
    });
    await test("Session deletion atomically cascades feedback and replay records, so old IDs cannot resurrect choices", async () => {
      const set = await fb(mutation(id, turnId, { expectedRevision: 4 }));
      assert.equal(set.status, 200);
      const r = await sessions.DELETE(
        request({ sessionId: id }, "/api/tutor/session", "DELETE"),
      );
      assert.equal(r.status, 200);
      assert.equal(
        db
          .prepare("SELECT count(*) n FROM tutor_feedback WHERE session_id=?")
          .get(id).n,
        0,
      );
      assert.equal(
        db
          .prepare(
            "SELECT count(*) n FROM tutor_feedback_actions WHERE session_id=?",
          )
          .get(id).n,
        0,
      );
      assert.equal((await fb(key)).status, 404);
    });
    await test("Feedback transaction fault rolls back categories and idempotency metadata together", () => {
      const local = direct().state,
        turn = local.latestTurn.id;
      db.exec(
        "CREATE TRIGGER fixture_feedback_fault BEFORE INSERT ON tutor_feedback_actions BEGIN SELECT RAISE(ABORT,'fixture-fault');END;",
      );
      assert.throws(
        () =>
          store.mutateTutorFeedback(
            a.id,
            a.sessionVersion,
            mutation(local.sessionId, turn),
          ),
        /fixture-fault/,
      );
      db.exec("DROP TRIGGER fixture_feedback_fault");
      assert.equal(
        db
          .prepare("SELECT count(*) n FROM tutor_feedback WHERE turn_id=?")
          .get(turn).n,
        0,
      );
      assert.equal(
        db
          .prepare(
            "SELECT count(*) n FROM tutor_feedback_actions WHERE turn_id=?",
          )
          .get(turn).n,
        0,
      );
    });
    await test("TTL sweep deletes both feedback choices and hashed replay metadata with expired owned content", () => {
      const local = direct().state;
      store.mutateTutorFeedback(
        a.id,
        a.sessionVersion,
        mutation(local.sessionId, local.latestTurn.id),
      );
      db.prepare("UPDATE tutor_sessions SET expires_at=1 WHERE id=?").run(
        local.sessionId,
      );
      assert.throws(
        () => store.getTutorSession(a.id, a.sessionVersion, local.sessionId),
        (e) => e.code === "TUTOR_SESSION_NOT_FOUND",
      );
      assert.equal(
        db
          .prepare("SELECT count(*) n FROM tutor_feedback WHERE session_id=?")
          .get(local.sessionId).n,
        0,
      );
      assert.equal(
        db
          .prepare(
            "SELECT count(*) n FROM tutor_feedback_actions WHERE session_id=?",
          )
          .get(local.sessionId).n,
        0,
      );
    });
    await test("Real schema17 clone upgrades to18 preserving existing user/turn bytes with default progress intent", () => {
      const old = path.join(directory, "old17.sqlite"),
        d = new DatabaseSync(old),
        schema = load("lib/server/schema.ts");
      d.exec(
        "PRAGMA foreign_keys=ON;CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL)",
      );
      for (const m of schema.migrations.filter((m) => m.version <= 17)) {
        d.exec(m.sql);
        d.prepare("INSERT INTO schema_migrations VALUES(?,?)").run(
          m.version,
          "2026-10-16T00:00:00.000Z",
        );
      }
      const local = direct().state;
      for (const table of ["users", "tutor_sessions", "tutor_turns"]) {
        const cols = d
          .prepare(`PRAGMA table_info(${table})`)
          .all()
          .map((r) => r.name);
        const rows =
          table === "users"
            ? db.prepare("SELECT * FROM users WHERE id=?").all(a.id)
            : table === "tutor_sessions"
              ? db
                  .prepare("SELECT * FROM tutor_sessions WHERE id=?")
                  .all(local.sessionId)
              : db
                  .prepare("SELECT * FROM tutor_turns WHERE session_id=?")
                  .all(local.sessionId);
        for (const row of rows)
          d.prepare(
            `INSERT INTO ${table}(${cols.join(",")}) VALUES(${cols.map(() => "?").join(",")})`,
          ).run(...cols.map((k) => row[k]));
      }
      d.close();
      const operator = require("../scripts/database-snapshot.cjs"),
        beforeBytes = fs.readFileSync(old),
        copy = path.join(directory, "old17-copy.sqlite");
      assert.equal(operator.inspect(old).schemaVersion, 17);
      assert.equal(operator.snapshot(old, copy).schemaVersion, 17);
      assert.deepEqual(fs.readFileSync(old), beforeBytes);
      const upgraded = platform.createStore(copy);
      try {
        assert.equal(upgraded.runtimeHealth().schemaVersion, 18);
        const view = upgraded.getTutorSession(
          a.id,
          a.sessionVersion,
          local.sessionId,
        );
        assert.equal(view.hintCount, 1);
        assert.equal(view.turns[0].intent, "progress");
        assert.equal(view.turns[0].feedback, null);
        assert.equal(
          view.turns[0].assistant,
          hint[0].hint + "\n" + hint[0].question,
        );
      } finally {
        upgraded.close();
      }
    });
    await test("Adaptive AI failure refunds held credits and duplicate completed intent cannot call the provider twice", async () => {
      output = {
        hint: "Hãy dùng kết quả x=4 để giải bài toán này.",
        question: "Em có hiểu không?",
      };
      const balance = store.getBillingSnapshot(a.id, a.sessionVersion).account
        .balance;
      const failed = await send({ tutorIntent: "example" });
      assert.equal(failed.status, 502);
      assert.equal((await failed.json()).error, "TUTOR_SOLUTION_LEAK");
      assert.equal(
        store.getBillingSnapshot(a.id, a.sessionVersion).account.balance,
        balance,
      );
      output = hint[0];
      const key = crypto.randomUUID(),
        body = {
          task: "chat",
          mode: "tutor",
          language: "vi",
          source: "",
          question: "2x+3=11",
          tutorIntent: "simpler",
        };
      const make = () => {
        const r = request(body);
        r.headers.set("idempotency-key", key);
        return r;
      };
      const first = await api.POST(make());
      assert.equal(first.status, 200);
      const saved = await first.json(),
        n = calls;
      const again = await api.POST(make());
      assert.equal(again.status, 409);
      const duplicate = await again.json();
      assert.equal(duplicate.error, "AI_REQUEST_COMPLETED");
      assert.equal(duplicate.receipt.tutorSessionId, saved.tutor.sessionId);
      assert.equal(calls, n);
      assert.equal(
        store.getTutorSession(a.id, a.sessionVersion, saved.tutor.sessionId)
          .hintCount,
        0,
      );
    });
    await test("Per-turn edit cap remains bounded but still allows erasing choices", () => {
      const local = direct().state;
      let revision = 0;
      for (let i = 0; i < 50; i++)
        revision = store.mutateTutorFeedback(
          a.id,
          a.sessionVersion,
          mutation(local.sessionId, local.latestTurn.id, {
            expectedRevision: revision,
            usefulness: i % 2 ? "helpful" : "not_helpful",
          }),
        ).revision;
      assert.throws(
        () =>
          store.mutateTutorFeedback(
            a.id,
            a.sessionVersion,
            mutation(local.sessionId, local.latestTurn.id, {
              expectedRevision: revision,
            }),
          ),
        (e) => e.code === "TUTOR_FEEDBACK_LIMIT",
      );
      const erase = mutation(local.sessionId, local.latestTurn.id, {
        expectedRevision: revision,
        action: "delete",
      });
      delete erase.usefulness;
      assert.equal(
        store.mutateTutorFeedback(a.id, a.sessionVersion, erase).feedback,
        null,
      );
    });
    await test("Schema18 native snapshot restores feedback bytes, stable IDs and session intent metadata", () => {
      const local = direct({ tutorIntent: "approach" }).state;
      store.mutateTutorFeedback(
        a.id,
        a.sessionVersion,
        mutation(local.sessionId, local.latestTurn.id),
      );
      const canonical = store.getTutorSession(
          a.id,
          a.sessionVersion,
          local.sessionId,
        ),
        snapshot = require("../scripts/database-snapshot.cjs"),
        out = path.join(directory, "restore18.sqlite");
      assert.equal(
        snapshot.snapshot(path.join(directory, "isolated.sqlite"), out)
          .schemaVersion,
        18,
      );
      const restored = platform.createStore(out);
      try {
        assert.deepEqual(
          restored.getTutorSession(a.id, a.sessionVersion, local.sessionId),
          canonical,
        );
      } finally {
        restored.close();
      }
    });
    const report = {
      status: "PASS",
      checkedAt: new Date().toISOString(),
      checks,
      passed,
      providerRequests: 0,
      scope:
        "Actual isolated SQLite/migration/handlers with synthetic identities and intercepted fake provider; no real provider, OAuth, device microphone or student validation.",
    };
    fs.mkdirSync(path.join(root, "docs/v8/reports"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "docs/v8/reports/tutor-api.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(`V8 tutor: ${passed} checks PASS; 0 real provider calls.`);
  } finally {
    global.fetch = originalFetch;
    db.close();
    store.close();
    fs.rmSync(directory, { recursive: true, force: true });
    for (const [k, v] of Object.entries(before))
      v === undefined ? delete process.env[k] : (process.env[k] = v);
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
