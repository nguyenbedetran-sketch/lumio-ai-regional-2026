const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
function load(file, dependencies = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(
    fs.readFileSync(path.join(root, file), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  new Function("require", "module", "exports", code)(
    (name) => {
      if (name in dependencies) return dependencies[name];
      throw Error("UNEXPECTED_TEST_IMPORT: " + name);
    },
    module,
    module.exports,
  );
  return module.exports;
}
const learningEngine = load("lib/lumio/learning-engine.ts");
const r = load("lib/lumio/recommendations.ts", {
    "./learning-engine": learningEngine,
    "./skill-taxonomy": load("lib/lumio/skill-taxonomy.ts"),
  }),
  now = Date.parse("2026-09-20T12:00:00Z"),
  at = new Date(now).toISOString();
let passed = 0;
function test(name, run) {
  run();
  console.log("PASS " + name);
  passed++;
}
const item = (id, title, text = "", extra = {}) => ({
  id,
  title,
  text,
  kind: "text",
  cards: [],
  attempts: [],
  favorite: false,
  createdAt: at,
  updatedAt: at,
  ...extra,
});
const emptyLearning = () => ({
  version: 1,
  events: [],
  reviews: [],
  tasks: [],
  focus: null,
});
const feedback = (itemId, value) => ({ itemId, value, at });
const vec = (a, b) =>
  Array.from({ length: 48 }, (_, i) => (i === 0 ? a : i === 1 ? b : 0));

test("Cold start has no invented ratings, model or interest evidence", () => {
  const result = r.recommend(
    [item("one", "Algebra"), item("two", "Chemistry")],
    emptyLearning(),
    r.emptyPreferences(),
    now,
  );
  assert.equal(result.method, "baseline");
  assert.equal(result.ratings, 0);
  assert.equal(result.trainingLoss, undefined);
  assert.deepEqual(result.topics, []);
  assert.ok(
    result.items.every(
      (i) => i.reason === "explore" && Number.isFinite(i.score),
    ),
  );
});
test("Recent related history outranks unrelated content, expired and future events do not", () => {
  const items = [
    item(
      "history",
      "JavaScript programming functions",
      "JavaScript function syntax closures variables",
    ),
    item(
      "related",
      "JavaScript functions closures",
      "JavaScript programming function variables",
    ),
    item(
      "other",
      "Photosynthesis chlorophyll sunlight",
      "Botany green leaves oxygen biology",
    ),
  ];
  const learning = emptyLearning();
  learning.events = [{ id: "read", itemId: "history", kind: "open", at }];
  const result = r.recommend(items, learning, r.emptyPreferences(), now);
  const related = result.items.find((x) => x.item.id === "related"),
    other = result.items.find((x) => x.item.id === "other");
  assert.equal(result.method, "content");
  assert.ok(related.score > other.score);
  assert.ok(related.terms.includes("javascript"));
  for (const offset of [-91 * 86400000, 86400000]) {
    learning.events[0].at = new Date(now + offset).toISOString();
    assert.equal(
      r.recommend(items, learning, r.emptyPreferences(), now).method,
      "baseline",
    );
  }
});
test("Explicit negative feedback downranks a previously related recommendation", () => {
  const items = [
    item("one", "JavaScript functions"),
    item("two", "JavaScript closures"),
    item("other", "Botany plants"),
  ];
  const learning = emptyLearning();
  learning.events = [{ id: "event", itemId: "one", kind: "open", at }];
  const result = r.recommend(
    items,
    learning,
    { ...r.emptyPreferences(), feedback: [feedback("two", 0)] },
    now,
  );
  assert.equal(result.items.at(-1).item.id, "two");
  assert.equal(result.items.at(-1).feedback, 0);
});
test("Disabled personalization ignores both reading history and positive/negative labels", () => {
  const items = [
    item("one", "Algebra", "", { favorite: true }),
    item("two", "Geometry"),
  ];
  const learning = emptyLearning();
  learning.events = [{ id: "e", kind: "open", itemId: "two", at }];
  const withEvidence = r.recommend(
    items,
    learning,
    {
      version: 1,
      enabled: false,
      feedback: [feedback("one", 0), feedback("two", 1)],
    },
    now,
  );
  const baseline = r.recommend(
    items,
    emptyLearning(),
    { version: 1, enabled: false, feedback: [] },
    now,
  );
  assert.deepEqual(
    withEvidence.items.map((x) => [x.item.id, x.score, x.reason]),
    baseline.items.map((x) => [x.item.id, x.score, x.reason]),
  );
  assert.equal(withEvidence.method, "baseline");
  assert.deepEqual(withEvidence.topics, []);
});
test("Review and practice evidence are real; deleted flashcards cannot become due recommendations", () => {
  const items = [
    item("review", "Review", "", {
      cards: [{ id: "card", front: "Q", back: "A" }],
    }),
    item("deleted", "Deleted"),
    item("practice", "Practice", "", {
      attempts: [{ score: 1, total: 5, date: at }],
    }),
  ];
  const learning = emptyLearning();
  learning.reviews = [
    {
      itemId: "review",
      cardId: "card",
      dueAt: at,
      fingerprint: learningEngine.cardFingerprint("Q", "A"),
    },
    { itemId: "deleted", cardId: "gone", dueAt: at },
  ];
  const result = r.recommend(items, learning, r.emptyPreferences(), now);
  assert.equal(
    result.items.find((x) => x.item.id === "review").reason,
    "review",
  );
  assert.equal(
    result.items.find((x) => x.item.id === "practice").reason,
    "practice",
  );
  assert.notEqual(
    result.items.find((x) => x.item.id === "deleted").reason,
    "review",
  );
});
test("Logistic regression learns a linear preference on unseen feature vectors", () => {
  const training = [];
  for (let i = 0; i < 12; i++) {
    training.push(
      { x: vec(0.55 + i * 0.025, 0.05 + i * 0.005), y: 1 },
      { x: vec(0.05 + i * 0.005, 0.55 + i * 0.025), y: 0 },
    );
  }
  const model = r.trainRanker(training);
  assert.equal(model.method, "logistic");
  assert.ok(model.loss < 0.15);
  assert.ok(model.predict(vec(0.82, 0.14)) > 0.8);
  assert.ok(model.predict(vec(0.14, 0.82)) < 0.2);
  const repeat = r.trainRanker(training);
  assert.equal(repeat.predict(vec(0.82, 0.14)), model.predict(vec(0.82, 0.14)));
});
test("Two-hidden-layer neural ranker learns nonlinear XOR on held-out quadrants", () => {
  const training = [];
  for (const a of [-0.9, -0.7, -0.5, 0.5, 0.7, 0.9])
    for (const b of [-0.9, -0.7, -0.5, 0.5, 0.7, 0.9])
      training.push({ x: vec(a, b), y: a * b > 0 ? 1 : 0 });
  const linear = r.trainRanker(training),
    model = r.trainRanker(training, true);
  assert.ok(linear.loss > 0.65, "linear baseline must not solve XOR");
  assert.equal(model.method, "neural");
  assert.ok(model.loss < 0.1);
  for (const [a, b] of [
    [0.8, 0.6],
    [0.8, -0.6],
    [-0.8, 0.6],
    [-0.8, -0.6],
  ]) {
    assert.ok(
      !training.some((e) => e.x[0] === a && e.x[1] === b),
      "held-out values must not appear in training",
    );
    const prediction = model.predict(vec(a, b));
    assert.ok(a * b > 0 ? prediction > 0.9 : prediction < 0.1);
  }
});
test("Training and prediction reject oversized, sparse, nonfinite and unstable vectors", () => {
  const valid = { x: vec(0.5, 0.1), y: 1 };
  for (const data of [
    [],
    Array(201).fill(valid),
    [{ x: Array(48), y: 1 }],
    [{ x: [...vec(0.5, 0.1).slice(0, 47), NaN], y: 1 }],
    [{ x: vec(1e300, 0), y: 1 }],
    [{ x: vec(0.5, 0.1), y: 2 }],
    Array(2),
  ])
    assert.throws(() => r.trainRanker(data), /INVALID_TRAINING_DATA/);
  for (const neural of [false, true]) {
    const model = r.trainRanker([valid, { x: vec(0.1, 0.5), y: 0 }], neural);
    for (const x of [[], Array(48), vec(Infinity, 0), vec(2, 0)])
      assert.throws(() => model.predict(x), /INVALID_FEATURE_VECTOR/);
  }
  assert.equal(r.MAX_TRAINING_EXAMPLES, 200);
});
test("Only explicit balanced feedback opens ML thresholds, and deleted-item ratings do not count", () => {
  const items = Array.from({ length: 40 }, (_, i) =>
    item(String(i), i % 2 ? "Botany plants" : "JavaScript functions"),
  );
  const rated = (n) => ({
    ...r.emptyPreferences(),
    feedback: items.slice(0, n).map((v, i) => feedback(v.id, i % 2)),
  });
  assert.equal(
    r.recommend(items, emptyLearning(), rated(11), now).method,
    "content",
  );
  assert.equal(
    r.recommend(items, emptyLearning(), rated(12), now).method,
    "logistic",
  );
  assert.equal(
    r.recommend(items, emptyLearning(), rated(40), now).method,
    "neural",
  );
  const oneClass = {
    ...r.emptyPreferences(),
    feedback: items.map((v) => feedback(v.id, 1)),
  };
  assert.equal(
    r.recommend(items, emptyLearning(), oneClass, now).method,
    "content",
  );
  assert.equal(
    r.recommend(
      items,
      emptyLearning(),
      { ...r.emptyPreferences(), feedback: [feedback("deleted", 1)] },
      now,
    ).ratings,
    0,
  );
});
test("Corrupt preferences fail closed and exact account namespaces cannot collide", () => {
  const good = { version: 1, enabled: true, feedback: [feedback("one", 1)] };
  assert.deepEqual(r.parsePreferences(good), good);
  for (const bad of [
    null,
    { ...good, version: 2 },
    { ...good, enabled: "true" },
    { ...good, feedback: Array(1001).fill(feedback("one", 1)) },
    { ...good, feedback: [feedback("", 1)] },
    { ...good, feedback: [feedback("one", 1), feedback("one", 0)] },
    { ...good, feedback: [feedback("one", 2)] },
    { ...good, feedback: [{ ...feedback("one", 1), at: "invalid" }] },
  ])
    assert.throws(() => r.parsePreferences(bad), /INVALID_PREFERENCES/);
  for (const [a, b] of [
    ["guest", "google:guest"],
    ["user1", "user2"],
    ["a:b", "a%3Ab"],
    ["A", "a"],
  ])
    assert.notEqual(r.preferenceKey(a), r.preferenceKey(b));
  const clone = r.parsePreferences(good);
  clone.feedback[0].value = 0;
  assert.equal(good.feedback[0].value, 1);
});

test("Regional controls round-trip without changing legacy backups or retaining unknown data", () => {
  const legacy = { version: 1, enabled: true, feedback: [] };
  assert.deepEqual(r.parsePreferences(legacy), legacy);
  const modern = {
    ...legacy,
    controls: {
      topics: [" Phương trình ", "Vật lí"],
      difficulty: "beginner",
      goal: "practice",
    },
    outcomes: [{ itemId: "a", useful: true, at }],
  };
  const parsed = r.parsePreferences({ ...modern, secret: "not retained" });
  assert.deepEqual(parsed.controls.topics, ["Phương trình", "Vật lí"]);
  assert.equal(parsed.secret, undefined);
  parsed.controls.topics[0] = "changed";
  assert.equal(modern.controls.topics[0], " Phương trình ");
  for (const controls of [
    null,
    { topics: [], difficulty: "expert", goal: "practice" },
    { topics: Array(9).fill("a"), difficulty: "any", goal: "review" },
    { topics: ["a", "A"], difficulty: "any", goal: "review" },
    { topics: ["x".repeat(81)], difficulty: "any", goal: "review" },
  ])
    assert.throws(
      () => r.parsePreferences({ ...legacy, controls }),
      /INVALID_PREFERENCES/,
    );
  for (const outcomes of [
    null,
    [{ itemId: "a", useful: "yes", at }],
    [{ itemId: "a", useful: true, at: "invalid" }],
    [
      { itemId: "a", useful: true, at },
      { itemId: "a", useful: false, at },
    ],
  ])
    assert.throws(
      () => r.parsePreferences({ ...legacy, outcomes }),
      /INVALID_PREFERENCES/,
    );
});
test("Invalid, future and expired quiz results never invent practice needs", () => {
  const subject = item("one", "Algebra", "", {
    attempts: [
      { score: 0, total: 5, date: new Date(now + 1).toISOString() },
      { score: 0, total: 5, date: new Date(now - 91 * 86400000).toISOString() },
      { score: -1, total: 5, date: at },
      { score: 7, total: 5, date: at },
      { score: 0, total: 0, date: at },
      { score: 0, total: 5, date: "bad" },
    ],
  });
  const recommended = r.recommend(
    [subject],
    emptyLearning(),
    r.emptyPreferences(),
    now,
  ).items[0];
  assert.notEqual(recommended.reason, "practice");
  assert.equal(recommended.evidence.total, 0);
  assert.deepEqual(recommended.evidence.wrongTopics, []);
});
test("Changed flashcard content cannot reuse an old card's review evidence", () => {
  const subject = item("a", "Algebra", "", {
    cards: [{ id: "c", front: "New question", back: "New answer" }],
  });
  const learning = emptyLearning();
  learning.reviews = [
    {
      itemId: "a",
      cardId: "c",
      dueAt: at,
      reviewedAt: at,
      fingerprint: learningEngine.cardFingerprint("Old question", "Old answer"),
    },
  ];
  assert.equal(r.recommendationEvidence(subject, learning, now).due, 0);
  assert.equal(r.canEvaluateRecommendation(subject, learning, now), false);
});
test("Practice explanations report observed topic errors without inferring a misconception", () => {
  const subject = item("one", "Algebra", "", {
    questions: [
      { id: "q1", difficulty: "beginner", topic: "Phương trình" },
      { id: "q2", difficulty: "beginner", topic: "Phương trình" },
    ],
    attempts: [
      {
        score: 1,
        total: 2,
        date: at,
        answers: [
          {
            questionId: "q1",
            selected: 1,
            correct: false,
            topic: "Phương trình",
          },
          {
            questionId: "q2",
            selected: 0,
            correct: true,
            topic: "Phương trình",
          },
        ],
      },
    ],
  });
  const evidence = r.recommendationEvidence(subject, emptyLearning(), now);
  assert.equal(evidence.correct, 1);
  assert.equal(evidence.total, 2);
  assert.equal(evidence.difficulty, "beginner");
  assert.deepEqual(evidence.wrongTopics, [
    { topic: "Phương trình", wrong: 1, total: 2 },
  ]);
  subject.attempts[0].answers[1].correct = false;
  assert.deepEqual(
    r.recommendationEvidence(subject, emptyLearning(), now).wrongTopics,
    [],
    "inconsistent imported answer detail is not evidence",
  );
});
test("Difficulty remains unknown when quiz labels are absent, mixed or incomplete", () => {
  for (const questions of [
    [],
    [{ id: "a" }],
    [
      { id: "a", difficulty: "beginner" },
      { id: "b", difficulty: "advanced" },
    ],
    [{ id: "a", difficulty: "beginner" }, { id: "b" }],
  ])
    assert.equal(
      r.recommendationEvidence(
        item("a", "A", "", { questions }),
        emptyLearning(),
        now,
      ).difficulty,
      null,
    );
});
test("Topic, difficulty and goal controls affect ranking but cannot imply mastery", () => {
  const items = [
    item("plants", "Botany plants"),
    item("math", "Phương trình", "", {
      questions: [{ id: "q", difficulty: "beginner", topic: "Phương trình" }],
    }),
  ];
  const preferences = {
    ...r.emptyPreferences(),
    controls: {
      topics: ["Phương trình"],
      difficulty: "beginner",
      goal: "practice",
    },
  };
  const selected = r.recommend(items, emptyLearning(), preferences, now)
    .items[0];
  assert.equal(selected.item.id, "math");
  assert.equal(selected.reason, "topic");
  assert.deepEqual(selected.evidence.topics, ["Phương trình"]);
  assert.equal(selected.evidence.attempts, 0);
  assert.equal(selected.evidence.total, 0);
  const disabled = r.recommend(
    items,
    emptyLearning(),
    { ...preferences, enabled: false },
    now,
  );
  const baseline = r.recommend(
    items,
    emptyLearning(),
    { ...r.emptyPreferences(), enabled: false },
    now,
  );
  assert.deepEqual(
    disabled.items.map((x) => [x.item.id, x.score]),
    baseline.items.map((x) => [x.item.id, x.score]),
  );
});
test("Variety reranking includes other subjects and formats instead of one liked cluster", () => {
  const same = Array.from({ length: 10 }, (_, i) =>
    item(
      `a${i}`,
      "JavaScript functions closures",
      "JavaScript function closure",
    ),
  );
  const other = item(
    "z",
    "Biology plants growth",
    "Photosynthesis biology plants",
    { kind: "pdf" },
  );
  const result = r.recommend(
    [...same, other],
    emptyLearning(),
    r.emptyPreferences(),
    now,
  );
  assert.ok(
    result.items.findIndex((x) => x.item.id === "z") < 4,
    "another subject and format appears within first four slots",
  );
});
test("A common format or vector collision cannot be explained as a shared learning topic", () => {
  const items = [
    item("math", "Phương trình"),
    item("biology", "Photosynthesis chlorophyll"),
  ];
  const learning = emptyLearning();
  learning.events = [{ id: "e", kind: "read", itemId: "math", at }];
  const biology = r
    .recommend(items, learning, r.emptyPreferences(), now)
    .items.find((x) => x.item.id === "biology");
  assert.deepEqual(biology.terms, []);
  assert.notEqual(biology.reason, "interest");
});
test("Likes, clicks and future activity cannot unlock after-study evaluation", () => {
  const subject = item("a", "Algebra", "", {
    favorite: true,
    lastOpenedAt: at,
  });
  const learning = emptyLearning();
  assert.equal(r.canEvaluateRecommendation(subject, learning, now), false);
  learning.events = [
    { id: "x", kind: "read", itemId: "a", at: new Date(now + 1).toISOString() },
  ];
  assert.equal(r.canEvaluateRecommendation(subject, learning, now), false);
  learning.events[0].at = at;
  assert.equal(r.canEvaluateRecommendation(subject, learning, now), true);
});
test("After-study self-reports are counted separately from preference labels, not as ability", () => {
  const items = [item("a", "Algebra"), item("b", "Biology")];
  const preferences = {
    ...r.emptyPreferences(),
    feedback: [feedback("a", 1)],
    outcomes: [
      { itemId: "a", useful: false, at },
      { itemId: "b", useful: true, at },
      { itemId: "gone", useful: true, at },
    ],
  };
  const result = r.recommend(items, emptyLearning(), preferences, now);
  assert.equal(result.ratings, 1);
  assert.deepEqual(result.outcomes, { total: 2, useful: 1 });
  assert.equal(result.items.find((x) => x.item.id === "a").outcome, false);
  assert.equal(result.items.find((x) => x.item.id === "a").evidence.total, 0);
});
test("Per-request disclosure contains only prepared data categories and no unknown payload fields", () => {
  const d = load("lib/lumio/outbound-disclosure.ts");
  assert.deepEqual(
    d.outboundCategories({
      action: "chat",
      sourceCharacters: 50,
      questionCharacters: 5,
      historyMessages: 2,
      mediaKind: "image",
      password: "secret",
    }),
    ["source", "question", "history", "image", "options"],
  );
  assert.deepEqual(
    d.outboundCategories({
      action: "summary",
      sourceCharacters: 0,
      historyMessages: 2,
      videoUrl: true,
    }),
    ["videoUrl", "options"],
  );
  assert.deepEqual(
    d.outboundCategories({
      action: "quiz",
      sourceCharacters: NaN,
      questionCharacters: -1,
    }),
    ["options"],
  );
  assert.deepEqual(
    d.outboundCategories({
      action: "transcription",
      sourceCharacters: 50,
      historyMessages: 2,
    }),
    ["audio", "options"],
  );
  assert.deepEqual(
    d.outboundCategories({
      action: "speech",
      sourceCharacters: 50,
      mediaKind: "pdf",
    }),
    ["speechText", "options"],
  );
});

// A small hook scheduler exercises lifecycle/account races without a browser or provider.
function hookHarness() {
  const slots = [],
    pending = [],
    listeners = new Set(),
    storage = new Map();
  let cursor = 0,
    account;
  const same = (a, b) =>
    a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots))
        slots[i] = typeof initial === "function" ? initial() : initial;
      return [
        slots[i],
        (value) => {
          slots[i] = typeof value === "function" ? value(slots[i]) : value;
        },
      ];
    },
    useRef(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = { current: initial };
      return slots[i];
    },
    useCallback(fn, deps) {
      const i = cursor++;
      if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { deps, fn };
      return slots[i].fn;
    },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!slots[i] || !same(slots[i].deps, deps)) {
        const old = slots[i];
        slots[i] = { deps, cleanup: old?.cleanup };
        pending.push(() => {
          old?.cleanup?.();
          slots[i].cleanup = fn();
        });
      }
    },
  };
  global.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  };
  global.window = {
    addEventListener: (event, fn) => listeners.add(fn),
    removeEventListener: (event, fn) => listeners.delete(fn),
  };
  const { usePersonalization } = load(
    "components/lumio/use-personalization.ts",
    { react, "../../lib/lumio/recommendations": r },
  );
  const render = (next) => {
    account = next ?? account;
    cursor = 0;
    return usePersonalization(account);
  };
  return {
    storage,
    render,
    flush() {
      while (pending.length) pending.shift()();
      return render();
    },
    event(key) {
      listeners.forEach((fn) => fn({ key }));
      return render();
    },
    close() {
      delete global.localStorage;
      delete global.window;
    },
  };
}
test("Hook never reveals or writes old-account feedback during a switch or corrupt load", () => {
  const h = hookHarness();
  try {
    h.storage.set(
      r.preferenceKey("one"),
      JSON.stringify({
        version: 1,
        enabled: false,
        feedback: [feedback("private", 1)],
      }),
    );
    h.render("one");
    const old = h.flush();
    assert.equal(old.state.feedback.length, 1);
    h.storage.set(r.preferenceKey("two"), "not json");
    const fresh = h.render("two");
    assert.deepEqual(fresh.state.feedback, []);
    const before = h.storage.get(r.preferenceKey("one"));
    old.update({ ...r.emptyPreferences(), feedback: [] });
    fresh.update(r.emptyPreferences());
    assert.equal(h.storage.get(r.preferenceKey("one")), before);
    assert.equal(h.storage.get(r.preferenceKey("two")), "not json");
    const failed = h.flush();
    assert.equal(failed.error, true);
    assert.deepEqual(failed.state.feedback, []);
    failed.update(r.emptyPreferences());
    assert.equal(h.storage.get(r.preferenceKey("two")), "not json");
    failed.update(r.emptyPreferences(), true);
    assert.equal(h.render().error, false);
    assert.equal(
      JSON.parse(h.storage.get(r.preferenceKey("two"))).enabled,
      true,
    );
  } finally {
    h.close();
  }
});
test("Hook respects cross-tab clear and merges against freshly stored preferences", () => {
  const h = hookHarness();
  try {
    h.render("one");
    let state = h.flush();
    state.update({ ...r.emptyPreferences(), feedback: [feedback("a", 1)] });
    h.storage.set(
      r.preferenceKey("one"),
      JSON.stringify({ ...r.emptyPreferences(), feedback: [feedback("b", 0)] }),
    );
    state.update((p) => ({
      ...p,
      feedback: [...p.feedback, feedback("c", 1)],
    }));
    assert.deepEqual(
      h.render().state.feedback.map((f) => f.itemId),
      ["b", "c"],
    );
    h.storage.clear();
    state = h.event(null);
    assert.deepEqual(state.state.feedback, []);
    state.update((p) => ({ ...p, enabled: false }));
    assert.deepEqual(
      JSON.parse(h.storage.get(r.preferenceKey("one"))).feedback,
      [],
    );
  } finally {
    h.close();
  }
});
console.log(
  `${passed} recommendations checks passed; local deterministic data only, no network.`,
);
