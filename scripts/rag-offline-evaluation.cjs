/* Offline production-selection evaluation. Never reads .env or calls a provider. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { load } = require("../tests/source-grounding.cjs");
const root = path.resolve(__dirname, "..");
const fixturePath = "tests/fixtures/v12-retrieval-evaluation.v1.json";
const defaultOutput = "docs/next/reports/retrieval-evaluation/production-selection.json";
const { createStore } = load("lib/server/store.ts");
const { lexicalRank, cosine, potentialConflict } = load("lib/rag/retrieval.ts");
const { sourceSegments } = load("lib/ai/grounding.ts");
const { RAG_LIMITS } = load("lib/rag/types.ts");
const digest = (value) => crypto.createHash("sha256").update(value).digest("hex");
const readJSON = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const fileProof = (relative) => ({ path: relative, sha256: digest(fs.readFileSync(path.join(root, relative))) });

/** Fail before any socket is opened, including accidental non-fetch clients. */
function withoutNetwork(run) {
  const restore = [], counts = { networkAttempts: 0, providerCalls: 0 };
  const forbidden = () => { counts.networkAttempts++; throw Error("OFFLINE_NETWORK_FORBIDDEN"); };
  const replace = (object, key) => { const prior = object[key]; object[key] = forbidden; restore.push(() => { object[key] = prior; }); };
  replace(globalThis, "fetch");
  for (const name of ["node:http", "node:https"]) {
    const object = require(name); replace(object, "request"); replace(object, "get");
  }
  for (const key of ["connect", "createConnection"]) replace(require("node:net"), key);
  replace(require("node:tls"), "connect");
  try { return { value: run(), ...counts }; }
  finally { restore.reverse().forEach((fn) => fn()); }
}

function validateFixture(fixture) {
  assert.equal(fixture.schema, 1);
  assert.equal(fixture.id, "lumio-v12-production-retrieval-offline");
  assert.match(fixture.version, /^\d+\.\d+\.\d+$/);
  assert.equal(fixture.languageFixture, "tests/fixtures/v7-ai-evaluation.v1.json");
  assert.ok(Array.isArray(fixture.cases) && fixture.cases.length > 0 && fixture.cases.length <= 40);
  const ids = new Set();
  for (const row of fixture.cases) {
    assert.ok(typeof row.id === "string" && !ids.has(row.id)); ids.add(row.id);
    assert.ok(typeof row.query === "string" && row.query.trim() && row.query.length <= 4000);
    assert.ok(Array.isArray(row.documents) && row.documents.length > 0 && row.documents.length <= RAG_LIMITS.documents);
    const documents = new Set(), chunks = new Set();
    for (const doc of row.documents) {
      assert.ok(typeof doc.id === "string" && /^[a-z0-9-]{1,60}$/.test(doc.id) && !documents.has(doc.id)); documents.add(doc.id);
      assert.ok(typeof doc.title === "string" && doc.title.length <= 200);
      assert.ok(Array.isArray(doc.paragraphs) && doc.paragraphs.length > 0);
      for (const para of doc.paragraphs) {
        const key = doc.id + ":" + para.id;
        assert.ok(typeof para.id === "string" && /^[a-z0-9-]{1,60}$/.test(para.id) && !chunks.has(key)); chunks.add(key);
        assert.ok(typeof para.text === "string" && para.text.trim() && para.text.length <= 700);
      }
    }
    assert.ok(Array.isArray(row.relevant) && new Set(row.relevant).size === row.relevant.length && row.relevant.every((id) => chunks.has(id)));
    assert.ok(row.selectedDocuments === undefined || (Array.isArray(row.selectedDocuments) && row.selectedDocuments.length && row.selectedDocuments.every((id) => documents.has(id))));
    assert.equal(typeof row.expect?.hits, "boolean");
    assert.equal(typeof row.expect?.conflict, "boolean");
  }
  return true;
}

