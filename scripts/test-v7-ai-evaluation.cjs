/* Regression of the offline evaluator itself: false expectations must fail. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  corpusPath,
  validateCorpus,
  evaluateCorpus,
  writeReport,
} = require("./evaluate-v7-ai.cjs");
const corpus = JSON.parse(fs.readFileSync(corpusPath, "utf8"));
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
      scope:
        "Regression of evaluator coverage, false expectations, honest unknowns and deterministic execution. These eleven checks are not eleven additional AI answers.",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `${checks.length} evaluator regression checks passed; ${baseline.caseCount} authored corpus cases, zero provider requests.`,
);
