// Deterministic authored fixtures. No providers, real students or private databases.
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript");
const root = path.resolve(__dirname, ".."),
  cache = new Map();
function load(file) {
  file = path.resolve(root, file);
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
    (n) =>
      n.startsWith(".")
        ? load(path.relative(root, path.resolve(path.dirname(file), n + ".ts")))
        : require(n),
    m,
    m.exports,
  );
  return m.exports;
}
const skills = load("lib/lumio/skill-evidence.ts"),
  engine = load("lib/lumio/learning-engine.ts"),
  prefs = load("lib/lumio/recommendations.ts"),
  plans = load("lib/lumio/learning-plan.ts"),
  sync = load("lib/sync/contracts.ts"),
  merge = load("lib/sync/merge.ts"),
  storage = load("lib/lumio/storage.ts"),
  copy = load("lib/lumio/learning-plan-copy.ts").learningPlanCopy;
const now = Date.parse("2026-10-16T12:00:00Z"),
  at = new Date(now),
  DAY = 86400000,
  checks = [];
const test = (name, fn) => {
  fn();
  checks.push({ name, status: "PASS" });
  console.log("PASS " + name);
};
const question = (id = "q", extra = {}) => ({
  id,
  prompt: "Solve x+1=3",
  options: ["1", "2", "3", "4"],
  correct: 1,
  explanation: "Subtract one.",
  topic: "Linear equations",
  difficulty: "beginner",
  ...extra,
});
const item = (id = "lesson", extra = {}) => ({
  id,
  title: "QA · " + id,
  kind: "text",
  spaceId: "",
  createdAt: at.toISOString(),
  updatedAt: at.toISOString(),
  text: "Authored lesson",
  notes: "",
  cards: [],
  questions: [],
  attempts: [],
  favorite: false,
  ...extra,
});
function attempt(q, id = "attempt", prior = [], chosen = q.correct) {
  return {
    date: at.toISOString(),
    score: chosen === q.correct ? 1 : 0,
    total: 1,
    answers: [
      {
        questionId: q.id,
        selected: chosen,
        correct: chosen === q.correct,
        topic: q.topic,
      },
    ],
    skillEvidence: skills.createSkillEvidence([q], [chosen], prior, id),
  };
}
const stat = (i, excluded = []) =>
  skills
    .buildSkillProfile([i], true, now, excluded)
    .skills.find((s) => s.id === "linear");
