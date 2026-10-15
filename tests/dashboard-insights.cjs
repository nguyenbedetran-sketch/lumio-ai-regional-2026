const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const cache = new Map();
function load(relative) {
  const filename = path.resolve(__dirname, relative);
  if (cache.has(filename)) return cache.get(filename);
  const mod = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  new Function("exports", "module", "require", source)(
    mod.exports,
    mod,
    (name) =>
      load(
        path.relative(
          __dirname,
          path.resolve(path.dirname(filename), name + ".ts"),
        ),
      ),
  );
  cache.set(filename, mod.exports);
  return mod.exports;
}
const { dashboardInsights } = load("../lib/lumio/dashboard-insights.ts");
const { dashboardCopy } = load("../lib/lumio/dashboard-v3-copy.ts");
const { emptyLearning, dayKey, cardKey, cardFingerprint } = load(
  "../lib/lumio/learning-engine.ts",
);
const now = new Date("2026-10-03T12:00:00+07:00");
function item(id, values = {}) {
  return {
    id,
    title: `Material ${id}`,
    kind: "text",
    spaceId: "",
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
    text: "",
    notes: "",
    cards: [],
    questions: [],
    attempts: [],
    favorite: false,
    ...values,
  };
}
function goal(id, values = {}) {
  return {
    id,
    title: `Goal ${id}`,
    date: dayKey(now),
    minutes: 25,
    itemId: "",
    done: false,
    createdAt: "2026-09-01T00:00:00Z",
    ...values,
  };
}
function result(items = [], values = {}) {
  return dashboardInsights(items, { ...emptyLearning(), ...values }, now);
}
const card = { id: "card", front: "Question", back: "Answer" };
let passed = 0;
function test(name, run) {
  run();
  console.log(`PASS ${name}`);
  passed++;
}

