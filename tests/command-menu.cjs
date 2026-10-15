const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function load(relative) {
  const source = fs.readFileSync(path.join(__dirname, relative), "utf8");
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
  return mod.exports;
}
const search = load("../lib/lumio/command-search.ts");
const { commandCopy } = load("../lib/lumio/command-copy.ts");
let passed = 0;
function test(name, run) {
  run();
  console.log(`PASS ${name}`);
  passed++;
}
function item(id, values = {}) {
  return {
    id,
    title: `Lesson ${id}`,
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
const find = (items, query, spaces) =>
  search.searchCommandItems(search.buildCommandIndex(items, spaces), query);

test("Vietnamese accents and crossed d match; exact titles outrank note matches", () => {
  const result = find(
    [
      item("notes", {
        notes: "đường thẳng",
        lastOpenedAt: "2026-09-27T00:00:00Z",
      }),
      item("title", { title: "Đường thẳng" }),
      item("prefix", { title: "Đường thẳng và hình học" }),
    ],
    "duong thang",
  );
  assert.deepEqual(
    result.items.map((entry) => entry.item.id),
    ["title", "prefix", "notes"],
  );
  assert.equal(result.items[2].matchedIn, "notes");
});
test("All words must match; terms may span title and notes", () => {
  const result = find(
    [
      item("both", { title: "Đại số", notes: "căn thức" }),
      item("one", { title: "Đại số" }),
    ],
    "dai can",
  );
  assert.deepEqual(
    result.items.map((entry) => entry.item.id),
    ["both"],
  );
});
test("File name and study space are searchable without reading binary blobs", () => {
  const file = item("file", {
    kind: "pdf",
    fileName: "Bài-tập-hình-học.pdf",
    spaceId: "s",
  });
  assert.equal(find([file], "bai-tap").items[0].matchedIn, "file");
  assert.equal(
    find([file], "Lop 9", [{ id: "s", name: "Lớp 9", color: "mint" }]).items[0]
      .matchedIn,
    "space",
  );
});
test("Chinese, Japanese and Korean titles retain literal search support", () => {
  for (const [title, query] of [
    ["数学学习", "数学"],
    ["数学のノート", "ノート"],
    ["수학 공부", "수학"],
  ])
    assert.equal(find([item("local", { title })], query).total, 1);
});
test("Duplicate titles keep separate stable identities", () => {
  const result = find(
    [item("one", { title: "Math" }), item("two", { title: "Math" })],
    "math",
  );
  assert.deepEqual(
    result.items.map((entry) => entry.item.id),
    ["one", "two"],
  );
});
test("An empty query returns six recent items deterministically", () => {
  const data = Array.from({ length: 9 }, (_, i) =>
    item(String(i), {
      lastOpenedAt: `2026-09-${String(i + 10).padStart(2, "0")}T00:00:00Z`,
    }),
  );
  const before = JSON.stringify(data);
  const result = find(data, "   ");
  assert.deepEqual(
    result.items.map((entry) => entry.item.id),
    ["8", "7", "6", "5", "4", "3"],
  );
  assert.equal(result.total, 9);
  assert.equal(JSON.stringify(data), before);
});
test("Malformed dates fall back to zero without unstable comparisons", () => {
  assert.deepEqual(
    find(
      [item("bad", { createdAt: "bad date" }), item("valid")],
      "lesson",
    ).items.map((entry) => entry.item.id),
    ["valid", "bad"],
  );
});
test("Results cap at twenty and preserve total match count", () => {
  const result = find(
    Array.from({ length: 35 }, (_, i) => item(String(i))),
    "lesson",
  );
  assert.equal(result.items.length, 20);
  assert.equal(result.total, 35);
});
test("Requested limits cannot exceed the cap or leak a negative slice", () => {
  const index = search.buildCommandIndex(
    Array.from({ length: 25 }, (_, i) => item(String(i))),
  );
  assert.equal(search.searchCommandItems(index, "lesson", -1).items.length, 0);
  assert.equal(
    search.searchCommandItems(index, "lesson", 10000).items.length,
    20,
  );
  assert.equal(
    search.searchCommandItems(index, "lesson", NaN).items.length,
    20,
  );
});
test("Regex-like input is literal and does not broaden matches", () => {
  assert.equal(
    find([item("literal", { title: "Use [.* safely" }), item("other")], "[.*")
      .total,
    1,
  );
});
test("Content limit is enforced independently for notes and source text", () => {
  const prefix = "x".repeat(search.COMMAND_CONTENT_LIMIT);
  const data = [
    item("late", {
      notes: prefix + "hiddenunique",
      text: prefix + "sourcehidden",
    }),
    item("visible", { notes: "visibleunique", text: "sourcevisible" }),
  ];
  assert.equal(find(data, "hiddenunique").total, 0);
  assert.equal(find(data, "sourcehidden").total, 0);
  assert.equal(find(data, "visibleunique").items[0].matchedIn, "notes");
  assert.equal(find(data, "sourcevisible").items[0].matchedIn, "text");
});
test("Input is bounded before Unicode normalization", () => {
  assert.equal(
    search.commandQuery("a".repeat(200)).length,
    search.COMMAND_QUERY_LIMIT,
  );
  assert.equal(search.commandFold("  ĐẠI\t SỐ \n"), "dai so");
});
test("Building an index for another account retains no old account entries", () => {
  const a = search.buildCommandIndex([
    item("a", { text: "privatefirstaccount" }),
  ]);
  const b = search.buildCommandIndex([item("b", { text: "secondaccount" })]);
  assert.equal(search.searchCommandItems(a, "privatefirstaccount").total, 1);
  assert.equal(search.searchCommandItems(b, "privatefirstaccount").total, 0);
});
test("Destination matching supports accent-insensitive labels and aliases", () => {
  assert.equal(
    search.commandMatches("giong noi", "Phòng giọng nói", ["voice"]),
    true,
  );
  assert.equal(
    search.commandMatches("voice", "Phòng giọng nói", ["voice"]),
    true,
  );
  assert.equal(
    search.commandMatches("voice math", "Phòng giọng nói", ["voice"]),
    false,
  );
});
test("Shortcut accepts Ctrl or Meta K including caps lock", () => {
  const event = {
    key: "k",
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
    isComposing: false,
    defaultPrevented: false,
  };
  assert.equal(search.isCommandShortcut(event), true);
  assert.equal(
    search.isCommandShortcut({
      ...event,
      ctrlKey: false,
      metaKey: true,
      key: "K",
    }),
    true,
  );
  assert.equal(search.isCommandShortcut({ ...event, ctrlKey: false }), false);
  assert.equal(search.isCommandShortcut({ ...event, key: "j" }), false);
});
test("Composition, handled events, repeats and alternate shortcuts are preserved", () => {
  const event = {
    key: "k",
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
    isComposing: false,
    defaultPrevented: false,
  };
  for (const field of [
    "altKey",
    "shiftKey",
    "repeat",
    "isComposing",
    "defaultPrevented",
  ])
    assert.equal(
      search.isCommandShortcut({ ...event, [field]: true }),
      false,
      field,
    );
});
test("Every supported locale supplies every label and all source kind names", () => {
  assert.deepEqual(Object.keys(commandCopy).sort(), [
    "en",
    "ja",
    "ko",
    "vi",
    "zh-CN",
  ]);
  for (const copy of Object.values(commandCopy)) {
    assert.deepEqual(
      Object.keys(copy).sort(),
      Object.keys(commandCopy.en).sort(),
    );
    assert.deepEqual(Object.keys(copy.kind).sort(), [
      "audio",
      "image",
      "link",
      "pdf",
      "text",
      "video",
    ]);
    assert.deepEqual(Object.keys(copy.match).sort(), [
      "file",
      "notes",
      "space",
      "text",
      "title",
    ]);
    for (const value of Object.values(copy))
      if (typeof value === "string") assert.ok(value.trim());
  }
});
console.log(`${passed} command menu checks passed.`);
