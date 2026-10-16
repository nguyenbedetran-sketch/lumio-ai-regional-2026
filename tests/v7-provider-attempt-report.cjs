// Actual admin guards, SQLite journal/core and read service; synthetic metadata only.
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  crypto = require("node:crypto"),
  ts = require("typescript");
const root = path.resolve(__dirname, ".."),
  cache = new Map(),
  checks = [];
let session = null;
function load(relative) {
  const file = path.resolve(root, relative);
  if (file === path.join(root, "lib/lumio/auth.ts"))
    return { authOptions: () => ({}) };
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  new Function("require", "module", "exports", code)(
    (name) =>
      name === "next-auth"
        ? { getServerSession: async () => session }
        : name.startsWith(".")
          ? load(
              path.relative(
                root,
                path.resolve(path.dirname(file), name + ".ts"),
              ),
            )
          : require(name),
    module,
    module.exports,
  );
  return module.exports;
}
const directory = fs.mkdtempSync(
  path.join(os.tmpdir(), "lumio-v7-attempt-report-"),
);
const platform = load("lib/server/store.ts");
let now = Date.UTC(2026, 9, 16, 10);
const store = platform.createStore(path.join(directory, "isolated.sqlite"), {
  now: () => now,
  adminEmails: ["attempt-owner@example.test"],
});
platform.getStore = () => store;
const route = load("app/api/admin/usage/route.ts"),
  owner = store.ensureIdentity({
    provider: "google",
    providerAccountId: "attempt-owner",
    email: "attempt-owner@example.test",
    emailVerified: true,
    name: "Authored owner",
  }),
  learner = store.ensureIdentity({
    provider: "google",
    providerAccountId: "attempt-learner",
    name: "Authored learner",
  });
function authorize(user, extra = {}) {
  session = {
    userId: user.id,
    sessionVersion: user.sessionVersion,
    authenticatedAt: Date.now(),
    ...extra,
  };
}
const get = (query = "summary=1&scope=attempts", account = owner.storageKey) =>
  route.GET(
    new Request("http://127.0.0.1/api/admin/usage?" + query, {
      headers: { "X-Lumio-Account": account },
    }),
  );