function multilingualCases(fixture) {
  const data = readJSON(fixture.languageFixture);
  assert.deepEqual(data.languages.map((r) => r.language), ["vi", "en", "zh-CN", "ja", "ko"]);
  return data.languages.flatMap((row) => {
    const documents = [
      { id: "lesson", title: "Source", paragraphs: [{ id: "domain", text: row.source }] },
      { id: "distractor", title: "Other", paragraphs: [{ id: "bicycle", text: "A bicycle has two wheels." }] },
    ];
    return [
      { id: row.language + "-lexical-source", language: row.language, query: row.query, documents, relevant: ["lesson:domain"], expect: { hits: true, conflict: false } },
      { id: row.language + "-no-token-hit", language: row.language, query: row.missingQuery, documents, relevant: [], expect: { hits: false, conflict: false } },
      { id: row.language + "-numeric-conflict", language: row.language, query: row.conflictQuery, documents: [
        { id: "table-a", title: "A", paragraphs: [{ id: "value", text: row.conflictKey + " = 20 " + row.unit + "." }] },
        { id: "table-b", title: "B", paragraphs: [{ id: "value", text: row.conflictKey + " = 30 " + row.unit + "." }] },
      ], relevant: ["table-a:value", "table-b:value"], expect: { hits: true, conflict: true } },
    ];
  });
}

/** Only geometry is authored here: these vectors cannot prove semantic quality. */
function geometryCases() {
  const vector = (x) => [x, Math.sqrt(1 - x * x), ...Array(254).fill(0)];
  const make = (id, score) => ({ id, title: "Passage " + id, paragraphs: [{ id: "body", text: "An authored passage with an assigned geometric test vector." }], vectors: [vector(score)] });
  const base = { language: "en", query: "xyzzq semantic needle", mode: "hybrid", vectorKind: "synthetic-geometry-not-semantic-evidence", queryVector: [1, ...Array(255).fill(0)], model: "offline-geometry-model" };
  return [
    { ...base, id: "synthetic-semantic-only-selection", documents: [make("aligned", 1), make("orthogonal", 0)], relevant: ["aligned:body"], expect: { hits: true, conflict: false } },
    { ...base, id: "synthetic-threshold-neighbours", documents: [make("above", 0.350001), make("below", 0.349999)], relevant: ["above:body"], expect: { hits: true, conflict: false }, excluded: ["below:body"] },
    { ...base, id: "synthetic-semantic-no-hit", documents: [make("orthogonal", 0)], relevant: [], expect: { hits: false, conflict: false } },
  ];
}

function context(documents) {
  const store = createStore(":memory:", { now: () => Date.parse("2026-10-17T00:00:00Z") });
  try {
    const user = store.ensureIdentity({ provider: "google", providerAccountId: "offline-retrieval", name: "Synthetic evaluation", emailVerified: false });
    const ids = new Map(), stable = new Map(), sources = new Map(), rows = [];
    for (const doc of documents) {
      const text = doc.paragraphs.map((p) => p.text).join("\n\n");
      const indexed = store.ragIndex(user.id, { workspaceId: "fixture", clientItemId: doc.id, title: doc.title, text }, user.sessionVersion);
      ids.set(doc.id, indexed.id); sources.set(indexed.id, text);
      const input = store.ragEmbeddingInput(user.id, "fixture", indexed.id, user.sessionVersion);
      assert.equal(input.chunks.length, doc.paragraphs.length, "Authored paragraphs must equal actual production chunks");
      const segments = sourceSegments(text);
      input.chunks.forEach((chunk, i) => {
        assert.equal(chunk.text, doc.paragraphs[i].text);
        stable.set(chunk.id, doc.id + ":" + doc.paragraphs[i].id);
        rows.push({ ...segments[i], chunkId: chunk.id, documentId: indexed.id, documentTitle: doc.title, documentDigest: indexed.digest, documentRevision: indexed.revision, score: 0 });
      });
      if (doc.vectors) store.ragSetEmbeddings(user.id, "fixture", indexed.id, indexed.digest, indexed.revision, doc.model || documents.model || "offline-geometry-model", doc.vectors, false, user.sessionVersion);
    }
    return { store, user, ids, stable, sources, rows };
  } catch (error) { store.close(); throw error; }
}

