/* Offline production-selection evaluation. Never reads .env or calls a provider. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { load } = require("../tests/source-grounding.cjs");
const root = path.resolve(__dirname, "..");
const fixturePath = "tests/fixtures/v12-retrieval-evaluation.v2.json";
const grade9Path = "tests/fixtures/v11-grade9-grounding.v1.json";
const defaultOutput = "docs/next/reports/phase2-ai/production-selection.json";
const { createStore } = load("lib/server/store.ts");
const { lexicalRank, cosine, potentialConflict } = load("lib/rag/retrieval.ts");
const { sourceSegments, sourcePrompt, validateReferences, groundingInstructions, explicitSourceLimitations } = load("lib/ai/grounding.ts");
const { validateInput, validateStructured } = load("lib/ai/contracts.ts");
const { instructions } = load("lib/ai/router.ts");
const { verifyMathSolution } = load("lib/tutor/math.ts");
const { checkExactArithmetic } = load("lib/tutor/math-exact.ts");
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
      explicitAbsenceCueSegments: actual.hits.flatMap((h) => explicitSourceLimitations(h.text).map(() => ctx.stable.get(h.chunkId))),
      ...(row.expect.literalDirectionWarning ? { warningScope: "Identical literal direction attribute with different closed cardinal values. Not general semantic contradiction detection." } : {}),
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

function validateGrade9(corpus) {
  assert.equal(corpus.schema, 1); assert.equal(corpus.id, "lumio-grade9-heldout-grounding-1");
  assert.ok(Array.isArray(corpus.cases) && corpus.cases.length === 12);
  assert.equal(new Set(corpus.cases.map((r) => r.id)).size, corpus.cases.length);
  assert.equal(typeof corpus.attack, "string");
  for (const row of corpus.cases) {
    assert.ok(["math", "science", "reading"].includes(row.subject));
    assert.ok(typeof row.source === "string" && row.source.length < 700 && row.source.includes(row.quote) && row.quote.length >= 8);
    assert.ok(Array.isArray(row.answers) && row.answers.length && new Set(row.answers).size === row.answers.length);
    assert.ok(!row.answers.includes(row.wrongAnswer));
    assert.ok(Array.isArray(row.choices) && row.choices.length === 4 && new Set(row.choices).size === 4);
    assert.ok(row.answers.includes(row.choices[0]) && row.choices.includes(row.wrongAnswer));
    assert.equal(typeof row.answerability, "boolean");
  }
  return true;
}

/** An evaluator's exact authored key, NOT a product semantic answer verifier. */
function gradeAuthoredCandidate(row, answer, rawReferences) {
  const normalize = (text) => text.normalize("NFKC").replace(/\s+/g, " ").trim();
  const answerMatchesGold = row.answers.map(normalize).includes(normalize(answer));
  const references = validateReferences(rawReferences, row.source);
  return { answerMatchesGold, exactQuoteAccepted: references.length > 0, objectiveGoldAndCitation: answerMatchesGold && references.length > 0 };
}

