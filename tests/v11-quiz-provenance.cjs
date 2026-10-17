const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript");
const root = path.resolve(__dirname, ".."),
  cache = new Map();
function load(relative) {
  const file = path.resolve(root, relative);
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} };
  cache.set(file, mod);
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
    mod,
    mod.exports,
  );
  return mod.exports;
}
const { localQuizSkillEvidence, parseAnswerKeyProvenance } = load(
    "lib/lumio/quiz-provenance.ts",
  ),
  { exportLibrary, importLibrary } = load("lib/lumio/storage.ts"),
  { normalizeSyncEnvelope } = load("lib/sync/contracts.ts"),
  { emptyLearning } = load("lib/lumio/learning-engine.ts"),
  { emptyPreferences } = load("lib/lumio/recommendations.ts"),
  { quizSnapshot } = load("lib/lumio/study-v3.ts"),
  { quizReviewCopy } = load("lib/lumio/quiz-review-copy.ts");
const question = (provenance) => ({
  id: "q",
  prompt: "2x+3=7",
  options: ["2", "3", "4", "5"],
  correct: 0,
  explanation: "Synthetic",
  topic: "linear",
  difficulty: "beginner",
  ...(provenance ? { answerKeyProvenance: provenance } : {}),
});
const item = (questions, attempts = []) => ({
  id: "item",
  title: "Synthetic",
  kind: "text",
  text: "Original $x$ source",
  notes: "",
  spaceId: "",
  createdAt: "2026-10-17T00:00:00Z",
  updatedAt: "2026-10-17T00:00:00Z",
  cards: [],
  questions,
  attempts,
  favorite: false,
});
const library = (questions, attempts) => ({
  version: 1,
  spaces: [],
  items: [item(questions, attempts)],
});
let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log("PASS " + name);
}
test("AI keys cannot create new skill evidence even with declared skill and difficulty", () => {
  const qs = [question("ai-unreviewed")];
  assert.equal(
    localQuizSkillEvidence(qs, [0], [], "ai-attempt", {
      skillId: "linear",
      difficulty: "beginner",
    }),
    undefined,
  );
});
test("Legacy keys with no provenance cannot create new skill evidence", () => {
  assert.equal(
    localQuizSkillEvidence([question()], [0], [], "legacy-attempt"),
    undefined,
  );
});
test("Mixed manual and AI or legacy sessions are excluded as a whole", () => {
  for (const other of [question(), question("ai-unreviewed")])
    assert.equal(
      localQuizSkillEvidence(
        [question("learner-authored"), other],
        [0, 0],
        [],
        "mixed",
      ),
      undefined,
    );
  assert.equal(localQuizSkillEvidence([], [], [], "empty"), undefined);
});
test("Manual learner-authored practice remains available without an approval flag", () => {
  const evidence = localQuizSkillEvidence(
    [question("learner-authored")],
    [0],
    [],
    "manual-attempt",
    { skillId: "linear", difficulty: "beginner" },
  );
  assert.equal(evidence.attemptId, "manual-attempt");
  assert.equal(evidence.answers[0].correct, true);
  assert.equal(evidence.teacherConfirmed, undefined);
});
test("Closed provenance parser never accepts teacher confirmation from a client", () => {
  assert.equal(parseAnswerKeyProvenance(undefined), undefined);
  for (const bad of [
    null,
    "teacher-confirmed",
    "reviewed",
    true,
    {},
    "AI-unreviewed",
  ])
    assert.throws(() => parseAnswerKeyProvenance(bad), /INVALID_BACKUP/);
});
test("Backup codec retains both provenance enums and leaves absent legacy provenance absent", () => {
  const qs = [
    question("ai-unreviewed"),
    question("learner-authored"),
    question(),
  ];
  const parsed = importLibrary(exportLibrary(library(qs)));
  assert.deepEqual(
    parsed.items[0].questions.map((q) => q.answerKeyProvenance),
    ["ai-unreviewed", "learner-authored", undefined],
  );
  assert.equal(parsed.items[0].text, "Original $x$ source");
});
test("Sync normalization preserves provenance and rejects forged approval", () => {
  const envelope = {
    version: 1,
    library: library([question("ai-unreviewed"), question("learner-authored")]),
    learning: emptyLearning(),
    preferences: emptyPreferences(),
  };
  assert.deepEqual(
    normalizeSyncEnvelope(envelope).library.items[0].questions.map(
      (q) => q.answerKeyProvenance,
    ),
    ["ai-unreviewed", "learner-authored"],
  );
  envelope.library.items[0].questions[0].answerKeyProvenance =
    "teacher-confirmed";
  assert.throws(() => normalizeSyncEnvelope(envelope), /INVALID_BACKUP/);
});
test("Historical attempts and original skill snapshots are not silently rewritten", () => {
  const manual = question("learner-authored"),
    ev = localQuizSkillEvidence([manual], [0], [], "historic", {
      skillId: "linear",
      difficulty: "beginner",
    });
  const prior = [
    {
      date: "2026-10-17T00:00:00Z",
      score: 1,
      total: 1,
      skillEvidence: ev,
      answers: [{ questionId: "q", selected: 0, correct: true }],
    },
  ];
  const before = JSON.stringify(prior);
  assert.equal(
    localQuizSkillEvidence([question("ai-unreviewed")], [0], prior, "new"),
    undefined,
  );
  assert.equal(JSON.stringify(prior), before);
  assert.deepEqual(
    importLibrary(exportLibrary(library([question()], prior))).items[0]
      .attempts,
    prior,
  );
});
test("Quiz session snapshots retain provenance without aliasing answer options", () => {
  const q = question("ai-unreviewed"),
    snapshot = quizSnapshot([q]);
  assert.equal(snapshot[0].answerKeyProvenance, "ai-unreviewed");
  snapshot[0].options[0] = "different";
  assert.equal(q.options[0], "2");
});
test("Actual learner creation and completion paths use closed provenance and gated evidence", () => {
  const ai = fs.readFileSync(
      path.join(root, "components/lumio/ai-panel.tsx"),
      "utf8",
    ),
    study = fs.readFileSync(
      path.join(root, "components/lumio/study-tools.tsx"),
      "utf8",
    );
  assert.match(ai, /answerKeyProvenance:\s*"ai-unreviewed"/);
  assert.match(study, /answerKeyProvenance:\s*"learner-authored"/);
  assert.match(study, /skillEvidence:\s*localQuizSkillEvidence\(/);
  assert.equal(/skillEvidence:\s*createSkillEvidence\(/.test(study), false);
  assert.match(study, /data-quiz-key-review/);
  for (const file of [
    "components/lumio/skill-evidence.tsx",
    "components/lumio/learning-plan.tsx",
  ])
    assert.match(
      fs.readFileSync(path.join(root, file), "utf8"),
      /quizReviewCopy\[locale\]\.history/,
    );
});
test("Every locale distinguishes saved-key comparison from teacher assessment", () => {
  assert.deepEqual(Object.keys(quizReviewCopy).sort(), [
    "en",
    "ja",
    "ko",
    "vi",
    "zh-CN",
  ]);
  for (const c of Object.values(quizReviewCopy))
    for (const value of Object.values(c)) assert.ok(value.length > 5);
  assert.match(quizReviewCopy.en.notice, /not teacher-confirmed/);
  assert.match(quizReviewCopy.en.history, /Older evidence is retained/);
  assert.match(quizReviewCopy.en.matched, /saved key/);
  assert.match(quizReviewCopy.en.rate, /Saved-key/);
});
console.log(
  JSON.stringify({
    status: "PASS",
    checks: passed,
    scope:
      "Actual provenance codec, sync, snapshot and completion gate; no semantic answer verifier, no teacher approval or historical evidence rewrite",
  }),
);