const card = {
  itemId: "cards",
  cardId: "due",
  fingerprint: engine.cardFingerprint("Due", "Answer"),
};
const cards = item("cards", {
  cards: [
    { id: "new", front: "New", back: "Answer" },
    { id: "due", front: "Due", back: "Answer" },
  ],
});
const scheduled = () => ({
  ...engine.emptyLearning(),
  reviews: [
    engine.scheduleReview(undefined, "again", card, new Date(now - DAY)),
  ],
});
test("Shuffling answer positions preserves canonical identity and answer value", () => {
  const q = question(),
    rotated = { ...q, id: "copy", options: ["2", "3", "4", "1"], correct: 0 };
  assert.equal(
    skills.questionFingerprint(q),
    skills.questionFingerprint(rotated),
  );
  const a = attempt(q, "a"),
    b = attempt(rotated, "b", [a]);
  assert.equal(b.skillEvidence.answers[0].exposure, "previous-attempt");
  assert.equal(stat(item("a", { attempts: [a, b] })).independent, 1);
});
test("Copied shuffled first-choice records cannot inflate distinct-question count", () => {
  const q = question(),
    r = { ...q, id: "other", options: ["4", "3", "2", "1"], correct: 2 };
  assert.equal(
    stat(item("a", { attempts: [attempt(q, "a"), attempt(r, "b")] }))
      .independent,
    1,
  );
});
test("Answer-letter explanations cannot split the identity of an ordinary MCQ", () => {
  const q = question(),
    letter = {
      ...q,
      id: "letter",
      explanation: "Answer B is correct. Subtract one.",
    },
    rotated = {
      ...q,
      id: "rotated",
      options: ["2", "3", "4", "1"],
      correct: 0,
      explanation: "Answer A is correct. Subtract one.",
    };
  assert.equal(
    skills.questionFingerprint(q),
    skills.questionFingerprint(letter),
  );
  assert.equal(
    skills.questionFingerprint(q),
    skills.questionFingerprint(rotated),
  );
  assert.equal(
    stat(
      item("same", {
        attempts: [
          attempt(q, "a"),
          attempt(letter, "b"),
          attempt(rotated, "c"),
        ],
      }),
    ).independent,
    1,
  );
});
test("Different correct answer, prompt or options changes question identity", () => {
  const q = question();
  for (const changed of [
    { ...q, correct: 2 },
    { ...q, prompt: "Solve x+1=4" },
    { ...q, options: ["1", "2", "3", "5"] },
  ])
    assert.notEqual(
      skills.questionFingerprint(q),
      skills.questionFingerprint(changed),
    );
});
test("Whitespace and NFC equivalents deduplicate without algebraic equivalence claims", () => {
  assert.equal(
    skills.questionFingerprint(question()),
    skills.questionFingerprint(
      question("copy", { prompt: "  Solve   x+1=3  " }),
    ),
  );
  assert.notEqual(
    skills.questionFingerprint(question()),
    skills.questionFingerprint(question("different", { prompt: "Solve x=2" })),
  );
});
test("Positional dependencies retain ordered identity rather than unsafe shuffling", () => {
  const q = question("p", { options: ["1", "2", "Both A and B", "4"] });
  assert.ok(skills.questionFingerprint(q).startsWith("q3:"));
  assert.notEqual(
    skills.questionFingerprint(q),
    skills.questionFingerprint({
      ...q,
      options: ["2", "1", "Both A and B", "4"],
      correct: 0,
    }),
  );
});
test("Old q1 evidence stays readable and observed history is untouched but inference is excluded", () => {
  const a = attempt(question());
  a.skillEvidence.answers[0].fingerprint = "q1:90:abcdef:123";
  const original = JSON.stringify(a);
  assert.doesNotThrow(() => skills.parseSkillEvidence(a.skillEvidence, a));
  const p = skills.buildSkillProfile(
    [item("old", { attempts: [a] })],
    true,
    now,
  );
  assert.equal(p.legacyIdentityAnswers, 1);
  assert.equal(p.skills.find((s) => s.id === "linear").independent, 0);
  assert.equal(JSON.stringify(a), original);
});
test("A known legacy MCQ remains previously seen even after its choices rotate", () => {
  const q = question(),
    a = attempt(q, "old");
  a.skillEvidence.answers[0].fingerprint = "q1:35:1c924ef5:77b1f9b3";
  const b = attempt(
    { ...q, id: "new-id", options: ["2", "3", "4", "1"], correct: 0 },
    "new",
    [a],
  );
  assert.equal(b.skillEvidence.answers[0].exposure, "previous-attempt");
  assert.equal(stat(item("legacy", { attempts: [a, b] })).independent, 0);
});
test("Malformed optional prior snapshots cannot crash canonical exposure detection", () => {
  assert.doesNotThrow(() =>
    skills.createSkillEvidence(
      [question()],
      [1],
      [{ skillEvidence: { answers: { bad: true } } }],
      "safe",
    ),
  );
});
test("Excluding an attempt changes inference only and restoration recovers the same observations", () => {
  const i = item("weak", {
      questions: [question()],
      attempts: [attempt(question(), "a", [], 0)],
    }),
    before = JSON.stringify(i);
  assert.equal(stat(i).independent, 1);
  assert.equal(stat(i, ["a"]).independent, 0);
  assert.equal(stat(i, []).independent, 1);
  assert.equal(JSON.stringify(i), before);
});
test("Exclusions operate across copied attempt IDs and never affect another library", () => {
  const a = attempt(question(), "a");
  assert.equal(
    skills
      .buildSkillProfile([item("x", { attempts: [a, a] })], true, now, ["a"])
      .skills.find((s) => s.id === "linear").independent,
    0,
  );
  assert.equal(
    skills
      .buildSkillProfile([], true, now, ["a"])
      .skills.every((s) => s.observations === 0),
    true,
  );
});
test("Exclusion and focus controls are bounded, cloned, and backward-compatible", () => {
  const p = {
    ...prefs.emptyPreferences(),
    excludedSkillAttemptIds: ["a"],
    studyFocusSkillId: "linear",
  };
  assert.deepEqual(prefs.parsePreferences(p), p);
  for (const bad of [
    ["a", "a"],
    [""],
    ["x".repeat(101)],
    new Array(1001).fill("a"),
    [1],
  ])
    assert.throws(() =>
      prefs.parsePreferences({ ...p, excludedSkillAttemptIds: bad }),
    );
  assert.throws(() =>
    prefs.parsePreferences({ ...p, studyFocusSkillId: "invented" }),
  );
  assert.equal(
    prefs.parsePreferences(prefs.emptyPreferences()).excludedSkillAttemptIds,
    undefined,
  );
});
test("Actually overdue cards precede unseen cards regardless of array order", () => {
  assert.equal(engine.dueCards([cards], scheduled(), at)[0].card.id, "due");
});
test("Postponing a review creates no event, adaptive review, score or mastery data", () => {
  const s = scheduled(),
    before = JSON.stringify(s),
    next = engine.setReviewSchedule(s, card, new Date(now + DAY), at);
  assert.deepEqual(next.events, s.events);
  assert.deepEqual(next.reviews, s.reviews);
  assert.equal(next.reviewOverrides.length, 1);
  assert.equal(JSON.stringify(s), before);
  assert.ok(
    !engine.dueCards([cards], next, at).some((c) => c.card.id === "due"),
  );
  assert.equal(engine.learningMetrics([cards], next, at).reviews, 0);
});
test("Manual future scheduling also supports unseen cards without fabricating first review", () => {
  const empty = engine.emptyLearning(),
    next = engine.setReviewSchedule(
      empty,
      {
        ...card,
        cardId: "new",
        fingerprint: engine.cardFingerprint("New", "Answer"),
      },
      new Date(now + DAY),
      at,
    );
  assert.equal(next.reviews.length, 0);
  assert.ok(
    !engine.dueCards([cards], next, at).some((c) => c.card.id === "new"),
  );
});
test("Restoring the adaptive schedule brings a truly overdue card back", () => {
  const s = engine.setReviewSchedule(
      scheduled(),
      card,
      new Date(now + DAY),
      at,
    ),
    next = engine.clearReviewSchedule(
      s,
      engine.cardKey(card.itemId, card.cardId),
    );
  assert.equal(engine.dueCards([cards], next, at)[0].card.id, "due");
  assert.deepEqual(next.reviews, s.reviews);
});
test("Edited or deleted cards invalidate manual schedules safely", () => {
  const s = engine.setReviewSchedule(
    engine.emptyLearning(),
    card,
    new Date(now + DAY),
    at,
  );
  assert.ok(
    engine
      .dueCards(
        [
          {
            ...cards,
            cards: [{ id: "due", front: "Changed", back: "Answer" }],
          },
        ],
        s,
        at,
      )
      .some((c) => c.card.id === "due"),
  );
  assert.equal(engine.dueCards([], s, at).length, 0);
});
test("Manual schedules reject past, malformed and overlong dates without changing state", () => {
  const s = scheduled(),
    before = JSON.stringify(s);
  for (const d of [new Date(now - 1), new Date(NaN), new Date(now + 366 * DAY)])
    assert.throws(() => engine.setReviewSchedule(s, card, d, at));
  assert.equal(JSON.stringify(s), before);
});
test("Override parser rejects duplicate keys, wrong identities and malformed timestamps", () => {
  const good = engine.setReviewSchedule(
    scheduled(),
    card,
    new Date(now + DAY),
    at,
  );
  for (const modify of [
    (r) => (r.key = "foreign"),
    (r) => (r.fingerprint = "bad-hash"),
    (r) => (r.dueAt = "tomorrow"),
    (r) => (r.dueAt = new Date(now - DAY).toISOString()),
  ]) {
    const bad = structuredClone(good);
    modify(bad.reviewOverrides[0]);
    assert.throws(() => engine.parseLearning(bad));
  }
  assert.throws(() =>
    engine.parseLearning({
      ...good,
      reviewOverrides: [good.reviewOverrides[0], good.reviewOverrides[0]],
    }),
  );
});
test("Old learning data remain readable and optional overrides round trip", () => {
  const s = engine.emptyLearning();
  assert.equal(engine.parseLearning(s).reviewOverrides, undefined);
  const next = engine.setReviewSchedule(s, card, new Date(now + DAY), at);
  assert.deepEqual(
    engine.parseLearning(JSON.parse(JSON.stringify(next))),
    next,
  );
});
test("Recommendation due counts honor the same manual deferral as review queue", () => {
  const s = scheduled(),
    next = engine.setReviewSchedule(s, card, new Date(now + DAY), at);
  assert.equal(prefs.recommendationEvidence(cards, s, now).due, 1);
  assert.equal(prefs.recommendationEvidence(cards, next, now).due, 0);
});
test("Empty library creates no invented plan or resource", () => {
  const p = plans.buildLearningPlan(
    [],
    engine.emptyLearning(),
    prefs.emptyPreferences(),
    now,
  );
  assert.equal(p.primary, null);
  assert.deepEqual(p.actions, []);
});
test("Daily plan has one primary and at most two distinct-material alternatives", () => {
  const items = Array.from({ length: 8 }, (_, i) => item("i" + i));
  const p = plans.buildLearningPlan(
    items,
    engine.emptyLearning(),
    prefs.emptyPreferences(),
    now,
  );
  assert.equal(p.actions.length, 3);
  assert.equal(p.alternatives.length, 2);
  assert.equal(new Set(p.actions.map((a) => a.item.id)).size, 3);
  assert.ok(p.actions.every((a) => items.includes(a.item)));
});
test("Overdue cards become a factual primary action with observed count", () => {
  const p = plans.buildLearningPlan(
    [cards],
    scheduled(),
    prefs.emptyPreferences(),
    now,
  );
  assert.equal(p.primary.reason, "due");
  assert.equal(p.primary.dueCount, 1);
  assert.equal(p.primary.kind, "review");
});
test("Learner focus overrides order explicitly without overwriting skill results", () => {
  const focused = item("linear", { questions: [question()] }),
    p = { ...prefs.emptyPreferences(), studyFocusSkillId: "linear" };
  const result = plans.buildLearningPlan([cards, focused], scheduled(), p, now);
  assert.equal(result.primary.reason, "focus");
  assert.equal(result.primary.item.id, "linear");
  assert.ok(result.profile.skills.every((s) => s.independent === 0));
});
test("Opt-out prevents inferred profile and ignores stored focus preference", () => {
  const focused = item("linear", {
    questions: [question()],
    attempts: [attempt(question())],
  });
  const result = plans.buildLearningPlan(
    [cards, focused],
    scheduled(),
    {
      ...prefs.emptyPreferences(),
      enabled: false,
      studyFocusSkillId: "linear",
    },
    now,
  );
  assert.equal(result.primary.reason, "due");
  assert.ok(result.profile.skills.every((s) => s.observations === 0));
  assert.ok(!result.actions.some((a) => a.reason === "focus"));
});
test("Unknown subjects never produce diagnosed skill or invented prerequisite actions", () => {
  const q = question("q", { topic: "Unlabelled biology" }),
    i = item("bio", { questions: [q], attempts: [attempt(q)] });
  const result = plans.buildLearningPlan(
    [i],
    engine.emptyLearning(),
    prefs.emptyPreferences(),
    now,
  );
  assert.equal(result.primary.reason, "continue");
  assert.ok(result.profile.skills.every((s) => s.independent === 0));
});
test("Excluded weak-topic evidence stops driving inferred practice while its recorded score remains", () => {
  const q = question(),
    q2 = question("second", { prompt: "Solve x+2=4" }),
    i = item("weak", {
      questions: [q, q2],
      attempts: [attempt(q, "first", [], 0), attempt(q2, "second", [], 0)],
    });
  assert.equal(
    plans.buildLearningPlan(
      [i],
      engine.emptyLearning(),
      prefs.emptyPreferences(),
      now,
    ).primary.reason,
    "review",
  );
  const result = plans.buildLearningPlan(
    [i],
    engine.emptyLearning(),
    {
      ...prefs.emptyPreferences(),
      excludedSkillAttemptIds: ["first", "second"],
    },
    now,
  );
  assert.equal(result.primary.reason, "continue");
  assert.equal(i.attempts[0].score, 0);
  assert.equal(i.attempts.length, 2);
});
test("Sync retains overrides, exclusions and focus without changing observed scores", () => {
  const library = {
      version: 1,
      spaces: [],
      items: [
        item("linear", {
          questions: [question()],
          attempts: [attempt(question())],
        }),
      ],
    },
    data = {
      version: 1,
      library,
      learning: engine.setReviewSchedule(
        engine.emptyLearning(),
        card,
        new Date(now + DAY),
        at,
      ),
      preferences: {
        ...prefs.emptyPreferences(),
        excludedSkillAttemptIds: ["attempt"],
        studyFocusSkillId: "linear",
      },
    };
  const out = sync.normalizeSyncEnvelope(data);
  assert.deepEqual(out.learning.reviewOverrides, data.learning.reviewOverrides);
  assert.deepEqual(out.preferences, data.preferences);
  assert.equal(out.library.items[0].attempts[0].score, 1);
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(storage.importLibrary(storage.exportLibrary(library))),
    ),
    library,
  );
});
test("Concurrent manual schedule edits conflict rather than silently overwriting", () => {
  const base = {
      version: 1,
      library: { version: 1, items: [], spaces: [] },
      learning: engine.emptyLearning(),
      preferences: prefs.emptyPreferences(),
    },
    local = structuredClone(base),
    remote = structuredClone(base);
  local.learning = engine.setReviewSchedule(
    local.learning,
    card,
    new Date(now + DAY),
    at,
  );
  remote.learning = engine.setReviewSchedule(
    remote.learning,
    card,
    new Date(now + 2 * DAY),
    at,
  );
  const result = merge.mergeSync(base, local, remote);
  assert.equal(result.conflicts.length, 1);
  assert.equal(
    merge.mergeSync(base, local, remote, "remote").data.learning
      .reviewOverrides[0].dueAt,
    new Date(now + 2 * DAY).toISOString(),
  );
});
test("Old 7244-style normalization cannot delete unsupported V8 controls during merge", () => {
  const base = sync.normalizeSyncEnvelope({
    version: 1,
    library: { version: 1, items: [], spaces: [] },
    learning: engine.setReviewSchedule(
      engine.emptyLearning(),
      card,
      new Date(now + DAY),
      at,
    ),
    preferences: {
      ...prefs.emptyPreferences(),
      excludedSkillAttemptIds: ["excluded-prior"],
      studyFocusSkillId: "linear",
    },
  });
  const old = structuredClone(base);
  delete old.learning.reviewOverrides;
  delete old.preferences.excludedSkillAttemptIds;
  delete old.preferences.studyFocusSkillId;
  old.preferences.enabled = false;
  old.preferences.skillTracking = false;
  const result = merge.mergeSync(base, base, old);
  assert.deepEqual(
    result.data.learning.reviewOverrides,
    base.learning.reviewOverrides,
  );
  assert.deepEqual(result.data.preferences.excludedSkillAttemptIds, [
    "excluded-prior",
  ]);
  assert.equal(result.data.preferences.studyFocusSkillId, "linear");
  assert.equal(result.data.preferences.enabled, false);
  assert.equal(result.data.preferences.skillTracking, false);
  assert.equal(result.conflicts.length, 0);
});
test("Explicit [] and focus null clear V8 controls rather than preserving them", () => {
  const base = sync.normalizeSyncEnvelope({
    version: 1,
    library: { version: 1, items: [], spaces: [] },
    learning: engine.setReviewSchedule(
      engine.emptyLearning(),
      card,
      new Date(now + DAY),
      at,
    ),
    preferences: {
      ...prefs.emptyPreferences(),
      excludedSkillAttemptIds: ["excluded-prior"],
      studyFocusSkillId: "linear",
    },
  });
  const clear = structuredClone(base);
  clear.learning.reviewOverrides = [];
  clear.preferences.excludedSkillAttemptIds = [];
  clear.preferences.studyFocusSkillId = null;
  const result = merge.mergeSync(base, clear, base);
  assert.deepEqual(result.data.learning.reviewOverrides, []);
  assert.deepEqual(result.data.preferences.excludedSkillAttemptIds, []);
  assert.equal(result.data.preferences.studyFocusSkillId, null);
});
test("Excluding prior evidence never turns a retry into new independent evidence", () => {
  const q = question(),
    first = attempt(q, "excluded-prior", [], 0),
    retry = attempt(
      { ...q, id: "rotated-copy", options: ["2", "3", "4", "1"], correct: 0 },
      "retry",
      [first],
      0,
    );
  const i = item("retries", { attempts: [first, retry] });
  assert.equal(retry.skillEvidence.answers[0].exposure, "previous-attempt");
  assert.equal(stat(i, ["excluded-prior"]).independent, 0);
  assert.equal(stat(i).independent, 1);
  assert.equal(first.score, 0);
  assert.equal(retry.score, 1);
});
test("All five locales expose usable plan, privacy and scheduling controls", () => {
  for (const c of Object.values(copy))
    for (const key of [
      "title",
      "focusLabel",
      "inspectHint",
      "exclude",
      "restore",
      "manualHint",
      "invalidDate",
    ])
      assert.ok(typeof c[key] === "string" && c[key].length > 0);
});
const report = {
  status: "PASS",
  passed: checks.length,
  checkedAt: new Date().toISOString(),
  scope:
    "Authored deterministic local fixtures, no provider requests, real students, diagnoses, calibrated mastery or proven learning improvement",
  checks,
};
fs.mkdirSync(path.join(root, "docs/v8/reports"), { recursive: true });
fs.writeFileSync(
  path.join(root, "docs/v8/reports/learning-unit.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify({ status: report.status, passed: report.passed }));
