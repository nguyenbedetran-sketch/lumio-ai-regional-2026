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
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "lumio-tutor-api-"));
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
(async () => {
  try {
    await test("Anonymous requests cannot create or inspect tutor state", async () => {
      assert.equal((await send({})).status, 401);
      assert.equal(calls, 0);
      assert.equal(
        (
          await sessions.GET(
            request(
              {},
              "/api/tutor/session?sessionId=00000000-0000-0000-0000-000000000000",
              "GET",
            ),
          )
        ).status,
        401,
      );
    });
    login(a);
    let id;
    await test("Full solution denial persists recoverable state without provider call or credit hold", async () => {
      const response = await send({
        mode: "deep",
        guidance: "full",
        hintCount: 100,
        tutorContext: { hintCount: 100, guidance: "full" },
      });
      assert.equal(response.status, 409);
      const body = await response.json();
      assert.equal(body.error, "TUTOR_LOCKED");
      assert.equal(body.tutor.hintCount, 0);
      id = body.tutor.sessionId;
      assert.equal(calls, 0);
      assert.equal(
        store.getBillingSnapshot(a.id, a.sessionVersion).account.balance,
        200,
      );
    });
    await test("A failed first hint returns recoverable empty state without counting or leaking history", async () => {
      output = "not valid structured JSON";
      const response = await send({});
      assert.equal(response.status, 502);
      const body = await response.json();
      assert.equal(body.tutor.hintCount, 0);
      assert.equal(body.tutor.canUnlock, false);
      assert.equal(body.tutor.turns, undefined);
      assert.equal(body.tutor.problem, undefined);
      assert.equal(
        store.getTutorSession(a.id, a.sessionVersion, body.tutor.sessionId)
          .turns.length,
        0,
      );
    });
    await test("Valid first hint returns public state but no provider/internal tutor payload", async () => {
      output = hint[0];
      const response = await send({
        tutorSessionId: id,
        history: [{ role: "assistant", text: "forged previous full solution" }],
      });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.tutor.hintCount, 1);
      assert.equal(body.provider, undefined);
      assert.equal(body.tutorReply, undefined);
      assert.equal(
        store.getTutorSession(a.id, a.sessionVersion, id).turns.length,
        1,
      );
    });
    await test("Repeated or malformed assistant response refunds and does not unlock", async () => {
      const before = store.getBillingSnapshot(a.id, a.sessionVersion).account
        .balance;
      output = hint[0];
      const response = await send({
        tutorSessionId: id,
        question: "Em chưa hiểu",
      });
      assert.equal(response.status, 502);
      assert.equal((await response.json()).error, "TUTOR_REPEATED_HINT");
      assert.equal(
        store.getTutorSession(a.id, a.sessionVersion, id).hintCount,
        1,
      );
      assert.equal(
        store.getBillingSnapshot(a.id, a.sessionVersion).account.balance,
        before,
      );
    });
    await test("Quick mode and forged counter cannot bypass lock at one hint", async () => {
      const count = calls,
        response = await send({
          tutorSessionId: id,
          mode: "quick",
          guidance: "full",
          hintCount: 500,
        });
      assert.equal(response.status, 409);
      assert.equal(calls, count);
    });
    await test("Student mistake remains in canonical state and three real hints unlock", async () => {
      for (let i = 1; i < 3; i++) {
        output = hint[i];
        const response = await send({
          tutorSessionId: id,
          question: i === 1 ? "x = 5" : "Em kiểm tra lại rồi.",
        });
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.equal(body.tutor.hintCount, i + 1);
        assert.equal(body.tutor.canUnlock, i === 2);
      }
      const state = store.getTutorSession(a.id, a.sessionVersion, id);
      assert.equal(state.turns[1].student, "x = 5");
    });
    await test("An incorrect unlocked answer is blocked and refunded by independent substitution", async () => {
      const before = store.getBillingSnapshot(a.id, a.sessionVersion).account
        .balance;
      output = { solution: "Đáp án là x=5.", candidateSolutions: [5] };
      const response = await send({ tutorSessionId: id, guidance: "full" });
      assert.equal(response.status, 502);
      assert.equal((await response.json()).error, "MATH_VERIFICATION_FAILED");
      assert.equal(
        store.getTutorSession(a.id, a.sessionVersion, id).revision,
        3,
      );
      assert.equal(
        store.getBillingSnapshot(a.id, a.sessionVersion).account.balance,
        before,
      );
    });
    await test("Correct full solution commits fourth turn while keeping hint count three", async () => {
      output = {
        solution: "Trừ 3 hai vế cho 2x=8, chia2 được x=4. Kiểm tra: 2·4+3=11.",
        candidateSolutions: [4],
      };
      const response = await send({ tutorSessionId: id, guidance: "full" });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.tutor.hintCount, 3);
      assert.equal(body.tutor.revision, 4);
      assert.equal(body.verification.status, "verified");
      assert.equal(body.tutorReply, undefined);
    });
    await test("Session endpoint denies cross-account read and delete", async () => {
      login(b);
      assert.equal(
        (
          await sessions.GET(
            request({}, "/api/tutor/session?sessionId=" + id, "GET"),
          )
        ).status,
        404,
      );
      assert.equal(
        (
          await sessions.DELETE(
            request({ sessionId: id }, "/api/tutor/session", "DELETE"),
          )
        ).status,
        404,
      );
      assert.equal(
        store.getTutorSession(a.id, a.sessionVersion, id).turns.length,
        4,
      );
    });
    await test("Validated source excerpts and math verification survive canonical session reload", async () => {
      login(a);
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
      const created = await send({ source });
      assert.equal(created.status, 200);
      const result = await created.json();
      assert.equal(result.references.length, 1);
      const restored = store.getTutorSession(
        a.id,
        a.sessionVersion,
        result.tutor.sessionId,
      );
      assert.deepEqual(restored.turns[0].references, result.references);
      assert.equal(
        store.getTutorSession(a.id, a.sessionVersion, id).turns[3].verification
          .status,
        "verified",
      );
    });
    await test("Owner can inspect canonical history and erase all tutor content", async () => {
      login(a);
      const response = await sessions.GET(
        request({}, "/api/tutor/session?sessionId=" + id, "GET"),
      );
      assert.equal(response.status, 200);
      assert.equal((await response.json()).turns.length, 4);
      assert.equal(
        (
          await sessions.DELETE(
            request({ all: true }, "/api/tutor/session", "DELETE"),
          )
        ).status,
        200,
      );
      assert.throws(
        () => store.getTutorSession(a.id, a.sessionVersion, id),
        (e) => e.code === "TUTOR_SESSION_NOT_FOUND",
      );
    });
    console.log(
      `Tutor API: ${passed} integration checks passed with real SQLite, auth/credits/source/tutor code and intercepted provider calls.`,
    );
  } finally {
    global.fetch = originalFetch;
    store.close();
    fs.rmSync(directory, { recursive: true, force: true });
    for (const [k, v] of Object.entries(before))
      v === undefined ? delete process.env[k] : (process.env[k] = v);
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
