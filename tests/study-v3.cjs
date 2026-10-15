const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
function load(relative) {
  const mod = { exports: {} };
  new Function(
    "exports",
    "module",
    ts.transpileModule(
      fs.readFileSync(path.join(__dirname, relative), "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
  )(mod.exports, mod);
  return mod.exports;
}
const study = load("../lib/lumio/study-v3.ts");
const { studyV3Copy } = load("../lib/lumio/study-v3-copy.ts");
let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`PASS ${name}`);
}
const question = (id, correct = 0) => ({
  id,
  prompt: `Question ${id}`,
  options: ["First", "Second", "Third", "Fourth"],
  correct,
  explanation: "Why",
});

test("Reader settings recover safely from missing, corrupt and unexpected storage", () => {
  for (const value of [null, "", "not json", "null", "[]", "42", '"large"'])
    assert.deepEqual(study.parseReaderPreferences(value), {
      fontSize: 18,
      lineHeight: 1.9,
    });
});
test("Only supported typography values may enter persisted settings", () => {
  assert.deepEqual(
    study.normalizeReaderPreferences({ fontSize: 16, lineHeight: 2.2 }),
    { fontSize: 16, lineHeight: 2.2 },
  );
  assert.deepEqual(
    study.normalizeReaderPreferences({ fontSize: 99, lineHeight: -1 }),
    { fontSize: 18, lineHeight: 1.9 },
  );
  assert.deepEqual(
    study.normalizeReaderPreferences({ fontSize: "20", lineHeight: "1.6" }),
    { fontSize: 18, lineHeight: 1.9 },
  );
});
test("Reading preferences drop document drafts, account details and unknown fields", () => {
  const preferences = study.parseReaderPreferences(
    JSON.stringify({
      fontSize: 20,
      lineHeight: 1.6,
      notes: "private notes",
      email: "student@example.invalid",
      token: "secret",
    }),
  );
  assert.deepEqual(Object.keys(preferences).sort(), ["fontSize", "lineHeight"]);
  assert.equal(JSON.stringify(preferences).includes("secret"), false);
});
test("Preference normalization never mutates defaults or caller data", () => {
  const input = { fontSize: 16, lineHeight: 1.6 };
  const output = study.normalizeReaderPreferences(input);
  output.fontSize = 20;
  assert.equal(input.fontSize, 16);
  const fallback = study.parseReaderPreferences(null);
  fallback.lineHeight = 2.2;
  assert.equal(study.defaultReaderPreferences.lineHeight, 1.9);
});
test("Quiz snapshots keep an active practice stable when the library changes", () => {
  const source = [question("one"), question("two", 1)];
  const snapshot = study.quizSnapshot(source);
  source[0].options[0] = "Changed";
  source[0].correct = 1;
  source.splice(1, 1);
  assert.equal(snapshot.length, 2);
  assert.equal(snapshot[0].options[0], "First");
  assert.equal(snapshot[0].correct, 0);
});
test("Invalid answer indices and single-option questions cannot enter a quiz session", () => {
  const input = [
    question("good"),
    question("negative", -1),
    question("fraction", 0.5),
    question("outside", 4),
    { ...question("single"), options: ["Only one"] },
  ];
  assert.deepEqual(
    study.quizSnapshot(input).map((q) => q.id),
    ["good"],
  );
});
test("A quiz score counts only answered correct options and never implicit zeroes", () => {
  const questions = [
    question("one", 0),
    question("two", 1),
    question("three", 2),
  ];
  assert.equal(study.answeredQuizScore(questions, []), 0);
  assert.equal(study.answeredQuizScore(questions, [null, null, null]), 0);
  assert.equal(study.answeredQuizScore(questions, [0, 3, 2]), 2);
  assert.equal(study.answeredQuizScore(questions, [0, 1, 2, 0]), 3);
  assert.equal(study.answeredQuizScore(questions, ["0", 1, 2]), 2);
});
test("Quiz keyboard choices respect available options and uppercase letters", () => {
  assert.equal(study.quizChoiceForKey("A", 4), 0);
  assert.equal(study.quizChoiceForKey("d", 4), 3);
  assert.equal(study.quizChoiceForKey("1", 2), 0);
  assert.equal(study.quizChoiceForKey("4", 2), null);
  for (const key of ["0", "Enter", " ", "ArrowRight", "toString", "10"])
    assert.equal(study.quizChoiceForKey(key, 4), null);
});
test("Review shortcuts map only the four documented ratings", () => {
  assert.deepEqual(["1", "2", "3", "4"].map(study.reviewRatingForKey), [
    "again",
    "hard",
    "good",
    "easy",
  ]);
  for (const key of ["0", "5", "Enter", "toString", "__proto__"])
    assert.equal(study.reviewRatingForKey(key), null);
});
test("Study shortcuts cannot consume editing, held keys or browser modifiers", () => {
  const event = {
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    repeat: false,
  };
  assert.equal(study.shortcutMayRun(event, false), true);
  assert.equal(study.shortcutMayRun(event, true), false);
  for (const key of ["altKey", "ctrlKey", "metaKey", "repeat"])
    assert.equal(study.shortcutMayRun({ ...event, [key]: true }, false), false);
});
test("New reading, review and quiz labels exist in all five supported languages", () => {
  const keys = Object.keys(studyV3Copy.en).sort();
  for (const locale of ["vi", "en", "zh-CN", "ja", "ko"]) {
    assert.deepEqual(Object.keys(studyV3Copy[locale]).sort(), keys);
    for (const text of Object.values(studyV3Copy[locale]))
      assert.ok(typeof text === "string" && text.trim());
  }
});
console.log(`${passed} study v3 checks passed`);
