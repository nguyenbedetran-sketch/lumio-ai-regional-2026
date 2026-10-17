/* Actual SQLite/core journal and read SQL; authored metadata only. No provider. */
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), ts = require("typescript");
const { DatabaseSync } = require("node:sqlite");
const { load } = require("./source-grounding.cjs");
const { createStore } = load("lib/server/store.ts");
const { usageBreakdown } = load("lib/server/usage-report.ts");
const { providerAttemptBreakdown } = load("lib/server/provider-attempt-report.ts");
const root = path.resolve(__dirname, ".."), now = Date.parse("2026-10-17T06:00:00Z"), db = new DatabaseSync(":memory:");
const store = createStore(":memory:", { database: db, now: () => now });
const user = (id) => store.ensureIdentity({ provider: "google", providerAccountId: id, name: "Synthetic telemetry user " + id, emailVerified: false });
const a = user("a"), b = user("b"), checks = [];
const check = (name, run) => { run(); checks.push(name); console.log("PASS " + name); };
const queryCounter = { count: 0, sql: [], prepare(sql) { this.count++; this.sql.push(sql); return db.prepare(sql); } };
const outcomes = (dimension = "model", days = 7) => usageBreakdown(queryCounter, now, dimension, days);
const attempts = (dimension = "model", days = 7) => providerAttemptBreakdown(queryCounter, now, dimension, days);
const observed = [], recorded = [];
function context(user = a, feature = "learner.chat") {
  const requestId = crypto.randomUUID(), reservation = store.reserveUsage({ userId: user.id, sessionVersion: user.sessionVersion, requestId, task: "chat", mode: "quick", kind: "text" });
  return store.providerAttemptObserver({ userId: user.id, sessionVersion: user.sessionVersion, requestId, reservationId: reservation.reservationId, feature });
}
const observer = context(), other = context(b, "learner.tutor");
function seed(model, latency, status = "response_received", httpStatus = 200, provider = "openai", owner = observer) {
  const row = owner.prepare({ provider, endpointKind: provider === "openai" ? "responses" : "generate-content", requestedModel: model });
  if (status !== "prepared") row.finish({ status, ...(latency === null ? {} : { latencyMs: latency }), ...(httpStatus === null ? {} : { httpStatus }) });
  observed.push({ model, latency: status === "prepared" ? null : latency, status, httpStatus: status === "prepared" ? null : httpStatus, provider, owner: owner === observer ? a.id : b.id, feature: owner === observer ? "learner.chat" : "learner.tutor" });
}
function outcome(model, latency, status = "success", provider = "openai", owner = a, task = "chat") {
  store.recordAIUsage({ requestId: crypto.randomUUID(), userId: owner.id, task, provider, model, status, ...(latency === null ? {} : { latencyMs: latency }) });
  recorded.push({ model, latency: latency ?? 0, status, provider, owner: owner.id, task });
}
const nearest = (values, p) => { const sorted = values.filter((n) => n !== null).sort((a, b) => a - b); return sorted.length ? sorted[Math.ceil(p * sorted.length) - 1] : null; };
let finalOutcomes, finalAttempts;
try {
  check("Empty populations retain null percentiles/ratios and known zero sample counts", () => {
    for (const report of [outcomes(), attempts()]) {
      assert.equal(report.totals.p50LatencyMs, null); assert.equal(report.totals.p95LatencyMs, null); assert.equal(report.totals.latencyRecords, 0);
      assert.equal(report.totals.httpStatusCoverage, null); assert.equal(report.totals.httpErrorRatio, null);
    }
    assert.equal(outcomes().totals.recordedErrorRatio, null); assert.equal(outcomes().totals.observedLatencyRecords, null);
    assert.equal(attempts().totals.observedLatencyRecords, 0);
  });
  outcome("shared", 0); outcome("shared", 100, "error"); outcome("shared", 200); outcome("shared", 5000);
  outcome("shared", 10, "success", "gemini"); outcome("legacy-zero", null, "error", "openai", b, "cards");
  seed("shared", 0); seed("shared", 100, "response_received", 500); seed("shared", 500, "response_received", 302);
  seed("shared", null, "response_received", null); seed("shared", 200, "network_unknown", null); seed("shared", null, "prepared", null);
  seed("shared", 10, "response_received", 200, "gemini");
  seed("unknown", null, "network_unknown", null, "openai", other); seed("unknown", null, "prepared", null, "openai", other);
  for (let i = 1; i <= 21; i++) seed("rank-21", i, "response_received", i % 5 === 0 ? 429 : 200);
  check("Nearest-rank median uses lower middle observed value; no interpolation or null-to-zero", () => {
    const group = attempts().groups.find((r) => r.key === "shared" && r.provider === "openai");
    assert.equal(group.latencyRecords, 4); assert.equal(group.observedLatencyRecords, 4);
    assert.equal(group.p50LatencyMs, 100); assert.equal(group.p95LatencyMs, 500); assert.equal(group.averageLatencyMs, 200);
    const unknown = attempts().groups.find((r) => r.key === "unknown");
    assert.equal(unknown.latencyRecords, 0); assert.equal(unknown.p50LatencyMs, null); assert.equal(unknown.p95LatencyMs, null);
  });
  check("p50/p95 rank boundaries for 21 samples are ranks11/20, not interpolated20.05", () => {
    const group = attempts().groups.find((r) => r.key === "rank-21");
    assert.equal(group.p50LatencyMs, 11); assert.equal(group.p95LatencyMs, 20); assert.equal(group.latencyRecords, 21);
  });
  check("Genuine zero latency remains a measured sample and single-sample quantiles stay zero", () => {
    seed("zero-only", 0, "response_received", 200);
    const group = attempts().groups.find((r) => r.key === "zero-only");
    assert.equal(group.p50LatencyMs, 0); assert.equal(group.p95LatencyMs, 0); assert.equal(group.latencyRecords, 1);
  });
  check("HTTP ratio divides errors by known statuses; unknown transport/prepared are not successes/errors", () => {
    const group = attempts().groups.find((r) => r.key === "shared" && r.provider === "openai");
    assert.equal(group.attempts, 6); assert.equal(group.httpStatusRecords, 3); assert.equal(group.httpErrors, 1);
    assert.equal(group.httpErrorRatio, 1 / 3); assert.equal(group.httpStatusCoverage, 3 / 6);
    const unknown = attempts().groups.find((r) => r.key === "unknown");
    assert.equal(unknown.httpStatusRecords, 0); assert.equal(unknown.httpErrorRatio, null); assert.equal(unknown.httpStatusCoverage, 0);
  });
  check("Outcome zero coercion is exposed without inventing observed count or HTTP metadata", () => {
    const r = outcomes(), group = r.groups.find((g) => g.key === "legacy-zero");
    assert.equal(group.p50LatencyMs, 0); assert.equal(group.latencyRecords, 1); assert.equal(group.observedLatencyRecords, null);
    assert.equal(group.recordedErrorRatio, 1); assert.equal(group.httpStatusRecords, null); assert.equal(group.httpStatusCoverage, null); assert.equal(group.httpErrorRatio, null);
    assert.ok(r.limitations.some((v) => /absent\/invalid latency as zero/.test(v)));
    assert.equal(r.totals.recordedErrorRatio, 2 / 6);
  });
  check("All three closed dimensions match independent sorted samples in totals and every shown group", () => {
    for (const dimension of ["model", "task", "user"]) for (const [get, data, attempt] of [[outcomes, recorded, false], [attempts, observed, true]]) {
      const r = get(dimension);
      assert.equal(r.totals.p50LatencyMs, nearest(data.map((v) => v.latency), .5)); assert.equal(r.totals.p95LatencyMs, nearest(data.map((v) => v.latency), .95));
      for (const group of r.groups) {
        const samples = data.filter((v) => dimension === "model" ? v.model === group.key && v.provider === group.provider : dimension === "user" ? v.owner === group.key : (attempt ? v.feature : v.task) === group.key).map((v) => v.latency);
        assert.equal(group.p50LatencyMs, nearest(samples, .5)); assert.equal(group.p95LatencyMs, nearest(samples, .95));
        assert.equal(group.latencyRecords, samples.filter((v) => v !== null).length);
      }
    }
  });
  check("Grouping preserves provider identity and user IDs without names, prompts or invoice prices", () => {
    const r = attempts(); assert.equal(r.groups.filter((g) => g.key === "shared").length, 2);
    assert.equal(r.totals.estimatedCostUsd, null); assert.equal(r.totals.unpricedAttempts, r.totals.attempts);
    assert.ok(!JSON.stringify(attempts("user")).includes("Synthetic telemetry user"));
    assert.equal(outcomes().totals.recordedEstimatedCostUsd, null);
  });
  check("A large group count still uses exactly two outcome/four attempt statements with no N+1 RPC", () => {
    for (let i = 0; i < 30; i++) { seed("bounded-" + i, i); outcome("bounded-" + i, i); }
    queryCounter.count = 0; const out = outcomes(); assert.equal(queryCounter.count, 2);
    queryCounter.count = 0; const att = attempts(); assert.equal(queryCounter.count, 4);
    assert.equal(out.groups.length, 25); assert.equal(att.groups.length, 25); assert.equal(out.truncated, true); assert.equal(att.truncated, true);
    assert.equal(out.totals.requests, recorded.length); assert.equal(att.totals.attempts, observed.length);
    assert.ok(queryCounter.sql.some((q) => /row_number\(\) OVER/.test(q)));
    assert.ok(queryCounter.sql.every((q) => /^\s*SELECT\b/i.test(q)), "Preserve the current remote adapter's read-only classification");
  });
  check("Future/out-of-window samples never enter nearest-rank statistics", () => {
    // Authored fixtures inserted outside the selected cohort; not mutations of real telemetry.
    db.prepare("INSERT INTO ai_usage(id,request_id,user_id,task,status,latency_ms,created_at) VALUES (?,?,?,?,?,?,?)").run(crypto.randomUUID(), crypto.randomUUID(), a.id, "chat", "error", 999999, new Date(now + 1).toISOString());
    db.prepare("INSERT INTO ai_usage(id,request_id,user_id,task,status,latency_ms,created_at) VALUES (?,?,?,?,?,?,?)").run(crypto.randomUUID(), crypto.randomUUID(), a.id, "chat", "error", 999999, new Date(now - 8 * 86400000).toISOString());
    assert.equal(outcomes().totals.requests, recorded.length);
    assert.equal(outcomes( "model", 14).totals.requests, recorded.length + 1);
    assert.equal(outcomes().totals.p95LatencyMs, nearest(recorded.map((v) => v.latency), .95));
  });
  check("Invalid dimensions and windows reject before preparing any SQL", () => {
    queryCounter.count = 0;
    for (const get of [outcomes, attempts]) { assert.throws(() => get("model; DROP TABLE users"), (e) => e.code === "INVALID_USAGE_DIMENSION"); assert.throws(() => get("model", 32), (e) => e.code === "INVALID_USAGE_WINDOW"); }
    assert.equal(queryCounter.count, 0);
  });
  check("Actual React telemetry view renders quantiles/counts/HTTP denominators and unknowns without NaN", () => {
    const filename = path.join(root, "components/admin/usage-breakdown.tsx"), module = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    new Function("require", "module", "exports", code)(require, module, module.exports);
    const React = require("react"), { renderToStaticMarkup } = require("react-dom/server");
    finalAttempts = attempts(); finalOutcomes = outcomes();
    const html = renderToStaticMarkup(React.createElement(module.exports.AttemptBreakdownView, { report: finalAttempts }));
    assert.match(html, /p50/); assert.match(html, /p95/); assert.match(html, /mã HTTP đã ghi/); assert.match(html, /làm tròn hạng lên/); assert.ok(!html.includes("NaN") && !html.includes("undefined"));
    const empty = renderToStaticMarkup(React.createElement(module.exports.LatencyDetails, { metrics: { averageLatencyMs: null, p50LatencyMs: null, p95LatencyMs: null, latencyRecords: 0, observedLatencyRecords: 0 } }));
    assert.match(empty, /p50 — ms/); assert.match(empty, /0 bản ghi/);
    const legacy = renderToStaticMarkup(React.createElement(module.exports.LatencyDetails, { metrics: finalOutcomes.totals, legacy: true }));
    assert.match(legacy, /số giá trị đo thực chưa xác định/);
    const oldFixture = renderToStaticMarkup(React.createElement(module.exports.LatencyDetails, { metrics: { averageLatencyMs: 0 } }));
    assert.ok(!oldFixture.includes("NaN"));
  });
  const folder = path.join(root, "docs/next/reports/v14-telemetry"); fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, "distributions.json"), JSON.stringify({ checkedAt: new Date().toISOString(), status: "PASS", passed: checks.length, checks, sourceProof: ["lib/server/latency-report-sql.ts", "lib/server/usage-report.ts", "lib/server/provider-attempt-report.ts", "components/admin/usage-breakdown.tsx", "tests/v14-telemetry-distributions.cjs"].map((file) => ({ path: file, sha256: crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex") })), outcomes: finalOutcomes, attempts: finalAttempts, newProviderCalls: 0, scope: "Actual isolated SQLite, existing reservation/journal core, report SQL and actual React SSR. Synthetic telemetry only, no remote database, live browser/account/provider or invoice/production latency proof. Percentiles nearest-rank over retained recorded cohort, with source-specific null/legacy-zero provenance." }, null, 2) + "\n");
  console.log(checks.length + " telemetry distribution checks PASS; no provider calls.");
} finally { store.close(); }
