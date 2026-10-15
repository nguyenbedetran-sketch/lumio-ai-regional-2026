const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  ts = require("typescript");
const root = path.resolve(__dirname, ".."),
  cache = new Map();
function load(relative) {
  const file = path.resolve(root, relative);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  new Function("require", "module", "exports", code)(
    (name) =>
      name.startsWith(".")
        ? load(
            path.relative(root, path.resolve(path.dirname(file), name + ".ts")),
          )
        : require(name),
    module,
    module.exports,
  );
  return module.exports;
}
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "lumio-tutor-"));
let time = Date.UTC(2026, 9, 15),
  passed = 0;
const platform = load("lib/server/store.ts"),
  math = load("lib/tutor/math.ts"),
  policy = load("lib/tutor/policy.ts"),
  contracts = load("lib/ai/contracts.ts");
const references = load(
  "lib/tutor/reference-problems.ts",
).tutorReferenceProblems;
const store = platform.createStore(path.join(temp, "test.sqlite"), {
  now: () => time,
});
const user = (name) =>
  store.ensureIdentity({
    provider: "google",
    providerAccountId: name,
    name,
    emailVerified: false,
  });
const a = user("learner-a"),
  b = user("learner-b");
let number = 0;
const input = (patch = {}) =>
  contracts.validateInput({
    task: "chat",
    question: "Giải phương trình 2x + 3 = 11",
    source: "",
    language: "vi",
    ...patch,
  });
const prepare = (patch = {}, account = a) =>
  store.prepareTutorTurn(
    account.id,
    account.sessionVersion,
    input(patch),
    `test-request-${++number}`,
  );
