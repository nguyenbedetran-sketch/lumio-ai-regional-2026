// Actual admin route + authorization + temporary SQLite. Never opens the application database or calls providers.
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  ts = require("typescript"),
  { DatabaseSync } = require("node:sqlite");
const root = path.resolve(__dirname, ".."),
  cache = new Map(),
  checks = [];
let session = null,
  now = Date.now();
function load(relative) {
  const file = path.resolve(root, relative);
  if (file === path.join(root, "lib/lumio/auth.ts"))
    return { authOptions: () => ({}) };
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
    (n) =>
      n === "next-auth"
        ? { getServerSession: async () => session }
        : n.startsWith(".")
          ? load(
              path.relative(root, path.resolve(path.dirname(file), n + ".ts")),
            )
          : require(n),
    m,
    m.exports,
  );
  return m.exports;
}
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "lumio-v8-job-health-")),
  file = path.join(folder, "isolated.sqlite"),
  platform = load("lib/server/store.ts");
const store = platform.createStore(file, {
    now: () => now,
    adminEmails: ["queue-owner@example.test"],
  }),
  db = new DatabaseSync(file);
platform.getStore = () => store;
const route = load("app/api/admin/jobs/route.ts"),
  oldBackground = process.env.LUMIO_BACKGROUND_JOBS_DISABLED,
  originalFetch = global.fetch;
process.env.LUMIO_BACKGROUND_JOBS_DISABLED = "true";
global.fetch = async () => {
  throw Error("EXTERNAL_NETWORK_FORBIDDEN");
};
const user = (id, extra = {}) =>
  store.ensureIdentity({
    provider: "google",
    providerAccountId: "job-health-" + id,
    name: "PRIVATE_SYNTHETIC_NAME_" + id,
    emailVerified: false,
    ...extra,
  });
const owner = user("owner", {
    email: "queue-owner@example.test",
    emailVerified: true,
  }),
  learner = user("learner"),
  disabled = user("disabled"),
  dev = user("developer");
db.prepare("UPDATE users SET role='DEV' WHERE id=?").run(dev.id);
const authorize = (u, extra = {}) => {
  session = u
    ? {
        userId: u.id,
        sessionVersion: u.sessionVersion,
        authenticatedAt: Date.now(),
        ...extra,
      }
    : null;
};
async function get(status = 200, extra = {}) {
  const response = await route.GET(
    new Request("http://127.0.0.1:3000/api/admin/jobs" + (extra.query || ""), {
      headers: {
        "X-Lumio-Account": extra.account || owner.storageKey,
        ...extra.headers,
      },
    }),
  );
  const result = await response.json();
  assert.equal(response.status, status, JSON.stringify(result));
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  return result;
}
async function check(name, fn) {
  await fn();
  checks.push({ name, status: "PASS" });
  console.log("PASS " + name);
}
function job(id, status, extra = {}) {
  db.prepare(
    "INSERT INTO summary_jobs(id,user_id,session_version,request_key,fingerprint,source_digest,title,source_type,input_json,status,total,available_at,created_at,updated_at,expires_at,error_code,result_json) VALUES(?,?,?,?,?,?,?,'text',?,?,1,?,?,?,?,?,?)",
  ).run(
    id,
    extra.userId || learner.id,
    extra.version ?? learner.sessionVersion,
    id,
    "synthetic-fingerprint-" + id,
    "PRIVATE_DIGEST_" + id,
    "PRIVATE_JOB_TITLE_" + id,
    JSON.stringify({ source: "PRIVATE_SOURCE_" + id }),
    status,
    extra.available ?? now - 1,
    new Date(now - (extra.age ?? 90) * 1000).toISOString(),
    new Date(now).toISOString(),
    extra.expiry ?? now + 86400000,
    "PRIVATE_ERROR_" + id,
    JSON.stringify({ answer: "PRIVATE_OUTPUT_" + id }),
  );
  if (status === "running")
    db.prepare(
      "INSERT INTO summary_job_parts(job_id,ordinal,input_json,status,attempts,lease_sequence,lease_token,lease_until) VALUES(?,0,?,'running',1,1,?,?)",
    ).run(
      id,
      '{"text":"PRIVATE_PART"}',
      extra.missing ? null : "PRIVATE_LEASE_" + id,
      extra.missing ? null : (extra.lease ?? now + 1000),
    );
}
const snapshot = () =>
  JSON.stringify({
    jobs: db.prepare("SELECT * FROM summary_jobs ORDER BY id").all(),
    parts: db.prepare("SELECT * FROM summary_job_parts ORDER BY job_id").all(),
    audit: db.prepare("SELECT count(*) n FROM audit_events").get(),
    ledger: db.prepare("SELECT count(*) n FROM billing_ledger").get(),
  });