function metrics(selected, relevant) {
  const matched = relevant.filter((id) => selected.includes(id));
  const first = selected.findIndex((id) => relevant.includes(id));
  const expectedDocs = [...new Set(relevant.map((id) => id.split(":")[0]))];
  const selectedDocs = new Set(selected.map((id) => id.split(":")[0]));
  return {
    authoredRelevantChunks: relevant.length,
    chunkRecallAt6: relevant.length ? matched.length / relevant.length : null,
    documentRecallAt6: expectedDocs.length ? expectedDocs.filter((id) => selectedDocs.has(id)).length / expectedDocs.length : null,
    precisionAtSelected: selected.length ? matched.length / selected.length : null,
    reciprocalRankAt6: first < 0 ? 0 : 1 / (first + 1),
    emptyGoldRetrieved: relevant.length === 0 && selected.length > 0,
  };
}

function evaluateCase(row) {
  const ctx = context(row.documents);
  try {
    const selectedDocuments = row.selectedDocuments || row.documents.map((d) => d.id);
    const scope = { workspaceId: "fixture", documentIds: selectedDocuments.map((id) => ctx.ids.get(id)), mode: row.mode || "lexical" };
    const embedding = row.queryVector ? { vector: row.queryVector, model: row.model } : undefined;
    const actual = ctx.store.ragSearch(ctx.user.id, scope, row.query, embedding, ctx.user.sessionVersion);
    const selected = actual.hits.map((h) => ctx.stable.get(h.chunkId));
    assert.ok(selected.every(Boolean));
    assert.ok(actual.hits.length <= RAG_LIMITS.hits);
    assert.equal(actual.hits.length > 0, row.expect.hits);
    assert.equal(potentialConflict(actual.hits), row.expect.conflict);
    for (const h of actual.hits) {
      assert.ok(scope.documentIds.includes(h.documentId));
      assert.equal(ctx.sources.get(h.documentId).slice(h.start, h.end), h.text);
      assert.equal(h.documentRevision, 1);
    }
    const raw = lexicalRank(ctx.rows.filter((r) => scope.documentIds.includes(r.documentId)), row.query).slice(0, 6).map((h) => ctx.stable.get(h.chunkId));
    if (row.expect.diversificationRescuesRelevant) {
      assert.ok(row.relevant.every((id) => !raw.includes(id)), "Fixture must expose naive top6 losing required source");
      assert.ok(row.relevant.every((id) => selected.includes(id)), "Actual production diversity must restore the required source");
    }
    if (row.excluded) assert.ok(row.excluded.every((id) => !selected.includes(id)));
    let snapshot;
    if (!actual.hits.length) {
      assert.throws(() => ctx.store.ragPrepareSnapshot(ctx.user.id, ctx.user.sessionVersion, scope, row.query, embedding), (e) => e.code === "RAG_NO_EVIDENCE" && e.status === 422);
      snapshot = { created: false, error: "RAG_NO_EVIDENCE", httpStatus: 422 };
    } else {
      const stored = ctx.store.ragPrepareSnapshot(ctx.user.id, ctx.user.sessionVersion, scope, row.query, embedding);
      assert.deepEqual(stored.hits, actual.hits);
      assert.equal(stored.potentialConflict, row.expect.conflict);
      assert.equal(stored.source, stored.hits.map((h) => h.text).join("\n\n"));
      snapshot = { created: true, conflictWarning: stored.potentialConflict, exactOffsetsChecked: true };
    }
    return {
      id: row.id, language: row.language, status: "PASS", scope: row.vectorKind || "authored-lexical-retrieval",
      question: row.query, selectedDocuments, relevant: row.relevant, selected, rawLexicalTop6: raw,
      metrics: metrics(selected, row.relevant), mode: actual.mode, snapshot,
      ...(row.expect.semanticConflictNotDetected ? { limitationObserved: "Both contradictory direction passages are retrieved; the numeric-only conflict warning does not detect this semantic contradiction." } : {}),
      ...(row.expect.overlapDoesNotProveAnswer ? { limitationObserved: "Lexical overlap retrieves an incomplete passage. Retrieval is not proof that the requested answer exists; no generated answer/abstention was tested." } : {}),
    };
  } finally { ctx.store.close(); }
}