test("A new learner has no manufactured goals, activity or accuracy", () => {
  const insight = result();
  assert.equal(insight.action.kind, "start");
  assert.equal(insight.goalPercent, 0);
  assert.equal(insight.quizAttempts, 0);
  assert.equal(insight.reviewCount, 0);
  assert.deepEqual(insight.recent, []);
});
test("An active timer takes priority over due cards without adding focus evidence", () => {
  const insight = result([item("a", { cards: [card] })], {
    focus: {
      id: "timer",
      seconds: 1500,
      remaining: 1500,
      deadline: now.getTime() + 60_100,
    },
  });
  assert.equal(insight.action.kind, "focus");
  assert.equal(insight.action.remainingMinutes, 2);
  assert.equal(insight.due.length, 1);
});
test("A paused timer can be resumed; an expired timer cannot displace review", () => {
  assert.equal(
    result([], {
      focus: { id: "timer", seconds: 1500, remaining: 91, deadline: null },
    }).action.remainingMinutes,
    2,
  );
  assert.equal(
    result([item("a", { cards: [card] })], {
      focus: {
        id: "timer",
        seconds: 1500,
        remaining: 1500,
        deadline: now.getTime() - 1,
      },
    }).action.kind,
    "review",
  );
});
test("Due review uses the supplied snapshot and ignores a future review", () => {
  const saved = {
    key: cardKey("a", card.id),
    itemId: "a",
    cardId: card.id,
    fingerprint: cardFingerprint(card.front, card.back),
    interval: 1,
    ease: 2.5,
    repetitions: 1,
    reviewedAt: "2026-10-02T12:00:00Z",
    dueAt: new Date(now.getTime() + 1).toISOString(),
  };
  assert.equal(
    result([item("a", { cards: [card] })], { reviews: [saved] }).action.kind,
    "continue",
  );
  saved.dueAt = now.toISOString();
  assert.equal(
    result([item("a", { cards: [card] })], { reviews: [saved] }).action.kind,
    "review",
  );
});
test("Only today's pending goals are chosen; removed linked resources fall back safely", () => {
  const insight = result([item("a")], {
    tasks: [
      goal("past", { date: "2026-10-02" }),
      goal("done", { done: true }),
      goal("pending", { itemId: "deleted" }),
      goal("next"),
    ],
  });
  assert.equal(insight.action.kind, "goal");
  assert.equal(insight.action.task.id, "pending");
  assert.equal(insight.action.item, undefined);
  assert.equal(insight.completedGoals, 1);
  assert.equal(insight.goalPercent, 33);
});
test("A linked goal opens its actual current material", () => {
  const resource = item("a");
  assert.equal(
    result([resource], { tasks: [goal("linked", { itemId: "a" })] }).action
      .item,
    resource,
  );
});
test("Practice advice excludes future, corrupt and negative quiz evidence", () => {
  const insight = result([
    item("a", {
      attempts: [
        { date: "invalid", score: 0, total: 10 },
        { date: "2027-01-01T00:00:00Z", score: 0, total: 10 },
        { date: "2026-10-01T00:00:00Z", score: -1, total: 10 },
        { date: "2026-10-01T00:00:00Z", score: 11, total: 10 },
      ],
    }),
  ]);
  assert.equal(insight.action.kind, "continue");
  assert.equal(insight.quizAttempts, 0);
});
test("Practice advice uses the latest three attempts by time and weighted question totals", () => {
  const insight = result([
    item("a", {
      attempts: [
        { date: "2026-10-02T00:00:00Z", score: 1, total: 2 },
        { date: "2026-09-01T00:00:00Z", score: 100, total: 100 },
        { date: "2026-10-01T00:00:00Z", score: 1, total: 2 },
        { date: "2026-10-03T00:00:00Z", score: 2, total: 6 },
      ],
    }),
  ]);
  assert.equal(insight.action.kind, "practice");
  assert.equal(insight.action.accuracy, 40);
  assert.equal(insight.action.attempts, 3);
  assert.equal(insight.quizAttempts, 4);
});
test("An 80 percent result is not labelled as a weak topic", () => {
  const insight = result([
    item("a", {
      attempts: [{ date: "2026-10-01T00:00:00Z", score: 8, total: 10 }],
    }),
  ]);
  assert.equal(insight.action.kind, "continue");
  assert.equal(insight.weakTopic, undefined);
});
test("Recent materials use opened time, ignore future timestamps and resolve ties by ID", () => {
  const insight = result([
    item("z"),
    item("b", {
      updatedAt: "2026-09-29T00:00:00Z",
      lastOpenedAt: "2027-01-01T00:00:00Z",
    }),
    item("a", { lastOpenedAt: "2026-10-01T00:00:00Z" }),
    item("c", { lastOpenedAt: "2026-10-01T00:00:00Z" }),
  ]);
  assert.deepEqual(
    insight.recent.map((entry) => entry.id),
    ["a", "c", "b"],
  );
  assert.equal(insight.action.item.id, "a");
});
test("Review counters deduplicate saved event IDs and exclude future events", () => {
  const events = [
    { id: "one", kind: "review", at: "2026-10-01T00:00:00Z" },
    { id: "one", kind: "review", at: "2026-10-01T00:00:00Z" },
    { id: "two", kind: "review", at: "2027-01-01T00:00:00Z" },
    { id: "goal", kind: "goal", at: "2026-10-01T00:00:00Z" },
  ];
  assert.equal(result([], { events }).reviewCount, 1);
});
test("A recently updated material is not hidden by an older opened timestamp", () => {
  const insight = result([
    item("opened", { lastOpenedAt: "2026-10-01T00:00:00Z" }),
    item("updated", {
      lastOpenedAt: "2026-09-01T00:00:00Z",
      updatedAt: "2026-10-02T00:00:00Z",
    }),
  ]);
  assert.equal(insight.action.item.id, "updated");
});
test("Suggestion computation is deterministic and never mutates saved input", () => {
  const materials = [
    item("b"),
    item("a", {
      attempts: [{ date: "2026-10-01T00:00:00Z", score: 3, total: 10 }],
    }),
  ];
  const state = { ...emptyLearning(), tasks: [goal("one")] };
  const before = JSON.stringify({ materials, state });
  assert.deepEqual(
    dashboardInsights(materials, state, now),
    dashboardInsights(materials, state, now),
  );
  assert.equal(JSON.stringify({ materials, state }), before);
});
test("New dashboard copy is complete in all five supported languages", () => {
  assert.deepEqual(Object.keys(dashboardCopy).sort(), [
    "en",
    "ja",
    "ko",
    "vi",
    "zh-CN",
  ]);
  for (const copy of Object.values(dashboardCopy)) {
    assert.deepEqual(
      Object.keys(copy).sort(),
      Object.keys(dashboardCopy.en).sort(),
    );
    assert(
      Object.values(copy).every(
        (value) => typeof value === "string" && value.trim(),
      ),
    );
  }
});
console.log(`${passed} dashboard insight checks passed.`);
