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
const { studyControls } = load("lib/lumio/study-setup.ts"),
  { emptyPreferences, parsePreferences } = load("lib/lumio/recommendations.ts"),
  { buildLearningPlan } = load("lib/lumio/learning-plan.ts"),
  { emptyLearning } = load("lib/lumio/learning-engine.ts"),
  search = load("lib/lumio/command-search.ts"),
  { normalizeSyncEnvelope } = load("lib/sync/contracts.ts");
const item = (id, values = {}) => ({
  id,
  title: id,
  kind: "text",
  text: "",
  notes: "",
  spaceId: "",
  createdAt: "2026-10-17T00:00:00Z",
  updatedAt: "2026-10-17T00:00:00Z",
  cards: [],
  questions: [],
  attempts: [],
  favorite: false,
  ...values,
});
let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log("PASS " + name);
}
test("Goal setup uses the canonical controls codec and round-trips existing preferences", () => {
  const controls = studyControls({
      topics: " Đại số, Chuyển động ",
      goal: "practice",
      difficulty: "beginner",
    }),
    base = {
      ...emptyPreferences(),
      feedback: [{ itemId: "private", value: 1, at: "2026-10-17T00:00:00Z" }],
    };
  assert.deepEqual(controls, {
    topics: ["Đại số", "Chuyển động"],
    goal: "practice",
    difficulty: "beginner",
  });
  assert.deepEqual(
    parsePreferences({ ...base, controls }).feedback,
    base.feedback,
  );
  assert.equal(base.controls, undefined);
});
test("Closed goal/level enums and duplicate/oversized topics are rejected", () => {
  for (const value of [
    { goal: "graduate", difficulty: "any", topics: "" },
    { goal: "practice", difficulty: "expert", topics: "" },
    { goal: "review", difficulty: "any", topics: "math, MATH" },
    { goal: "review", difficulty: "any", topics: "a".repeat(81) },
    {
      goal: "review",
      difficulty: "any",
      topics: Array.from({ length: 9 }, (_, i) => String(i)).join(","),
    },
  ])
    assert.throws(() => studyControls(value), /INVALID_PREFERENCES/);
});
test("Version-1 defaults remain valid and setup creates no learning events or scores", () => {
  const learning = emptyLearning(),
    before = JSON.stringify(learning);
  assert.equal(parsePreferences(emptyPreferences()).controls, undefined);
  buildLearningPlan([], learning, {
    ...emptyPreferences(),
    controls: studyControls({
      topics: "",
      difficulty: "any",
      goal: "practice",
    }),
  });
  assert.equal(JSON.stringify(learning), before);
});
test("Declared practice goal selects matching topic and declared level without inventing mastery", () => {
  const q = {
      id: "q",
      prompt: "Equation",
      options: ["1", "2"],
      correct: 0,
      explanation: "A synthetic example",
      topic: "Đại số",
      difficulty: "beginner",
    },
    items = [
      item("unrelated", { questions: [{ ...q, topic: "Geometry" }] }),
      item("chosen", { questions: [q] }),
    ],
    p = {
      ...emptyPreferences(),
      controls: studyControls({
        topics: "dai so",
        difficulty: "beginner",
        goal: "practice",
      }),
    },
    before = JSON.stringify(items),
    plan = buildLearningPlan(items, emptyLearning(), p);
  assert.equal(plan.primary.item.id, "chosen");
  assert.equal(plan.primary.reason, "goal");
  assert.equal(plan.primary.kind, "practice");
  assert.equal(plan.primary.errors, 0);
  assert.equal(JSON.stringify(items), before);
});
test("Unlabelled quiz level cannot be advertised as a match for a chosen level", () => {
  const plan = buildLearningPlan(
    [
      item("unknown", {
        questions: [
          {
            id: "q",
            prompt: "Question",
            options: ["1", "2"],
            correct: 0,
            explanation: "",
            topic: "Math",
          },
        ],
      }),
    ],
    emptyLearning(),
    {
      ...emptyPreferences(),
      controls: studyControls({
        topics: "",
        difficulty: "advanced",
        goal: "practice",
      }),
    },
  );
  assert.notEqual(plan.primary?.reason, "goal");
});
test("Review/exploration goals produce real actions; opt-out ignores selected goals", () => {
  const items = [
      item("read", { text: "algebra" }),
      item("cards", { cards: [{ id: "c", front: "front", back: "back" }] }),
    ],
    controls = studyControls({ topics: "", difficulty: "any", goal: "review" });
  const plan = buildLearningPlan(items, emptyLearning(), {
    ...emptyPreferences(),
    controls,
  });
  assert.equal(plan.primary.item.id, "cards");
  assert.equal(plan.primary.kind, "review");
  assert.equal(plan.primary.reason, "goal");
  const off = buildLearningPlan(items, emptyLearning(), {
    ...emptyPreferences(),
    enabled: false,
    controls,
  });
  assert.notEqual(off.primary?.reason, "goal");
});
test("Goal controls use the existing text backup/sync envelope without another storage schema", () => {
  const p = {
      ...emptyPreferences(),
      controls: studyControls({
        topics: "math",
        difficulty: "any",
        goal: "explore",
      }),
    },
    data = normalizeSyncEnvelope({
      version: 1,
      library: { version: 1, items: [], spaces: [] },
      learning: emptyLearning(),
      preferences: p,
    });
  assert.deepEqual(data.preferences.controls, p.controls);
});
test("Command index searches saved card and quiz text without reading binary attachments", () => {
  const card = item("card", {
      cards: [{ id: "c", front: "Quang hợp", back: "Ánh sáng" }],
    }),
    question = item("quiz", {
      questions: [
        {
          id: "q",
          prompt: "What is refraction?",
          options: ["A", "B"],
          correct: 0,
          explanation: "A light direction change",
          topic: "Optics",
        },
      ],
    });
  Object.defineProperty(card, "blob", {
    get() {
      throw Error("must not read file bytes");
    },
  });
  const index = search.buildCommandIndex([card, question]);
  assert.equal(
    search.searchCommandItems(index, "quang hop").items[0].item.id,
    "card",
  );
  assert.equal(
    search.searchCommandItems(index, "direction change").items[0].item.id,
    "quiz",
  );
  assert.equal(
    search.searchCommandItems(index, "refraction").items[0].matchedIn,
    "study",
  );
});
test("Search text cap applies to generated study content and another workspace has no old entries", () => {
  const index = search.buildCommandIndex([
    item("private", {
      cards: [
        { id: "c", front: "x".repeat(12000), back: "secret-after-bound" },
      ],
    }),
  ]);
  assert.equal(search.searchCommandItems(index, "secret-after-bound").total, 0);
  assert.equal(
    search.searchCommandItems(
      search.buildCommandIndex([item("other")]),
      "private",
    ).total,
    0,
  );
});
test("Study task search is bounded, accent-aware, date-aware and nonmutating", () => {
  const tasks = [
      { id: "b", title: "Ôn Đại số", date: "2026-10-20", done: true },
      { id: "a", title: "Ôn Đại số", date: "2026-10-19", done: false },
    ],
    before = JSON.stringify(tasks);
  assert.deepEqual(
    search.searchCommandTasks(tasks, "on dai so").map((x) => x.id),
    ["a", "b"],
  );
  assert.deepEqual(
    search.searchCommandTasks(tasks, "2026-10-20").map((x) => x.id),
    ["b"],
  );
  assert.equal(search.searchCommandTasks(tasks, "").length, 0);
  assert.equal(JSON.stringify(tasks), before);
  assert.equal(
    search.searchCommandTasks(
      Array.from({ length: 50 }, (_, n) => ({ ...tasks[0], id: String(n) })),
      "dai so",
    ).length,
    20,
  );
});
test("Install manifest uses public actual-size branding and no private shortcuts or offline promise", () => {
  const manifest = load("app/manifest.ts").default(),
    meta = load("lib/metadata.ts").siteMetadata;
  assert.equal(meta.manifest, "/manifest.webmanifest");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.shortcuts, undefined);
  assert.equal(manifest.related_applications, undefined);
  for (const icon of manifest.icons) {
    const data = fs.readFileSync(path.join(root, "public", icon.src));
    assert.equal(
      icon.sizes,
      `${data.readUInt32BE(16)}x${data.readUInt32BE(20)}`,
    );
    assert.equal(icon.purpose, "any");
  }
  assert.equal(/offline/i.test(JSON.stringify(manifest)), false);
});
test("Shared setup and search scope copy cover all five locales without a server-class search claim", () => {
  const { studySetupCopy } = load("lib/lumio/study-setup-copy.ts"),
    { commandCopy } = load("lib/lumio/command-copy.ts");
  assert.deepEqual(Object.keys(studySetupCopy).sort(), [
    "en",
    "ja",
    "ko",
    "vi",
    "zh-CN",
  ]);
  for (const locale of Object.keys(studySetupCopy)) {
    assert.ok(studySetupCopy[locale].hint.length > 30);
    assert.ok(commandCopy[locale].tasks);
    assert.ok(commandCopy[locale].match.study);
  }
  assert.match(commandCopy.en.scope, /server classrooms are not searched/);
});
console.log(
  JSON.stringify({
    status: "PASS",
    checks: passed,
    scope:
      "Deterministic owned local workspace data and actual codecs/helpers; no provider, real user, or installed-device validation",
  }),
);