function savedVectorReplay() {
  const vectorFile = "docs/regional/rag-live-vectors.json", historicalFile = "docs/regional/rag-live-evaluation.json";
  const data = readJSON(vectorFile), historical = readJSON(historicalFile);
  // Keep the exact historical six-document top3 comparison as a separate scope.
  const legacy = require("../tests/rag-live-replay.cjs").validateHistoricalReplay(data, historical);
  const groups = [
    { id: "school", ids: ["equation", "triangle", "plants", "recall"] },
    { id: "laboratory", ids: ["boiling-a", "boiling-b"] },
  ];
  const results = [];
  for (const group of groups) {
    const documents = data.corpus.filter((d) => group.ids.includes(d.id)).map((d) => ({ id: d.id, title: d.id, model: data.model, paragraphs: [{ id: "body", text: d.text }], vectors: [d.vector] }));
    const ctx = context(documents);
    try {
      for (const [i, q] of data.queries.entries()) for (const mode of ["lexical", "hybrid"]) {
        const scope = { workspaceId: "fixture", documentIds: [...ctx.ids.values()], mode };
        const embedding = mode === "hybrid" ? { vector: q.vector, model: data.model } : undefined;
        const actual = ctx.store.ragSearch(ctx.user.id, scope, q.text, embedding, ctx.user.sessionVersion);
        const selected = actual.hits.map((h) => ctx.stable.get(h.chunkId));
        assert.ok(selected.every(Boolean) && selected.length <= 6);
        assert.ok(actual.hits.every((h) => ctx.sources.get(h.documentId).slice(h.start, h.end) === h.text));
        const relevant = q.expected.filter((id) => group.ids.includes(id)).map((id) => id + ":body");
        if (!selected.length) assert.throws(() => ctx.store.ragPrepareSnapshot(ctx.user.id, ctx.user.sessionVersion, scope, q.text, embedding), (e) => e.code === "RAG_NO_EVIDENCE");
        else assert.deepEqual(ctx.store.ragPrepareSnapshot(ctx.user.id, ctx.user.sessionVersion, scope, q.text, embedding).hits, actual.hits);
        if (group.id === "laboratory" && i === 5) { assert.equal(selected.length, 2); assert.equal(potentialConflict(actual.hits), true); }
        results.push({ id: group.id + "-q" + (i + 1) + "-" + mode, mode, scope: group.id, question: q.text, relevant, selected, metrics: metrics(selected, relevant), conflictWarning: potentialConflict(actual.hits) });
      }
    } finally { ctx.store.close(); }
  }
  return {
    status: "PASS_REPLAY_SCOPE", provenance: [fileProof(vectorFile), fileProof(historicalFile)],
    vectors: "Saved actual provider vectors for authored historical fixtures; zero new provider requests. Current production selection is exercised offline, not current provider quality.",
    originalProviderRequests: historical.requests, originalModel: data.model, legacy,
    productionScopes: groups, results,
    limitations: ["The old corpus has six documents, above today's five-document per-account limit. Fixed school (4) and laboratory (2) scopes are evaluated independently; gold labels do not select individual documents per query.", "Scores/cosine threshold are not calibrated probability or semantic confidence.", "Metrics on seven old authored questions are descriptive, not acceptance thresholds or population estimates."],
  };
}

function aggregate(rows) {
  const answerable = rows.filter((r) => r.metrics.authoredRelevantChunks > 0);
  const empty = rows.filter((r) => r.metrics.authoredRelevantChunks === 0);
  const average = (key) => answerable.length ? answerable.reduce((sum, row) => sum + row.metrics[key], 0) / answerable.length : null;
  return { cases: rows.length, answerableCases: answerable.length, emptyGoldCases: empty.length, chunkRecallAt6: average("chunkRecallAt6"), documentRecallAt6: average("documentRecallAt6"), reciprocalRankAt6: average("reciprocalRankAt6"), emptyGoldRetrievedCases: empty.filter((r) => r.metrics.emptyGoldRetrieved).length };
}

