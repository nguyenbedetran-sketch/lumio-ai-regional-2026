/* Actual isolated SQLite/production selection; saved-vector replay, zero network. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const evaluator = require("../scripts/rag-offline-evaluation.cjs");
const { validateHistoricalReplay } = require("./rag-live-replay.cjs");
const fixture = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/v12-retrieval-evaluation.v1.json"), "utf8"));
const clone = (v) => JSON.parse(JSON.stringify(v));
const reportDirectory = path.join(root, "docs/next/reports/retrieval-evaluation");
const checks = [];
let evaluated;
const historicalPaths = ["docs/regional/rag-live-vectors.json", "docs/regional/rag-live-evaluation.json"];
const historical = historicalPaths.map((relative) => ({ relative, bytes: fs.readFileSync(path.join(root, relative)) }));
function check(name, run) { run(); checks.push(name); console.log("PASS " + name); }
try {
  check("Versioned authored fixture validates; duplicate/unknown relevance or oversized document scope is rejected", () => {
    assert.equal(evaluator.validateFixture(fixture), true);
    for (const mutate of [
      (v) => { v.cases[0].relevant = ["invented:source"]; },
      (v) => { v.cases[0].relevant.push(v.cases[0].relevant[0]); },
      (v) => { v.cases[0].documents = Array.from({ length: 6 }, (_, i) => ({ ...v.cases[0].documents[0], id: "over" + i })); },
      (v) => { v.cases[0].selectedDocuments = ["unknown"]; },
      (v) => { v.cases.push(clone(v.cases[0])); },
    ]) { const bad = clone(fixture); mutate(bad); assert.throws(() => evaluator.validateFixture(bad)); }
  });
  check("Offline guard refuses fetch/HTTP/socket transport and restores callers afterward", () => {
    const prior = global.fetch, http = require("node:https"), request = http.request;
    const result = evaluator.withoutNetwork(() => {
      assert.throws(() => global.fetch("https://example.test"), /OFFLINE_NETWORK_FORBIDDEN/);
      assert.throws(() => http.request("https://example.test"), /OFFLINE_NETWORK_FORBIDDEN/);
      assert.throws(() => require("node:net").connect(443, "example.test"), /OFFLINE_NETWORK_FORBIDDEN/);
    });
    assert.equal(result.networkAttempts, 3); assert.equal(global.fetch, prior); assert.equal(http.request, request);
    assert.throws(() => evaluator.withoutNetwork(() => { throw Error("EXPECTED_FAILURE"); }), /EXPECTED_FAILURE/);
    assert.equal(global.fetch, prior);
  });
  check("Current evaluator executes 51 production retrieval/snapshot cases without provider/network requests", () => {
    evaluated = evaluator.evaluate();
    assert.equal(evaluated.status, "PASS_SCOPED_OFFLINE_CHECKS");
    assert.equal(evaluated.semanticQualityStatus, "PARTIAL_NOT_A_SEMANTIC_BENCHMARK");
    assert.equal(evaluated.checked, 51);
    assert.equal(evaluated.authored.length, 20); assert.equal(evaluated.syntheticGeometry.length, 3); assert.equal(evaluated.savedReplay.results.length, 28);
    assert.equal(evaluated.networkAttempts, 0); assert.equal(evaluated.newProviderCalls, 0); assert.equal(evaluated.realUserData, false);
    assert.equal(evaluated.configuration.topK, 6);
  });
  check("Actual production diversity recovers the relevant paragraph excluded by raw top6", () => {
    const row = evaluated.authored.find((r) => r.id === "multi-chunk-diversification");
    assert.ok(!row.rawLexicalTop6.includes("verification:required"));
    assert.ok(row.selected.includes("verification:required"));
    assert.equal(row.selected.length, 6); assert.equal(row.metrics.chunkRecallAt6, 1);
    assert.equal(row.metrics.precisionAtSelected, 1 / 6);
    assert.equal(row.snapshot.exactOffsetsChecked, true);
  });
  for (const language of ["vi", "en", "zh-CN", "ja", "ko"]) check(language + " actual production lexical/source, no-hit and numeric-conflict cases preserve the declared scope", () => {
    const source = evaluated.authored.find((r) => r.id === language + "-lexical-source");
    const missing = evaluated.authored.find((r) => r.id === language + "-no-token-hit");
    const conflict = evaluated.authored.find((r) => r.id === language + "-numeric-conflict");
    assert.deepEqual(source.selected, ["lesson:domain"]); assert.equal(source.mode, "lexical");
    assert.deepEqual(missing.selected, []); assert.equal(missing.snapshot.error, "RAG_NO_EVIDENCE"); assert.equal(missing.snapshot.httpStatus, 422);
    assert.deepEqual([...conflict.selected].sort(), ["table-a:value", "table-b:value"]); assert.equal(conflict.snapshot.conflictWarning, true);
  });
  check("Numeric disagreement preserves competing sources, without inventing context/reconciliation", () => {
    const row = evaluated.authored.find((r) => r.id === "numeric-conflict-preserves-both");
    assert.ok(row.selected.includes("table-a:value") && row.selected.includes("table-b:value"));
    assert.equal(row.snapshot.conflictWarning, true); assert.equal(row.metrics.chunkRecallAt6, 1);
  });
  check("Nonnumeric contradiction is visibly recorded as an unsupported warning, not semantic success", () => {
    const row = evaluated.authored.find((r) => r.id === "semantic-conflict-outside-numeric-warning");
    assert.equal(row.snapshot.conflictWarning, false); assert.equal(row.selected.length, 2);
    assert.match(row.limitationObserved, /does not detect/);
  });
  check("Unanswerable lexical overlap remains a reported false-positive case, not asserted abstention", () => {
    const row = evaluated.authored.find((r) => r.id === "overlapping-terms-without-answer");
    assert.equal(row.metrics.emptyGoldRetrieved, true); assert.equal(row.snapshot.created, true);
    assert.match(row.limitationObserved, /no generated answer\/abstention was tested/);
    assert.equal(evaluated.summary.authoredLexical.emptyGoldRetrievedCases, 1);
  });
  check("An indexed answer outside the explicit selected document scope cannot become evidence", () => {
    const row = evaluated.authored.find((r) => r.id === "selected-sources-exclude-unselected-answer");
    assert.deepEqual(row.selected, []); assert.deepEqual(row.selectedDocuments, ["geometry", "biology"]);
    assert.equal(row.snapshot.created, false);
  });
  check("Synthetic cosine geometry exercises only semantic plumbing around the threshold", () => {
    const rows = evaluated.syntheticGeometry;
    assert.ok(rows.every((r) => r.scope === "synthetic-geometry-not-semantic-evidence"));
    assert.deepEqual(rows[0].rawLexicalTop6, []); assert.deepEqual(rows[0].selected, ["aligned:body"]);
    assert.deepEqual(rows[1].selected, ["above:body"]); assert.deepEqual(rows[2].selected, []);
    assert.equal(rows[2].snapshot.error, "RAG_NO_EVIDENCE");
  });
  check("Historical vectors retain exact raw-top3 replay, then run separate valid four/two document production scopes", () => {
    const replay = evaluated.savedReplay;
    assert.equal(replay.originalProviderRequests, 2); assert.equal(replay.legacy.cases, 7);
    assert.equal(replay.legacy.productionScope, false);
    assert.deepEqual(replay.productionScopes.map((s) => s.ids.length), [4, 2]);
    assert.equal(replay.results.length, 28);
    assert.ok(replay.results.every((r) => r.selected.length <= 6));
    const data = JSON.parse(historical[0].bytes), old = JSON.parse(historical[1].bytes);
    const altered = clone(old); altered.queries[0].hybrid = ["invented"];
    assert.throws(() => validateHistoricalReplay(data, altered));
    const mismatched = clone(old); mismatched.queries[0].question = "A different untested question";
    assert.throws(() => validateHistoricalReplay(data, mismatched));
    for (const mode of ["lexical", "hybrid"]) assert.equal(replay.results.find((r) => r.id === "laboratory-q6-" + mode).conflictWarning, true);
  });
  check("Report source hashes match evaluated bytes and retain explicit semantic/pilot limitations", () => {
    for (const item of evaluated.sourceProof) assert.equal(item.sha256, crypto.createHash("sha256").update(fs.readFileSync(path.join(root, item.path))).digest("hex"));
    assert.ok(evaluated.limitations.some((s) => /not.*answer/i.test(s)));
    assert.ok(evaluated.limitations.some((s) => /no.*pilot/i.test(s)));
    assert.equal(evaluated.configuration.maximumDocuments, 5);
  });
  check("Output isolation cannot overwrite historical/provider evidence, and missing output argument is rejected", () => {
    assert.throws(() => evaluator.outputPath("docs/regional/rag-live-evaluation.json"));
    assert.throws(() => evaluator.outputPath("docs/next/reports/retrieval-evaluation/../escape.json"));
    assert.throws(() => evaluator.main(["--offline", "--output"]), /requires/);
  });
  check("Existing evaluator offline CLI returns before environment-file reading, even with --live also present", () => {
    const child = `const fs=require('node:fs');const original=fs.readFileSync;fs.readFileSync=function(file,...args){if(/[\\\\/]\\.env(?:\\.|$)/.test(String(file)))throw Error('ENV_FILE_FORBIDDEN');return original.call(this,file,...args)};process.argv=['node','scripts/evaluate-rag.cjs','--offline','--live','--output','docs/next/reports/retrieval-evaluation/cli-check.json'];require('./scripts/evaluate-rag.cjs');`;
    const text = execFileSync(process.execPath, ["-e", child], { cwd: root, encoding: "utf8", timeout: 60000 });
    const output = JSON.parse(text.trim());
    assert.equal(output.status, "PASS_SCOPED_OFFLINE_CHECKS"); assert.equal(output.cases, 51); assert.equal(output.newProviderCalls, 0); assert.equal(output.networkAttempts, 0);
  });
  check("Historical vector/report evidence stays byte-for-byte unchanged", () => {
    for (const file of historical) assert.ok(fs.readFileSync(path.join(root, file.relative)).equals(file.bytes));
  });
  fs.mkdirSync(reportDirectory, { recursive: true });
  fs.writeFileSync(path.join(reportDirectory, "production-selection.json"), JSON.stringify(evaluated, null, 2) + "\n");
  fs.writeFileSync(path.join(reportDirectory, "runner-regression.json"), JSON.stringify({ checkedAt: new Date().toISOString(), status: "PASS", passed: checks.length, checks, scope: "Actual in-memory SQLite, production RAG core and deterministic/saved vectors; no live provider, network, user data or current semantic accuracy proof.", historicalBytesPreserved: true, newProviderCalls: 0 }, null, 2) + "\n");
  console.log(checks.length + " retrieval evaluator regression groups PASS; 51 production cases + 7 distinct historical raw-top3 replay cases; no new provider calls.");
} catch (error) { console.error(error); process.exitCode = 1; }
