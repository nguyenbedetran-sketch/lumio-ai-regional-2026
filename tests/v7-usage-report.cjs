/* Actual admin handler/authorization + isolated SQLite. No provider transport. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
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
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "lumio-v7-usage-"));
const platform = load("lib/server/store.ts");
let now = Date.UTC(2026, 9, 16, 10);
const store = platform.createStore(path.join(directory, "isolated.sqlite"), {
  now: () => now,
  adminEmails: ["usage-owner@example.test"],
});
platform.getStore = () => store;
const route = load("app/api/admin/usage/route.ts");
const identity = (id, extra = {}) =>
  store.ensureIdentity({
    provider: "google",
    providerAccountId: id,
    name: "Authored fixture",
    emailVerified: false,
    ...extra,
  });
const owner = identity("owner", {
    email: "usage-owner@example.test",
    emailVerified: true,
  }),
  learner = identity("learner");
const authorize = (user, extra = {}) => {
  session = {
    userId: user.id,
    sessionVersion: user.sessionVersion,
    authenticatedAt: Date.now(),
    ...extra,
  };
};
const get = (query = "summary=1", account = owner.storageKey) =>
  route.GET(
    new Request("http://127.0.0.1/api/admin/usage?" + query, {
      headers: { "X-Lumio-Account": account },
    }),
  );
const event = (id, extra = {}) =>
  store.recordAIUsage({
    requestId: id,
    userId: learner.id,
    task: "chat",
    status: "success",
    latencyMs: 100,
    ...extra,
  });
async function check(name, run) {
  await run();
  checks.push(name);
  console.log("PASS " + name);
}
(async () => {
  try {
    await check(
      "Unauthenticated and ordinary users cannot read summary metadata",
      async () => {
        assert.equal((await get()).status, 401);
        authorize(learner);
        assert.equal(
          (await get("summary=1&dimension=user", learner.storageKey)).status,
          403,
        );
      },
    );
    await check(
      "Admin reauthentication and canonical account binding precede reads",
      async () => {
        authorize(owner, { authenticatedAt: Date.now() - 3600001 });
        assert.equal((await get()).status, 401);
        authorize(owner);
        assert.equal((await get("summary=1", learner.storageKey)).status, 401);
      },
    );
    await check(
      "Empty report retains null token/cost metrics rather than inventing zeros",
      async () => {
        const response = await get();
        assert.equal(response.status, 200);
        assert.match(response.headers.get("cache-control"), /no-store/);
        const body = await response.json();
        assert.equal(body.totals.requests, 0);
        assert.equal(body.totals.inputTokens, null);
        assert.equal(body.totals.recordedEstimatedCostUsd, null);
        assert.deepEqual(body.groups, []);
      },
    );
    await check(
      "Only bounded canonical summary parameters are accepted",
      async () => {
        for (const query of [
          "summary=0",
          "summary=1&days=0",
          "summary=1&days=32",
          "summary=1&days=1e1",
          "summary=1&days=7&days=8",
          "summary=1&dimension=model&dimension=user",
          "summary=1&dimension=DROP%20TABLE",
          "summary=1&offset=3",
        ])
          assert.equal((await get(query)).status, 400, query);
      },
    );
    await check(
      "Inclusive time window excludes older and future telemetry",
      async () => {
        now -= 8 * 86400000;
        event("older");
        now += 8 * 86400000;
        event("unpriced", {
          provider: "openai",
          model: "shared-name",
          inputTokens: 10,
          outputTokens: 5,
        });
        event("measured-zero", {
          userId: owner.id,
          task: "summary",
          provider: "gemini",
          model: "shared-name",
          inputTokens: 20,
          outputTokens: 10,
          estimatedCostUsd: 0,
          status: "error",
          errorCode: "AUTHORED_ERROR",
        });
        event("measured-value", {
          provider: "openai",
          model: "shared-name",
          estimatedCostUsd: 0.0025,
          latencyMs: 300,
        });
        event("unknown", { userId: null, task: "voice", latencyMs: 0 });
        now += 86400000;
        event("future");
        now -= 86400000;
        assert.equal(store.getUsageBreakdown("model", 7).totals.requests, 4);
        assert.equal(store.getUsageBreakdown("model", 14).totals.requests, 5);
      },
    );
    await check(
      "Partial recorded costs carry coverage; unknown costs remain null",
      () => {
        const report = store.getUsageBreakdown("model");
        assert.equal(report.totals.recordedEstimatedCostUsd, 0.0025);
        assert.equal(report.totals.costRecords, 2);
        assert.equal(report.totals.unpricedRequests, 2);
        assert.equal(
          report.groups.find((g) => g.key === "unknown")
            .recordedEstimatedCostUsd,
          null,
        );
        assert.equal(
          report.groups.find((g) => g.provider === "gemini")
            .recordedEstimatedCostUsd,
          0,
        );
      },
    );
    await check(
      "Same-named models from different providers remain distinct",
      () => {
        const report = store.getUsageBreakdown("model");
        assert.equal(
          report.groups.filter((g) => g.key === "shared-name").length,
          2,
        );
        assert.equal(
          report.groups.find((g) => g.provider === "openai").requests,
          2,
        );
      },
    );
    await check(
      "Task and account attribution derive existing outcome rows, not profile text",
      () => {
        assert.equal(
          store
            .getUsageBreakdown("task")
            .groups.find((g) => g.key === "summary").errors,
          1,
        );
        assert.equal(
          store
            .getUsageBreakdown("user")
            .groups.find((g) => g.key === learner.id).requests,
          2,
        );
        const serialized = JSON.stringify(store.getUsageBreakdown("user"));
        assert.ok(!serialized.includes("usage-owner@example.test"));
        assert.ok(!serialized.includes("Authored fixture"));
      },
    );
    await check(
      "Existing telemetry request uniqueness prevents duplicated outcome counts",
      () => {
        event("unpriced", { estimatedCostUsd: 999 });
        assert.equal(store.getUsageBreakdown("model").totals.requests, 4);
        assert.equal(
          store.getUsageBreakdown("model").totals.recordedEstimatedCostUsd,
          0.0025,
        );
      },
    );
    await check(
      "Direct service calls reject unbounded dimensions and windows",
      () => {
        assert.throws(() => store.getUsageBreakdown("private_sql"), {
          code: "INVALID_USAGE_DIMENSION",
        });
        for (const days of [0, 32, 1.2, NaN])
          assert.throws(() => store.getUsageBreakdown("model", days), {
            code: "INVALID_USAGE_WINDOW",
          });
      },
    );
    await check(
      "Groups are bounded while totals retain all rows and expose truncation",
      () => {
        for (let index = 0; index < 30; index++)
          event("many-" + index, { task: "fixture-" + index });
        const report = store.getUsageBreakdown("task");
        assert.equal(report.groups.length, 25);
        assert.equal(report.truncated, true);
        assert.equal(report.totals.requests, 34);
      },
    );
    await check(
      "Response explicitly limits evidence and does not expose billing or source content",
      async () => {
        const report = await (
          await get("summary=1&dimension=task&days=7")
        ).json();
        assert.equal(report.scope, "recorded-request-outcomes");
        assert.equal(report.limitations.length, 4);
        assert.ok(!Object.hasOwn(report, "balance"));
        assert.ok(!Object.hasOwn(report, "source"));
        assert.ok(!Object.hasOwn(report, "email"));
        assert.deepEqual(
          Object.keys(report.groups[0]).sort(),
          [
            "requests",
            "errors",
            "inputTokens",
            "outputTokens",
            "tokenRecords",
            "recordedEstimatedCostUsd",
            "costRecords",
            "unpricedRequests",
            "averageLatencyMs",
            "key",
            "provider",
          ].sort(),
        );
      },
    );
    await check(
      "Legacy paginated usage rejects stale account headers before reading events",
      async () => {
        assert.equal((await get("offset=0", learner.storageKey)).status, 401);
      },
    );
    await check(
      "Legacy paginated usage remains compatible with canonical account",
      async () => {
        const response = await get("offset=0");
        assert.equal(response.status, 200);
        const result = await response.json();
        assert.equal(result.events.length, 30);
      },
    );
    fs.mkdirSync(path.join(root, "docs/v7/reports"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "docs/v7/reports/usage-breakdown.json"),
      JSON.stringify(
        {
          status: "PASS",
          runAt: new Date().toISOString(),
          checks: checks.length,
          cases: checks,
          scope:
            "Actual handler, canonical authorization and isolated SQLite; authored metadata only, no provider or cost invoice validation.",
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      `${checks.length} usage report checks passed; no provider calls.`,
    );
  } finally {
    store.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