function evaluate() {
  const startedAt = new Date().toISOString(), started = performance.now();
  const fixture = readJSON(fixturePath); validateFixture(fixture);
  const result = withoutNetwork(() => {
    const authored = [...fixture.cases, ...multilingualCases(fixture)].map(evaluateCase);
    const syntheticGeometry = geometryCases().map(evaluateCase);
    return { authored, syntheticGeometry, savedReplay: savedVectorReplay() };
  });
  assert.equal(result.networkAttempts, 0);
  let sourceCommit = null;
  try { sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(); } catch { /* File hashes still bind the local evaluated sources. */ }
  const { authored, syntheticGeometry, savedReplay } = result.value;
  return {
    schema: 1, evaluator: "lumio-v12-production-retrieval-offline", status: "PASS_SCOPED_OFFLINE_CHECKS",
    sourceScope: "Local working tree identified by the listed file SHA-256 values; sourceCommit is the base HEAD, not a claim of a clean/released tree.",
    semanticQualityStatus: "PARTIAL_NOT_A_SEMANTIC_BENCHMARK", startedAt, finishedAt: new Date().toISOString(), latencyMs: Math.round(performance.now() - started), sourceCommit,
    sourceProof: [fixturePath, fixture.languageFixture, "scripts/evaluate-rag.cjs", "scripts/rag-offline-evaluation.cjs", "tests/rag-live-replay.cjs", "lib/rag/retrieval.ts", "lib/rag/types.ts", "lib/server/rag-core.ts", "lib/ai/grounding.ts"].map(fileProof),
    configuration: { productionPath: "Actual createStore(':memory:').ragSearch and ragPrepareSnapshot", maximumDocuments: RAG_LIMITS.documents, topK: RAG_LIMITS.hits, dimensions: RAG_LIMITS.dimensions, semanticThreshold: 0.35, selection: "Actual production diverseHits; no copied ranking/diversification algorithm" },
    checked: authored.length + syntheticGeometry.length + savedReplay.results.length,
    networkAttempts: result.networkAttempts, newProviderCalls: 0, realUserData: false,
    summary: { authoredLexical: aggregate(authored), syntheticGeometry: aggregate(syntheticGeometry), historicalSavedVectorReplay: Object.fromEntries(["lexical", "hybrid"].map((mode) => [mode, aggregate(savedReplay.results.filter((r) => r.mode === mode))])) },
    authored, syntheticGeometry, savedReplay,
    limitations: [
      "PASS means the explicitly scoped deterministic retrieval/snapshot assertions passed. It does not mean all retrieved passages answer a question or all contradictions are detected.",
      "Gold relevance and multilingual passages are developer-authored, with no held-out independent teacher or curriculum review.",
      "Diversification can rescue another document and also promote distractors. Per-case selected chunks, recall and precision remain visible; scores are not confidence.",
      "The deliberately overlapping but unanswerable passage is retrieved, and a nonnumeric contradiction is not flagged. These observed limitations are reported, not renamed as successful abstention/semantic verification.",
      "Synthetic geometry cases establish threshold/fusion plumbing only; saved provider vectors establish historical replay only. No live model, generated answer, injection resistance, classroom pilot or student outcome is evaluated.",
    ],
  };
}

function outputPath(argument) {
  const output = path.resolve(root, argument || defaultOutput);
  const permitted = path.resolve(root, "docs/next/reports/retrieval-evaluation") + path.sep;
  assert.ok(output.startsWith(permitted) && output.endsWith(".json"), "Output must be a new JSON report in docs/next/reports/retrieval-evaluation");
  return output;
}
function main(args = process.argv.slice(2)) {
  const option = args.indexOf("--output");
  if (option >= 0) assert.ok(typeof args[option + 1] === "string" && !args[option + 1].startsWith("--"), "--output requires a report path");
  const output = outputPath(option < 0 ? undefined : args[option + 1]);
  const report = evaluate();
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ status: report.status, cases: report.checked, newProviderCalls: 0, networkAttempts: report.networkAttempts, report: path.relative(root, output), summary: report.summary }));
  return report;
}
module.exports = { validateFixture, multilingualCases, geometryCases, evaluateCase, evaluate, outputPath, withoutNetwork, main };
if (require.main === module) { try { main(); } catch (error) { console.error(error); process.exitCode = 1; } }