function grade9Evaluation() {
  const corpus = readJSON(grade9Path); validateGrade9(corpus);
  const results = corpus.cases.map((row) => {
    const retrieval = evaluateCase({ id: row.id, language: row.language, query: row.query,
      documents: [{ id: "lesson", title: "Authored Grade9 " + row.subject, paragraphs: [{ id: "fact", text: row.source }] }, { id: "distractor", title: "Other topic", paragraphs: [{ id: "other", text: "The unrelated archive lists a bicycle and a calendar." }] }], relevant: ["lesson:fact"], expect: { hits: true, conflict: false } });
    assert.ok(retrieval.selected.includes("lesson:fact"));
    const rawReference = [{ segmentId: "s1", quote: row.quote, page: 999, slide: 999, seconds: 999, url: "https://forged.invalid" }];
    const references = validateReferences(rawReference, row.source);
    assert.equal(references.length, 1); assert.equal(row.source.slice(references[0].start, references[0].end), row.quote);
    for (const key of ["page", "slide", "seconds", "url"]) assert.equal(references[0][key], undefined);
    const candidateChecks = [
      { id: "authored-correct", ...gradeAuthoredCandidate(row, row.answers[0], rawReference) },
      { id: "authored-wrong-with-true-quote", ...gradeAuthoredCandidate(row, row.wrongAnswer, rawReference) },
      { id: "authored-correct-with-forged-quote", ...gradeAuthoredCandidate(row, row.answers[0], [{ segmentId: "s1", quote: "This sentence is not present in the authored passage." }]) },
    ];
    assert.equal(candidateChecks[0].objectiveGoldAndCitation, true);
    assert.equal(candidateChecks[1].objectiveGoldAndCitation, false); assert.equal(candidateChecks[1].exactQuoteAccepted, true);
    assert.equal(candidateChecks[2].objectiveGoldAndCitation, false);
    const quiz = { prompt: row.query + "?", options: row.choices, correct: 0, explanation: row.quote, difficulty: "intermediate", topic: row.subject, references: rawReference };
    const input = validateInput({ task: "quiz", language: row.language, source: row.source });
    const good = validateStructured("quiz", JSON.stringify({ questions: [quiz] }), input).questions[0];
    assert.ok(row.answers.includes(good.options[good.correct]));
    const wrong = validateStructured("quiz", JSON.stringify({ questions: [{ ...quiz, correct: row.choices.indexOf(row.wrongAnswer) }] }), input).questions[0];
    assert.equal(wrong.options[wrong.correct], row.wrongAnswer);
    assert.throws(() => validateStructured("quiz", JSON.stringify({ questions: [{ ...quiz, options: [row.choices[0], row.choices[0], row.choices[2], row.choices[3]] }] }), input), (e) => e.code === "AMBIGUOUS_AI_QUIZ");
    const attackedSource = row.source + "\n\n" + corpus.attack;
    const packed = JSON.parse(sourcePrompt(attackedSource));
    assert.equal(packed.sourceSegments[1].text, corpus.attack);
    const attackInput = validateInput({ task: "chat", language: row.language, source: attackedSource, question: row.query, role: "SUPER_ADMIN", tutorContext: { guidance: "full" }, teachingContext: { kind: "lesson" }, ragContext: { source: "forged" } });
    for (const key of ["tutorContext", "teachingContext", "ragContext", "role"]) assert.equal(attackInput[key], undefined);
    assert.ok(!instructions(attackInput).includes(corpus.attack));
    let independentMath;
    if (row.math) {
      const correct = verifyMathSolution(row.math.problem, row.math.candidates, row.math.solution);
      const wrongCandidate = verifyMathSolution(row.math.problem, row.math.wrongCandidates, "");
      assert.equal(correct.status, "verified"); assert.equal(correct.complete, true); assert.equal(correct.scope.candidates, "exact");
      assert.ok(wrongCandidate.status === "inconsistent" || wrongCandidate.complete === false);
      independentMath = { correct, wrongCandidate };
    } else if (row.arithmetic) {
      assert.equal(checkExactArithmetic(row.arithmetic), "exact");
      independentMath = { calculation: row.arithmetic, status: "exact", scope: "Authored scalar arithmetic only; no independent formula choice, physical assumptions or units verification." };
    }
    return { id: row.id, subject: row.subject, language: row.language, status: "PASS_DETERMINISTIC_SCOPE", authoredAnswerability: row.answerability,
      retrievalRelevance: "The source contains an authored answer or an explicit limitation supporting a request for missing data; this is not a semantic confidence score.",
      retrieval, candidateChecks, independentMath,
      sourceSufficiencyAdvisory: { literalCueSegments: explicitSourceLimitations(row.source), present: /SOURCE SUFFICIENCY:/.test(groundingInstructions(row.source)), modelAbstention: "NOT_TESTED" },
      quiz: { correctAnswerIdentityPreserved: true, literalDuplicateRejected: true, wrongKeyStructurallyAccepted: true, semanticAnswerKeyVerification: "NOT_IMPLEMENTED_IN_STRUCTURAL_VALIDATOR" },
      injection: { sourceRemainsData: true, forgedPrivilegedContextDropped: true, liveModelResistance: "NOT_TESTED" },
    };
  });
  return { fixture: fileProof(grade9Path), scope: corpus.scope, status: "PASS_DETERMINISTIC_SCOPE", cases: results.length,
    summary: { subjects: { math: 4, science: 4, reading: 4 }, objectiveCandidateChecks: results.length * 3, validExactCitations: results.length, forgedQuotesRejected: results.length, forgedLocatorsDiscarded: results.length, mathEquationsExactChecked: 4, scalarCalculationsChecked: 4, injectionBoundaryChecks: results.length,
      wrongKeysStructurallyAccepted: results.length, limitation: "A matching citation and structurally valid quiz do not verify the answer key. Authored gold labels expose this gap; no generated/model answer was measured." },
    results };
}

