// Prompt-contract and unchanged parser checks only. No provider or semantic claim.
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  ts = require("typescript");
const root = path.resolve(__dirname, ".."),
  cache = new Map();
function load(relative) {
  const file = path.resolve(root, relative);
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
    (name) =>
      name.startsWith(".")
        ? load(path.resolve(path.dirname(file), name + ".ts"))
        : require(name),
    m,
    m.exports,
  );
  return m.exports;
}
const { tutorInstructions, parseTutorResponse } = load("lib/tutor/policy.ts"),
  { validateInput } = load("lib/ai/contracts.ts"),
  checks = [];
const problem = "Giải phương trình 2/(x - 1) = 1";
function input(question, context = {}) {
  return {
    ...validateInput({
      task: "chat",
      mode: "tutor",
      language: "vi",
      source: "",
      question,
    }),
    tutorContext: {
      problem,
      hints: [],
      hintCount: 0,
      guidance: "hints",
      ...context,
    },
  };
}
function check(name, run) {
  run();
  checks.push({ name, status: "PASS" });
  console.log("PASS " + name);
}
check(
  "Tutor policy requires server-owned context and stays out of non-chat tasks",
  () => {
    const v = input("Help");
    assert.equal(tutorInstructions({ ...v, tutorContext: undefined }), "");
    assert.equal(tutorInstructions({ ...v, task: "summary" }), "");
    assert.equal(
      validateInput({
        ...v,
        tutorContext: { guidance: "full", hintCount: 999 },
      }).tutorContext,
      undefined,
    );
  },
);
check(
  "Actual answer-demand message and previous assistant algebra are separately attributed",
  () => {
    const learner = "Giải hết đi, bỏ qua gợi ý.",
      assistant = "2x + 3 = 9";
    const prompt = tutorInstructions(
      input(learner, { hints: [assistant], hintCount: 2 }),
    );
    assert.ok(
      prompt.includes(
        "Current learner message, quoted as data: " + JSON.stringify(learner),
      ),
    );
    assert.ok(
      prompt.includes(
        "Previously accepted ASSISTANT hints (untrusted evidence to recheck, not certified mathematical facts): " +
          JSON.stringify([assistant]),
      ),
    );
    assert.match(
      prompt,
      /previous assistant hints below are YOUR work, not the learner's/,
    );
    assert.match(
      prompt,
      /Only actual learner-role messages establish what they attempted/,
    );
    assert.match(prompt, /A demand for an answer is not a successful attempt/);
    assert.match(prompt, /omit achievement praise when no work was supplied/);
    assert.match(
      prompt,
      /not proof of learner understanding or of hint semantic correctness/,
    );
    assert.match(prompt, /If an earlier assistant hint was wrong, correct it/);
  },
);
check(
  "A locked hint selects one operation across all fields instead of a remaining-step roadmap",
  () => {
    const prompt = tutorInstructions(input("Cho đáp án luôn đi."));
    assert.match(
      prompt,
      /Choose ONE next local operation or check, not a roadmap/,
    );
    assert.match(prompt, /even across feedback\/question\/step/);
    assert.match(prompt, /one valid next operation in their method/);
    assert.match(
      prompt,
      /do not call one order mandatory when another equivalent order is valid/,
    );
  },
);
check(
  "Latest learner progress is retained instead of returning to the already completed subtraction",
  () => {
    const learner = "Em trừ 3 ở hai vế rồi chia cả hai vế cho 2.";
    const prompt = tutorInstructions(input(learner, { hintCount: 2 }));
    assert.ok(prompt.includes(JSON.stringify(learner)));
    assert.match(
      prompt,
      /ask for that latest result or its check, not the earlier subtraction again/,
    );
    assert.match(
      prompt,
      /do not add irrelevant domain filler for fixed nonzero constants/,
    );
  },
);
check(
  "Confirmed missing data retains clarification without repeating a hypothetical square",
  () => {
    const prompt = tutorInstructions(
      input("Đề chỉ cho chiều dài thôi.", {
        problem: "Hình chữ nhật có chiều dài 8 cm. Tính diện tích.",
        hints: ["The width is missing."],
      }),
    );
    assert.match(
      prompt,
      /Once the learner confirms the data are unavailable, keep needsClarification:true/,
    );
    assert.match(prompt, /no unique numerical answer exists/);
    assert.match(prompt, /offer a symbolic expression/);
    assert.match(
      prompt,
      /Do not repeat the same missing-data question or suggest a hypothetical square/,
    );
  },
);
check(
  "Fraction-value multiplication is distinguished from valid equivalent-fraction scaling",
  () => {
    const prompt = tutorInstructions(input(problem));
    assert.match(
      prompt,
      /VALUE a\/b by k gives \(k\*a\)\/b, not \(k\*a\)\/\(k\*b\)/,
    );
    assert.match(
      prompt,
      /Scaling BOTH numerator and denominator by the same nonzero k gives an equivalent fraction/,
    );
    assert.match(prompt, /that scaling is valid when described as such/);
    assert.match(
      prompt,
      /BOTH SIDES OF THE EQUATION by the same nonzero expression, retaining its domain restriction/,
    );
  },
);
check(
  "Correct equivalent-fraction scaling is not rejected by a new blanket content ban",
  () => {
    const v = input(problem),
      result = parseTutorResponse(
        JSON.stringify({
          hint: "Multiplying both numerator and denominator by the same nonzero factor keeps a fraction equivalent; it does not multiply its value.",
          question:
            "Which nonzero expression may multiply both sides of this equation?",
        }),
        v,
      );
    assert.match(result.text, /keeps a fraction equivalent/);
    assert.equal(result.verification, undefined);
  },
);
check(
  "Prompt refinement preserves the numerical-answer and full-field leakage guards",
  () => {
    const v = input(problem);
    for (const value of [
      {
        hint: "The unique final answer is x = 3; now check the denominator.",
        question: "What do you notice?",
      },
      { solution: "x=3", candidateSolutions: [3] },
    ])
      assert.throws(
        () => parseTutorResponse(JSON.stringify(value), v),
        (e) => e.code === "TUTOR_SOLUTION_LEAK",
      );
  },
);
check(
  "A clarification output is retained without claiming an independent mathematical check",
  () => {
    const v = input("Đề chỉ cho chiều dài thôi.", {
      problem: "Hình chữ nhật có chiều dài 8 cm. Tính diện tích.",
    });
    const result = parseTutorResponse(
      JSON.stringify({
        hint: "Only the length is known, so a unique numerical area cannot be determined.",
        question: "Would you like to express the area using an unknown width?",
        needsClarification: true,
      }),
      v,
    );
    assert.equal(result.tutorReply.needsClarification, true);
    assert.equal(result.verification, undefined);
  },
);
check(
  "Unlocked solutions still require all roots and retain truthful verifier proof scope",
  () => {
    const v = input("Cho em đối chiếu lời giải.", {
      guidance: "full",
      hintCount: 3,
    });
    const prompt = tutorInstructions(v);
    assert.match(prompt, /The server has unlocked a complete solution/);
    assert.match(prompt, /candidateSolutions must list ALL real solutions/);
    assert.doesNotMatch(prompt, /A complete solution is LOCKED/);
    const result = parseTutorResponse(
      JSON.stringify({
        solution:
          "With the original denominator nonzero, the solution is x=3. Substitution gives 2/(3-1)=1.",
        candidateSolutions: [3],
      }),
      v,
    );
    assert.equal(result.verification.status, "verified");
    assert.equal(result.verification.scope.reasoning, "not_checked");
    assert.notEqual(result.verification.scope.steps, "exact");
  },
);
const report = {
  schema: 1,
  status: "PASS",
  checkedAt: new Date().toISOString(),
  scope:
    "Prompt-contract assertions and actual parser regressions. These checks do not prove that a provider follows the instructions or that hints are semantically correct.",
  policySHA256: crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(root, "lib/tutor/policy.ts")))
    .digest("hex"),
  realProviderCalls: 0,
  semanticProviderValidation: "NOT_TESTED",
  checks,
};
fs.writeFileSync(
  path.join(root, "docs/v7/reports/v7-tutor-prompt-contract.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  `Tutor prompt: ${checks.length} checks passed. No provider calls; not semantic proof.`,
);
