/* Regression of the offline evaluator itself: false expectations must fail. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  corpusPath,
  validateCorpus,
  assertPreservedQuestionIdentity,
  evaluateCorpus,
  writeReport,
} = require("./evaluate-v7-ai.cjs");
const corpus = JSON.parse(fs.readFileSync(corpusPath, "utf8"));
const { load } = require("../tests/source-grounding.cjs"),
  { validateInput, validateStructured } = load("lib/ai/contracts.ts"),
  { sourceSegments } = load("lib/ai/grounding.ts");
const checks = [],
  copy = () => structuredClone(corpus);
const test = (name, run) => {
  run();
  checks.push({ name, status: "PASS" });
  console.log("PASS " + name);
};
const baseline = evaluateCorpus(corpus);
test("Versioned corpus covers the five supported AI languages without empty categories", () => {
  assert.equal(validateCorpus(corpus), true);
  assert.equal(baseline.caseCount, 46);
  assert.equal(baseline.passedCases, baseline.caseCount);
  assert.ok(baseline.languages.every((r) => r.cases >= 9));
  for (const dimension of [
    "source",
    "injection",
    "answer-question",
    "question-quality",
    "math",
  ])
    assert.ok(baseline.results.some((r) => r.dimension === dimension));
});
test("Actual provider and language-quality claims remain explicitly untested", () => {
  assert.equal(baseline.actualProviderRequests, 0);
  assert.equal(baseline.networkAttempts, 0);
  assert.equal(baseline.model, null);
  assert.ok(
    baseline.languages.every(
      (r) => r.generatedLanguageQuality === "NOT TESTED",
    ),
  );
  assert.ok(
    baseline.dimensions.every((d) =>
      Object.values(d).some((v) => v === "NOT TESTED"),
    ),
  );
  assert.match(baseline.evidenceType, /not generated-model accuracy/);
});
function normalizedQuestion(row, shift) {
  const source = row.source + "\n\n2x+3=11; x=4.",
    segment = sourceSegments(source).find((s) => s.text.includes("2x+3=11")),
    original = ["4", "2", "3", "5"],
    options = Array(4);
  original.forEach((option, index) => {
    options[(index + shift) % 4] = option;
  });
  const authored = {
      prompt: "2x+3=11",
      options,
      correct: shift,
      explanation: row.explanation,
      topic: row.topic,
      difficulty: "beginner",
      references: [{ segmentId: segment.id, quote: segment.text }],
    },
    input = validateInput({
      task: "quiz",
      source,
      question: row.ask,
      language: row.language,
    }),
    parsed = validateStructured(
      "quiz",
      JSON.stringify({ questions: [authored] }),
      input,
    );
  return { authored, actual: parsed.questions[0], parsed };
}
test("Actual normalization accepts valid key rotations in every locale while preserving the exact correct answer and source", () => {
  let moved = 0;
  for (const row of corpus.languages)
    for (let shift = 0; shift < 4; shift++) {
      const { authored, actual, parsed } = normalizedQuestion(row, shift);
      assertPreservedQuestionIdentity(actual, authored);
      assert.equal(actual.options[actual.correct], "4");
      assert.equal(actual.references.length, 1);
      assert.equal(actual.references[0].quote, "2x+3=11; x=4.");
      assert.equal(parsed.quality.status, "review-required");
      assert.ok(parsed.quality.issues.includes("semantic-review"));
      if (actual.correct !== authored.correct) moved++;
    }
  assert.ok(
    moved > 0,
    "Exercise real option rotation, not just an unchanged key",
  );
});
test("A wrongly mapped key or altered question content fails the same evaluator identity assertion", () => {
  for (const row of corpus.languages)
    for (let shift = 0; shift < 4; shift++) {
      const { authored, actual } = normalizedQuestion(row, shift);
      const wrongKey = { ...actual, correct: (actual.correct + 1) % 4 };
      assert.notEqual(wrongKey.options[wrongKey.correct], "4");
      assert.throws(() => assertPreservedQuestionIdentity(wrongKey, authored));
      for (const change of [
        { prompt: "An altered exercise" },
        { explanation: "The incorrect answer is 2." },
        {
          options: actual.options.map((option) =>
            option === "5" ? "6" : option,
          ),
        },
        { correct: -1 },
      ])
        assert.throws(() =>
          assertPreservedQuestionIdentity({ ...actual, ...change }, authored),
        );
    }
});
test("Missing, duplicate or unsupported corpus languages are rejected before evaluation", () => {
  for (const change of [
    (c) => c.languages.pop(),
    (c) => (c.languages[0].language = "en"),
    (c) => (c.languages[0].language = "xx"),
  ]) {
    const c = copy();
    change(c);
    assert.throws(() => evaluateCorpus(c));
  }
});
test("Too few math cases, duplicate IDs and absent expected outcomes fail closed", () => {
  for (const change of [
    (c) => (c.math = c.math.slice(0, 2)),
    (c) => (c.math[1].id = c.math[0].id),
    (c) => delete c.math[0].expectedStatus,
  ]) {
    const c = copy();
    change(c);
    assert.throws(() => evaluateCorpus(c));
  }
});
test("An incorrect expected answer outcome produces a failed report instead of a green summary", () => {
  const c = copy();
  c.math[0].expectedStatus = "inconsistent";
  const report = evaluateCorpus(c);
  assert.equal(report.status, "FAIL");
  assert.ok(
    report.results.some(
      (r) => r.id === "math-linear-valid" && r.status === "FAIL",
    ),
  );
  assert.equal(report.failedCases, 1);
});
test("A query absent from the authored source fails its declared answerable retrieval expectation", () => {
  const c = copy();
  c.languages[2].query = c.languages[2].missingQuery;
  const report = evaluateCorpus(c);
  assert.equal(report.status, "FAIL");
  assert.ok(
    report.results.some(
      (r) => r.id === "zh-CN-retrieval-answerable" && r.status === "FAIL",
    ),
  );
});
test("An alleged missing-source query that actually matches is detected", () => {
  const c = copy();
  c.languages[4].missingQuery = c.languages[4].query;
  const report = evaluateCorpus(c);
  assert.equal(report.status, "FAIL");
  assert.ok(
    report.results.some(
      (r) => r.id === "ko-retrieval-missing" && r.status === "FAIL",
    ),
  );
});
test("Invalid quotes and unknown adverse-question variants cannot silently pass", () => {
  const badQuote = copy();
  badQuote.languages[0].quote = "Absent quotation";
  assert.throws(() => evaluateCorpus(badQuote));
  const badQuestion = copy();
  badQuestion.languages[0].negativeQuestion = "unimplemented-variant";
  assert.equal(evaluateCorpus(badQuestion).status, "FAIL");
});
test("Unsupported math is an honest expected unknown, not a verified answer", () => {
  const invalid = baseline.results.find(
    (r) => r.id === "math-invalid-operation-unknown",
  );
  assert.equal(invalid.actual.actual, "unknown");
  const irrational = baseline.results.find(
    (r) => r.id === "math-irrational-approximation",
  );
  assert.equal(irrational.actual.status, "not_supported");
  assert.equal(irrational.actual.scope.reasoning, "not_checked");
});
test("Repeated evaluation is deterministic apart from timing metadata and preserves the input corpus", () => {
  const before = JSON.stringify(corpus),
    again = evaluateCorpus(corpus);
  assert.deepEqual(again.results, baseline.results);
  assert.equal(again.assertionCount, baseline.assertionCount);
  assert.equal(JSON.stringify(corpus), before);
});
test("Evaluation restores the original fetch function even after an asserted case failure", () => {
  const previous = global.fetch;
  const c = copy();
  c.math[0].expectedStatus = "inconsistent";
  evaluateCorpus(c);
  assert.equal(global.fetch, previous);
});
writeReport(baseline);
const output = path.resolve(
  __dirname,
  "../docs/v7/reports/ai-evaluation-runner.json",
);
fs.writeFileSync(
  output,
  JSON.stringify(
    {
      schema: 1,
      status: "PASS",
      checkedAt: new Date().toISOString(),
      passed: checks.length,
      checks,
      corpusCases: baseline.caseCount,
      corpusAssertions: baseline.assertionCount,
      actualProviderRequests: 0,
      scope: `Regression of evaluator coverage, preserved answer identities under rotation, wrong mapped keys, false expectations, honest unknowns and deterministic execution. These ${checks.length} checks are not additional AI answers.`,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `${checks.length} evaluator regression checks passed; ${baseline.caseCount} authored corpus cases, zero provider requests.`,
);