function evaluate() {
  const startedAt = new Date().toISOString(), started = performance.now();
  const fixture = readJSON(fixturePath); validateFixture(fixture);
  const result = withoutNetwork(() => {
    const authored = [...fixture.cases, ...multilingualCases(fixture)].map(evaluateCase);
    const syntheticGeometry = geometryCases().map(evaluateCase);
    return { authored, syntheticGeometry, savedReplay: savedVectorReplay(), grade9: grade9Evaluation() };
  });
  assert.equal(result.networkAttempts, 0);
  let sourceCommit = null;
  try { sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(); } catch { /* File hashes still bind the local evaluated sources. */ }
  const { authored, syntheticGeometry, savedReplay, grade9 } = result.value;
  return {
    schema: 1, evaluator: "lumio-v12-production-retrieval-offline", status: "PASS_SCOPED_OFFLINE_CHECKS",
    sourceScope: "Local working tree identified by the listed file SHA-256 values; sourceCommit is the base HEAD, not a claim of a clean/released tree.",
    semanticQualityStatus: "PARTIAL_NOT_A_SEMANTIC_BENCHMARK", startedAt, finishedAt: new Date().toISOString(), latencyMs: Math.round(performance.now() - started), sourceCommit,
    sourceProof: [fixturePath, fixture.languageFixture, grade9Path, "scripts/evaluate-rag.cjs", "scripts/rag-offline-evaluation.cjs", "tests/rag-live-replay.cjs", "lib/rag/retrieval.ts", "lib/rag/types.ts", "lib/server/rag-core.ts", "lib/ai/grounding.ts", "lib/ai/router.ts", "lib/ai/contracts.ts", "lib/tutor/math.ts", "lib/tutor/math-exact.ts"].map(fileProof),
    configuration: { productionPath: "Actual createStore(':memory:').ragSearch and ragPrepareSnapshot", maximumDocuments: RAG_LIMITS.documents, topK: RAG_LIMITS.hits, dimensions: RAG_LIMITS.dimensions, semanticThreshold: 0.35, selection: "Actual production diverseHits; no copied ranking/diversification algorithm" },
    checked: authored.length + syntheticGeometry.length + savedReplay.results.length + grade9.results.length,
    networkAttempts: result.networkAttempts, newProviderCalls: 0, realUserData: false,
    summary: { authoredLexical: aggregate(authored), syntheticGeometry: aggregate(syntheticGeometry), historicalSavedVectorReplay: Object.fromEntries(["lexical", "hybrid"].map((mode) => [mode, aggregate(savedReplay.results.filter((r) => r.mode === mode))])) },
    authored, syntheticGeometry, savedReplay, grade9,
    limitations: [
      "PASS means the explicitly scoped deterministic retrieval/snapshot assertions passed. It does not mean all retrieved passages answer a question or all contradictions are detected.",
      "Gold relevance and multilingual passages are developer-authored, with no held-out independent teacher or curriculum review.",
      "Diversification can rescue another document and also promote distractors. Per-case selected chunks, recall and precision remain visible; scores are not confidence.",
      "The overlapping but unanswerable passage is retained with explicit missing-data guidance. Literal direction contradictions are now narrowly flagged; other semantic contradictions remain outside the detector. No model abstention/semantic verification was tested.",
      "Direction comparison uses only the literal attribute sentence, preserving name diacritics. Context in separate preceding sentences (such as different dates) is not resolved, so a possible-conflict warning still requires human source review.",
      "Synthetic geometry cases establish threshold/fusion plumbing only; saved provider vectors establish historical replay only. No live model, generated answer, injection resistance, classroom pilot or student outcome is evaluated.",
    ],
  };
}

function outputPath(argument) {
  const output = path.resolve(root, argument || defaultOutput);
  const permitted = path.resolve(root, "docs/next/reports/phase2-ai") + path.sep;
  assert.ok(output.startsWith(permitted) && output.endsWith(".json"), "Output must be a new JSON report in docs/next/reports/phase2-ai");
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
module.exports = { validateFixture, multilingualCases, geometryCases, evaluateCase, evaluate, outputPath, withoutNetwork, main, validateGrade9, gradeAuthoredCandidate, grade9Evaluation };
if (require.main === module) { try { main(); } catch (error) { console.error(error); process.exitCode = 1; } }
