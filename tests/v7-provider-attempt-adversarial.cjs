/* Independent adversarial checks: actual Router/journal/reservations/SQLite,
 * injected provider transport and SQLite faults. No live service or user data. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  crypto = require("node:crypto"),
  ts = require("typescript"),
  { DatabaseSync } = require("node:sqlite");
const openedDatabases = [],
  openedStores = [];
function openDatabase(file, options) {
  const db = new DatabaseSync(file, options || {});
  openedDatabases.push(db);
  return db;
}
function openStore(file, options) {
  const store = createStore(file, options);
  openedStores.push(store);
  return store;
}
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
    (n) =>
      n.startsWith(".")
        ? load(path.resolve(path.dirname(file), n + ".ts"))
        : require(n),
    m,
    m.exports,
  );
  return m.exports;
}
const env = {
  LUMIO_AI_ENABLED: "true",
  LUMIO_PUBLIC_DEMO: "false",
  LUMIO_DESKTOP: "false",
  LUMIO_COMPETITION_PREVIEW: "false",
  OPENAI_API_KEY: "synthetic-not-real",
  OPENAI_MODEL: "fixture-openai",
  OPENAI_MODEL_QUICK: "fixture-openai",
  GEMINI_API_KEY: "synthetic-not-real",
  GEMINI_MODEL: "fixture-gemini",
  GEMINI_MODEL_QUICK: "fixture-gemini",
};
const saved = Object.fromEntries(
  Object.keys(env).map((k) => [k, process.env[k]]),
);
Object.assign(process.env, env);
const originalFetch = global.fetch;
global.fetch = async () => {
  throw Error("REAL_NETWORK_FORBIDDEN");
};
const { createStore } = load("lib/server/store.ts"),
  { validateInput } = load("lib/ai/contracts.ts"),
  { routeAI } = load("lib/ai/router.ts"),
  { PROVIDER_ATTEMPT_LIMITS } = load("lib/server/provider-attempt-core.ts"),
  { migrations } = load("lib/server/schema.ts"),
  { assertDatabaseIntegrity, DATABASE_SCHEMA_VERSION } = load(
    "lib/server/database-integrity.ts",
  ),
  { providerAttemptMigration } = load("lib/server/provider-attempt-schema.ts"),
  folder = fs.mkdtempSync(
    path.join(os.tmpdir(), "lumio-v7-attempt-adversarial-"),
  );
const prepare = {
  provider: "openai",
  requestedModel: "fixture-openai",
  endpointKind: "responses",
};
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
function fixture() {
  const file = path.join(folder, crypto.randomUUID() + ".sqlite");
  let time = Date.UTC(2026, 9, 16);
  const store = openStore(file, { now: () => time }),
    db = openDatabase(file);
  const user = store.ensureIdentity({
    provider: "google",
    providerAccountId: crypto.randomUUID(),
    name: "Synthetic learner",
    emailVerified: false,
  });
  const requestId = "adversarial-" + crypto.randomUUID();
  const reservation = store.reserveUsage({
    userId: user.id,
    sessionVersion: user.sessionVersion,
    requestId,
    task: "chat",
    kind: "text",
    mode: "quick",
  });
  const context = {
    userId: user.id,
    sessionVersion: user.sessionVersion,
    requestId,
    reservationId: reservation.reservationId,
    feature: "learner.chat",
  };
  return {
    file,
    store,
    db,
    user,
    reservation,
    context,
    observer: () => store.providerAttemptObserver(context),
    rows: () =>
      db
        .prepare("SELECT * FROM ai_provider_attempts ORDER BY dispatch_ordinal")
        .all(),
    advance: (value) => {
      time += value;
    },
    now: () => time,
    close: () => {
      db.close();
      store.close();
    },
  };
}
const input = (patch) =>
  validateInput({
    task: "chat",
    language: "vi",
    mode: "quick",
    source: "SYNTHETIC_PRIVATE_SOURCE_DO_NOT_LOG",
    question: "SYNTHETIC_PRIVATE_PROMPT_DO_NOT_LOG",
    ...patch,
  });
const openai = (patch = {}) =>
  Response.json({
    model: "fixture-openai-reported",
    output: [
      {
        content: [
          { type: "output_text", text: "SYNTHETIC_PRIVATE_OUTPUT_DO_NOT_LOG" },
        ],
      },
    ],
    ...patch,
  });
const gemini = (patch = {}) =>
  Response.json({
    modelVersion: "fixture-gemini-reported",
    candidates: [
      {
        finishReason: "STOP",
        content: { parts: [{ text: "Synthetic fallback answer" }] },
      },
    ],
    ...patch,
  });
async function check(name, run) {
  await run();
  checks.push({ name, status: "PASS" });
  console.log("PASS " + name);
}
async function withFixture(run) {
  const f = fixture();
  try {
    await run(f);
  } finally {
    f.close();
  }
}
async function main() {
  try {
    await check(
      "A failed SQLite prepare stops before dispatch and cannot cause fallback",
      () =>
        withFixture(async (f) => {
          f.db.exec(
            "CREATE TRIGGER synthetic_prepare_fault BEFORE INSERT ON ai_provider_attempts BEGIN SELECT RAISE(ABORT,'SYNTHETIC_STORAGE_FAILURE'); END",
          );
          let calls = 0;
          await assert.rejects(
            routeAI(
              input(),
              async () => {
                calls++;
                return openai();
              },
              undefined,
              f.observer(),
            ),
            (e) => e.code === "AI_ATTEMPT_UNAVAILABLE",
          );
          assert.equal(calls, 0);
          assert.equal(f.rows().length, 0);
        }),
    );
    await check(
      "Terminal SQLite and warning failures cannot replace a successful response with another paid dispatch",
      () =>
        withFixture(async (f) => {
          f.db.exec(
            "CREATE TRIGGER synthetic_terminal_fault BEFORE UPDATE ON ai_provider_attempts BEGIN SELECT RAISE(ABORT,'SYNTHETIC_STORAGE_FAILURE'); END",
          );
          const warn = console.warn;
          let calls = 0,
            warnings = 0;
          try {
            console.warn = () => {
              warnings++;
              throw Error("SYNTHETIC_WARNING_FAILURE");
            };
            const result = await routeAI(
              input(),
              async () => {
                calls++;
                return openai({ usage: { input_tokens: 9, output_tokens: 2 } });
              },
              undefined,
              f.observer(),
            );
            assert.equal(result.text, "SYNTHETIC_PRIVATE_OUTPUT_DO_NOT_LOG");
          } finally {
            console.warn = warn;
          }
          assert.equal(calls, 1);
          assert.equal(warnings, 1);
          assert.equal(f.rows().length, 1);
          assert.equal(f.rows()[0].status, "prepared");
          assert.equal(f.rows()[0].input_tokens, null);
        }),
    );
    await check(
      "HTTP error metadata is captured before the one existing fallback and both dispatch ordinals persist",
      () =>
        withFixture(async (f) => {
          let calls = 0;
          const result = await routeAI(
            input(),
            async () =>
              ++calls === 1
                ? Response.json(
                    {
                      model: "fixture-error-model",
                      usage: {
                        input_tokens: 0,
                        output_tokens: 3,
                        total_tokens: 7,
                        output_tokens_details: { reasoning_tokens: 4 },
                      },
                    },
                    {
                      status: 500,
                      headers: { "x-request-id": "req_fixture_error" },
                    },
                  )
                : gemini({
                    usageMetadata: {
                      promptTokenCount: 2,
                      candidatesTokenCount: 1,
                      totalTokenCount: 3,
                    },
                  }),
            undefined,
            f.observer(),
          );
          assert.equal(calls, 2);
          assert.equal(result.provider, "gemini");
          const [first, second] = f.rows();
          assert.equal(f.rows().length, 2);
          assert.deepEqual(
            [first.dispatch_ordinal, second.dispatch_ordinal],
            [1, 2],
          );
          assert.equal(first.http_status, 500);
          assert.equal(first.status, "response_received");
          assert.equal(first.response_model, "fixture-error-model");
          assert.equal(first.requested_model, "fixture-openai");
          assert.equal(first.provider_request_id, "req_fixture_error");
          assert.equal(first.input_tokens, 0);
          assert.equal(first.total_tokens, 7);
          assert.equal(first.reasoning_tokens, 4);
          assert.equal(second.response_model, "fixture-gemini-reported");
          assert.equal(second.requested_model, "fixture-gemini");
        }),
    );
    await check(
      "A non-JSON HTTP error records status without inventing model or zero usage",
      () =>
        withFixture(async (f) => {
          let calls = 0;
          await routeAI(
            input(),
            async () =>
              ++calls === 1
                ? new Response("SYNTHETIC_PRIVATE_ERROR_BODY", { status: 500 })
                : gemini(),
            undefined,
            f.observer(),
          );
          const first = f.rows()[0];
          assert.equal(calls, 2);
          assert.equal(first.http_status, 500);
          assert.equal(first.response_model, null);
          assert.equal(first.input_tokens, null);
          assert.equal(first.total_tokens, null);
          assert.ok(
            !JSON.stringify(f.rows()).includes("SYNTHETIC_PRIVATE_ERROR_BODY"),
          );
        }),
    );
    await check(
      "Oversized response cleanup failure cannot turn a bounded rejection into a paid fallback",
      () =>
        withFixture(async (f) => {
          let calls = 0;
          await assert.rejects(
            routeAI(
              input(),
              async () => {
                calls++;
                if (calls !== 1) return gemini();
                return new Response(
                  new ReadableStream({
                    start(controller) {
                      controller.enqueue(new Uint8Array(2 * 1024 * 1024 + 1));
                    },
                    cancel() {
                      throw Error("SYNTHETIC_READER_CANCEL_FAILURE");
                    },
                  }),
                );
              },
              undefined,
              f.observer(),
            ),
            (e) => e.code === "INVALID_PROVIDER_RESPONSE",
          );
          assert.equal(calls, 1);
          assert.equal(f.rows().length, 1);
          assert.equal(f.rows()[0].status, "response_received");
          assert.equal(f.rows()[0].http_status, 200);
          assert.equal(
            f.rows()[0].safe_error_code,
            "INVALID_PROVIDER_RESPONSE",
          );
          assert.equal(f.rows()[0].total_tokens, null);
        }),
    );
    await check(
      "Observed zero survives while missing totals and malformed token values remain null",
      () =>
        withFixture(async (f) => {
          await routeAI(
            input(),
            async () => {
              const response = openai({
                model: env.OPENAI_API_KEY,
                usage: {
                  input_tokens: 0,
                  output_tokens: "7",
                  input_tokens_details: { cached_tokens: 0 },
                  output_tokens_details: { reasoning_tokens: -1 },
                },
              });
              response.headers.set("x-request-id", env.OPENAI_API_KEY);
              return response;
            },
            undefined,
            f.observer(),
          );
          const r = f.rows()[0];
          assert.equal(r.input_tokens, 0);
          assert.equal(r.cached_tokens, 0);
          assert.equal(r.output_tokens, null);
          assert.equal(r.total_tokens, null);
          assert.equal(r.reasoning_tokens, null);
          assert.equal(r.response_model, null);
          assert.equal(r.provider_request_id, null);
          assert.equal(r.estimated_cost_usd, null);
          assert.ok(!JSON.stringify(r).includes("SYNTHETIC_PRIVATE_"));
        }),
    );
    await check(
      "An incomplete successful HTTP response retains observed usage even though the answer is rejected",
      () =>
        withFixture(async (f) => {
          let calls = 0;
          await assert.rejects(
            routeAI(
              input(),
              async () => {
                calls++;
                return openai({
                  status: "incomplete",
                  usage: {
                    input_tokens: 11,
                    output_tokens: 5,
                    total_tokens: 19,
                  },
                });
              },
              undefined,
              f.observer(),
            ),
            (e) => e.code === "INCOMPLETE_RESPONSE",
          );
          assert.equal(calls, 1);
          const r = f.rows()[0];
          assert.equal(r.status, "response_received");
          assert.equal(r.input_tokens, 11);
          assert.equal(r.total_tokens, 19);
        }),
    );
    await check(
      "Cancellation after dispatch records unknown receipt/cost and prevents fallback",
      () =>
        withFixture(async (f) => {
          const controller = new AbortController();
          let calls = 0;
          await assert.rejects(
            routeAI(
              input(),
              async () => {
                calls++;
                controller.abort(
                  new DOMException("Synthetic cancel", "AbortError"),
                );
                throw controller.signal.reason;
              },
              controller.signal,
              f.observer(),
            ),
          );
          assert.equal(calls, 1);
          const r = f.rows()[0];
          assert.equal(r.status, "cancelled_unknown");
          assert.equal(r.http_status, null);
          assert.equal(r.total_tokens, null);
          assert.equal(r.estimated_cost_usd, null);
        }),
    );
    await check(
      "Prepared observation finalizes after revocation/refund, but a new dispatch is rejected and terminal CAS never rewrites it",
      () =>
        withFixture(async (f) => {
          const observer = f.observer(),
            recorder = observer.prepare(prepare);
          f.store.failUsage({
            userId: f.user.id,
            reservationId: f.reservation.reservationId,
          });
          f.db
            .prepare(
              "UPDATE users SET disabled=1,session_version=session_version+1 WHERE id=?",
            )
            .run(f.user.id);
          recorder.finish({
            status: "response_received",
            httpStatus: 200,
            inputTokens: 8,
            responseModel: "fixture-real-response",
            usageSource: "openai-response-usage",
          });
          const savedRow = JSON.stringify(f.rows()[0]);
          assert.equal(f.rows()[0].status, "response_received");
          assert.equal(f.rows()[0].input_tokens, 8);
          recorder.finish({ status: "network_unknown", inputTokens: 99 });
          assert.equal(JSON.stringify(f.rows()[0]), savedRow);
          assert.throws(
            () => observer.prepare(prepare),
            (e) => e.code === "SESSION_REVOKED",
          );
        }),
    );
    await check(
      "Observer recreation and connection reopen preserve a durable ordinal instead of restarting it",
      () =>
        withFixture(async (f) => {
          f.observer()
            .prepare(prepare)
            .finish({ status: "response_received", httpStatus: 200 });
          const reopened = openStore(f.file, { now: f.now });
          try {
            reopened
              .providerAttemptObserver(f.context)
              .prepare(prepare)
              .finish({ status: "network_unknown" });
          } finally {
            reopened.close();
          }
          assert.deepEqual(
            f.rows().map((r) => r.dispatch_ordinal),
            [1, 2],
          );
        }),
    );
    await check(
      "Foreign actor/request/task and client-only observer metadata cannot forge a journal context",
      () =>
        withFixture(async (f) => {
          const other = f.store.ensureIdentity({
            provider: "google",
            providerAccountId: crypto.randomUUID(),
            name: "Other synthetic learner",
            emailVerified: false,
          });
          for (const patch of [
            { userId: other.id },
            { requestId: "unrelated" },
            { feature: "learner.quiz" },
            { prompt: "SYNTHETIC_PRIVATE_PROMPT" },
          ])
            assert.throws(
              () => f.store.providerAttemptObserver({ ...f.context, ...patch }),
              (e) => e.code === "AI_ATTEMPT_CONTEXT_INVALID",
            );
          assert.equal(f.rows().length, 0);
          const parsed = validateInput({
            ...input(),
            providerAttemptObserver: {
              feature: "teacher.lesson",
              userId: other.id,
            },
          });
          assert.equal(parsed.providerAttemptObserver, undefined);
        }),
    );
    await check(
      "Unresolved capacity refuses dispatch without silently dropping the prepare record",
      () =>
        withFixture(async (f) => {
          for (let n = 0; n < PROVIDER_ATTEMPT_LIMITS.unresolvedPerAccount; n++)
            f.observer().prepare(prepare);
          let calls = 0;
          await assert.rejects(
            routeAI(
              input(),
              async () => {
                calls++;
                return openai();
              },
              undefined,
              f.observer(),
            ),
            (e) => e.code === "AI_ATTEMPT_CAPACITY",
          );
          assert.equal(calls, 0);
          assert.equal(
            f.rows().length,
            PROVIDER_ATTEMPT_LIMITS.unresolvedPerAccount,
          );
          assert.ok(
            f
              .rows()
              .every((r) => r.status === "prepared" && r.total_tokens === null),
          );
        }),
    );
    await check(
      "Expired terminal retention commits even when old unresolved rows prevent a new dispatch",
      () =>
        withFixture(async (f) => {
          f.observer()
            .prepare(prepare)
            .finish({ status: "response_received", httpStatus: 200 });
          for (let n = 0; n < PROVIDER_ATTEMPT_LIMITS.unresolvedPerAccount; n++)
            f.observer().prepare(prepare);
          f.advance(PROVIDER_ATTEMPT_LIMITS.terminalRetentionMs + 1);
          const requestId = "fresh-" + crypto.randomUUID(),
            reservation = f.store.reserveUsage({
              userId: f.user.id,
              sessionVersion: f.user.sessionVersion,
              requestId,
              task: "chat",
              kind: "text",
              mode: "quick",
            }),
            observer = f.store.providerAttemptObserver({
              ...f.context,
              requestId,
              reservationId: reservation.reservationId,
            });
          assert.equal(
            f.rows().filter((r) => r.status !== "prepared").length,
            1,
          );
          let calls = 0;
          await assert.rejects(
            routeAI(
              input(),
              async () => {
                calls++;
                return openai();
              },
              undefined,
              observer,
            ),
            (e) => e.code === "AI_ATTEMPT_CAPACITY",
          );
          assert.equal(calls, 0);
          assert.equal(
            f.rows().length,
            PROVIDER_ATTEMPT_LIMITS.unresolvedPerAccount,
          );
          assert.ok(f.rows().every((r) => r.status === "prepared"));
          assert.equal(
            f.db
              .prepare("SELECT status FROM billing_reservations WHERE id=?")
              .get(reservation.reservationId).status,
            "reserved",
            "Journal cleanup must not itself charge/refund the new reservation",
          );
        }),
    );
    await check(
      "Genuine migration13–16 prefixes are checked read-only and upgrade copies to17 with original immutable guards intact",
      () => {
        assert.equal(DATABASE_SCHEMA_VERSION, 17);
        for (const version of [13, 14, 15, 16]) {
          const file = path.join(folder, "prefix-" + version + ".sqlite"),
            db = openDatabase(file);
          db.exec(
            "PRAGMA foreign_keys=ON; CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL)",
          );
          for (const migration of migrations.filter(
            (m) => m.version <= version,
          )) {
            db.exec(migration.sql);
            db.prepare("INSERT INTO schema_migrations VALUES (?,?)").run(
              migration.version,
              "synthetic",
            );
          }
          assert.equal(
            assertDatabaseIntegrity(db, { allowPrefix: true }).schemaVersion,
            version,
          );
          assert.equal(
            db.prepare("SELECT max(version) n FROM schema_migrations").get().n,
            version,
          );
          db.close();
          const before = hash(fs.readFileSync(file));
          const readOnly = openDatabase(file, { readOnly: true });
          assert.equal(
            assertDatabaseIntegrity(readOnly, { allowPrefix: true })
              .schemaVersion,
            version,
          );
          readOnly.close();
          assert.equal(hash(fs.readFileSync(file)), before);
          const upgraded = openStore(file);
          upgraded.close();
          const current = openDatabase(file, { readOnly: true });
          assert.equal(assertDatabaseIntegrity(current).schemaVersion, 17);
          assert.equal(
            current
              .prepare(
                "SELECT count(*) n FROM sqlite_schema WHERE type='trigger' AND name IN('billing_ledger_no_delete','billing_ledger_no_update','audit_no_delete','audit_no_update')",
              )
              .get().n,
            4,
          );
          if (version >= 15)
            assert.equal(
              current
                .prepare(
                  "SELECT count(*) n FROM sqlite_schema WHERE type='trigger' AND name LIKE 'teaching_grade_events_no_%'",
                )
                .get().n,
              2,
            );
          assert.throws(() =>
            assertDatabaseIntegrity(current, { maximumVersion: 16 }),
          );
          current.close();
        }
      },
    );
    await check(
      "A journal table falsely attached to schema16 is rejected before startup writes",
      () => {
        const file = path.join(folder, "future-object.sqlite"),
          db = openDatabase(file);
        db.exec(
          "CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL)",
        );
        for (const migration of migrations.filter((m) => m.version <= 16)) {
          db.exec(migration.sql);
          db.prepare("INSERT INTO schema_migrations VALUES (?,?)").run(
            migration.version,
            "synthetic",
          );
        }
        db.exec(providerAttemptMigration.sql);
        db.close();
        const before = hash(fs.readFileSync(file));
        assert.throws(
          () => createStore(file),
          /DATABASE_FUTURE_OBJECT:ai_provider_attempts/,
        );
        assert.equal(hash(fs.readFileSync(file)), before);
      },
    );
    const report = {
      schema: 1,
      status: "PASS",
      checkedAt: new Date().toISOString(),
      passed: checks.length,
      checks,
      actualProviderCalls: 0,
      scope:
        "Actual temporary SQLite/reservation/journal/Router and migration-prefix tests with injected transport, simulated SQLite faults and synthetic account data. Not real provider receipt, invoice, OAuth, public HTTP, device, teacher/student, billing settlement HTTP-handler or full production crash recovery validation.",
    };
    fs.writeFileSync(
      path.join(root, "docs/v7/reports/provider-attempt-adversarial.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(
      `Provider attempt adversarial: ${checks.length} checks passed; zero live calls.`,
    );
  } finally {
    global.fetch = originalFetch;
    for (const [key, value] of Object.entries(saved))
      value === undefined
        ? delete process.env[key]
        : (process.env[key] = value);
    for (const db of openedDatabases) {
      try {
        db.close();
      } catch {
        /* Already closed by its fixture. */
      }
    }
    for (const store of openedStores) {
      try {
        store.close();
      } catch {
        /* Already closed by its fixture. */
      }
    }
    if (path.dirname(folder) !== os.tmpdir())
      throw Error("UNEXPECTED_TEMP_ROOT");
    try {
      fs.rmSync(folder, {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 20,
      });
    } catch {
      console.warn("SYNTHETIC_FIXTURE_CLEANUP_INCOMPLETE");
    }
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
