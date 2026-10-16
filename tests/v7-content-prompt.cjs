// Prompt/structure compatibility only; intercepted transport, not semantic proof.
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  ts = require("typescript");
const root = path.resolve(__dirname, ".."),
  cache = new Map(),
  checks = [];
function load(relative) {
  const file = path.resolve(root, relative);
  if (cache.has(file)) return cache.get(file).exports;
  const m = { exports: {} };
  cache.set(file, m);
  new Function(
    "require",
    "module",
    "exports",
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
  )(
    (name) =>
      name.startsWith(".")
        ? load(path.resolve(path.dirname(file), name + ".ts"))
        : require(name),
    m,
    m.exports,
  );
  return m.exports;
}
const ai = load("lib/ai/contracts.ts"),
  router = load("lib/ai/router.ts"),
  summary = load("lib/ai/summary.ts");
const source = "Mẫu số phải khác không. Với 1/(x-2), điều kiện là x khác 2.",
  quote = "Mẫu số phải khác không.",
  references = [{ segmentId: "s1", quote }];
const input = (task, patch = {}) =>
  ai.validateInput({
    task,
    source,
    question: "Tạo học liệu từ nguồn ngắn này.",
    language: "vi",
    mode: "quick",
    ...patch,
  });
const card = {
  front: "Mẫu số phải thỏa điều kiện gì?",
  back: quote,
  references,
};
const question = {
  prompt: "Mẫu số phải thỏa điều kiện gì?",
  options: ["Khác không", "Bằng không", "Luôn âm", "Luôn dương"],
  correct: 0,
  explanation: quote,
  difficulty: "beginner",
  topic: "Phân thức",
  references,
};
function shortSummary() {
  return {
    title: "Điều kiện của mẫu số",
    overview: quote,
    keyPoints: [quote],
    chapters: [
      { title: "Quy tắc", summary: quote, bullets: [quote], references },
    ],
    mindMap: {
      nodes: [
        { id: "root", label: "Phân thức", detail: quote },
        {
          id: "rule",
          label: "Mẫu số khác không",
          detail: quote,
          chapterIndex: 0,
        },
      ],
      edges: [{ source: "root", target: "rule" }],
    },
  };
}
async function check(name, run) {
  await run();
  checks.push({ name, status: "PASS" });
  console.log("PASS " + name);
}
async function main() {
  await check(
    "Learner cards and quiz use source-sized1–5 counts, never mandatory five",
    () => {
      for (const task of ["cards", "quiz"]) {
        const text = router.instructions(input(task));
        assert.match(text, /array of 1-5 objects/);
        assert.match(
          text,
          /one (?:card|question) is sufficient for one supported concept/,
        );
        assert.doesNotMatch(text, /array of 5 objects/);
        assert.match(text, /distinct supported concept/);
        assert.match(text, /No tautologies, padding or extra-source rationale/);
      }
    },
  );
  await check(
    "Short summaries allow one chapter/keypoint and two connected nodes without padding",
    () => {
      const text = router.instructions(input("summary"));
      assert.match(text, /keyPoints \(1-8 distinct supported strings\)/);
      assert.match(text, /chapters \(1-16 logical sections/);
      assert.match(text, /2-15 connected mind-map nodes/);
      assert.match(text, /one chapter, one key point and two nodes/);
      assert.match(
        text,
        /do not invent extra topics, examples, repetitive chapters or filler/,
      );
      assert.doesNotMatch(text, /3-8 strings|3-16 logical|5-15 connected/);
    },
  );
  await check(
    "All five learner languages retain conflict/context uncertainty and no invented reconciliation",
    () => {
      for (const language of ["vi", "en", "zh-CN", "ja", "ko"])
        for (const task of ["summary", "cards", "quiz"]) {
          const text = router.instructions(input(task, { language }));
          assert.ok(text.includes("Reply in language " + language));
          assert.match(text, /without choosing, averaging or reconciling/);
          assert.match(text, /context\/reason is unknown/);
          assert.match(text, /source order does not establish chronology/);
          assert.match(
            text,
            /Never invent different times, dates, conditions, authors, causes or measurement circumstances/,
          );
          assert.match(
            text,
            /Separate source observations from any explicitly labelled proposed inference/,
          );
          assert.match(
            text,
            /does not prove that the source entails surrounding claims/,
          );
        }
    },
  );
  await check(
    "Unrelated-goal scope note stays outside summary chapters/keypoints/map and card/quiz facts",
    () => {
      const text = router.instructions(
        input("summary", { question: "Núi lửa Sao Hỏa?" }),
      );
      assert.match(
        text,
        /assistant scope note in overview, separate from source observations/,
      );
      assert.match(
        text,
        /do not turn that note into a chapter, key point, map node or falsely sourced claim/,
      );
      for (const task of ["cards", "quiz"])
        assert.match(
          router.instructions(input(task)),
          /do not turn the scope limitation into a learning fact/,
        );
    },
  );
  await check(
    "Teacher exact-count workflow and stateful tutor policy remain separate",
    () => {
      const teacher = {
          ...input("chat"),
          teachingContext: { kind: "questions" },
        },
        text = router.instructions(teacher);
      assert.match(text, /Generate exactly the requested count/);
      assert.match(text, /choices:\[exactly four strings\]/);
      assert.doesNotMatch(text, /array of 1-5|SOURCE FIDELITY/);
      const tutor = router.instructions({
        ...input("chat"),
        tutorContext: {
          problem: "2x+3=11",
          hints: [],
          hintCount: 0,
          guidance: "hints",
        },
      });
      assert.match(tutor, /complete solution is LOCKED/);
      assert.doesNotMatch(tutor, /array of 1-5|SOURCE FIDELITY/);
    },
  );
  await check(
    "One cited card is accepted by unchanged structured validator",
    () => {
      const result = ai.validateStructured(
        "cards",
        JSON.stringify({ cards: [card] }),
        input("cards"),
      );
      assert.equal(result.cards.length, 1);
      assert.equal(result.cards[0].references[0].quote, quote);
    },
  );
  await check(
    "One cited quiz is accepted with its correct key preserved regardless of option order",
    () => {
      const result = ai.validateStructured(
        "quiz",
        JSON.stringify({ questions: [question] }),
        input("quiz"),
      );
      assert.equal(result.questions.length, 1);
      const q = result.questions[0];
      assert.equal(q.options[q.correct], "Khác không");
      assert.equal(q.references[0].quote, quote);
    },
  );
  await check(
    "One-chapter/one-keypoint/two-node cited summary validates and exports Markdown",
    () => {
      const result = ai.validateStructured(
        "summary",
        JSON.stringify(shortSummary()),
        input("summary"),
      );
      assert.equal(result.summary.chapters.length, 1);
      assert.equal(result.summary.keyPoints.length, 1);
      assert.equal(result.summary.mindMap.nodes.length, 2);
      assert.equal(result.summary.chapters[0].references[0].quote, quote);
      assert.equal(result.summary.chapters[0].startSeconds, undefined);
      assert.match(
        summary.summaryMarkdown(result.summary),
        /Điều kiện của mẫu số/,
      );
    },
  );
  await check(
    "Existing empty/oversized item and invalid graph rejection remain enforced",
    () => {
      for (const task of ["cards", "quiz"]) {
        const key = task === "cards" ? "cards" : "questions",
          value = task === "cards" ? card : question;
        for (const items of [[], Array(11).fill(value)])
          assert.throws(() =>
            ai.validateStructured(
              task,
              JSON.stringify({ [key]: items }),
              input(task),
            ),
          );
      }
      const bad = shortSummary();
      bad.chapters = [];
      assert.throws(() =>
        ai.validateStructured("summary", JSON.stringify(bad), input("summary")),
      );
      const graph = shortSummary();
      graph.mindMap.nodes.pop();
      assert.throws(() =>
        ai.validateStructured(
          "summary",
          JSON.stringify(graph),
          input("summary"),
        ),
      );
    },
  );
  await check(
    "Explicit conflicting observations with unknown context fit existing summary schema",
    () => {
      const raw = shortSummary(),
        conflict = "Nhiệt độ ghi nhận:20 độ.\n\nNhiệt độ ghi nhận:30 độ.";
      raw.overview =
        "Nguồn ghi20 độ và30 độ; chưa rõ quan hệ hoặc bối cảnh của hai giá trị.";
      raw.keyPoints = [raw.overview];
      raw.chapters[0] = {
        title: "Hai giá trị trong nguồn",
        summary: raw.overview,
        bullets: ["20 độ", "30 độ"],
        references: [
          { segmentId: "s1", quote: "Nhiệt độ ghi nhận:20 độ." },
          { segmentId: "s2", quote: "Nhiệt độ ghi nhận:30 độ." },
        ],
      };
      const result = ai.validateStructured(
        "summary",
        JSON.stringify(raw),
        input("summary", { source: conflict }),
      );
      assert.equal(result.summary.chapters[0].references.length, 2);
      assert.match(result.summary.overview, /chưa rõ/);
    },
  );
  await check(
    "Recorded unsupported chronology remains a known semantic-validator limitation, not claimed repaired by quote checks",
    () => {
      const name = "docs/v7/reports/v7-live-content-20261016.json",
        bytes = fs.readFileSync(path.join(root, name)),
        r = JSON.parse(bytes),
        item = r.cases.find(
          (item) => item.id === "vi-conflicting-source-summary",
        );
      assert.equal(
        crypto.createHash("sha256").update(bytes).digest("hex"),
        "37eb74bb0d9b247beb38dceeeb1e9b9f4884c1e230d809bfba75e71ea382da0e",
      );
      assert.match(
        item.result.body.summary.overview,
        /hai trường hợp hoặc thời điểm khác nhau/,
      );
      const accepted = ai.validateStructured(
        "summary",
        JSON.stringify(item.result.body.summary),
        input("summary", { source: item.fixture.source }),
      );
      assert.match(
        accepted.summary.overview,
        /hai trường hợp hoặc thời điểm khác nhau/,
      );
      assert.match(
        router.instructions(input("summary")),
        /Never invent different times/,
      );
    },
  );
  await check(
    "Actual Router carries source-sized instructions to both intercepted provider protocols and accepts short outputs",
    async () => {
      const env = {
          LUMIO_AI_ENABLED: "true",
          LUMIO_DESKTOP: "false",
          OPENAI_API_KEY: "synthetic-only-not-real",
          OPENAI_MODEL: "fixture-model",
          OPENAI_MODEL_QUICK: "fixture-model",
          GEMINI_API_KEY: "synthetic-only-not-real",
          GEMINI_MODEL: "fixture-model",
          GEMINI_MODEL_QUICK: "fixture-model",
        },
        before = Object.fromEntries(
          Object.keys(env).map((key) => [key, process.env[key]]),
        );
      Object.assign(process.env, env);
      let dispatches = 0;
      try {
        for (const task of ["summary", "cards", "quiz"]) {
          const value =
            task === "summary"
              ? shortSummary()
              : task === "cards"
                ? { cards: [card] }
                : { questions: [question] };
          const result = await router.routeAI(
            input(task),
            async (url, init) => {
              dispatches++;
              const body = JSON.parse(init.body),
                gemini = String(url).includes("googleapis.com"),
                text = gemini
                  ? body.systemInstruction.parts
                      .map((part) => part.text)
                      .join("")
                  : body.instructions;
              assert.match(text, /SOURCE FIDELITY/);
              assert.match(
                text,
                task === "summary" ? /chapters \(1-16/ : /array of 1-5/,
              );
              return Response.json(
                gemini
                  ? {
                      candidates: [
                        {
                          finishReason: "STOP",
                          content: { parts: [{ text: JSON.stringify(value) }] },
                        },
                      ],
                    }
                  : {
                      output: [
                        {
                          content: [
                            {
                              type: "output_text",
                              text: JSON.stringify(value),
                            },
                          ],
                        },
                      ],
                    },
              );
            },
          );
          assert.ok(
            result.summary ||
              result.cards?.length === 1 ||
              result.questions?.length === 1,
          );
        }
        assert.equal(dispatches, 3);
      } finally {
        for (const [key, value] of Object.entries(before))
          value === undefined
            ? delete process.env[key]
            : (process.env[key] = value);
      }
    },
  );
  const report = {
    status: "PASS",
    checkedAt: new Date().toISOString(),
    passed: checks.length,
    checks,
    actualProviderRequests: 0,
    interceptedProviderDispatches: 3,
    semanticRepairVerified: false,
    liveFollowup: "NOT_TESTED",
    scope:
      "Actual prompt builder/structured validators and Router with synthetic intercepted provider responses. Includes unchanged recorded bad-summary acceptance to document that structure/exact quotes do not prove semantic entailment. No real provider, student or teacher pilot.",
    routerSHA256: crypto
      .createHash("sha256")
      .update(fs.readFileSync(path.join(root, "lib/ai/router.ts")))
      .digest("hex"),
  };
  fs.writeFileSync(
    path.join(root, "docs/v7/reports/content-prompt.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    "V7 content prompt: " +
      checks.length +
      " checks PASS;0 actual provider requests.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
