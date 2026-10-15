// Deterministic synthetic evidence, not student or calibrated educational results.
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript");
const root = path.resolve(__dirname, ".."),
  cache = new Map();
function load(relative) {
  const file = path.resolve(root, relative);
  if (cache.has(file)) return cache.get(file).exports;
  const m = { exports: {} };
  cache.set(file, m);
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
    m,
    m.exports,
  );
  return m.exports;
}
const s = load("lib/lumio/skill-evidence.ts"),
  t = load("lib/lumio/skill-taxonomy.ts"),
  r = load("lib/lumio/recommendations.ts"),
  storage = load("lib/lumio/storage.ts");
const now = Date.parse("2026-10-15T12:00:00Z"),
  DAY = 86400000;
let count = 0,
  seq = 0;
const passed = [];
function test(name, fn) {
  fn();
  count++;
  passed.push(name);
  console.log("PASS " + name);
}
const question = (id, extra = {}) => ({
  id,
  prompt: `Giải phương trình x + ${id} = 50`,
  options: ["1", "2", "3", "4"],
  correct: 0,
  explanation: "Kiểm tra hai vế.",
  topic: "Phương trình bậc nhất",
  difficulty: "beginner",
  ...extra,
});
function attempt(questions, answers, days = 0, prior = [], selection = {}) {
  const a = {
    date: new Date(now - days * DAY).toISOString(),
    score: answers.filter((v, i) => v === questions[i].correct).length,
    total: questions.length,
    answers: questions.map((q, i) => ({
      questionId: q.id,
      selected: answers[i],
      correct: answers[i] === q.correct,
      ...(q.topic ? { topic: q.topic } : {}),
    })),
  };
  return {
    ...a,
    skillEvidence: s.createSkillEvidence(
      questions,
      answers,
      prior,
      "attempt-" + ++seq,
      selection,
    ),
  };
}
function item(attempts = [], questions = []) {
  return {
    id: "sample",
    title: "Synthetic maths fixture",
    kind: "text",
    spaceId: "",
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    text: "",
    notes: "",
    cards: [],
    questions,
    attempts,
    favorite: false,
  };
}
const stats = (attempts, enabled = true) =>
  s
    .buildSkillProfile([item(attempts)], enabled, now)
    .skills.find((v) => v.id === "linear");
const stable = () =>
  [8, 4, 0].map((age, i) => {
    const qs = Array.from({ length: i === 2 ? 2 : 3 }, (_, j) =>
      question(`stable-${i}-${j}`, {
        difficulty: i === 0 ? "beginner" : "intermediate",
      }),
    );
    return attempt(
      qs,
      qs.map(() => 0),
      age,
    );
  });

test("Taxonomy is an explicit acyclic graph with existing prerequisite IDs", () =>
  assert.equal(t.validateSkillGraph(t.skillTaxonomy), true));