(async () => {
  try {
    await check(
      "Unauthenticated and ordinary users cannot inspect global queue metadata",
      async () => {
        authorize(null);
        assert.equal((await get(401)).error, "SIGN_IN_REQUIRED");
        authorize(learner);
        assert.equal(
          (await get(403, { account: learner.storageKey })).error,
          "FORBIDDEN",
        );
      },
    );
    await check(
      "Recent admin session and exact bound account are required",
      async () => {
        authorize(owner, { authenticatedAt: Date.now() - 3600001 });
        assert.equal((await get(401)).error, "ADMIN_REAUTH_REQUIRED");
        authorize(owner);
        assert.equal(
          (await get(401, { account: learner.storageKey })).error,
          "SESSION_REVOKED",
        );
      },
    );
    await check(
      "Cross-site, bearer and arbitrary query scope are rejected",
      async () => {
        authorize(owner);
        assert.equal(
          (await get(403, { headers: { "sec-fetch-site": "cross-site" } }))
            .error,
          "INVALID_ORIGIN",
        );
        await get(403, {
          headers: { authorization: "Bearer synthetic-device-token" },
        });
        await get(400, { query: "?userId=forged" });
      },
    );
    await check(
      "An empty database returns zero stored counts and unknown wait time, not fabricated health",
      async () => {
        const r = await get();
        assert.equal(r.retainedJobs, 0);
        assert.equal(r.oldestEligibleWaitSeconds, null);
        assert.equal(r.nextRetryAt, null);
        assert.equal(r.backgroundJobsConfigured, false);
        assert.equal(r.recovery, "owner-access-driven");
        assert.equal(
          Object.values(r.statuses).reduce((a, b) => a + b, 0),
          0,
        );
        assert.equal("workerAlive" in r, false);
        assert.equal("backupHealthy" in r, false);
      },
    );
    job("ready", "queued", { age: 300 });
    job("future", "queued", { available: now + 30000 });
    job("retry-future", "retry_wait", { available: now + 60000 });
    job("retry-ready", "retry_wait");
    job("paused", "paused");
    job("running-good", "running");
    job("running-expired", "running", { lease: now });
    job("running-missing", "running", { missing: true });
    job("complete", "completed");
    job("failed", "failed");
    job("cancelled", "cancelled");
    job("expired-retained", "queued", { expiry: now });
    job("revoked-session", "queued", { version: learner.sessionVersion - 1 });
    job("disabled-actor", "queued", {
      userId: disabled.id,
      version: disabled.sessionVersion,
    });
    db.prepare("UPDATE users SET disabled=1 WHERE id=?").run(disabled.id);
    await check(
      "Snapshot distinguishes retained statuses, eligibility, delayed retries and expired/missing leases",
      async () => {
        const r = await get();
        assert.equal(r.retainedJobs, 14);
        assert.deepEqual(r.statuses, {
          queued: 5,
          running: 3,
          retry_wait: 2,
          paused: 1,
          completed: 1,
          cancelled: 1,
          failed: 1,
        });
        assert.equal(r.eligiblePending, 4);
        assert.equal(r.readyNow, 2);
        assert.equal(r.delayedRetries, 1);
        assert.equal(r.oldestEligibleWaitSeconds, 300);
        assert.equal(r.expiredRetained, 1);
        assert.equal(r.revokedPending, 2);
        assert.equal(r.runningParts, 3);
        assert.equal(r.expiredRunningLeases, 1);
        assert.equal(r.missingRunningLeases, 1);
        assert.equal(r.nextRetryAt, new Date(now + 60000).toISOString());
      },
    );
    await check(
      "Response contains no raw title, source, user identity, lease, model output or error text",
      async () => {
        const r = await get(),
          serialized = JSON.stringify(r);
        assert.doesNotMatch(
          serialized,
          /PRIVATE_|job-health-|example\.test|userId|lease_token|input_json|result_json/,
        );
        for (const id of [
          owner.id,
          learner.id,
          disabled.id,
          dev.id,
          "running-good",
        ])
          assert.equal(serialized.includes(id), false);
      },
    );
    await check(
      "Repeated reads perform no cleanup, recovery, credit change or audit mutation",
      async () => {
        const before = snapshot();
        await get();
        await get();
        assert.equal(snapshot(), before);
        process.env.LUMIO_BACKGROUND_JOBS_DISABLED = "false";
        assert.equal((await get()).backgroundJobsConfigured, true);
        assert.equal(snapshot(), before);
      },
    );
    await check(
      "system.read developer role can view aggregates but learner cannot call store directly",
      async () => {
        authorize(dev);
        assert.equal(
          (await get(200, { account: dev.storageKey })).retainedJobs,
          14,
        );
        assert.throws(
          () => store.getJobHealth(learner.id, learner.sessionVersion),
          (e) => e.code === "FORBIDDEN",
        );
      },
    );
    await check(
      "Role/session revocation between route authorization and read is caught again in the transaction",
      async () => {
        authorize(owner);
        const original = store.getJobHealth;
        store.getJobHealth = (id, version) => {
          db.prepare("UPDATE users SET role='USER' WHERE id=?").run(id);
          return original(id, version);
        };
        try {
          await get(403);
        } finally {
          store.getJobHealth = original;
          db.prepare("UPDATE users SET role='SUPER_ADMIN' WHERE id=?").run(
            owner.id,
          );
        }
        store.getJobHealth = (id, version) => {
          db.prepare(
            "UPDATE users SET session_version=session_version+1 WHERE id=?",
          ).run(id);
          return original(id, version);
        };
        try {
          assert.equal((await get(401)).error, "SESSION_REVOKED");
        } finally {
          store.getJobHealth = original;
        }
      },
    );
    const report = {
      status: "PASS",
      passed: checks.length,
      checks,
      checkedAt: new Date().toISOString(),
      providerRequests: 0,
      scope:
        "Actual admin handler and isolated SQLite with synthetic jobs; read-only aggregates, no worker/backup/public-host claim.",
    };
    fs.mkdirSync(path.join(root, "docs/v8/reports"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "docs/v8/reports/job-health.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log("V8 job health: " + checks.length + " checks passed.");
  } finally {
    db.close();
    store.close();
    fs.rmSync(folder, { recursive: true, force: true });
    global.fetch = originalFetch;
    oldBackground === undefined
      ? delete process.env.LUMIO_BACKGROUND_JOBS_DISABLED
      : (process.env.LUMIO_BACKGROUND_JOBS_DISABLED = oldBackground);
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
