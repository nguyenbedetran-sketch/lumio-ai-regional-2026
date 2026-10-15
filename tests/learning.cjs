const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const source = fs.readFileSync(
  path.join(__dirname, "../lib/lumio/learning-engine.ts"),
  "utf8",
);
const mod = { exports: {} };
new Function(
  "exports",
  "module",
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText,
)(mod.exports, mod);
const e = mod.exports,
  now = new Date("2026-09-20T12:00:00+07:00");
let passed = 0;
function test(name, run) {
  run();
  console.log(`PASS ${name}`);
  passed++;
}
const item = {
  id: "lesson",
  title: "Lesson",
  cards: [{ id: "one", front: "Question", back: "Answer" }],
  attempts: [],
};
test("Storage isolates exact account namespaces", () => {
  assert.notEqual(e.learningKey("google:one"), e.learningKey("google:two"));
  assert.notEqual(e.learningKey("guest"), e.learningKey("google:guest"));
  assert.notEqual(e.learningKey("a:b"), e.learningKey("a%3Ab"));
});
test("No progress invented for a new learner", () => {
  const m = e.learningMetrics([item], e.emptyLearning(), now);
  assert.equal(m.accuracy, null);
  assert.equal(m.streak, 0);
  assert.equal(m.focusMinutes, 0);
  assert.equal(m.reviews, 0);
  assert.equal(
    m.week.reduce((n, d) => n + d.count, 0),
    0,
  );
});
test("Only completed quiz evidence changes accuracy", () => {
  const m = e.learningMetrics(
    [
      {
        ...item,
        attempts: [
          { date: now.toISOString(), score: 3, total: 4 },
          { date: now.toISOString(), score: 1, total: 2 },
        ],
      },
    ],
    e.emptyLearning(),
    now,
  );
  assert.equal(m.accuracy, 67);
  assert.equal(m.correct, 4);
  assert.equal(m.total, 6);
  assert.equal(m.streak, 1);
  assert.equal(m.topics[0].attempts, 2);
});
test("Streak preserves yesterday and breaks at missed days", () => {
  const localToday = e.dayKey(now),
    event = (id, day) => ({
      id,
      kind: "goal",
      at: new Date(`${day}T12:00:00`).toISOString(),
    });
  const s = {
    ...e.emptyLearning(),
    events: [
      event("1", e.shiftDay(localToday, -1)),
      event("2", e.shiftDay(localToday, -2)),
      event("3", e.shiftDay(localToday, -4)),
    ],
  };
  assert.equal(e.learningMetrics([], s, now).streak, 2);
  assert.equal(
    e.learningMetrics([], s, new Date(`${e.shiftDay(localToday, 1)}T12:00:00`))
      .streak,
    0,
  );
});
test("Recall ratings schedule real different intervals", () => {
  const card = {
    itemId: "lesson",
    cardId: "one",
    fingerprint: e.cardFingerprint("Question", "Answer"),
  };
  const again = e.scheduleReview(undefined, "again", card, now),
    good = e.scheduleReview(undefined, "good", card, now),
    easy = e.scheduleReview(undefined, "easy", card, now);
  assert.equal(Date.parse(again.dueAt) - now.getTime(), 600000);
  assert.equal(good.interval, 1);
  assert.equal(easy.interval, 4);
  const second = e.scheduleReview(good, "good", card, now),
    third = e.scheduleReview(second, "good", card, now);
  assert.equal(second.interval, 3);
  assert.ok(third.interval > second.interval);
  assert.ok(
    e.scheduleReview(third, "hard", card, now).interval < third.interval * 2,
  );
});
test("Due queue excludes scheduled cards, notices edited answers and deleted cards", () => {
  const card = {
    itemId: "lesson",
    cardId: "one",
    fingerprint: e.cardFingerprint("Question", "Answer"),
  };
  const s = {
    ...e.emptyLearning(),
    reviews: [e.scheduleReview(undefined, "good", card, now)],
  };
  assert.equal(e.dueCards([item], s, now).length, 0);
  assert.equal(
    e.dueCards(
      [{ ...item, cards: [{ ...item.cards[0], back: "Changed answer" }] }],
      s,
      now,
    ).length,
    1,
  );
  assert.equal(e.dueCards([{ ...item, cards: [] }], s, now).length, 0);
  assert.equal(
    e.dueCards([item], s, new Date(now.getTime() + 86400001)).length,
    1,
  );
});
test("Backups round trip goals, schedules, events and paused timer", () => {
  const s = {
    ...e.emptyLearning(),
    tasks: [
      {
        id: "task",
        title: "Understand quadratics",
        date: e.dayKey(now),
        minutes: 25,
        itemId: "lesson",
        done: false,
        createdAt: now.toISOString(),
      },
    ],
    focus: { id: "focus", seconds: 1500, remaining: 1200, deadline: null },
    events: [
      { id: "r", kind: "review", at: now.toISOString(), rating: "good" },
    ],
  };
  assert.deepEqual(e.parseLearning(JSON.parse(JSON.stringify(s))), s);
});
test("Corrupt backup is rejected without replacing saved evidence", () => {
  const s = {
    ...e.emptyLearning(),
    tasks: [
      {
        id: "task",
        title: "Learn",
        date: "2026-02-30",
        minutes: 25,
        itemId: "",
        done: false,
        createdAt: now.toISOString(),
      },
    ],
  };
  assert.throws(() => e.parseLearning(s));
  assert.throws(() =>
    e.parseLearning({
      ...e.emptyLearning(),
      events: [{ id: "r", at: "not a date", kind: "focus" }],
    }),
  );
  assert.throws(() =>
    e.parseLearning({
      ...e.emptyLearning(),
      focus: { id: "f", seconds: 1500, remaining: -1, deadline: null },
    }),
  );
});
test("Meaningful activity is deduplicated per material, type and local day", () => {
  const today = new Date(2026, 8, 20, 23, 59, 40);
  const first = e.recordStudyActivity(
    e.emptyLearning(),
    "read",
    "lesson",
    today,
  );
  assert.equal(first.events.length, 1);
  assert.equal(
    e.recordStudyActivity(
      first,
      "read",
      "lesson",
      new Date(today.getTime() + 10000),
    ),
    first,
  );
  const nextDay = e.recordStudyActivity(
    first,
    "read",
    "lesson",
    new Date(today.getTime() + 40000),
  );
  assert.equal(nextDay.events.length, 2);
  assert.equal(
    e.learningMetrics([], nextDay, new Date(today.getTime() + 50000)).streak,
    2,
  );
  assert.equal(e.recordStudyActivity(first, "login", "lesson", today), first);
  assert.equal(e.recordStudyActivity(first, "notes", "", today), first);
  assert.equal(e.learningMetrics([], first, today).todayActive, true);
});
test("Saved summary evidence recovers prior learning without inventing visits or doubling activity", () => {
  const saved = {
    ...item,
    lastOpenedAt: now.toISOString(),
    artifacts: [
      {
        id: "summary",
        kind: "summary",
        createdAt: now.toISOString(),
        summary: { overview: "An actual saved explanation" },
      },
    ],
  };
  const initial = e.learningMetrics([saved], e.emptyLearning(), now);
  assert.equal(initial.streak, 1);
  assert.equal(initial.week.at(-1).count, 1);
  const state = e.recordStudyActivity(
    e.emptyLearning(),
    "summary",
    "lesson",
    now,
  );
  assert.equal(e.learningMetrics([saved], state, now).week.at(-1).count, 1);
  assert.equal(
    e.learningMetrics(
      [{ ...item, lastOpenedAt: now.toISOString() }],
      e.emptyLearning(),
      now,
    ).streak,
    0,
  );
  assert.equal(
    e.learningMetrics(
      [
        {
          ...saved,
          artifacts: [{ ...saved.artifacts[0], summary: { overview: "" } }],
        },
      ],
      e.emptyLearning(),
      now,
    ).streak,
    0,
  );
});
test("A quiz event and its stored result count as one interaction; future data cannot advance a streak", () => {
  const state = e.recordStudyActivity(e.emptyLearning(), "quiz", "lesson", now);
  const lesson = {
    ...item,
    attempts: [{ date: now.toISOString(), score: 1, total: 2 }],
  };
  assert.equal(e.learningMetrics([lesson], state, now).week.at(-1).count, 1);
  const future = new Date(now.getTime() + 86400000);
  assert.equal(
    e.learningMetrics(
      [],
      e.recordStudyActivity(e.emptyLearning(), "chat", "lesson", future),
      now,
    ).streak,
    0,
  );
});
test("Recorded local date survives timezone changes and does not depend on elapsed 24-hour periods", () => {
  const localToday = e.dayKey(now);
  const state = {
    ...e.emptyLearning(),
    events: [
      {
        id: "timezone",
        kind: "read",
        itemId: "lesson",
        at: new Date(now.getTime() - 3600000).toISOString(),
        localDay: e.shiftDay(localToday, -1),
      },
    ],
  };
  const metrics = e.learningMetrics([], state, now);
  assert.equal(metrics.streak, 1);
  assert.equal(metrics.todayActive, false);
  assert.equal(metrics.week.at(-2).count, 1);
  assert.equal(e.shiftDay("2026-03-01", -1), "2026-02-28");
  assert.equal(e.shiftDay("2024-03-01", -1), "2024-02-29");
});
test("Timer completion is once only, including reload, and a reset or paused timer adds no progress", () => {
  const deadline = now.getTime();
  const active = {
    ...e.emptyLearning(),
    focus: { id: "session", seconds: 1500, remaining: 1500, deadline },
  };
  assert.equal(e.finishFocus(active, "session", deadline - 1), active);
  assert.equal(e.finishFocus(active, "another-session", deadline), active);
  const paused = {
    ...active,
    focus: { ...active.focus, deadline: null, remaining: 300 },
  };
  assert.equal(e.finishFocus(paused, "session", deadline + 10000), paused);
  const finished = e.finishFocus(active, "session", deadline);
  assert.equal(finished.focus, null);
  assert.equal(finished.events.length, 1);
  assert.equal(finished.events[0].minutes, 25);
  assert.equal(finished.events[0].localDay, e.dayKey(now));
  assert.equal(
    e.finishFocus(
      e.parseLearning(JSON.parse(JSON.stringify(finished))),
      "session",
      deadline + 10000,
    ).events.length,
    1,
  );
  const restored = e.finishFocus(
    { ...active, events: finished.events },
    "session",
    deadline,
  );
  assert.equal(restored.events.length, 1);
  assert.equal(e.learningMetrics([], finished, now).focusMinutes, 25);
});
test("Alarm preferences round trip with old backups supported and unsafe values rejected", () => {
  assert.deepEqual(e.parseLearning(e.emptyLearning()), e.emptyLearning());
  const state = {
    ...e.emptyLearning(),
    alarm: { preset: "custom", volume: 0.75, customName: "bell.wav" },
  };
  assert.deepEqual(e.parseLearning(JSON.parse(JSON.stringify(state))), state);
  assert.throws(() =>
    e.parseLearning({ ...state, alarm: { preset: "chime", volume: 2 } }),
  );
  assert.throws(() =>
    e.parseLearning({ ...state, alarm: { preset: "remote-url", volume: 0.5 } }),
  );
  assert.throws(() =>
    e.parseLearning({
      ...state,
      events: [
        {
          id: "bad",
          kind: "read",
          at: now.toISOString(),
          localDay: "2026-02-30",
        },
      ],
    }),
  );
  assert.throws(() =>
    e.parseLearning({
      ...state,
      focus: { id: "bad", seconds: 300, remaining: 400, deadline: null },
    }),
  );
});
console.log(`${passed} learning checks passed.`);
