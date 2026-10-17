/* Historical raw top3 replay, deliberately distinct from current production top6.
 * `evaluate-rag.cjs --offline` adds actual production-scoped snapshot replay. */
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const { load } = require("./source-grounding.cjs");
const { lexicalRank, cosine, hybridRank } = load("lib/rag/retrieval.ts");
function validateHistoricalReplay(data, report) {
  assert.equal(data.model, "text-embedding-3-small");
  assert.equal(data.dimensions, 256);
  assert.equal(report.requests, 2);
  assert.equal(data.queries.length, report.queries.length);
  for (const item of [...data.corpus, ...data.queries]) {
    assert.equal(item.vector.length, 256);
    assert.ok(item.vector.every(Number.isFinite));
    assert.ok(Math.abs(cosine(item.vector, item.vector) - 1) < 1e-12);
  }
  const rows = data.corpus.map((d, i) => ({ id: "s" + (i + 1), text: d.text, start: 0, end: d.text.length, paragraph: 1, chunkId: d.id, documentId: d.id, documentTitle: d.id, documentDigest: "authored-fixture", documentRevision: 1, score: 0 }));
  data.queries.forEach((query, i) => {
    assert.equal(query.text, report.queries[i].question);
    assert.deepEqual(query.expected, report.queries[i].expected);
    const lexical = lexicalRank(rows, query.text);
    const semantic = rows.map((r, j) => ({ ...r, score: cosine(data.corpus[j].vector, query.vector) })).filter((r) => r.score >= 0.35).sort((a, b) => b.score - a.score);
    const hybrid = hybridRank(lexical, semantic);
    assert.deepEqual(lexical.slice(0, 3).map((r) => r.chunkId), report.queries[i].lexical);
    assert.deepEqual(hybrid.slice(0, 3).map((r) => r.chunkId), report.queries[i].hybrid);
  });
  return { status: "PASS_HISTORICAL_RAW_TOP3", cases: data.queries.length, documents: data.corpus.length, topK: 3, productionScope: false, newProviderCalls: 0 };
}
module.exports = { validateHistoricalReplay };
if (require.main === module) {
  const directory = path.join(__dirname, "../docs/regional");
  const result = validateHistoricalReplay(JSON.parse(fs.readFileSync(path.join(directory, "rag-live-vectors.json"), "utf8")), JSON.parse(fs.readFileSync(path.join(directory, "rag-live-evaluation.json"), "utf8")));
  console.log("PASS Actual saved provider vectors replay all " + result.cases + " historical raw top3 lexical/hybrid rankings without new API calls; current production selection is a separate offline scope.");
}
