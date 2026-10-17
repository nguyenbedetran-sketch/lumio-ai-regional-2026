const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
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
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  new Function("require", "module", "exports", code)(
    (name) =>
      name.startsWith(".")
        ? load(
            path.relative(
              root,
              path.resolve(
                path.dirname(file),
                [name + ".tsx", name + ".ts", name + ".js"].find(candidate => fs.existsSync(path.resolve(path.dirname(file), candidate))) || name,
              ),
            ),
          )
        : require(name),
    module,
    module.exports,
  );
  return module.exports;
}
const exact = load("lib/tutor/math-exact.ts"),
  math = load("lib/tutor/math.ts"),
  policy = load("lib/tutor/policy.ts");
let passed = 0;
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  passed++;
}
test("Decimal coefficients are rational, not floating cancellation", () => {
  const result = math.verifyMathCandidates("0.1x+0.2=0.3", [1]);
  assert.equal(result.status, "verified");
  assert.equal(result.scope.candidates, "exact");
  assert.equal(result.complete, true);
  assert.equal(
    math.verifyMathCandidates("0.1x+0.2=0.3", [1.0000000000000002]).status,
    "not_supported",
  );
});
test("Near-root tolerance cannot earn an exact badge or completeness proof", () => {
  for (const [problem, value] of [
    ["x=1000000", 1000000.001],
    ["x=1", 1.000000001],
    ["x^2=2", Math.sqrt(2)],
  ]) {
    const result = math.verifyMathCandidates(problem, [value]);
    assert.notEqual(result.status, "verified");
    assert.equal(result.scope.candidates, "approximate_only");
    assert.notEqual(result.complete, true);
  }
});
test("A recurring rational JSON root is explicitly unverified", () => {
  const result = math.verifyMathCandidates("3x=1", [1 / 3]);
  assert.equal(result.status, "not_supported");
  assert.equal(result.complete, undefined);
  assert.equal(result.scope.candidates, "approximate_only");
});
test("A tiny nonzero denominator is not treated as zero", () => {
  const result = math.verifyMathCandidates("(x-1)/(x-1)=1", [1.000000001]);
  assert.equal(result.candidates[0].valid, true);
  assert.equal(result.scope.candidates, "exact");
  assert.equal(result.scope.domain, "checked");
  assert.equal(result.status, "not_supported"); // identity has infinitely many roots, not a complete finite list
});
test("Actual poles remain invalid after algebraic cancellation", () => {
  const result = math.verifyMathCandidates("(x^2-4)/(x-2)=0", [2]);
  assert.equal(result.status, "inconsistent");
  assert.equal(result.candidates[0].reason, "denominator_zero");
  assert.equal(
    math.verifyMathCandidates("(x^2-4)/(x-2)=0", [-2]).status,
    "verified",
  );
});
test("Nested original denominator restrictions survive simplification", () => {
  assert.equal(
    math.verifyMathCandidates("1/(1/x)=0", [0]).candidates[0].reason,
    "denominator_zero",
  );
  assert.equal(
    exact.checkExactEquivalence("1/(1/x)=0", "1/(1/x)=0", "x=0").status,
    "equivalent",
  );
  assert.equal(
    exact.checkExactEquivalence("x=0", "1/(1/x)=0", "x=0").status,
    "not_equivalent",
  );
});
test("Undefined zero to the zero power is not silently accepted", () => {
  const result = math.verifyMathCandidates("x^0=1", [0]);
  assert.equal(result.status, "inconsistent");
  assert.equal(result.candidates[0].reason, "zero_power_zero");
  assert.equal(exact.checkExactArithmetic("0^0=1"), "unknown");
});
test("A single radical checks signs and original domain exactly", () => {
  const result = math.verifyMathCandidates("sqrt(x+1)=x-1", [3]);
  assert.equal(result.status, "verified");
  assert.equal(result.scope.candidates, "exact");
  assert.equal(
    math.verifyMathCandidates("sqrt(x+1)=x-1", [0, 3]).status,
    "inconsistent",
  );
  assert.equal(
    math.verifyMathCandidates("sqrt(x+1)=0", [-1]).status,
    "verified",
  );
  assert.equal(
    math.verifyMathCandidates("sqrt(x+1)=0", [-1.0000000001]).status,
    "inconsistent",
  );
});
test("Exact quadratic completeness distinguishes missing and extraneous roots", () => {
  assert.equal(
    math.verifyMathCandidates("x^2-5x+6=0", [2, 3]).scope.completeness,
    "proved",
  );
  assert.equal(
    math.verifyMathCandidates("x^2-5x+6=0", [2]).scope.completeness,
    "incomplete",
  );
  assert.equal(
    math.verifyMathCandidates("x^2-5x+6=0", [2, 3, 4]).status,
    "inconsistent",
  );
  assert.equal(math.verifyMathCandidates("x^2+1=0", []).status, "verified");
});
test("Unsupported transcendental and multivariable claims are never verified", () => {
  assert.equal(
    math.verifyMathCandidates("ln(x)=0", [1]).status,
    "not_supported",
  );
  assert.equal(
    math.checkStudentAnswer("ln(x)=0", "x=1").status,
    "not_supported",
  );
  assert.equal(
    math.verifyMathCandidates("sin(x)=0", [0]).status,
    "not_supported",
  );
  assert.equal(
    exact.checkExactEquivalence("x+y=1", "x+y=1", "x=1-y").status,
    "not_supported",
  );
});
test("Equivalent linear transformations and exact arithmetic are independently checked", () => {
  for (const [a, b] of [
    ["2x+3=11", "2x=8"],
    ["2x=8", "x=4"],
    ["x/3+2=5", "x+6=15"],
  ])
    assert.equal(exact.checkExactEquivalence(a, a, b).status, "equivalent");
  assert.equal(exact.checkExactArithmetic("0.1+0.2=0.3"), "exact");
  assert.equal(exact.checkExactArithmetic("2*(4)+3=12"), "invalid");
});
test("Exact polynomial normalization checks factorisation without sampling", () => {
  assert.equal(
    exact.checkExactEquivalence("x^2-5x+6=0", "x^2-5x+6=0", "(x-2)(x-3)=0")
      .status,
    "equivalent",
  );
  assert.equal(
    exact.checkExactEquivalence("x^2=2", "x^2=2", "2x^2=4").status,
    "equivalent",
  );
  assert.equal(
    exact.checkExactEquivalence("x^4+1=0", "x^4+1=0", "2x^4+2=0").status,
    "equivalent",
  );
});
test("Many distinct linear operations preserve exact equivalence while wrong signs fail", () => {
  for (let a = 1; a <= 9; a++)
    for (let b = 1; b <= 7; b++) {
      const equation = `${a}x+${b}=${a + b + 5}`;
      assert.equal(
        exact.checkExactEquivalence(equation, equation, `${a}x=${a + 5}`)
          .status,
        "equivalent",
      );
      assert.equal(
        exact.checkExactEquivalence(equation, equation, `x=(${a + 5})/${a}`)
          .status,
        "equivalent",
      );
      assert.equal(
        exact.checkExactEquivalence(
          equation,
          equation,
          `${a}x=${a + b + 5 + b}`,
        ).status,
        "not_equivalent",
      );
    }
});
test("Dividing by x and unjustified squaring do not preserve the solution set", () => {
  assert.equal(
    exact.checkExactEquivalence("x(x-1)=0", "x(x-1)=0", "x-1=0").status,
    "not_equivalent",
  );
  assert.equal(
    exact.checkExactEquivalence("x=1", "x=1", "x^2=1").status,
    "not_equivalent",
  );
  assert.equal(
    exact.checkExactEquivalence("sqrt(x+1)=x-1", "sqrt(x+1)=x-1", "x+1=(x-1)^2")
      .status,
    "not_supported",
  );
});
test("Clearing a denominator is checked in the original exercise domain", () => {
  assert.equal(
    exact.checkExactEquivalence("(x+1)/(x-2)=3", "(x+1)/(x-2)=3", "x+1=3(x-2)")
      .status,
    "equivalent",
  );
  assert.equal(
    exact.checkExactEquivalence("x=2", "(x-2)/(x-2)=1", "x=2").status,
    "not_supported",
  );
});
test("Explicit equivalence chain and arithmetic expose separate proof scope", () => {
  const result = math.verifyMathSolution(
    "2x+3=11",
    [4],
    String.raw`\[2x+3=11 \Leftrightarrow 2x=8 \Leftrightarrow x=4\]\n\(2*4+3=11\)`,
  );
  assert.equal(result.status, "verified");
  assert.equal(result.explicitSteps.length, 2);
  assert.equal(result.scope.steps, "exact");
  assert.equal(result.scope.arithmetic, "exact");
  assert.equal(result.scope.reasoning, "not_checked");
});
test("A correct final root cannot hide a false equivalence or calculation", () => {
  const result = math.verifyMathSolution(
    "2x+3=11",
    [4],
    "$2x+3=11 ⇔ 2x=9 ⇔ x=4$",
  );
  assert.equal(result.status, "inconsistent");
  assert.equal(result.scope.steps, "inconsistent");
  const wrong = math.verifyMathSolution("2x+3=11", [4], "$2*4+3=12$");
  assert.equal(wrong.status, "inconsistent");
});
test("Ordinary prose and one-way implications are not passed off as a checked proof", () => {
  const result = math.verifyMathSolution(
    "x^2=4",
    [2, -2],
    "$x^2=4 => x=2$\nĐáp án là hai nghiệm, theo một lời văn chưa kiểm tra.",
  );
  assert.equal(result.status, "verified");
  assert.equal(result.scope.steps, "partial");
  assert.equal(result.scope.reasoning, "not_checked");
  assert.equal(
    math.verifyMathSolution(
      "x=4",
      [4],
      "Lấy kết quả theo lời giải của mô hình.",
    ).scope.steps,
    "not_checked",
  );
});
test("Root candidate declaration is not mistaken for an equivalence chain", () => {
  const result = math.verifyMathSolution(
    "x^2-5x+6=0",
    [2, 3],
    "$(x-2)(x-3)=0$\n$x=2$ hoặc $x=3$",
  );
  assert.equal(result.status, "verified");
  assert.equal(result.scope.steps, "partial");
});
test("Long explicit proofs stay inside the persisted metadata budget and disclose partial coverage", () => {
  const chain = Array.from(
    { length: 30 },
    (_, i) => `${i + 1}x=${4 * (i + 1)}`,
  ).join(" ⇔ ");
  const result = math.verifyMathSolution("x=4", [4], `$${chain}$`);
  assert.equal(result.explicitSteps.length, 4);
  assert.equal(result.scope.steps, "partial");
  assert.ok(JSON.stringify(result).length < 7000);
  const manyCalculations = math.verifyMathSolution(
    "x=4",
    [4],
    Array.from({ length: 8 }, (_, i) => `$${i}+1=${i + 1}$`).join("\n"),
  );
  assert.equal(manyCalculations.calculations.length, 4);
  assert.equal(manyCalculations.scope.arithmetic, "partial");
});
test("Unsupported syntax and resource limits fail closed without execution", () => {
  for (const value of [
    "process.exit()=0",
    "x^100000=0",
    "x^9=0",
    "1/0=0",
    "(".repeat(100) + "x" + ")".repeat(100) + "=0",
  ]) {
    const result = exact.checkExactEquation(value, [0]);
    assert.ok(!result || result.completeness !== "proved", value);
  }
  assert.equal(exact.checkExactArithmetic("1/0=1/0"), "unknown");
});
test("Student progress does not imply all roots have been supplied", () => {
  const result = math.checkStudentAnswer("x^2-5x+6=0", "x=2");
  assert.equal(result.status, "verified");
  assert.equal(result.complete, undefined);
  assert.equal(result.scope.completeness, "not_requested");
});
test("Full-solution parser rejects explicit bad steps after the same server gate", () => {
  const input = {
    task: "chat",
    language: "vi",
    tutorContext: {
      problem: "2x+3=11",
      guidance: "full",
      hints: ["a", "b", "c"],
      hintCount: 3,
    },
  };
  assert.throws(
    () =>
      policy.parseTutorResponse(
        JSON.stringify({
          solution: "$2x+3=11 ⇔ x=5$ rồi x=4",
          candidateSolutions: [4],
        }),
        input,
      ),
    (e) => e.code === "MATH_VERIFICATION_FAILED",
  );
  const result = policy.parseTutorResponse(
    JSON.stringify({
      solution: "$2x+3=11 ⇔ 2x=8 ⇔ x=4$",
      candidateSolutions: [4],
    }),
    input,
  );
  assert.equal(result.verification.scope.steps, "exact");
});
test("Scoped V3 metadata persists through the real tutor ledger and reload", () => {
  const os = require("node:os"),
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "lumio-exact-proof-"));
  const platform = load("lib/server/store.ts"),
    db = path.join(dir, "test.sqlite"),
    store = platform.createStore(db);
  try {
    const account = store.ensureIdentity({
      provider: "google",
      providerAccountId: "exact-metadata-test",
      name: "Synthetic",
      emailVerified: false,
    });
    let sessionId,
      revision = 0;
    const input = {
      task: "chat",
      question: "2x+3=11",
      source: "",
      language: "vi",
      mode: "tutor",
      kind: "text",
    };
    for (let n = 0; n < 4; n++) {
      const lease = store.prepareTutorTurn(
        account.id,
        account.sessionVersion,
        {
          ...input,
          tutorSessionId: sessionId,
          guidance: n === 3 ? "full" : "hints",
        },
        `math-proof-${n}`,
      );
      sessionId = lease.sessionId;
      const reservation = store.reserveUsage({
        userId: account.id,
        sessionVersion: account.sessionVersion,
        requestId: lease.requestId,
        task: "chat",
        mode: "tutor",
        kind: "text",
      });
      const verification =
        n === 3
          ? math.verifyMathSolution(
              input.question,
              [4],
              "$2x+3=11 ⇔ 2x=8 ⇔ x=4$\n$2*4+3=11$",
            )
          : undefined;
      const hints = [
        "Hãy xem số hạng tự do đang nằm cùng phía với ẩn và chọn phép toán ngược để tách nó.",
        "Sau khi bỏ số hạng tự do, chú ý hệ số của ẩn và phép toán giữ hai vế tương đương.",
        "Khi đã tìm được giá trị dự kiến, thay lại vào từng vế của phương trình ban đầu để đối chiếu.",
      ];
      const reply =
        n === 3
          ? {
              solution: "Đối chiếu các biểu thức rõ ràng.",
              candidateSolutions: [4],
            }
          : { hint: hints[n], question: "Em chọn phép toán nào?" };
      store.settleUsage({
        userId: account.id,
        reservationId: reservation.reservationId,
        onSettled: () => {
          revision = store.commitTutorTurn(
            lease,
            reply,
            reply.solution || reply.hint,
            { verification },
          ).revision;
        },
      });
    }
    assert.equal(revision, 4);
    const reopened = platform.createStore(db);
    try {
      const history = reopened.getTutorSession(
        account.id,
        account.sessionVersion,
        sessionId,
      );
      assert.equal(history.hintCount, 3);
      assert.equal(history.turns[3].verification.scope.steps, "exact");
      assert.equal(history.turns[3].verification.scope.arithmetic, "exact");
      assert.equal(history.turns[3].verification.explicitSteps.length, 2);
    } finally {
      reopened.close();
    }
  } finally {
    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("Legacy notices do not invent V3 proof metadata and exact notices expose limits", () => {
  const React = require("react"),
    { renderToStaticMarkup } = require("react-dom/server");
  const Notice = load(
    "components/lumio/tutor-progress.tsx",
  ).MathVerificationNotice;
  const exactHTML = renderToStaticMarkup(
    React.createElement(Notice, {
      locale: "vi",
      verification: math.verifyMathSolution("x=4", [4], "$x=4$"),
    }),
  );
  assert.match(exactHTML, /Chưa kiểm tra/);
  assert.match(exactHTML, /Đủ nghiệm/);
  assert.match(exactHTML, /Chỉ kiểm tra một phần/);
  const legacy = renderToStaticMarkup(
    React.createElement(Notice, {
      locale: "en",
      verification: { status: "verified", note: "old" },
    }),
  );
  assert.match(legacy, /earlier checker/);
  assert.doesNotMatch(legacy, /class="lm-math-verification verified"/);
});
console.log(
  `Exact math: ${passed} checks passed. Pure CPU; no provider calls. Prose proof and unsupported mathematics remain unverified.`,
);
