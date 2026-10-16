// Real libsql native driver + Worker RPC, synthetic temporary local database.
// This proves compatibility, not remote persistence or a paid provider flow.
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const load = require("./v9-database-loader.cjs")();
const { SqliteWorkerConnection } = load("lib/server/database-remote.ts");
const { databaseConfiguration } = load("lib/server/database-connection.ts");
const { createStore } = load("lib/server/store.ts");
const { assertDatabaseIntegrity, DATABASE_GUARDS } = load("lib/server/database-integrity.ts");
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "lumio-v9-native-db-"));
const file = path.join(folder, "synthetic.sqlite"), checks = [];
const check = (name, fn) => { fn(); checks.push({ name, status: "PASS" }); console.log("PASS " + name); };
const denied = (code) => (e) => e.code === code;
let db, store, owner, learner, organization, classroom;
const bootstrapCalls = { exec: 0, get: 0, all: 0, run: 0 }, reopenCalls = { exec: 0, get: 0, all: 0, run: 0 };
function measured(database, counts) {
  return {
    mode: database.mode, get poisoned() { return database.poisoned; },
    prepare(sql) { const statement = database.prepare(sql); return Object.fromEntries(["get", "all", "run"].map((op) => [op, (...args) => { counts[op]++; return statement[op](...args); }])); },
    exec(sql) { counts.exec++; return database.exec(sql); },
    close: () => database.close(),
    beginBootstrap: () => database.beginBootstrap(), endBootstrap: () => database.endBootstrap(),
    beginTransaction: () => database.beginTransaction(), endTransaction: () => database.endTransaction(),
  };
}
const started = performance.now();
function connection() { return new SqliteWorkerConnection({ url: file }); }
const identity = (id, extra = {}) => ({ provider: "google", providerAccountId: "synthetic-" + id, name: "Synthetic " + id, email: `${id}@example.test`, emailVerified: true, ...extra });
function command(user, data) { return store.mutateTeaching(user.id, user.sessionVersion, { requestId: crypto.randomUUID(), ...data }); }
async function main() {
  try {
    check("Configuration fails closed for mixed credentials, non-TLS, missing token and URL injection", () => {
      for (const env of [
        { TURSO_AUTH_TOKEN: "synthetic" },
        { LUMIO_DATABASE_MODE: "other" },
        { LUMIO_DATABASE_MODE: "remote-libsql", TURSO_DATABASE_URL: "http://x.turso.io", TURSO_AUTH_TOKEN: "synthetic" },
        { LUMIO_DATABASE_MODE: "remote-libsql", TURSO_DATABASE_URL: "libsql://x.turso.io" },
        { LUMIO_DATABASE_MODE: "remote-libsql", TURSO_DATABASE_URL: "libsql://x.turso.io/?token=secret", TURSO_AUTH_TOKEN: "synthetic" },
        { LUMIO_DATABASE_MODE: "remote-libsql", TURSO_DATABASE_URL: "libsql://x.turso.io.evil.test", TURSO_AUTH_TOKEN: "synthetic" },
      ]) assert.throws(() => databaseConfiguration(env), denied("DATABASE_CONFIGURATION_INVALID"));
      assert.equal(databaseConfiguration({}).mode, "local-sqlite");
      assert.equal(databaseConfiguration({ LUMIO_DATABASE_MODE: "remote-libsql", TURSO_DATABASE_URL: "libsql://x.aws-ap-northeast-1.turso.io", TURSO_AUTH_TOKEN: "synthetic" }).mode, "remote-libsql");
    });
    db = connection();
    const boot = performance.now();
    check("All schema18 migrations and six immutable guards bootstrap on actual libsql worker", () => {
      store = createStore(":injected:", { database: measured(db, bootstrapCalls), adminEmails: ["owner@example.test"] });
      assert.deepEqual(assertDatabaseIntegrity(db), { schemaVersion: 18, guardsChecked: 6 });
      assert.equal(db.prepare("PRAGMA foreign_keys").get().foreign_keys, 1);
    });
    const bootstrapMs = performance.now() - boot;
    const bootstrapCounts = { ...bootstrapCalls };
    check("Health uses a fresh two-read schema snapshot and still detects guard tampering", () => {
      let reads = 0;
      const counted = { prepare(sql) { const statement = db.prepare(sql); return {
        ...statement,
        all(...args) { reads++; return statement.all(...args); },
        get(...args) { reads++; return statement.get(...args); },
      }; } };
      assert.deepEqual(assertDatabaseIntegrity(counted), { schemaVersion: 18, guardsChecked: 6 });
      assert.equal(reads, 2);
      const guard = DATABASE_GUARDS[0];
      db.exec(`DROP TRIGGER ${guard.name}`);
      assert.throws(() => assertDatabaseIntegrity(db), /DATABASE_GUARD_INVALID/);
      db.exec(guard.sql);
      assert.equal(assertDatabaseIntegrity(db).guardsChecked, 6);
    });
    check("A foreign populated database named sqlitex is rejected before bootstrap writes", () => {
      const foreign = new (require("node:sqlite").DatabaseSync)(":memory:");
      try {
        foreign.exec("CREATE TABLE sqlitex_foreign_application(value TEXT)");
        assert.throws(() => assertDatabaseIntegrity(foreign, { allowPrefix: true }), /SCHEMA_NOT_SUPPORTED/);
      } finally { foreign.close(); }
    });
    check("Canonical identity and verified exact allowlist retain server role rules", () => {
      owner = store.ensureIdentity(identity("owner")); learner = store.ensureIdentity(identity("learner"));
      assert.equal(owner.role, "SUPER_ADMIN"); assert.equal(learner.role, "USER");
      assert.equal(store.ensureIdentity(identity("learner")).id, learner.id);
      assert.equal(store.ensureIdentity(identity("unverified", { email: "owner@example.test", emailVerified: false })).role, "USER");
    });
    check("Teacher org/class persist and an outsider cannot read the scope", () => {
      organization = command(owner, { action: "org.create", name: "Synthetic durable organization" }).result.id;
      classroom = command(owner, { action: "class.create", orgId: organization, name: "Synthetic class", subject: "Toán", grade: "9", description: "Temporary QA" }).result.id;
      const state = store.readTeaching(owner.id, owner.sessionVersion, { orgId: organization });
      assert.equal(state.classes[0].id, classroom);
      assert.throws(() => store.readTeaching(learner.id, learner.sessionVersion, { orgId: organization }), denied("TEACHING_FORBIDDEN"));
    });
    check("Teaching operation replay retains its UUID and does not duplicate writes", () => {
      const input = { requestId: crypto.randomUUID(), action: "class.create", orgId: organization, name: "Synthetic replay class", subject: "Toán", grade: "9", description: "Replay" };
      const first = store.mutateTeaching(owner.id, owner.sessionVersion, input);
      const replay = store.mutateTeaching(owner.id, owner.sessionVersion, input);
      assert.equal(replay.replayed, true); assert.equal(first.result.id, replay.result.id);
      assert.equal(db.prepare("SELECT count(*) n FROM teaching_operations WHERE request_id=?").get(input.requestId).n, 1);
    });
    check("Credit reserve/fail has one trial grant and restores exact wallet balance", () => {
      const before = store.getBillingSnapshot(learner.id, learner.sessionVersion).account;
      assert.equal(before.balance, 200);
      const reserved = store.reserveUsage({ userId: learner.id, sessionVersion: learner.sessionVersion, requestId: crypto.randomUUID(), task: "chat", kind: "text", mode: "quick" });
      assert.equal(store.getBillingSnapshot(learner.id, learner.sessionVersion).account.reserved, reserved.units);
      store.failUsage({ userId: learner.id, reservationId: reserved.reservationId, reason: "synthetic-failure" });
      assert.equal(store.getBillingSnapshot(learner.id, learner.sessionVersion).account.balance, before.balance);
      assert.equal(store.getBillingSnapshot(learner.id, learner.sessionVersion).account.reserved, 0);
    });
    check("Immutable audit and FK failures remain definite SQL failures with healthy rollback", () => {
      db.beginTransaction(); db.exec("BEGIN IMMEDIATE");
      assert.throws(() => db.prepare("DELETE FROM audit_events").run(), /AUDIT_APPEND_ONLY/);
      db.exec("ROLLBACK"); db.endTransaction();
      assert.equal(db.poisoned, false);
      assert.throws(() => db.prepare("INSERT INTO memberships(user_id,organization_id,role) VALUES(?,?,?)").run("missing", organization, "STUDENT"), (e) => e.code.startsWith("SQLITE_CONSTRAINT"));
      assert.equal(db.prepare("SELECT 1 n").get().n, 1);
    });
    check("Unicode, null, floats, binary zero bytes and 64-bit integers round-trip without timing metadata", () => {
      const row = db.prepare("SELECT ? AS text, ? AS empty, ? AS number, ? AS bytes, ? AS large").get("Tiếng Việt — lớp 9", null, 1.25, new Uint8Array([0,255,7,0]), 9007199254740993n);
      assert.deepEqual(Object.keys(row).sort(), ["bytes","empty","large","number","text"]);
      assert.equal(row.text, "Tiếng Việt — lớp 9"); assert.equal(row.empty, null); assert.equal(row.number, 1.25);
      assert.deepEqual([...row.bytes], [0,255,7,0]); assert.equal(row.large, 9007199254740993n);
      assert.equal(db.prepare("SELECT 1 AS n WHERE 0").get(), undefined);
    });
    check("Reopening a new worker restores canonical UUID, class and wallet without a new trial", () => {
      store.close(); db = connection(); store = createStore(":injected:", { database: measured(db, reopenCalls) });
      assert.equal(reopenCalls.run, 0);
      assert.equal(reopenCalls.exec, 2);
      assert.equal(Object.values(reopenCalls).reduce((a, b) => a + b, 0), 8);
      assert.equal(store.ensureIdentity(identity("learner")).id, learner.id);
      assert.equal(store.readTeaching(owner.id, owner.sessionVersion, { orgId: organization }).classes.some((c) => c.id === classroom), true);
      const wallet = store.getBillingSnapshot(learner.id, learner.sessionVersion);
      assert.equal(wallet.account.balance, 200); assert.equal(wallet.history.filter((e) => e.kind === "trial").length, 1);
    });
    const report = { scope: "Actual libsql0.5.29 native child + Worker/RPC with synthetic LOCAL SQLite file; no remote service/provider call or durability claim", passed: checks.length, checks, bootstrapCounts, existingSchemaBootstrapCalls: 8, healthReadCalls: 2, bootstrapMs: Math.round(bootstrapMs), elapsedMs: Math.round(performance.now()-started) };
    fs.mkdirSync(path.join(__dirname,"../docs/v9/reports"),{recursive:true});
    fs.writeFileSync(path.join(__dirname,"../docs/v9/reports/database-local.json"),JSON.stringify(report,null,2)+"\n");
    console.log(JSON.stringify({ passed: report.passed, bootstrapMs: report.bootstrapMs }));
  } finally {
    try { store?.close(); } catch {} try { db?.close(); } catch {}
    await new Promise((r) => setTimeout(r,100));
    assert.equal(path.dirname(folder), path.resolve(os.tmpdir()));
    assert.ok(path.basename(folder).startsWith("lumio-v9-native-db-"));
    fs.rmSync(folder,{recursive:true,force:true});
  }
}
main().catch((error) => { console.error(error); process.exitCode=1; });