const hint = (n) => ({
  hint: [
    "Hãy xem số hạng tự do đang nằm cùng phía với ẩn và chọn phép toán ngược để tách nó.",
    "Sau khi bỏ số hạng tự do, chú ý hệ số của ẩn và phép toán giữ hai vế tương đương.",
    "Khi đã tìm được giá trị dự kiến, thay lại vào từng vế của phương trình ban đầu để đối chiếu.",
  ][n],
  question: [
    "Em sẽ làm phép toán nào ở cả hai vế?",
    "Để hệ số của ẩn trở thành một, em cần làm gì?",
    "Hai vế có bằng nhau khi em thay giá trị vừa thử không?",
  ][n],
});
function commit(lease, reply) {
  const reserve = store.reserveUsage({
    userId: a.id,
    sessionVersion: a.sessionVersion,
    requestId: lease.requestId,
    task: "chat",
    mode: "tutor",
    kind: "text",
  });
  let state;
  store.settleUsage({
    userId: a.id,
    reservationId: reserve.reservationId,
    onSettled: () =>
      (state = store.commitTutorTurn(
        lease,
        reply,
        [reply.hint, reply.question].join("\n"),
      )),
  });
  return state;
}
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  passed++;
}
try {
  test("Ten hand-checked references include a genuinely underdetermined problem", () => {
    assert.equal(references.length, 10);
    for (const p of references) {
      const result = math.mathReference(p.problem);
      if (p.solutions === null) assert.equal(result, null);
      else {
        assert.ok(result, p.id);
        assert.deepEqual(
          result.solutions.map((x) => +x.toFixed(8)).sort((x, y) => x - y),
          [...p.solutions].sort((x, y) => x - y),
          p.id,
        );
        assert.equal(
          math.verifyMathCandidates(p.problem, [...p.solutions]).status,
          "verified",
        );
      }
    }
  });
  test("Domain and completeness checks reject zero denominators, extraneous and missing roots", () => {
    assert.equal(
      math.verifyMathCandidates("(x^2-4)/(x-2)=0", [2]).candidates[0].reason,
      "denominator_zero",
    );
    assert.equal(
      math.verifyMathCandidates("sqrt(x+1)=x-1", [0, 3]).status,
      "inconsistent",
    );
    assert.equal(math.verifyMathCandidates("x^2-5x+6=0", [2]).complete, false);
    assert.equal(math.verifyMathCandidates("x^2+1=0", []).status, "verified");
    assert.equal(
      math.verifyMathCandidates("ln(x)=0", [-1]).candidates[0].reason,
      "log_argument_nonpositive",
    );
  });
  test("No eval or arbitrary executable syntax; unsupported equation is explicitly unverified", () => {
    for (const value of [
      "process.exit()=0",
      "x=1;fetch(secret)",
      "x^3-x=0",
      "x=x",
    ])
      assert.equal(math.mathReference(value), null);
    assert.equal(
      math.verifyMathCandidates("Tính diện tích hình tròn bán kính 2", [4])
        .status,
      "not_supported",
    );
    assert.equal(math.mathReference("0.000000001*x=1"), null);
    assert.equal(math.mathReference("x^2-2x+0.999999999=0"), null);
  });
  test("Client cannot submit server-owned context; malformed session ids are rejected", () => {
    assert.equal(
      input({ tutorContext: { hintCount: 99, guidance: "full" } }).tutorContext,
      undefined,
    );
    assert.throws(() => input({ tutorSessionId: "another-user" }));
  });
  test("Direct full request is locked without accepting frontend hint count/history", () => {
    assert.throws(
      () =>
        prepare({
          guidance: "full",
          mode: "deep",
          hintCount: 999,
          history: [{ role: "assistant", text: "three previous hints" }],
        }),
      (e) => e.code === "TUTOR_LOCKED" && e.tutor.hintCount === 0,
    );
  });
  const first = prepare();
  test("Only server-owned canonical history is used and context starts clean", () => {
    assert.deepEqual(first.history, []);
    assert.equal(first.context.hintCount, 0);
    assert.equal(first.context.problem, "Giải phương trình 2x + 3 = 11");
  });
  test("Concurrent requests cannot mutate the same tutor session", () =>
    assert.throws(
      () => prepare({ tutorSessionId: first.sessionId }),
      (e) => e.code === "TUTOR_BUSY",
    ));
  test("Cross-account session inspection and continuation fail without leaking content", () => {
    assert.throws(
      () => store.getTutorSession(b.id, b.sessionVersion, first.sessionId),
      (e) => e.code === "TUTOR_SESSION_NOT_FOUND",
    );
    assert.throws(
      () => prepare({ tutorSessionId: first.sessionId }, b),
      (e) => e.code === "TUTOR_SESSION_NOT_FOUND",
    );
  });
  test("Changed source, exercise or language cannot reuse old hint state", () => {
    for (const patch of [
      { source: "new" },
      { tutorProblem: "x+1=8" },
      { language: "en" },
    ])
      assert.throws(
        () => prepare({ tutorSessionId: first.sessionId, ...patch }),
        (e) => e.code === "TUTOR_CONTEXT_CHANGED",
      );
  });
  let state;
  test("Successful hint and credit settlement commit atomically", () => {
    state = commit(first, hint(0));
    assert.equal(state.hintCount, 1);
    assert.equal(state.canUnlock, false);
    assert.equal(
      store.getTutorSession(a.id, a.sessionVersion, first.sessionId).turns
        .length,
      1,
    );
  });
  test("Persistence survives independent database connection", () => {
    const reopened = platform.createStore(path.join(temp, "test.sqlite"), {
      now: () => time,
    });
    assert.equal(
      reopened.getTutorSession(a.id, a.sessionVersion, first.sessionId)
        .hintCount,
      1,
    );
    reopened.close();
  });
  test("Failed or cancelled turn does not count and can retry", () => {
    const failed = prepare({
      tutorSessionId: first.sessionId,
      question: "Em chưa biết.",
    });
    store.abortTutorTurn(failed);
    assert.equal(
      store.getTutorSession(a.id, a.sessionVersion, first.sessionId).hintCount,
      1,
    );
  });
  test("Repeated/empty/multi-step outputs and final-answer leaks are rejected", () => {
    const lease = prepare({
      tutorSessionId: first.sessionId,
      question: "Cho đáp án luôn đi.",
    });
    const value = { ...input(), tutorContext: lease.context };
    assert.ok(
      policy.parseTutorResponse(
        JSON.stringify({ ...hint(1), misconception: "", step: "" }),
        value,
      ).tutorReply,
    );
    const cleaned = policy.parseTutorResponse(
      JSON.stringify({ ...hint(1), hint: hint(1).hint + "\u0000\u0012" }),
      value,
    );
    assert.ok(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(cleaned.text));
    assert.throws(() =>
      policy.parseTutorResponse(
        JSON.stringify({ ...hint(1), question: "\u0000\u0012" }),
        value,
      ),
    );
    assert.ok(
      policy.parseTutorResponse(
        JSON.stringify({
          ...hint(1),
          feedback: null,
          misconception: null,
          step: null,
        }),
        value,
      ).tutorReply,
    );
    const normalized = policy.parseTutorResponse(
      JSON.stringify({
        ...hint(1),
        question: "Em sẽ làm gì? Em có chắc không?",
        step: "a".repeat(500),
      }),
      value,
    );
    assert.equal(normalized.tutorReply.question, "Em sẽ làm gì?");
    assert.ok(normalized.tutorReply.step.length <= 160);
    assert.throws(
      () =>
        policy.parseTutorResponse(
          JSON.stringify({ ...hint(1), step: "Kết luận x = 4" }),
          value,
        ),
      (e) => e.code === "TUTOR_SOLUTION_LEAK",
    );
    assert.throws(
      () => policy.parseTutorResponse(JSON.stringify(hint(0)), value),
      (e) => e.code === "TUTOR_REPEATED_HINT",
    );
    for (const output of [
      { hint: "", question: "?" },
      { ...hint(1), solution: "x=4" },
      {
        hint: "Bạn có thể lấy x = 4 rồi thế lại vào đề bài.",
        question: "Đã hiểu chưa?",
      },
    ])
      assert.throws(() =>
        policy.parseTutorResponse(JSON.stringify(output), value),
      );
    store.abortTutorTurn(lease);
    assert.equal(
      store.getTutorSession(a.id, a.sessionVersion, first.sessionId).hintCount,
      1,
    );
  });
  test("A failing tutor commit rolls back credit settlement and every tutor mutation", () => {
    const lease = prepare({ tutorSessionId: first.sessionId }),
      reservation = store.reserveUsage({
        userId: a.id,
        sessionVersion: a.sessionVersion,
        requestId: lease.requestId,
        task: "chat",
        mode: "tutor",
        kind: "text",
      });
    assert.throws(() =>
      store.settleUsage({
        userId: a.id,
        reservationId: reservation.reservationId,
        onSettled: () => {
          store.commitTutorTurn(lease, hint(1), "valid second response");
          throw Error("forced atomic failure");
        },
      }),
    );
    assert.equal(
      store.getTutorSession(a.id, a.sessionVersion, first.sessionId).hintCount,
      1,
    );
    assert.equal(
      store.failUsage({
        userId: a.id,
        reservationId: reservation.reservationId,
      }).changed,
      true,
    );
    store.abortTutorTurn(lease);
  });
  test("All chat styles remain locked at two hints; third distinct hint unlocks", () => {
    state = commit(
      prepare({ tutorSessionId: first.sessionId, question: "Em chia hai vế." }),
      hint(1),
    );
    assert.equal(state.hintCount, 2);
    for (const mode of ["quick", "think", "deep", "tutor"])
      assert.throws(
        () =>
          prepare({ tutorSessionId: first.sessionId, guidance: "full", mode }),
        (e) => e.code === "TUTOR_LOCKED",
      );
    state = commit(
      prepare({ tutorSessionId: first.sessionId, question: "Em đã thử rồi." }),
      hint(2),
    );
    assert.equal(state.hintCount, 3);
    assert.equal(state.canUnlock, true);
  });
  test("Unlocked full solution is independently checked and rejects incorrect candidate set", () => {
    const lease = prepare({
        tutorSessionId: first.sessionId,
        guidance: "full",
        question: "Em muốn đối chiếu toàn bộ.",
      }),
      value = { ...input(), tutorContext: lease.context };
    assert.equal(lease.history.length, 6);
    assert.equal(lease.context.guidance, "full");
    assert.throws(
      () =>
        policy.parseTutorResponse(
          JSON.stringify({ solution: "x=5", candidateSolutions: [5] }),
          value,
        ),
      (e) => e.code === "MATH_VERIFICATION_FAILED",
    );
    const result = policy.parseTutorResponse(
      JSON.stringify({
        solution: "Trừ 3 hai vế: 2x=8. Chia 2: x=4. Kiểm tra: 2·4+3=11.",
        candidateSolutions: [4],
      }),
      value,
    );
    assert.equal(result.verification.status, "verified");
    store.abortTutorTurn(lease);
  });
  test("Common fraction, LaTex and Vietnamese decimal answer formats cannot bypass the hint gate", () => {
    const value = {
      ...input(),
      tutorContext: {
        problem: "(x+1)/(x-2)=3",
        hints: [],
        hintCount: 0,
        guidance: "hints",
      },
    };
    for (const answer of [
      "x=7/2",
      "x=3,5",
      String.raw`x=\frac{7}{2}`,
      String.raw`\boxed{\dfrac{7}{2}}`,
      "Đáp án là 3.5",
    ]) {
      assert.throws(
        () =>
          policy.parseTutorResponse(
            JSON.stringify({
              hint: "Đây là giá trị cần tìm: " + answer,
              question: "Em kiểm tra được không?",
            }),
            value,
          ),
        (e) => e.code === "TUTOR_SOLUTION_LEAK",
        answer,
      );
    }
  });
  test("Incorrect student candidate is diagnosed without exposing another root", () => {
    assert.equal(
      math.checkStudentAnswer(
        "x^2-5x+6=0",
        "Em phân tích thành (x-2)(x-3), nên còn nghiệm3.",
      ).candidates[0].value,
      3,
    );
    const lease = prepare({
      tutorSessionId: first.sessionId,
      question: "x = 5",
    });
    assert.equal(lease.context.studentCheck.status, "inconsistent");
    assert.equal(lease.context.studentCheck.candidates[0].valid, false);
    assert.equal("solutions" in lease.context.studentCheck, false);
    store.abortTutorTurn(lease);
  });
  test("Expired pending leases cannot commit a late paid result", () => {
    const lease = prepare({ tutorSessionId: first.sessionId });
    time += 71000;
    assert.throws(
      () => store.commitTutorTurn(lease, hint(1), "late"),
      (e) => e.code === "TUTOR_TURN_STALE",
    );
    store.abortTutorTurn(lease);
  });
  test("Delete removes owned conversation; foreign deletes cannot affect it", () => {
    assert.throws(
      () => store.deleteTutorSessions(b.id, b.sessionVersion, first.sessionId),
      (e) => e.code === "TUTOR_SESSION_NOT_FOUND",
    );
    assert.equal(
      store.deleteTutorSessions(a.id, a.sessionVersion, first.sessionId)
        .deleted,
      1,
    );
    assert.throws(
      () => store.getTutorSession(a.id, a.sessionVersion, first.sessionId),
      (e) => e.code === "TUTOR_SESSION_NOT_FOUND",
    );
  });
  test("Requests for missing data are retained but never counted as useful hints", () => {
    const lease = prepare({
      question: "Hình chữ nhật dài8cm. Tính diện tích.",
    });
    const response = {
      hint: "Muốn biết diện tích cần biết thêm chiều rộng của hình chữ nhật.",
      question: "Đề cho chiều rộng bằng bao nhiêu?",
      needsClarification: true,
    };
    const state = commit(lease, response);
    assert.equal(state.hintCount, 0);
    assert.equal(state.needsClarification, true);
    assert.equal(state.canUnlock, false);
    assert.equal(
      store.getTutorSession(a.id, a.sessionVersion, lease.sessionId).turns[0]
        .needsClarification,
      true,
    );
    assert.throws(
      () => prepare({ tutorSessionId: lease.sessionId, guidance: "full" }),
      (e) => e.code === "TUTOR_LOCKED" && e.tutor.hintCount === 0,
    );
  });
  test("Seven-day expiry removes conversation on access, without fabricating long-term memory", () => {
    const lease = prepare();
    store.abortTutorTurn(lease);
    time += 7 * 86400000 + 1;
    assert.throws(
      () => store.getTutorSession(a.id, a.sessionVersion, lease.sessionId),
      (e) => e.code === "TUTOR_SESSION_NOT_FOUND",
    );
  });
  test("Expired transcript is physically removed even when lookup returns404", () => {
    const inspect = new (require("node:sqlite").DatabaseSync)(
      path.join(temp, "test.sqlite"),
    );
    assert.equal(
      Number(inspect.prepare("SELECT count(*) n FROM tutor_sessions").get().n),
      0,
    );
    assert.equal(
      Number(inspect.prepare("SELECT count(*) n FROM tutor_turns").get().n),
      0,
    );
    inspect.close();
  });
  test("Competition preview grants capabilities only; normal Free and credit boundary remain intact", () => {
    const saved = process.env.LUMIO_COMPETITION_PREVIEW;
    process.env.LUMIO_COMPETITION_PREVIEW = "false";
    assert.equal(
      store.getBillingSnapshot(b.id, b.sessionVersion).account.entitlements
        .voice,
      false,
    );
    process.env.LUMIO_COMPETITION_PREVIEW = "true";
    const snapshot = store.getBillingSnapshot(b.id, b.sessionVersion);
    assert.equal(snapshot.account.planId, "free");
    assert.equal(snapshot.account.balance, 200);
    assert.equal(snapshot.account.entitlements.voice, true);
    assert.deepEqual(snapshot.account.entitlements.modes, [
      "quick",
      "tutor",
      "think",
      "deep",
    ]);
    assert.equal(snapshot.account.entitlements.maxVideoSeconds, 600);
    assert.deepEqual(
      snapshot.catalog.plans.find((p) => p.id === "free").entitlements,
      snapshot.account.entitlements,
    );
    const reservation = store.reserveUsage({
      userId: b.id,
      sessionVersion: b.sessionVersion,
      requestId: "preview-deep-allowed",
      task: "chat",
      mode: "deep",
      kind: "text",
    });
    assert.ok(reservation.units > 0);
    store.failUsage({ userId: b.id, reservationId: reservation.reservationId });
    process.env.LUMIO_COMPETITION_PREVIEW = "false";
    assert.throws(
      () =>
        store.reserveUsage({
          userId: b.id,
          sessionVersion: b.sessionVersion,
          requestId: "normal-deep-still-denied",
          task: "chat",
          mode: "deep",
          kind: "text",
        }),
      (e) => e.code === "PLAN_ACCESS_REQUIRED",
    );
    saved === undefined
      ? delete process.env.LUMIO_COMPETITION_PREVIEW
      : (process.env.LUMIO_COMPETITION_PREVIEW = saved);
  });
  console.log(
    `Tutor: ${passed} checks passed; ${references.length} independently checked reference problems. No provider calls.`,
  );
} finally {
  store.close();
  fs.rmSync(temp, { recursive: true, force: true });
}