test("Invalid, cyclic and duplicate graph edges are rejected", () => {
  assert.throws(() =>
    t.validateSkillGraph([{ id: "a", prerequisites: ["b"] }]),
  );
  assert.throws(() =>
    t.validateSkillGraph([
      { id: "a", prerequisites: ["b"] },
      { id: "b", prerequisites: ["a"] },
    ]),
  );
  assert.throws(() =>
    t.validateSkillGraph([{ id: "a", prerequisites: ["a", "a"] }]),
  );
  assert.throws(() =>
    t.validateSkillGraph([
      { id: "a", prerequisites: [] },
      { id: "a", prerequisites: [] },
    ]),
  );
});
test("Only exact normalised aliases map topics, broad equations are unknown", () => {
  assert.equal(t.skillForTopic("  PHƯƠNG TRÌNH   BẬC NHẤT "), "linear");
  assert.equal(t.skillForTopic("Phương trình"), undefined);
  assert.equal(t.skillForTopic("Phương trình bậc nhất và nâng cao"), undefined);
  assert.equal(t.skillForTopic("Photosynthesis"), undefined);
});
test("Cold start creates no ability claims or hidden observations", () => {
  const p = s.buildSkillProfile([], true, now);
  assert.ok(
    p.skills.every((v) => v.status === "insufficient" && v.independent === 0),
  );
  assert.equal(p.legacyAnswers, 0);
});
test("Corrupt optional prior evidence cannot crash completing a new practice", () => {
  assert.doesNotThrow(() =>
    s.createSkillEvidence(
      [question("safe-prior")],
      [0],
      [
        {
          date: new Date(now).toISOString(),
          score: 0,
          total: 1,
          skillEvidence: {},
          answers: [null],
        },
      ],
      "safe-new-attempt",
    ),
  );
});
test("Legacy attempts remain observed history and do not invent skill snapshots", () => {
  const old = {
    date: new Date(now).toISOString(),
    score: 1,
    total: 1,
    answers: [
      {
        questionId: "q",
        selected: 0,
        correct: true,
        topic: "Phương trình bậc nhất",
      },
    ],
  };
  const p = s.buildSkillProfile([item([old])], true, now);
  assert.equal(p.legacyAnswers, 1);
  assert.ok(p.skills.every((v) => v.independent === 0));
  assert.equal(old.skillEvidence, undefined);
});
test("One correct answer never meets consistency or mastery", () => {
  const v = stats([attempt([question("one")], [0])]);
  assert.equal(v.status, "insufficient");
  assert.equal(v.correct, 1);
  assert.equal(v.days, 1);
  assert.ok(v.interval[0] < 0.3);
  assert.equal("mastered" in v, false);
});
test("Eight correct unique questions still need spacing and several days", () => {
  const qs = Array.from({ length: 8 }, (_, i) =>
    question("same-day-" + i, { difficulty: i < 4 ? "beginner" : "advanced" }),
  );
  const v = stats([
    attempt(
      qs,
      qs.map(() => 0),
    ),
  ]);
  assert.notEqual(v.status, "consistent");
  assert.equal(v.spanDays, 0);
});
test("Spaced first choices over three days and two declared levels can be consistent", () => {
  const v = stats(stable());
  assert.equal(v.independent, 8);
  assert.equal(v.days, 3);
  assert.equal(v.spanDays, 8);
  assert.equal(v.status, "consistent");
  assert.equal(v.levels.beginner.total, 3);
  assert.equal(v.levels.intermediate.total, 5);
});
test("A single declared difficulty does not establish broader consistency", () => {
  const attempts = stable().map((a) => ({
    ...a,
    skillEvidence: {
      ...a.skillEvidence,
      answers: a.skillEvidence.answers.map((v) => ({
        ...v,
        difficulty: "beginner",
      })),
    },
  }));
  assert.notEqual(stats(attempts).status, "consistent");
});
test("Missing difficulty is preserved as unknown, not inferred from current quiz", () => {
  const q = question("unknown", { difficulty: undefined });
  const v = stats([attempt([q], [0])]);
  assert.equal(v.levels.unknown.total, 1);
  assert.equal(v.levels.beginner.total, 0);
});
test("Repeated same content cannot manufacture independent evidence, even after copying", () => {
  const q = question("repeat"),
    a = attempt([q], [0], 8),
    b = attempt([{ ...q, id: "copied" }], [0], 4);
  const v = stats([a, b]);
  assert.equal(v.independent, 1);
  assert.equal(v.repeated, 1);
  assert.equal(v.days, 1);
});
test("Previous attempts are explicitly marked and not counted as new ability evidence", () => {
  const q = question("seen"),
    a = attempt([q], [0], 8),
    b = attempt([q], [0], 0, [a]);
  assert.equal(b.skillEvidence.answers[0].exposure, "previous-attempt");
  assert.equal(stats([a, b]).independent, 1);
});
test("Unknown or answer-seen exposure does not become first-choice evidence", () => {
  const a = attempt([question("unknown-exposure")], [0]);
  a.skillEvidence.answers[0].exposure = "unknown";
  assert.equal(stats([a]).independent, 0);
});
test("Two different recent wrong answers trigger a review reason", () => {
  const v = stats([attempt([question("wrong1"), question("wrong2")], [1, 2])]);
  assert.equal(v.status, "review");
  assert.equal(v.recentErrors, 2);
  assert.equal(v.correct, 0);
});
test("New repeated errors can suggest review without inflating independent question count", () => {
  const attempts = stable(),
    a = attempt([question("freshwrong1"), question("freshwrong2")], [0, 0], 10);
  const b = attempt(
    [question("freshwrong1"), question("freshwrong2")],
    [1, 1],
    0,
    [a],
  );
  const v = stats([...attempts, a, b]);
  assert.equal(v.status, "review");
  assert.equal(v.recentErrors, 2);
  assert.equal(v.independent, 10);
});
test("Superseded repeat errors are not counted as current errors forever", () => {
  const qs = [question("later1"), question("later2")],
    a = attempt(qs, [1, 1], 8),
    b = attempt(qs, [0, 0], 0, [a]);
  assert.equal(stats([a, b]).recentErrors, 0);
});
test("Duplicate operation IDs/imported copies do not multiply the profile", () => {
  const a = attempt([question("dup")], [0]);
  const p = s.buildSkillProfile(
    [item([a]), { ...item([structuredClone(a)]), id: "duplicate" }],
    true,
    now,
  );
  assert.equal(p.skills.find((v) => v.id === "linear").observations, 1);
});
test("Expired, invalid and future attempt dates never strengthen evidence", () => {
  const a = attempt([question("old")], [0], 91),
    b = attempt([question("future")], [0], -1),
    c = { ...attempt([question("invalid-date")], [0]), date: "invalid" };
  assert.equal(stats([a, b, c]).observations, 0);
});
test("Practice days use UTC even when imported timestamps have a zone offset", () => {
  const a = attempt([question("utc1")], [0]);
  const b = attempt([question("utc2")], [0]);
  a.date = "2026-10-15T01:00:00+07:00";
  b.date = "2026-10-14T19:00:00Z";
  assert.equal(stats([a, b]).days, 1);
});
test("Learner-selected scope is distinct from exact topic aliases and unknown metadata", () => {
  const q = question("manual", { topic: undefined, difficulty: undefined });
  const a = attempt([q], [0], 0, [], {
    skillId: "factor",
    difficulty: "advanced",
  });
  assert.equal(a.skillEvidence.answers[0].skillOrigin, "learner-selected");
  assert.equal(a.skillEvidence.answers[0].difficultyOrigin, "learner-selected");
  assert.equal(
    s
      .buildSkillProfile([item([a])], true, now)
      .skills.find((v) => v.id === "factor").independent,
    1,
  );
});
test("Unrecognised topics remain unclassified instead of using model diagnosis", () => {
  const a = attempt([question("botany", { topic: "Photosynthesis" })], [0]);
  const p = s.buildSkillProfile([item([a])], true, now);
  assert.equal(p.unclassified, 1);
  assert.ok(p.skills.every((v) => !v.observations));
});
test("Editing current question labels does not rewrite old evidence snapshots", () => {
  const q = question("immutable"),
    a = attempt([q], [0]);
  const p = s.buildSkillProfile(
    [item([a], [{ ...q, topic: "Căn bậc hai", difficulty: "advanced" }])],
    true,
    now,
  );
  assert.equal(
    p.skills.find((v) => v.id === "linear").levels.beginner.total,
    1,
  );
  assert.equal(p.skills.find((v) => v.id === "roots").independent, 0);
});
test("Malformed snapshots, inconsistent scores, unknown skills and versions are refused", () => {
  const a = attempt([question("bad")], [0]);
  for (const mutate of [
    (e) => (e.version = 99),
    (e) => (e.taxonomyVersion = "future"),
    (e) => (e.answers[0].skillId = "invented"),
    (e) => (e.answers[0].correct = false),
    (e) => (e.answers[0].selected = 3),
    (e) => (e.answers[0].difficultyOrigin = "unknown"),
    (e) => e.answers.push(e.answers[0]),
  ]) {
    const e = structuredClone(a.skillEvidence);
    mutate(e);
    assert.throws(() => s.parseSkillEvidence(e, a));
  }
});
test("Disabled skill profiling does not read saved results into any computed profile", () => {
  const p = s.buildSkillProfile([item(stable())], false, now);
  assert.ok(
    p.skills.every((v) => v.observations === 0 && v.status === "insufficient"),
  );
  assert.equal(p.legacyAnswers, 0);
});
test("Deleting snapshots preserves quiz grades, detailed answers and materials without mutation", () => {
  const source = [item(stable())],
    out = s.stripSkillEvidence(source);
  assert.ok(out[0].attempts.every((a) => !a.skillEvidence));
  assert.equal(out[0].attempts[0].score, source[0].attempts[0].score);
  assert.deepEqual(out[0].attempts[0].answers, source[0].attempts[0].answers);
  assert.ok(source[0].attempts[0].skillEvidence);
  assert.equal(stats(out[0].attempts).independent, 0);
});
test("Backup roundtrip preserves skill snapshots and legacy compatibility", () => {
  const data = {
      version: 1,
      spaces: [],
      items: [item(stable(), [question("present")])],
    },
    out = storage.importLibrary(storage.exportLibrary(data));
  assert.deepEqual(out.items[0].attempts, data.items[0].attempts);
  const old = {
    ...data,
    items: [item([{ date: new Date(now).toISOString(), score: 1, total: 1 }])],
  };
  assert.equal(
    storage.importLibrary(storage.exportLibrary(old)).items[0].attempts[0]
      .skillEvidence,
    undefined,
  );
});
test("Invalid imported snapshots fail without silently creating a new empty library", () => {
  const data = { version: 1, spaces: [], items: [item(stable())] };
  data.items[0].attempts[0].skillEvidence.answers[0].fingerprint = "forged";
  assert.throws(
    () => storage.importLibrary(JSON.stringify(data)),
    /INVALID_SKILL_EVIDENCE/,
  );
});
test("Preferences keep optional tracking control and reject wrong field types", () => {
  assert.equal(
    r.parsePreferences({ ...r.emptyPreferences(), skillTracking: false })
      .skillTracking,
    false,
  );
  assert.equal(
    r.parsePreferences(r.emptyPreferences()).skillTracking,
    undefined,
  );
  assert.throws(() =>
    r.parsePreferences({ ...r.emptyPreferences(), skillTracking: "true" }),
  );
});
test("Material suggestions use actual topic/snapshot matches without inventing resources", () => {
  const items = [item([], [question("match")])];
  assert.equal(s.matchingSkillItems(items, "linear").length, 1);
  assert.equal(s.matchingSkillItems(items, "radical-equations").length, 0);
  assert.doesNotThrow(() =>
    s.matchingSkillItems([item([{ skillEvidence: {} }])], "linear"),
  );
});
test("Skill suggestions explain actual observed errors and use only existing materials", () => {
  const qs = [
    question("product1", { topic: "Phương trình tích" }),
    question("product2", { topic: "Phương trình tích" }),
  ];
  const items = [
    { ...item([attempt(qs, [1, 1])], qs), id: "product-material" },
  ];
  const suggestions = s.skillPracticeSuggestions(
    items,
    s.buildSkillProfile(items, true, now),
  );
  assert.equal(suggestions[0].reason, "review");
  assert.equal(suggestions[0].errors, 2);
  assert.equal(suggestions[0].item.id, "product-material");
});
test("Skill suggestions disappear when profiling is disabled", () => {
  const items = [item(stable(), [question("enabled")])];
  assert.deepEqual(
    s.skillPracticeSuggestions(items, s.buildSkillProfile(items, false, now)),
    [],
  );
});
test("Unknown or missing learning materials never create an invented next-step link", () => {
  const source = item(stable());
  assert.deepEqual(
    s.skillPracticeSuggestions(
      [source],
      s.buildSkillProfile([source], true, now),
    ),
    [],
  );
});
test("An explicit weak prerequisite is recommended with its actual relationship", () => {
  const linearQs = [question("prereq1"), question("prereq2")],
    productQs = [
      question("child1", { topic: "Phương trình tích" }),
      question("child2", { topic: "Phương trình tích" }),
      question("child3", { topic: "Phương trình tích" }),
    ];
  const items = [
    { ...item([attempt(linearQs, [1, 1])], linearQs), id: "linear-material" },
    {
      ...item([attempt(productQs, [1, 1, 1])], productQs),
      id: "product-material",
    },
  ];
  const suggestions = s.skillPracticeSuggestions(
    items,
    s.buildSkillProfile(items, true, now),
  );
  assert.ok(
    suggestions.some(
      (v) =>
        v.item.id === "linear-material" &&
        v.reason === "foundation" &&
        v.basisId === "product",
    ),
  );
  assert.equal(
    new Set(suggestions.map((v) => v.item.id)).size,
    suggestions.length,
  );
});
test("Next-skill suggestion requires all explicitly declared foundations, not one correct answer", () => {
  const factorAttempts = [8, 4, 0].map((age, i) => {
    const qs = Array.from({ length: i === 2 ? 2 : 3 }, (_, j) =>
      question(`next-factor-${i}-${j}`, {
        topic: "Phân tích thành nhân tử",
        difficulty: i === 0 ? "beginner" : "intermediate",
      }),
    );
    return attempt(
      qs,
      qs.map(() => 0),
      age,
    );
  });
  const items = [
    { ...item(stable()), id: "linear-ready" },
    { ...item(factorAttempts), id: "factor-ready" },
    {
      ...item([], [question("new-product", { topic: "Phương trình tích" })]),
      id: "product-next",
    },
  ];
  assert.ok(
    s
      .skillPracticeSuggestions(items, s.buildSkillProfile(items, true, now))
      .some((v) => v.reason === "next" && v.skillId === "product"),
  );
  items[1].attempts = factorAttempts.slice(0, 1);
  assert.ok(
    !s
      .skillPracticeSuggestions(items, s.buildSkillProfile(items, true, now))
      .some((v) => v.reason === "next" && v.skillId === "product"),
  );
});
test("All five languages have skill labels, uncertainty text and deletion controls", () => {
  const copy = load("lib/lumio/skill-copy.ts").skillCopy;
  for (const locale of ["vi", "en", "zh-CN", "ja", "ko"]) {
    for (const key of [
      "noMastery",
      "rules",
      "first",
      "intervalHint",
      "clearConfirm",
      "off",
      "nextSteps",
    ]) {
      assert.ok(
        typeof copy[locale][key] === "string" &&
          copy[locale][key].trim().length > 0,
      );
    }
    for (const skill of t.skillTaxonomy)
      assert.ok(t.skillLabel(skill.id, locale));
  }
});
test("Descriptive interval is bounded, broad for one answer and narrows with more observations", () => {
  assert.deepEqual(s.observedInterval(0, 0), [0, 1]);
  const one = s.observedInterval(1, 1),
    many = s.observedInterval(20, 20);
  assert.ok(one[0] >= 0 && one[1] <= 1);
  assert.ok(many[1] - many[0] < one[1] - one[0]);
});
test("Sync errors guide recovery without showing arbitrary raw server or exception text", () => {
  const copy = load("lib/sync/copy.ts");
  assert.ok(
    copy.friendlySyncError("SESSION_REVOKED", "vi").includes("Tài khoản"),
  );
  assert.ok(
    copy.friendlySyncError("SYNC_LOCAL_CHANGED", "vi").includes("chỉnh sửa"),
  );
  assert.ok(
    copy.friendlySyncError("SYNC_TOO_LARGE", "en").includes("too large"),
  );
  const raw = "private exception payload text";
  assert.ok(!copy.friendlySyncError(raw, "vi").includes(raw));
});
test("Sync consent, retention, conflict and deletion text exists in all five languages", () => {
  const copy = load("lib/sync/copy.ts").syncCopy;
  for (const locale of ["vi", "en", "zh-CN", "ja", "ko"]) {
    for (const key of [
      "consent",
      "detail",
      "conflict",
      "deleteConfirm",
      "accountBound",
      "authError",
    ]) {
      assert.ok(
        typeof copy[locale][key] === "string" && copy[locale][key].trim(),
      );
    }
    assert.ok(copy[locale].detail.includes("7"));
  }
});
const report = {
  status: "PASS",
  passed: count,
  checkedAt: new Date().toISOString(),
  kind: "deterministic synthetic local regression; no students or provider calls",
  cases: passed,
};
const folder = path.join(root, "docs/v3");
fs.mkdirSync(folder, { recursive: true });
fs.writeFileSync(
  path.join(folder, "skill-evidence-unit.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(`${count} skill evidence checks passed.`);
