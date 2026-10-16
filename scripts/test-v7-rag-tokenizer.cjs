/* Offline regression: actual tokenizer/ranker and isolated SQLite. No provider. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { load } = require("../tests/source-grounding.cjs");
const {
  terms,
  queryTerms,
  lexicalRank,
  potentialConflict,
  LEXICAL_TOKEN_LIMITS: limits,
} = load("lib/rag/retrieval.ts");
const { createStore } = load("lib/server/store.ts");
const { sourceSegments, validateReferences } = load("lib/ai/grounding.ts");
const { mapRagReferences } = load("lib/rag/types.ts");
const checks = [];
const check = (name, run) => {
  run();
  checks.push({ name, status: "PASS" });
  console.log("PASS " + name);
};
const hit = (id, text) => ({
  id: "s1",
  text,
  start: 0,
  end: text.length,
  paragraph: 1,
  chunkId: id,
  documentId: id,
  documentTitle: "Authored source",
  documentDigest: "fixture",
  documentRevision: 1,
  score: 0,
});
const fixtures = [
  ["vi", "Điều kiện xác định: mẫu số phải khác không.", "dieu kien mau so"],
  ["en", "The denominator must be a nonzero divisor.", "nonzero divisor"],
  [
    "zh-CN",
    "求解分式方程前，分母不能为零，必须先写出限制条件。",
    "分母不能为零",
  ],
  [
    "ja",
    "分数方程式では分母がゼロにならない条件を先に確認します。",
    "分数方程式",
  ],
  [
    "ko",
    "분수방정식을 풀기 전에 분모가 영이 아닌 조건을 먼저 확인합니다.",
    "분수방정식",
  ],
];
let networkAttempts = 0;
const oldFetch = global.fetch;
global.fetch = async () => {
  networkAttempts++;
  throw Error("OFFLINE_NETWORK_FORBIDDEN");
};
try {
  check("Latin and Vietnamese legacy token normalization is preserved", () => {
    assert.deepEqual(terms("Điều kiện XÁC ĐỊNH, ĐKXĐ 2026 / linear x2"), [
      "dieu",
      "kien",
      "xac",
      "dinh",
      "dkxd",
      "2026",
      "linear",
      "x2",
    ]);
    assert.deepEqual(terms("điều kiện"), terms("điều kiện"));
    assert.deepEqual(queryTerms("What is the điều kiện của mẫu số?"), [
      "dieu",
      "kien",
      "mau",
      "so",
    ]);
  });
  for (const [language, source, query] of fixtures)
    check(
      `${language}: native-script lexical retrieval finds the authored source`,
      () => {
        const rows = [
          hit("unrelated", "A bicycle has two wheels."),
          hit("expected", source),
        ];
        const ranked = lexicalRank(rows, query);
        assert.ok(queryTerms(query).length > 0);
        assert.equal(ranked[0]?.documentId, "expected");
        assert.ok(ranked[0].score > 0);
        assert.equal(ranked[0].text, source);
      },
    );
  check("Mixed Latin/CJK runs split without losing either script", () => {
    const t = terms("GPT模型與AI教材");
    assert.ok(
      t.includes("gpt") &&
        t.includes("模型") &&
        t.includes("ai") &&
        t.includes("教材"),
    );
    assert.equal(
      lexicalRank([hit("mixed", "GPT模型可以用于教材。")], "模型")[0]
        .documentId,
      "mixed",
    );
  });
  check(
    "Korean composed and decomposed syllables normalize identically",
    () => {
      assert.deepEqual(
        terms("이차방정식"),
        terms("이차방정식".normalize("NFD")),
      );
      assert.ok(queryTerms("방정식").includes("방정"));
      assert.equal(
        lexicalRank([hit("k", "이차방정식을 공부합니다.")], "방정식")[0]
          .documentId,
        "k",
      );
    },
  );
  check(
    "Japanese kana voicing is preserved rather than accent-stripped",
    () => {
      assert.notDeepEqual(terms("がく"), terms("かく"));
      assert.deepEqual(terms("ｶﾞｸ"), terms("ガク"));
    },
  );
  check("Supplementary Han characters remain whole code points", () => {
    const text = "𠀀𠀁𠀂";
    assert.ok(terms(text).includes("𠀀𠀁"));
    assert.ok(queryTerms(text).every((t) => !/[\uD800-\uDBFF]$/.test(t)));
    assert.equal(lexicalRank([hit("han", text)], "𠀁𠀂")[0].documentId, "han");
  });
  check(
    "Multi-character queries use adjacent bigrams, not isolated common characters",
    () => {
      assert.ok(!queryTerms("分母条件").includes("分"));
      assert.deepEqual(
        lexicalRank([hit("wrong", "分、母、条、件。")], "分母条件"),
        [],
      );
      assert.ok(terms("分母条件").includes("分母"));
    },
  );
  check(
    "A deliberate one-character query remains searchable in a document",
    () => {
      assert.deepEqual(queryTerms("根"), ["根"]);
      assert.equal(
        lexicalRank([hit("root", "平方根的定义。")], "根")[0].documentId,
        "root",
      );
    },
  );
  check(
    "No bigram crosses a punctuation, whitespace or Latin-script boundary",
    () => {
      assert.ok(!terms("平方。根").includes("方根"));
      assert.ok(!terms("平方 根").includes("方根"));
      assert.ok(!terms("平方x根").includes("方根"));
    },
  );
  check("Query terms are unique and bounded to forty", () => {
    const q = Array.from({ length: 100 }, (_, i) => "topic" + i).join(" ");
    assert.equal(queryTerms(q).length, limits.queryTerms);
    assert.deepEqual(queryTerms("模型模型模型"), [
      ...new Set(queryTerms("模型模型模型")),
    ]);
    const cjk = Array.from({ length: 150 }, (_, i) =>
      String.fromCodePoint(0x4e00 + i),
    ).join("");
    assert.ok(queryTerms(cjk).length <= limits.queryTerms);
    assert.ok(queryTerms(cjk).every((t) => t.length <= limits.termCharacters));
  });
  check(
    "Input, token and token-length bounds prevent unbounded lexical allocation",
    () => {
      assert.equal(terms("word ".repeat(200000)).length, limits.terms);
      assert.deepEqual(terms("a".repeat(1000000)), []);
      assert.equal(
        queryTerms(" ".repeat(limits.queryCharacters) + "secretfixture").length,
        0,
      );
      assert.ok(terms("学".repeat(200000)).length <= limits.terms);
    },
  );
  check(
    "Stop words, empty text, punctuation and emoji do not fabricate hits",
    () => {
      for (const q of ["", "😀 !!!", "the is and", "cho tôi của và"])
        assert.deepEqual(
          lexicalRank([hit("x", "Authored learning source.")], q),
          [],
        );
      assert.deepEqual(terms("😀 !!!"), []);
    },
  );
  check("Missing evidence in each authored language remains empty", () => {
    const absent = [
      "núi lửa sao hỏa",
      "volcanic magma",
      "火星火山喷发",
      "火星火山噴火",
      "화성 화산 분출",
    ];
    fixtures.forEach((f, i) =>
      assert.deepEqual(lexicalRank([hit("scope", f[1])], absent[i]), []),
    );
  });
  check(
    "Numeric conflict warning still works in Latin and East Asian text",
    () => {
      for (const key of [
        "Recorded temperature",
        "Nhiệt độ ghi nhận",
        "实验温度",
        "実験の温度",
        "실험 온도",
      ])
        assert.equal(
          potentialConflict([
            hit("a", `${key} = 100 degrees.`),
            hit("b", `${key} = 90 degrees.`),
          ]),
          true,
        );
      assert.equal(
        potentialConflict([
          hit("a", "实验温度 = 100 degrees."),
          hit("b", "实验温度 = 100 degrees."),
        ]),
        false,
      );
    },
  );
  check(
    "Isolated SQLite CJK retrieval preserves exact source offsets and actor scope",
    () => {
      const store = createStore(":memory:");
      const owner = store.ensureIdentity({
        provider: "google",
        providerAccountId: "v7-rag-owner",
        name: "Synthetic owner",
        emailVerified: false,
      });
      const other = store.ensureIdentity({
        provider: "google",
        providerAccountId: "v7-rag-other",
        name: "Synthetic other",
        emailVerified: false,
      });
      const text =
        "これは最初の段落です。\n\n分数方程式では分母がゼロにならない条件を先に確認します。";
      const doc = store.ragIndex(owner.id, {
        workspaceId: "main",
        clientItemId: "jp",
        title: "Authored fixture",
        text,
      });
      const scope = { workspaceId: "main", documentIds: [doc.id] };
      const snapshot = store.ragPrepareSnapshot(
        owner.id,
        owner.sessionVersion,
        scope,
        "分数方程式",
      );
      assert.equal(snapshot.hits[0].paragraph, 2);
      const segment = sourceSegments(snapshot.source)[0],
        quote = snapshot.source;
      const mapped = mapRagReferences(
        validateReferences(
          [{ segmentId: segment.id, quote, page: 999 }],
          snapshot.source,
        ),
        snapshot,
      );
      assert.equal(mapped[0].start, text.indexOf("分数方程式"));
      assert.equal(mapped[0].end, text.length);
      assert.equal(mapped[0].quote, text.slice(mapped[0].start, mapped[0].end));
      assert.equal(mapped[0].page, undefined);
      assert.throws(
        () => store.ragSearch(other.id, scope, "分数方程式"),
        (e) => e.code === "RAG_DOCUMENT_NOT_FOUND",
      );
      assert.equal(
        store.ragReadSnapshot(owner.id, owner.sessionVersion, snapshot.id).id,
        snapshot.id,
      );
    },
  );
  check("Offline test makes no network/provider request", () =>
    assert.equal(networkAttempts, 0),
  );
  const report = {
    schema: 1,
    status: "PASS",
    checkedAt: new Date().toISOString(),
    tokenizerVersion: "unicode-bigram-1",
    passed: checks.length,
    checks,
    actualProviderRequests: 0,
    networkAttempts,
    scope:
      "Deterministic tokenizer/ranking with authored fixtures and one isolated in-memory SQLite provenance/ACL flow. Not semantic retrieval, real provider, OAuth, student trial or public-deployment validation.",
    limits,
    limitations: [
      "Bigrams are lexical overlap, not word segmentation, translation or calibrated relevance.",
      "Single-character searches can have low precision; no guarantee of semantic coverage.",
      "Input/query/token caps are intentional lexical resource bounds; original source/citation text is unchanged.",
    ],
  };
  const output = path.resolve(
    __dirname,
    "../docs/v7/reports/rag-tokenizer.json",
  );
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(`${checks.length} tokenizer checks passed; zero provider calls.`);
} finally {
  global.fetch = oldFetch;
}
