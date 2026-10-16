const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  ts = require("typescript"),
  crypto = require("node:crypto");
const root = path.resolve(__dirname, ".."),
  cache = new Map();
function load(filename) {
  filename = path.resolve(root, filename);
  if (cache.has(filename)) return cache.get(filename).exports;
  const m = { exports: {} };
  cache.set(filename, m);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  new Function("require", "module", "exports", code)(
    (name) => {
      if (name.endsWith(".css"))
        return {
          __esModule: true,
          default: new Proxy({}, { get: (_, key) => String(key) }),
        };
      if (!name.startsWith(".")) return require(name);
      const base = path.resolve(path.dirname(filename), name);
      return load([base + ".ts", base + ".tsx"].find(fs.existsSync));
    },
    m,
    m.exports,
  );
  return m.exports;
}
const { balanceQuizOptions, hasPositionalOptionDependency } = load(
    "lib/ai/quiz-option-order.ts",
  ),
  contracts = load("lib/ai/contracts.ts"),
  { ContentQualityNotice } = load("components/lumio/source-references.tsx"),
  React = require("react"),
  { renderToStaticMarkup } = require("react-dom/server");
const cases = [];
let propertyBatches = 0,
  propertyQuestions = 0;
function test(name, fn) {
  fn();
  cases.push(name);
  console.log("PASS " + name);
}
function question(index = 0, patch = {}) {
  return {
    prompt: "Tính giá trị biểu thức " + index,
    options: ["8w", "8w+1", "8w+2", "8w+3"],
    correct: 0,
    explanation: "Thay số và tính được 8w.",
    topic: "Diện tích",
    difficulty: "beginner",
    references: [
      {
        segmentId: "s1",
        quote: "Diện tích là 8w.",
        start: 0,
        end: 16,
        paragraph: 1,
        verification: "exact-excerpt",
      },
    ],
    ...patch,
  };
}
function permutations(a) {
  return a.length === 0
    ? [[]]
    : a.flatMap((v, i) =>
        permutations(a.filter((_, j) => j !== i)).map((rest) => [v, ...rest]),
      );
}
function checkIdentity(before, after) {
  assert.equal(after.options.length, 4);
  assert.deepEqual([...after.options].sort(), [...before.options].sort());
  assert.equal(after.options[after.correct], before.options[before.correct]);
  assert.equal(after.prompt, before.prompt);
  assert.equal(after.explanation, before.explanation);
  assert.equal(after.topic, before.topic);
  assert.equal(after.difficulty, before.difficulty);
  assert.strictEqual(after.references, before.references);
}
function deepFreeze(x) {
  if (x && typeof x === "object") {
    Object.freeze(x);
    Object.values(x).forEach(deepFreeze);
  }
  return x;
}
test("All-safe validated batches preserve identity and have balanced correct positions across every original key/permutation", () => {
  for (const options of permutations(["8w", "8w+1", "8w+2", "8w+3"]))
    for (let correct = 0; correct < 4; correct++)
      for (let size = 1; size <= 10; size++) {
        const rows = Array.from({ length: size }, (_, i) =>
            question(i, { options: [...options], correct }),
          ),
          result = balanceQuizOptions(rows),
          counts = [0, 0, 0, 0];
        assert.equal(result.preservedIndices.length, 0);
        result.questions.forEach((q, i) => {
          checkIdentity(rows[i], q);
          counts[q.correct]++;
          propertyQuestions++;
        });
        assert.ok(Math.max(...counts) - Math.min(...counts) <= 1);
        assert.deepEqual(balanceQuizOptions(rows), result);
        assert.deepEqual(balanceQuizOptions(result.questions), result);
        propertyBatches++;
      }
});
test("Input rows, option arrays and reference objects remain immutable", () => {
  const rows = deepFreeze([question(0), question(1), question(2)]),
    snapshot = JSON.stringify(rows);
  const result = balanceQuizOptions(rows);
  assert.equal(JSON.stringify(rows), snapshot);
  result.questions.forEach((q, i) => checkIdentity(rows[i], q));
});
test("Retry identity ignores provider IDs, object key insertion and source metadata", () => {
  const rows = [question(0), question(1), question(2), question(3)],
    other = rows.map((q) => ({
      explanation: q.explanation,
      correct: q.correct,
      options: q.options,
      prompt: q.prompt,
      difficulty: q.difficulty,
      topic: q.topic,
      references: [{ ...q.references[0], page: 3 }],
      providerId: "unrelated",
    }));
  assert.deepEqual(
    balanceQuizOptions(rows).questions.map((q) => [q.options, q.correct]),
    balanceQuizOptions(other).questions.map((q) => [q.options, q.correct]),
  );
});
test("Explicit option letters and ordinal positions are preserved in five supported languages", () => {
  for (const text of [
    "Đáp án đúng là A.",
    "Chọn phương án B vì phù hợp.",
    "Lựa chọn thứ nhất là đúng.",
    "Phương án cuối cùng bị loại.",
    "The correct answer is C.",
    "Choice (D) is supported.",
    "The second option follows.",
    "Option 2 is correct.",
    "B is correct.",
    "答案是A。",
    "第一项正确。",
    "選択肢Bが正解です。",
    "最初の選択肢です。",
    "정답은 C 입니다.",
    "첫 번째 선택지입니다.",
  ]) {
    const q = question(0, { explanation: text }),
      r = balanceQuizOptions([q]);
    assert.ok(hasPositionalOptionDependency(q), text);
    assert.deepEqual(r.preservedIndices, [0]);
    assert.strictEqual(r.questions[0], q);
  }
});
test("Prompt and option dependencies prevent invalid all-above and combined-letter rotation", () => {
  for (const patch of [
    { prompt: "Which option is correct, A or B?" },
    { options: ["Both A and B", "8w+1", "8w+2", "8w+3"] },
    { options: ["All of the above", "8w+1", "8w+2", "8w+3"] },
    { options: ["Tất cả các phương án trên", "8w+1", "8w+2", "8w+3"] },
    { options: ["Cả A và B", "8w+1", "8w+2", "8w+3"] },
    { options: ["以上皆是", "8w+1", "8w+2", "8w+3"] },
    { options: ["上記のすべて", "8w+1", "8w+2", "8w+3"] },
    { options: ["위의 모두", "8w+1", "8w+2", "8w+3"] },
    { options: ["(1) 8w", "(2) 8w+1", "(3) 8w+2", "(4) 8w+3"] },
    { prompt: "Answer option 3." },
    { explanation: "A) follows from the source." },
  ]) {
    const q = question(0, patch),
      r = balanceQuizOptions([q]);
    assert.deepEqual(r.preservedIndices, [0], JSON.stringify(patch));
    assert.strictEqual(r.questions[0], q);
  }
});
test("Bare mathematical symbols and equations never trigger generic letter matching", () => {
  for (const text of [
    "A=8w.",
    "A = 8w, với w>0.",
    "Đáp án A=8w.",
    "The answer is A = 8w.",
    "Tính diện tích A của hình chữ nhật.",
    "Điểm A và B là hai đỉnh.",
    "A triangle has three sides.",
    "Vì a khác 0 nên có thể chia.",
    "Theo nguồn, điều kiện là x khác 2.",
  ]) {
    assert.equal(
      hasPositionalOptionDependency(
        question(0, { prompt: text, explanation: text }),
      ),
      false,
      text,
    );
  }
});
test("Unicode typography/fullwidth and format controls cannot hide explicit positional cues or rewrite mathematical content", () => {
  for (const text of [
    "Đáp án “A” đúng.",
    "Đáp án ‘Ａ’ đúng.",
    "答案Ａ。",
    "選択肢「Ｂ」です。",
    "정답은 Ｃ 입니다.",
    "Both “A” and “B”",
    "Đáp án “\u200bA” đúng.",
    "Lựa chọn thứ \u200bhai là đúng.",
  ]) {
    for (const patch of [
      { prompt: text },
      { explanation: text },
      { options: [text, "8w+1", "8w+2", "8w+3"] },
    ]) {
      const q = question(0, patch),
        before = JSON.stringify(q),
        r = balanceQuizOptions([q]);
      assert.deepEqual(r.preservedIndices, [0], text);
      assert.strictEqual(r.questions[0], q);
      assert.equal(JSON.stringify(q), before);
    }
  }
  for (const text of [
    "Đáp án “Ａ＝８ｗ”.",
    "The answer is ‘A’ = 8w.",
    "Ａ＝８ｗ.",
  ])
    assert.equal(
      hasPositionalOptionDependency(
        question(0, { prompt: text, explanation: text }),
      ),
      false,
      text,
    );
});
test("Fixed positional questions stay untouched while safe questions balance around their occupied slots", () => {
  const rows = [
      question(0, { explanation: "Option A is correct." }),
      question(1, { explanation: "Option A is correct." }),
      ...Array.from({ length: 6 }, (_, i) => question(i + 2)),
    ],
    result = balanceQuizOptions(rows);
  assert.deepEqual(result.preservedIndices, [0, 1]);
  assert.strictEqual(result.questions[0], rows[0]);
  assert.strictEqual(result.questions[1], rows[1]);
  const counts = [0, 0, 0, 0];
  result.questions.forEach((q, i) => {
    checkIdentity(rows[i], q);
    counts[q.correct]++;
  });
  assert.deepEqual(counts, [2, 2, 2, 2]);
  assert.deepEqual(balanceQuizOptions(result.questions), result);
});
test("Unavoidable fixed-position imbalance is preserved instead of creating a refundable paid retry", () => {
  const rows = Array.from({ length: 5 }, (_, i) =>
      question(i, { explanation: "Đáp án A là đúng." }),
    ),
    r = balanceQuizOptions(rows);
  assert.equal(r.preservedIndices.length, 5);
  assert.deepEqual(r.questions, rows);
});
test("Contract applies rotation only after original answer/options/metadata validation", () => {
  const valid = question(0),
    input = contracts.validateInput({
      task: "quiz",
      language: "vi",
      source: "Diện tích là 8w.",
      question: "Tạo câu hỏi",
    });
  for (const patch of [
    { correct: 4 },
    { correct: [0, 1] },
    { options: ["8w", "8w", "8w+1", "8w+2"] },
    { difficulty: "expert" },
    { topic: undefined },
  ])
    assert.throws(() =>
      contracts.validateStructured(
        "quiz",
        JSON.stringify({ questions: [{ ...valid, ...patch }] }),
        input,
      ),
    );
  const result = contracts.validateStructured(
    "quiz",
    JSON.stringify({
      questions: [valid, question(1), question(2), question(3)],
    }),
    input,
  );
  assert.equal(result.questions.length, 4);
  assert.equal(result.quality.status, "review-required");
  assert.ok(!result.quality.issues.includes("positional-options-preserved"));
  assert.deepEqual(
    new Set(result.questions.map((q) => q.correct)),
    new Set([0, 1, 2, 3]),
  );
});
test("Positional contract output remains review-required with a specific warning and unchanged explanation", () => {
  const q = question(0, {
      explanation: "The first option follows from the source.",
    }),
    r = contracts.validateStructured(
      "quiz",
      JSON.stringify({ questions: [q] }),
    );
  assert.deepEqual(r.questions[0].options, q.options);
  assert.equal(r.questions[0].correct, q.correct);
  assert.equal(r.questions[0].explanation, q.explanation);
  assert.ok(r.quality.issues.includes("positional-options-preserved"));
  assert.equal(r.quality.status, "review-required");
});
test("Teacher chat/structured generation branch is not changed by learner quiz positioning", () => {
  assert.deepEqual(
    contracts.validateStructured(
      "chat",
      JSON.stringify({ questions: [question()] }),
    ),
    {},
  );
});
test("Specific positional warning renders safely in all five locales and is absent for a normal quiz", () => {
  for (const locale of ["vi", "en", "zh-CN", "ja", "ko"]) {
    const quality = {
      status: "review-required",
      structuralChecks: true,
      citedItems: 1,
      totalItems: 1,
      issues: ["semantic-review", "positional-options-preserved"],
    };
    const html = renderToStaticMarkup(
      React.createElement(ContentQualityNotice, { quality, locale }),
    );
    assert.ok(html.includes("data-quiz-order-warning"), locale);
    assert.ok(!html.includes("undefined"));
    assert.ok(
      !renderToStaticMarkup(
        React.createElement(ContentQualityNotice, {
          quality: { ...quality, issues: ["semantic-review"] },
          locale,
        }),
      ).includes("data-quiz-order-warning"),
    );
  }
});
let replay = null;
test("Saved live all-A quiz replays offline to balanced keys without changing any answer, reference or raw evidence", () => {
  const file = path.join(root, "docs/v7/reports/v7-live-content-20261016.json"),
    bytes = fs.readFileSync(file),
    before = crypto.createHash("sha256").update(bytes).digest("hex"),
    raw = JSON.parse(bytes),
    item = raw.cases.find((c) => c.id === "vi-quiz"),
    old = item.result.body.questions,
    result = balanceQuizOptions(old),
    counts = [0, 0, 0, 0];
  result.questions.forEach((q, i) => {
    checkIdentity(old[i], q);
    counts[q.correct]++;
  });
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1);
  assert.notDeepEqual(
    result.questions.map((q) => q.correct),
    old.map((q) => q.correct),
  );
  assert.deepEqual(result.preservedIndices, [4]);
  const normalized = contracts.validateStructured(
    "quiz",
    raw.providerAttempts.find((attempt) => attempt.caseId === "vi-quiz")
      .rawOutput,
    contracts.validateInput({ ...item.fixture, history: [] }),
  );
  assert.deepEqual(
    normalized.questions.map((q) => [q.options, q.correct]),
    result.questions.map((q) => [q.options, q.correct]),
  );
  assert.ok(normalized.quality.issues.includes("positional-options-preserved"));
  assert.equal(normalized.questions[4].explanation, old[4].explanation);
  assert.equal(
    crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"),
    before,
  );
  replay = {
    originalFinalSHA256: before,
    originalCorrectIndices: old.map((q) => q.correct),
    offlineNormalizedCorrectIndices: result.questions.map((q) => q.correct),
    positionCounts: counts,
    preservedIndices: result.preservedIndices,
    positionalReviewWarningEmittedByContract: true,
    rawUnmodified: true,
    newProviderRequests: 0,
    note: "Offline repair replay, not a new live result or semantic-dedup repair.",
  };
});
const report = {
  status: "PASS",
  checkedAt: new Date().toISOString(),
  packageVersion: JSON.parse(fs.readFileSync(path.join(root, "package.json")))
    .version,
  passed: cases.length,
  cases,
  propertyBatches,
  propertyQuestions,
  replay,
  helperProvenance: {
    precedingTargetedLiveHelperSHA256:
      "3e90571d8d2032edfc5bf0778302357b019e82a7074f8a9add070c635cfa52c1",
    currentHelperSHA256: crypto
      .createHash("sha256")
      .update(fs.readFileSync(path.join(root, "lib/ai/quiz-option-order.ts")))
      .digest("hex"),
    note: "The targeted live report finished before the subsequent matching-only Unicode cue repair. No extra provider run was made for that repair.",
  },
  paidProviderRequests: 0,
  scope:
    "Deterministic pure/contract/SSR tests and offline replay of saved authored live output. No new provider, public deployment, real students, semantic dedup or secure exam shuffle.",
};
fs.writeFileSync(
  path.join(root, "docs/v7/reports/quiz-option-order-regression.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
