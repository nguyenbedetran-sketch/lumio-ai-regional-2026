const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
// Transpile only project TS modules in memory; no network or real credentials.
const root = path.resolve(__dirname, "..");
const cache = new Map();
function load(relative) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  new Function("require", "module", "exports", code)(
    (name) => {
      if (name.startsWith("."))
        return load(
          path.relative(
            root,
            path.resolve(path.dirname(filename), name + ".ts"),
          ),
        );
      return require(name);
    },
    module,
    module.exports,
  );
  return module.exports;
}
async function main() {
  const c = load("lib/ai/contracts.ts"),
    r = load("lib/ai/router.ts");
  const storage = load("lib/lumio/storage.ts"),
    types = load("lib/lumio/types.ts");
  let passed = 0;
  async function test(name, fn) {
    await fn();
    console.log("PASS " + name);
    passed++;
  }
  const input = c.validateInput({
    task: "chat",
    source: "A triangle has three sides.",
    question: "How many sides?",
    language: "vi",
  });
  await test("Routing respects media and requested task", () => {
    assert.equal(c.chooseProvider(input), "openai");
    assert.equal(c.chooseProvider({ ...input, task: "summary" }), "gemini");
    assert.equal(
      c.chooseProvider({
        ...input,
        media: { mimeType: "image/png", data: "YWJj" },
      }),
      "gemini",
    );
  });
  await test("Rejects unsupported language, oversized source and invalid media", () => {
    for (const patch of [
      { language: "unknown" },
      { source: "x".repeat(200001) },
      { media: { mimeType: "text/html", data: "YWJj" } },
      { task: "execute" },
    ])
      assert.throws(() => c.validateInput({ ...input, ...patch }));
  });
  await test("Structured questions must have four options and valid answer", () => {
    assert.throws(() =>
      c.validateStructured(
        "quiz",
        JSON.stringify({
          questions: [
            { prompt: "Q", options: ["A"], correct: 9, explanation: "E" },
          ],
        }),
      ),
    );
    assert.equal(
      c.validateStructured("cards", '{"cards":[{"front":"Q","back":"A"}]}')
        .cards.length,
      1,
    );
  });
  await test("Disabled AI never contacts a provider", async () => {
    process.env.LUMIO_AI_ENABLED = "false";
    await assert.rejects(
      () =>
        r.routeAI(input, () => {
          throw new Error("Unexpected request");
        }),
      (e) => e.code === "AI_DISABLED",
    );
  });
  process.env.LUMIO_AI_ENABLED = "true";
  process.env.OPENAI_API_KEY = "dummy-test-credential";
  process.env.OPENAI_MODEL = "test-model";
  process.env.GEMINI_API_KEY = "dummy-test-credential";
  process.env.GEMINI_MODEL = "test-model";
  await test("OpenAI request keeps key server-side and disables response storage", async () => {
    const result = await r.routeAI(input, async (url, opts) => {
      assert.equal(url, "https://api.openai.com/v1/responses");
      const body = JSON.parse(opts.body);
      assert.equal(body.store, false);
      assert.equal(body.model, "test-model");
      assert.ok(!opts.body.includes("dummy-test-credential"));
      return Response.json({
        output: [{ content: [{ type: "output_text", text: "Three sides." }] }],
      });
    });
    assert.equal(result.text, "Three sides.");
    assert.ok(!JSON.stringify(result).includes("credential"));
  });
  await test("Gemini receives media as inline data", async () => {
    const result = await r.routeAI(
      { ...input, media: { mimeType: "image/png", data: "YWJj" } },
      async (url, opts) => {
        assert.ok(url.startsWith("https://generativelanguage.googleapis.com/"));
        assert.equal(
          JSON.parse(opts.body).contents[0].parts[1].inlineData.mimeType,
          "image/png",
        );
        return Response.json({
          candidates: [
            {
              finishReason: "STOP",
              content: { parts: [{ text: "A triangle." }] },
            },
          ],
        });
      },
    );
    assert.equal(result.provider, "gemini");
  });
  await test("Provider errors and malformed output cannot become valid answers", async () => {
    await assert.rejects(
      () =>
        r.routeAI(
          input,
          async () => new Response("private upstream details", { status: 401 }),
        ),
      (e) => e.code === "PROVIDER_AUTH_ERROR" && !e.message.includes("private"),
    );
    await assert.rejects(
      () =>
        r.routeAI({ ...input, task: "quiz" }, async () =>
          Response.json({
            output: [{ content: [{ type: "output_text", text: "not JSON" }] }],
          }),
        ),
      (e) => e.code === "INVALID_AI_OUTPUT",
    );
  });
  await test("Backups preserve study data and omit binary attachments", () => {
    const item = types.createItem({
      title: "Lesson",
      kind: "text",
      text: "A triangle has three sides.",
      spaceId: "",
    });
    item.blob = new Blob(["local file"]);
    item.notes = "Review";
    const backup = storage.exportLibrary({
      version: 1,
      spaces: [],
      items: [item],
    });
    const restored = storage.importLibrary(backup);
    assert.equal(restored.items[0].notes, "Review");
    assert.equal(restored.items[0].blob, undefined);
    const bad = JSON.parse(backup);
    bad.items[0].url = "javascript:alert(1)";
    assert.throws(() => storage.importLibrary(JSON.stringify(bad)));
    bad.items[0].url = "";
    bad.items.push(bad.items[0]);
    assert.throws(() => storage.importLibrary(JSON.stringify(bad)));
  });
  await test("CSV export quotes text and neutralizes spreadsheet formulas", () => {
    const { cardsCSV } = load("lib/lumio/enhancements.ts");
    const csv = cardsCSV([{ front: "=1+1", back: 'A "quote", and\nnew line' }]);
    assert.ok(csv.includes('"\'=1+1"'));
    assert.ok(csv.includes('A ""quote"", and\nnew line'));
  });
  console.log(`${passed} checks passed; mocked providers only.`);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