function context(user = learner, feature = "learner.chat") {
  const requestId = crypto.randomUUID(),
    reservation = store.reserveUsage({
      userId: user.id,
      sessionVersion: user.sessionVersion,
      requestId,
      task: "chat",
      mode: "quick",
      kind: "text",
    });
  return {
    userId: user.id,
    sessionVersion: user.sessionVersion,
    requestId,
    reservationId: reservation.reservationId,
    feature,
  };
}
function seed(c, details = {}, observation) {
  const handle = store.providerAttemptObserver(c).prepare({
    provider: "openai",
    endpointKind: "responses",
    requestedModel: "fixture-shared",
    ...details,
  });
  if (observation) handle.finish(observation);
  return handle;
}
async function check(name, run) {
  await run();
  checks.push(name);
  console.log("PASS " + name);
}
(async () => {
  try {
    await check(
      "Attempt scope is denied to anonymous, learner, stale-admin and stale intended accounts",
      async () => {
        assert.equal((await get()).status, 401);
        authorize(learner);
        assert.equal((await get(undefined, learner.storageKey)).status, 403);
        authorize(owner, { authenticatedAt: Date.now() - 3600001 });
        assert.equal((await get()).status, 401);
        authorize(owner);
        assert.equal((await get(undefined, learner.storageKey)).status, 401);
      },
    );
    await check(
      "Empty attempt metadata has zero counts but unknown tokens/cost and no fabricated activation date",
      async () => {
        const response = await get();
        assert.equal(response.status, 200);
        assert.match(response.headers.get("cache-control"), /no-store/);
        const r = await response.json();
        assert.equal(r.scope, "recorded-text-provider-attempts");
        assert.equal(r.totals.attempts, 0);
        assert.equal(r.totals.inputTokens, null);
        assert.equal(r.totals.estimatedCostUsd, null);
        assert.equal(r.firstRetainedAttemptAt, null);
        assert.deepEqual(r.groups, []);
      },
    );
    await check(
      "Attempt scope keeps strict query enums, duplicates, windows and legacy paging separate",
      async () => {
        for (const q of [
          "summary=1&scope=invoice",
          "summary=1&scope=attempts&scope=outcomes",
          "summary=1&scope=attempts&dimension=user&dimension=model",
          "summary=1&scope=attempts&days=32",
          "summary=1&scope=attempts&days=01",
          "summary=1&scope=attempts&dimension=sql",
          "summary=1&scope=attempts&offset=0",
          "scope=attempts&offset=0",
        ])
          assert.equal((await get(q)).status, 400, q);
      },
    );
    now -= 8 * 86400000;
    seed(
      context(),
      {},
      { status: "response_received", httpStatus: 200, inputTokens: 999 },
    );
    now += 8 * 86400000;
    const fallback = context();
    seed(
      fallback,
      {},
      {
        status: "response_received",
        httpStatus: 500,
        responseModel: "fixture-shared",
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
        latencyMs: 100,
        usageSource: "openai-response-usage",
      },
    );
    seed(
      fallback,
      { provider: "gemini", endpointKind: "generate-content" },
      {
        status: "response_received",
        httpStatus: 200,
        responseModel: "fixture-version",
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        latencyMs: 200,
        usageSource: "gemini-usage-metadata",
      },
    );
    seed(context());
    seed(
      context(),
      {},
      {
        status: "network_unknown",
        safeErrorCode: "NETWORK_UNKNOWN",
        latencyMs: 300,
      },
    );
    seed(
      context(owner, "learner.tutor"),
      {},
      {
        status: "response_received",
        httpStatus: 200,
        inputTokens: 1,
        latencyMs: 400,
      },
    );
    seed(context(), {}, { status: "timeout_unknown", latencyMs: 500 });
    now += 86400000;
    seed(
      context(),
      {},
      { status: "response_received", httpStatus: 200, inputTokens: 888 },
    );
    now -= 86400000;
    store.recordAIUsage({
      requestId: fallback.requestId,
      userId: learner.id,
      task: "chat",
      status: "success",
      provider: "gemini",
      model: "fixture-shared",
      latencyMs: 200,
    });
    await check(
      "Two fallback dispatches count separately from the one logical request outcome",
      async () => {
        const attempts = await (await get()).json(),
          outcomes = await (await get("summary=1")).json();
        assert.equal(attempts.totals.attempts, 6);
        assert.equal(outcomes.scope, "recorded-request-outcomes");
        assert.equal(outcomes.totals.requests, 1);
        assert.equal(attempts.totals.responses, 3);
        assert.equal(attempts.totals.unresolved, 1);
        assert.equal(attempts.totals.transportUnknown, 2);
        assert.equal(attempts.totals.httpErrors, 1);
      },
    );
    await check(
      "Observed zeros count toward token coverage while unknown usage stays null",
      () => {
        const r = store.getProviderAttemptBreakdown("model");
        assert.equal(r.totals.inputTokens, 11);
        assert.equal(r.totals.outputTokens, 5);
        assert.equal(r.totals.totalTokens, 15);
        assert.equal(r.totals.inputTokenRecords, 3);
        assert.equal(r.totals.outputTokenRecords, 2);
        assert.equal(r.totals.totalTokenRecords, 2);
        const zero = r.groups.find((g) => g.provider === "gemini");
        assert.equal(zero.inputTokens, 0);
        assert.equal(zero.inputTokenRecords, 1);
        assert.equal(r.totals.estimatedCostUsd, null);
        assert.equal(r.totals.unpricedAttempts, 6);
      },
    );
    await check(
      "Requested-model provider identities stay distinct and response aliases are disclosed separately",
      () => {
        const r = store.getProviderAttemptBreakdown("model");
        assert.equal(r.groups.length, 2);
        assert.equal(
          r.groups.filter((g) => g.key === "fixture-shared").length,
          2,
        );
        assert.equal(r.totals.responseModelRecords, 2);
        assert.equal(r.totals.changedModelRecords, 1);
      },
    );
    await check(
      "Preparation-time bounds exclude older/future records and retained-first is not an activation claim",
      () => {
        const r = store.getProviderAttemptBreakdown("model");
        assert.equal(r.totals.attempts, 6);
        assert.equal(
          store.getProviderAttemptBreakdown("model", 14).totals.attempts,
          7,
        );
        assert.equal(
          r.firstRetainedAttemptAt,
          new Date(now - 8 * 86400000).toISOString(),
        );
      },
    );
    await check(
      "Feature and user grouping use canonical metadata and omit names, sources and provider IDs",
      () => {
        assert.equal(
          store
            .getProviderAttemptBreakdown("task")
            .groups.find((g) => g.key === "learner.tutor").attempts,
          1,
        );
        assert.equal(
          store
            .getProviderAttemptBreakdown("user")
            .groups.find((g) => g.key === owner.id).attempts,
          1,
        );
        const r = store.getProviderAttemptBreakdown("user"),
          serialized = JSON.stringify(r);
        for (const absent of [
          "attempt-owner@example.test",
          "Authored owner",
          "Authored learner",
          "reservationId",
          "providerRequestId",
          "source",
          "balance",
        ])
          assert.ok(!serialized.includes('"' + absent + '"'), absent);
        assert.match(r.limitations.join(" "), /not a valid or accepted answer/);
        assert.match(r.limitations.join(" "), /not backfilled/);
      },
    );
    await check(
      "Direct report calls reject arbitrary SQL dimensions and unbounded windows",
      () => {
        assert.throws(() => store.getProviderAttemptBreakdown("private_sql"), {
          code: "INVALID_USAGE_DIMENSION",
        });
        for (const days of [0, 32, 1.2, NaN])
          assert.throws(
            () => store.getProviderAttemptBreakdown("model", days),
            { code: "INVALID_USAGE_WINDOW" },
          );
      },
    );
    await check(
      "25 displayed groups remain bounded while totals include all retained in-window attempts",
      () => {
        for (let i = 0; i < 30; i++)
          seed(
            context(),
            { requestedModel: "fixture-model-" + i },
            { status: "response_received", httpStatus: 200 },
          );
        const r = store.getProviderAttemptBreakdown("model");
        assert.equal(r.groups.length, 25);
        assert.equal(r.truncated, true);
        assert.equal(r.totals.attempts, 36);
      },
    );
    await check(
      "Explicit outcomes and legacy pagination retain their original response contracts",
      async () => {
        assert.equal(
          (await (await get("summary=1&scope=outcomes")).json()).totals
            .requests,
          1,
        );
        const r = await (await get("offset=0")).json();
        assert.equal(r.events.length, 1);
        assert.equal(r.events[0].requestId, fallback.requestId);
      },
    );
    await check(
      "Old unresolved rows remain visible in separate capacity totals without inflating the selected time cohort",
      () => {
        const before = store.getProviderAttemptBreakdown("model");
        now -= 40 * 86400000;
        seed(context());
        now += 40 * 86400000;
        const after = store.getProviderAttemptBreakdown("model");
        assert.equal(after.totals.attempts, before.totals.attempts);
        assert.equal(after.totals.unresolved, before.totals.unresolved);
        assert.equal(
          after.retainedAllAges.attempts,
          before.retainedAllAges.attempts + 1,
        );
        assert.equal(
          after.retainedAllAges.unresolved,
          before.retainedAllAges.unresolved + 1,
        );
        assert.equal(
          after.retainedAllAges.unresolvedOutsideWindow,
          before.retainedAllAges.unresolvedOutsideWindow + 1,
        );
        assert.deepEqual(after.limits, {
          total: 100000,
          unresolvedGlobal: 2048,
          unresolvedPerAccount: 64,
        });
      },
    );
    fs.mkdirSync(path.join(root, "docs/v7/reports"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "docs/v7/reports/provider-attempt-report.json"),
      JSON.stringify(
        {
          status: "PASS",
          checkedAt: new Date().toISOString(),
          passed: checks.length,
          cases: checks,
          providerCalls: 0,
          scope:
            "Actual administrator guards, journal/core and SQLite aggregation with authored metadata and synthetic sessions. Not provider transport, price/invoice verification or a public deployment.",
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      checks.length +
        " provider-attempt report checks passed; no provider calls.",
    );
  } finally {
    store.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
