// Real temporary SQLite, migration/backup/restore; no providers or private app DB.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const ts = require("typescript");
const { DatabaseSync } = require("node:sqlite");
const root = path.resolve(__dirname, ".."),
  checks = [];
function loader(schemaTransform) {
  const cache = new Map();
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
      (name) =>
        name.startsWith(".")
          ? load(path.resolve(path.dirname(file), name + ".ts"))
          : require(name),
      m,
      m.exports,
    );
    if (file === path.join(root, "lib/server/schema.ts") && schemaTransform)
      m.exports = schemaTransform(m.exports);
    return m.exports;
  }
  return load;
}
const load = loader(),
  platform = load("lib/server/store.ts");
const schema = load("lib/server/schema.ts");
const integrity = load("lib/server/database-integrity.ts");
const { inspect, snapshot } = require("../scripts/database-snapshot.cjs");
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "lumio-v7-operations-"));
const file = path.join(folder, "current.sqlite"),
  store = platform.createStore(file);
const db = new DatabaseSync(file);
db.exec("PRAGMA foreign_keys=ON");
const check = (name, run) => {
  run();
  checks.push({ name, status: "PASS" });
  console.log("PASS " + name);
};
const sha = (value) => crypto.createHash("sha256").update(value).digest("hex");
const stamp = "2026-10-16T00:00:00.000Z";
const fixture = (name) =>
  store.ensureIdentity({
    provider: "google",
    providerAccountId: "ops-" + name,
    name: "Synthetic " + name,
    emailVerified: false,
  });
const teacher = fixture("teacher"),
  student = fixture("student");
const disposable = (name) => path.join(folder, name + ".sqlite");
function copy(name) {
  const out = disposable(name);
  snapshot(file, out);
  return out;
}
function edit(filename, run) {
  const d = new DatabaseSync(filename);
  try {
    d.exec("PRAGMA journal_mode=DELETE");
    run(d);
  } finally {
    d.close();
  }
}
function bytes(filename) {
  return fs.readFileSync(filename);
}
function unchangedFailure(filename, action) {
  const before = bytes(filename),
    entries = fs.readdirSync(folder).sort();
  assert.throws(
    action,
    /SCHEMA_NOT_SUPPORTED|DATABASE_GUARD_INVALID|DATABASE_TABLE_INVALID|DATABASE_FUTURE_OBJECT/,
  );
  assert.deepEqual(bytes(filename), before);
  assert.deepEqual(fs.readdirSync(folder).sort(), entries);
  const d = new DatabaseSync(filename, { readOnly: true });
  try {
    assert.equal(d.prepare("SELECT count(*) n FROM users").get().n, 2);
  } finally {
    d.close();
  }
}
let backup, restored, previous13;
try {
  // Canonical private fixtures are deliberately synthetic and never uploaded.
  db.prepare(
    "INSERT INTO organizations VALUES('ops-org','Synthetic organization',?)",
  ).run(stamp);
  db.prepare("INSERT INTO teaching_organizations VALUES('ops-org',1,?,?)").run(
    '{"timezone":"UTC","allowLateSubmissions":false}',
    teacher.id,
  );
  db.prepare(
    "INSERT INTO teaching_classes(id,organization_id,name,subject,grade,description,created_at) VALUES('ops-class','ops-org','Synthetic class','Math','9','Synthetic',?)",
  ).run(stamp);
  const issued =
    '{"questions":[{"id":"ops-q","prompt":"Synthetic problem","correctIndex":0}],"maxPoints":1}';
  db.prepare(
    "INSERT INTO teaching_assignments(id,organization_id,class_id,data_json,status,created_by,created_at,issued_at) VALUES('ops-assignment','ops-org','ops-class',?,'issued',?,?,?)",
  ).run(issued, teacher.id, stamp, stamp);
  db.prepare(
    "INSERT INTO teaching_assessment_windows(assignment_id,root_assignment_id,attempt_no,available_from,created_by,created_at) VALUES('ops-assignment','ops-assignment',1,?,?,?)",
  ).run(stamp, teacher.id, stamp);
  const answers = '[{"questionId":"ops-q","response":0}]',
    grades =
      '[{"questionId":"ops-q","points":1,"feedback":"Synthetic private feedback"}]';
  db.prepare(
    "INSERT INTO teaching_submissions(id,assignment_id,student_id,answers_json,submitted_at,late,status,revision,grades_json,score,feedback,confirmed_at,published_at) VALUES('ops-submission','ops-assignment',?,?,?,0,'published',3,?,1,'Synthetic private overall',?,?)",
  ).run(student.id, answers, stamp, grades, stamp, stamp);
  db.prepare(
    "INSERT INTO teaching_grade_events(id,submission_id,submission_revision,kind,grade_version,grades_json,score,feedback,answers_digest,actor_id,recorded_at,confirmed_at,reason) VALUES('ops-grade','ops-submission',2,'grade',1,?,1,'Synthetic private overall',?,?,?,?,'Synthetic private review reason')",
  ).run(grades, sha(answers), teacher.id, stamp, stamp);
  db.prepare(
    "INSERT INTO teaching_grade_events(id,submission_id,submission_revision,kind,grade_version,grade_event_id,actor_id,recorded_at,published_at) VALUES('ops-publish','ops-submission',3,'publish',1,'ops-grade',?,?,?)",
  ).run(teacher.id, stamp, stamp);
  store.recordAudit({
    actorId: teacher.id,
    action: "OPS_SYNTHETIC_AUDIT",
    target: "ops-fixture",
    requestId: crypto.randomUUID(),
  });
  const sync = store.syncRead(student.id, student.sessionVersion);
  store.syncWrite(student.id, student.sessionVersion, {
    epoch: sync.epoch,
    expectedRevision: 0,
    requestId: "ops-synthetic-sync-0001",
    data: {
      version: 1,
      library: { version: 1, items: [], spaces: [] },
      learning: { version: 1, tasks: [], reviews: [], events: [], focus: null },
      preferences: { version: 1, enabled: true, feedback: [] },
    },
  });
  const lease = store.beginAIHttpRequest(
    student.id,
    student.sessionVersion,
    "ai",
    crypto.randomUUID(),
    sha("Synthetic content fingerprint only"),
  );
  const reserved = store.reserveUsage({
    userId: student.id,
    sessionVersion: student.sessionVersion,
    requestId: lease.requestId,
    task: "chat",
    kind: "text",
    mode: "quick",
  });
  store
    .providerAttemptObserver({
      userId: student.id,
      sessionVersion: student.sessionVersion,
      requestId: lease.requestId,
      reservationId: reserved.reservationId,
      feature: "learner.chat",
    })
    .prepare({
      provider: "openai",
      requestedModel: "fixture-model",
      endpointKind: "responses",
    })
    .finish({
      status: "response_received",
      httpStatus: 200,
      inputTokens: 0,
      totalTokens: 0,
      responseModel: "fixture-response",
    });
  store.settleUsage({
    userId: student.id,
    reservationId: reserved.reservationId,
    onSettled: () => store.completeAIHttpRequest(lease),
  });

  check(
    "Canonical contract matches all migrations and six exact immutable guards",
    () => {
      assert.equal(schema.migrations.length, 17);
      const fresh = new DatabaseSync(":memory:");
      try {
        fresh.exec(
          "PRAGMA foreign_keys=ON;CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL)",
        );
        const firstTable = new Map(),
          firstGuard = new Map();
        for (const m of schema.migrations) {
          fresh.exec(m.sql);
          fresh
            .prepare("INSERT INTO schema_migrations VALUES(?,?)")
            .run(m.version, stamp);
          for (const row of fresh
            .prepare(
              "SELECT name,tbl_name,sql,type FROM sqlite_schema WHERE type IN ('table','trigger') AND name NOT LIKE 'sqlite_%'",
            )
            .all()) {
            const map = row.type === "table" ? firstTable : firstGuard;
            if (!map.has(row.name))
              map.set(row.name, { ...row, since: m.version });
          }
          assert.equal(
            integrity.assertDatabaseIntegrity(fresh, { allowPrefix: true })
              .schemaVersion,
            m.version,
          );
        }
        assert.equal(firstTable.size, integrity.DATABASE_TABLES.length);
        assert.equal(firstGuard.size, 6);
        for (const t of integrity.DATABASE_TABLES)
          assert.equal(firstTable.get(t.name).since, t.since);
        for (const g of integrity.DATABASE_GUARDS) {
          const actual = firstGuard.get(g.name);
          assert.equal(actual.tbl_name, g.table);
          assert.equal(actual.since, g.since);
          assert.equal(
            integrity.normalizedGuardSQL(actual.sql),
            integrity.normalizedGuardSQL(g.sql),
          );
        }
      } finally {
        fresh.close();
      }
    },
  );
  check(
    "Schema17 readiness is read-only and checks complete history plus actual guards",
    () => {
      const before = db.prepare("PRAGMA data_version").get().data_version,
        total = db.prepare("SELECT total_changes() n").get().n;
      assert.deepEqual(store.runtimeHealth(), {
        ready: true,
        schemaVersion: 17,
      });
      assert.equal(
        db.prepare("PRAGMA data_version").get().data_version,
        before,
      );
      assert.equal(db.prepare("SELECT total_changes() n").get().n, total);
    },
  );
  check(
    "Real WAL backup and separate restore preserve private grades, snapshots, receipts and ledger bytes",
    () => {
      backup = copy("backup");
      restored = disposable("restored");
      assert.equal(snapshot(backup, restored).schemaVersion, 17);
      const d = new DatabaseSync(restored, { readOnly: true });
      try {
        for (const table of [
          "users",
          "teaching_assignments",
          "teaching_assessment_windows",
          "teaching_submissions",
          "teaching_grade_events",
          "sync_snapshots",
          "ai_http_requests",
          "ai_provider_attempts",
          "billing_accounts",
          "billing_reservations",
          "billing_ledger",
          "audit_events",
        ])
          assert.deepEqual(
            d.prepare("SELECT * FROM " + table + " ORDER BY rowid").all(),
            db.prepare("SELECT * FROM " + table + " ORDER BY rowid").all(),
            table,
          );
        assert.equal(
          d.prepare("SELECT status FROM ai_http_requests").get().status,
          "completed",
        );
        assert.equal(
          d
            .prepare(
              "SELECT reason FROM teaching_grade_events WHERE kind='grade'",
            )
            .get().reason,
          "Synthetic private review reason",
        );
      } finally {
        d.close();
      }
    },
  );
  check(
    "Restored audit, credit ledger and grade history each reject UPDATE and DELETE",
    () => {
      const d = new DatabaseSync(restored);
      try {
        const cases = [
          ["audit_events", "action", "audit_no_update", "AUDIT_APPEND_ONLY"],
          [
            "billing_ledger",
            "note",
            "billing_ledger_no_update",
            "LEDGER_APPEND_ONLY",
          ],
          [
            "teaching_grade_events",
            "feedback",
            "teaching_grade_events_no_update",
            "TEACHING_HISTORY_IMMUTABLE",
          ],
        ];
        for (const [table, column, , code] of cases) {
          const before = d
            .prepare("SELECT * FROM " + table + " ORDER BY rowid")
            .all();
          assert.throws(
            () =>
              d.exec(
                "UPDATE " +
                  table +
                  " SET " +
                  column +
                  "='Synthetic tamper' WHERE rowid=(SELECT min(rowid) FROM " +
                  table +
                  ")",
              ),
            new RegExp(code),
          );
          assert.throws(
            () =>
              d.exec(
                "DELETE FROM " +
                  table +
                  " WHERE rowid=(SELECT min(rowid) FROM " +
                  table +
                  ")",
              ),
            new RegExp(code),
          );
          assert.deepEqual(
            d.prepare("SELECT * FROM " + table + " ORDER BY rowid").all(),
            before,
          );
        }
      } finally {
        d.close();
      }
    },
  );
  check(
    "Each missing append-only guard fails startup, health contract and backup before creating output",
    () => {
      for (const guard of integrity.DATABASE_GUARDS) {
        const out = copy("missing-" + guard.name),
          destination = disposable("rejected-" + guard.name);
        edit(out, (d) => d.exec('DROP TRIGGER "' + guard.name + '"'));
        assert.throws(() => inspect(out), /DATABASE_GUARD_INVALID/);
        assert.throws(
          () => snapshot(out, destination),
          /DATABASE_GUARD_INVALID/,
        );
        assert.equal(fs.existsSync(destination), false);
        unchangedFailure(out, () => platform.createStore(out));
      }
    },
  );
  check(
    "A same-name weakened WHEN or harmless trigger is rejected rather than counted as a guard",
    () => {
      const out = copy("altered-guard");
      edit(out, (d) =>
        d.exec(
          "DROP TRIGGER billing_ledger_no_update;CREATE TRIGGER billing_ledger_no_update BEFORE UPDATE ON billing_ledger WHEN 0 BEGIN SELECT RAISE(ABORT,'LEDGER_APPEND_ONLY'); END",
        ),
      );
      assert.throws(
        () => inspect(out),
        /DATABASE_GUARD_INVALID:billing_ledger_no_update/,
      );
      unchangedFailure(out, () => platform.createStore(out));
    },
  );
  check(
    "Deleting only migration15 cannot disguise future grade objects as a valid schema14 backup",
    () => {
      const out = copy("disguised14"),
        active = platform.createStore(out);
      const alter = new DatabaseSync(out);
      try {
        alter.exec(
          "DROP TABLE ai_provider_attempts;DROP TABLE teaching_assessment_windows;DELETE FROM schema_migrations WHERE version>=15",
        );
        assert.throws(() => active.runtimeHealth(), /SCHEMA_NOT_SUPPORTED/);
      } finally {
        alter.close();
        active.close();
      }
      edit(out, () => {});
      assert.throws(
        () => inspect(out),
        /DATABASE_FUTURE_OBJECT:teaching_grade_events/,
      );
      const dest = disposable("disguised14-rejected");
      assert.throws(() => snapshot(out, dest), /DATABASE_FUTURE_OBJECT/);
      assert.equal(fs.existsSync(dest), false);
      unchangedFailure(out, () => platform.createStore(out));
    },
  );
  check(
    "A known future guard alone is rejected even when every schema14 table is valid",
    () => {
      const out = copy("future-guard-only");
      edit(out, (d) => {
        d.exec(
          "PRAGMA foreign_keys=OFF;DROP TABLE ai_provider_attempts;DROP TABLE teaching_assessment_windows;DROP TABLE teaching_grade_events;DELETE FROM schema_migrations WHERE version>=15",
        );
        d.exec(
          "CREATE TRIGGER teaching_grade_events_no_update BEFORE UPDATE ON billing_ledger BEGIN SELECT RAISE(ABORT,'TEACHING_HISTORY_IMMUTABLE'); END",
        );
      });
      assert.throws(
        () => inspect(out),
        /DATABASE_FUTURE_OBJECT:teaching_grade_events_no_update/,
      );
      unchangedFailure(out, () => platform.createStore(out));
    },
  );
  check(
    "A dummy grade table with both exact canonical triggers fails health, startup and backup without writes",
    () => {
      const out = copy("dummy-grade-table"),
        active = platform.createStore(out);
      const alter = new DatabaseSync(out);
      try {
        alter.exec(
          "PRAGMA foreign_keys=OFF;DROP TABLE teaching_grade_events;CREATE TABLE teaching_grade_events(dummy TEXT)",
        );
        for (const g of integrity.DATABASE_GUARDS.filter((g) => g.since === 15))
          alter.exec(g.sql);
        assert.throws(
          () => active.runtimeHealth(),
          /DATABASE_TABLE_INVALID:teaching_grade_events/,
        );
      } finally {
        alter.close();
        active.close();
      }
      edit(out, () => {});
      assert.throws(
        () => inspect(out),
        /DATABASE_TABLE_INVALID:teaching_grade_events/,
      );
      const dest = disposable("dummy-grade-rejected");
      assert.throws(() => snapshot(out, dest), /DATABASE_TABLE_INVALID/);
      assert.equal(fs.existsSync(dest), false);
      unchangedFailure(out, () => platform.createStore(out));
    },
  );
  check(
    "Same columns with a removed CHECK are rejected; SQL normalization preserves literals and token boundaries",
    () => {
      const out = copy("weakened-grade-check");
      edit(out, (d) => {
        const columns = d
          .prepare("PRAGMA table_info(teaching_grade_events)")
          .all();
        const original = d
          .prepare(
            "SELECT sql FROM sqlite_schema WHERE name='teaching_grade_events'",
          )
          .get().sql;
        const weakened = original.replace("CHECK(legacy IN(0,1))", "");
        assert.notEqual(weakened, original);
        d.exec("PRAGMA foreign_keys=OFF;DROP TABLE teaching_grade_events");
        d.exec(weakened);
        for (const g of integrity.DATABASE_GUARDS.filter((g) => g.since === 15))
          d.exec(g.sql);
        assert.deepEqual(
          d.prepare("PRAGMA table_info(teaching_grade_events)").all(),
          columns,
        );
      });
      assert.throws(
        () => inspect(out),
        /DATABASE_TABLE_INVALID:teaching_grade_events/,
      );
      unchangedFailure(out, () => platform.createStore(out));
      assert.equal(
        integrity.normalizedTableSQL("CREATE TABLE a (v TEXT CHECK(v > 0));"),
        integrity.normalizedTableSQL("create  table a(v text check(v>0))"),
      );
      assert.notEqual(
        integrity.normalizedTableSQL("CREATE TABLE a(v TEXT DEFAULT 'A B')"),
        integrity.normalizedTableSQL("CREATE TABLE a(v TEXT DEFAULT 'AB')"),
      );
      assert.notEqual(
        integrity.normalizedTableSQL("CREATE TABLE a(v INT EGER)"),
        integrity.normalizedTableSQL("CREATE TABLE a(v INTEGER)"),
      );
    },
  );
  check(
    "Current runtime refuses a future schema before WAL, seeds, migrations or byte changes",
    () => {
      const out = copy("future18");
      edit(out, (d) =>
        d.prepare("INSERT INTO schema_migrations VALUES(18,?)").run(stamp),
      );
      unchangedFailure(out, () => platform.createStore(out));
    },
  );
  check(
    "Simulated hardened runtime14 refuses a schema17 database without rewriting identity, seed or schema bytes",
    () => {
      const out = copy("old-runtime");
      edit(out, () => {});
      const old = loader((s) => ({
        ...s,
        migrations: s.migrations.filter((m) => m.version <= 14),
        flagDefinitions: [
          ...s.flagDefinitions,
          {
            key: "must-not-seed",
            enabled: true,
            description: "Synthetic sentinel",
          },
        ],
      }))("lib/server/store.ts");
      unchangedFailure(out, () => old.createStore(out));
      const d = new DatabaseSync(out, { readOnly: true });
      try {
        assert.equal(
          d
            .prepare(
              "SELECT count(*) n FROM feature_flags WHERE key='must-not-seed'",
            )
            .get().n,
          0,
        );
      } finally {
        d.close();
      }
    },
  );
  check(
    "Gapped and empty recorded histories on populated DBs fail before changing the file",
    () => {
      for (const [name, sql] of [
        ["gapped", "DELETE FROM schema_migrations WHERE version=14"],
        ["empty", "DELETE FROM schema_migrations"],
      ]) {
        const out = copy(name);
        edit(out, (d) => d.exec(sql));
        unchangedFailure(out, () => platform.createStore(out));
        assert.throws(() => inspect(out), /SCHEMA_NOT_SUPPORTED/);
      }
    },
  );
  check(
    "A populated unversioned DB is not silently treated as a new database",
    () => {
      const out = disposable("unversioned"),
        d = new DatabaseSync(out);
      d.exec(
        "CREATE TABLE private_marker(value TEXT);INSERT INTO private_marker VALUES('Synthetic private marker')",
      );
      d.close();
      const before = bytes(out);
      assert.throws(() => platform.createStore(out), /SCHEMA_NOT_SUPPORTED/);
      assert.deepEqual(bytes(out), before);
    },
  );
  check(
    "Genuine13 inspect/backup/CLI restore keep source bytes and upgrade only the restored copy while preserving account/issued/submission/sync rows",
    () => {
      previous13 = disposable("genuine13");
      const d = new DatabaseSync(previous13);
      const copiedTables = integrity.DATABASE_TABLES.filter(
        (table) => table.since <= 13 && table.name !== "schema_migrations",
      ).map((table) => table.name);
      const protectedRows = new Map();
      try {
        d.exec(
          "CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL)",
        );
        for (const m of schema.migrations.filter((m) => m.version <= 13)) {
          d.exec(m.sql);
          d.prepare("INSERT INTO schema_migrations VALUES(?,?)").run(
            m.version,
            stamp,
          );
        }
        // Seed authored rows from the current temporary fixture into actual
        // migration13 structures; never open this source via current createStore.
        // Canonical metadata order is alphabetical, not foreign-key insert order.
        d.exec("PRAGMA foreign_keys=OFF");
        for (const table of copiedTables) {
          const rows = db
            .prepare("SELECT * FROM " + table + " ORDER BY rowid")
            .all();
          for (const row of rows) {
            const columns = Object.keys(row);
            d.prepare(
              "INSERT INTO " +
                table +
                " (" +
                columns.map((name) => '"' + name + '"').join(",") +
                ") VALUES(" +
                columns.map(() => "?").join(",") +
                ")",
            ).run(...columns.map((name) => row[name]));
          }
          protectedRows.set(
            table,
            JSON.stringify(
              d.prepare("SELECT * FROM " + table + " ORDER BY rowid").all(),
            ),
          );
        }
        d.exec("PRAGMA foreign_keys=ON");
        assert.equal(d.prepare("SELECT count(*) n FROM users").get().n, 2);
        assert.equal(
          d.prepare("SELECT status FROM teaching_assignments").get().status,
          "issued",
        );
        assert.equal(
          d.prepare("SELECT status FROM teaching_submissions").get().status,
          "published",
        );
        assert.equal(
          d.prepare("SELECT revision FROM sync_snapshots").get().revision,
          1,
        );
        assert.deepEqual(d.prepare("PRAGMA foreign_key_check").all(), []);
      } finally {
        d.close();
      }
      const sourceBytes = bytes(previous13),
        saved = disposable("genuine13-backup"),
        restore = disposable("genuine13-restored");
      assert.equal(inspect(previous13).schemaVersion, 13);
      assert.equal(snapshot(previous13, saved).schemaVersion, 13);
      assert.deepEqual(bytes(previous13), sourceBytes);
      const backupBytes = bytes(saved),
        { spawnSync } = require("node:child_process");
      const result = spawnSync(
        process.execPath,
        [
          "scripts/database-snapshot.cjs",
          "restore",
          "--source",
          saved,
          "--out",
          restore,
        ],
        { cwd: root, encoding: "utf8" },
      );
      assert.equal(result.status, 0, result.stderr);
      assert.equal(JSON.parse(result.stdout).schemaVersion, 13);
      assert.deepEqual(bytes(saved), backupBytes);
      assert.deepEqual(bytes(previous13), sourceBytes);
      assert.equal(inspect(restore).schemaVersion, 13);
      const upgraded = platform.createStore(restore);
      try {
        assert.deepEqual(upgraded.runtimeHealth(), {
          ready: true,
          schemaVersion: 17,
        });
      } finally {
        upgraded.close();
      }
      const verify = new DatabaseSync(restore, { readOnly: true });
      try {
        for (const [table, rows] of protectedRows)
          assert.equal(
            JSON.stringify(
              verify
                .prepare("SELECT * FROM " + table + " ORDER BY rowid")
                .all(),
            ),
            rows,
            table,
          );
        assert.equal(
          verify.prepare("SELECT count(*) n FROM ai_http_requests").get().n,
          0,
        );
        assert.equal(
          verify.prepare("SELECT count(*) n FROM teaching_grade_events").get()
            .n,
          1,
        );
        const legacy = verify
          .prepare(
            "SELECT kind,actor_id,recorded_at,answers_digest FROM teaching_grade_events",
          )
          .get();
        assert.deepEqual(
          { ...legacy },
          {
            kind: "legacy_snapshot",
            actor_id: null,
            recorded_at: null,
            answers_digest: null,
          },
        );
        assert.equal(
          verify
            .prepare("SELECT attempt_no FROM teaching_assessment_windows")
            .get().attempt_no,
          1,
        );
      } finally {
        verify.close();
      }
      assert.deepEqual(bytes(previous13), sourceBytes);
      assert.deepEqual(bytes(saved), backupBytes);
      assert.equal(inspect(previous13).schemaVersion, 13);
    },
  );
  check(
    "A fake13 database retaining known migration14 receipt objects is rejected before inspect/backup/startup writes",
    () => {
      const out = disposable("disguised13"),
        backup = disposable("disguised13-must-not-exist");
      snapshot(previous13, out);
      edit(out, (d) =>
        d.exec(schema.migrations.find((m) => m.version === 14).sql),
      );
      assert.throws(
        () => inspect(out),
        /DATABASE_FUTURE_OBJECT:ai_http_requests/,
      );
      unchangedFailure(out, () => snapshot(out, backup));
      unchangedFailure(out, () => platform.createStore(out));
      assert.equal(fs.existsSync(backup), false);
    },
  );
  check(
    "Schema14 operator backup stays usable and does not migrate or seed the source",
    () => {
      const out = disposable("previous14"),
        d = new DatabaseSync(out);
      try {
        d.exec(
          "CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL)",
        );
        for (const m of schema.migrations.filter((m) => m.version <= 14)) {
          d.exec(m.sql);
          d.prepare("INSERT INTO schema_migrations VALUES(?,?)").run(
            m.version,
            stamp,
          );
        }
      } finally {
        d.close();
      }
      const before = bytes(out),
        dest = disposable("previous14-copy");
      assert.equal(inspect(out).schemaVersion, 14);
      assert.equal(snapshot(out, dest).schemaVersion, 14);
      assert.deepEqual(bytes(out), before);
      const upgraded = platform.createStore(dest);
      try {
        assert.deepEqual(upgraded.runtimeHealth(), {
          ready: true,
          schemaVersion: 17,
        });
      } finally {
        upgraded.close();
      }
    },
  );
  check(
    "Failed migration closes the DB and rolls back its schema/history before explicit retry",
    () => {
      const out = disposable("failed-migration"),
        d = new DatabaseSync(out);
      for (const m of schema.migrations.filter((m) => m.version <= 14)) {
        if (m.version === 1)
          d.exec(
            "CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL)",
          );
        d.exec(m.sql);
        d.prepare("INSERT INTO schema_migrations VALUES(?,?)").run(
          m.version,
          stamp,
        );
      }
      d.close();
      const invalid = loader((s) => ({
        ...s,
        migrations: s.migrations.map((m) =>
          m.version === 15
            ? { ...m, sql: m.sql + "\nSYNTHETIC_INVALID_SQL" }
            : m,
        ),
      }))("lib/server/store.ts");
      const close = DatabaseSync.prototype.close;
      let closed = 0;
      DatabaseSync.prototype.close = function (...args) {
        closed++;
        return close.apply(this, args);
      };
      try {
        assert.throws(() => invalid.createStore(out), /syntax/);
        assert.equal(closed, 1);
      } finally {
        DatabaseSync.prototype.close = close;
      }
      const verify = new DatabaseSync(out, { readOnly: true });
      try {
        assert.equal(
          verify.prepare("SELECT max(version) n FROM schema_migrations").get()
            .n,
          14,
        );
        assert.equal(
          verify
            .prepare(
              "SELECT count(*) n FROM sqlite_schema WHERE name='teaching_grade_events'",
            )
            .get().n,
          0,
        );
      } finally {
        verify.close();
      }
      const retry = platform.createStore(out);
      try {
        assert.equal(retry.runtimeHealth().schemaVersion, 17);
      } finally {
        retry.close();
      }
    },
  );
  check(
    "Deleting only migration16 cannot disguise known practice-window objects as genuine15",
    () => {
      const out = copy("disguised15");
      edit(out, (d) =>
        d.exec(
          "DROP TABLE ai_provider_attempts;DELETE FROM schema_migrations WHERE version>=16",
        ),
      );
      assert.throws(
        () => inspect(out),
        /DATABASE_FUTURE_OBJECT:teaching_assessment_windows/,
      );
      unchangedFailure(out, () => platform.createStore(out));
    },
  );
  check(
    "Genuine15 backup stays read-only, preserves its history guards, and upgrades only a separate copy",
    () => {
      const source = disposable("genuine15"),
        d = new DatabaseSync(source);
      d.exec(
        "CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL)",
      );
      for (const m of schema.migrations.filter((m) => m.version <= 15)) {
        d.exec(m.sql);
        d.prepare("INSERT INTO schema_migrations VALUES(?,?)").run(
          m.version,
          stamp,
        );
      }
      d.close();
      const before = bytes(source),
        out = disposable("genuine15-copy");
      assert.equal(inspect(source).schemaVersion, 15);
      assert.equal(snapshot(source, out).schemaVersion, 15);
      assert.deepEqual(bytes(source), before);
      const upgraded = platform.createStore(out);
      try {
        assert.equal(upgraded.runtimeHealth().schemaVersion, 17);
      } finally {
        upgraded.close();
      }
      const verify = new DatabaseSync(out, { readOnly: true });
      try {
        assert.equal(
          verify
            .prepare(
              "SELECT count(*) n FROM sqlite_schema WHERE type='trigger' AND name LIKE 'teaching_grade_events_no_%'",
            )
            .get().n,
          2,
        );
      } finally {
        verify.close();
      }
    },
  );
  check(
    "Genuine16 operator snapshot is read-only and only a restored copy gains an empty journal17",
    () => {
      const source = disposable("genuine16"),
        d = new DatabaseSync(source);
      d.exec(
        "CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL)",
      );
      for (const m of schema.migrations.filter((m) => m.version <= 16)) {
        d.exec(m.sql);
        d.prepare("INSERT INTO schema_migrations VALUES(?,?)").run(
          m.version,
          stamp,
        );
      }
      d.close();
      const before = bytes(source),
        out = disposable("genuine16-copy");
      assert.equal(inspect(source).schemaVersion, 16);
      assert.equal(snapshot(source, out).schemaVersion, 16);
      assert.deepEqual(bytes(source), before);
      const upgraded = platform.createStore(out);
      try {
        assert.equal(upgraded.runtimeHealth().schemaVersion, 17);
      } finally {
        upgraded.close();
      }
      const verify = new DatabaseSync(out, { readOnly: true });
      try {
        assert.equal(
          verify.prepare("SELECT count(*) n FROM ai_provider_attempts").get().n,
          0,
        );
      } finally {
        verify.close();
      }
      assert.deepEqual(bytes(source), before);
      assert.equal(inspect(source).schemaVersion, 16);
    },
  );
  check(
    "A fake16 retaining the known journal17 fails integrity/backup/startup without writes",
    () => {
      const out = copy("disguised16");
      edit(out, (d) =>
        d.exec("DELETE FROM schema_migrations WHERE version=17"),
      );
      assert.throws(
        () => inspect(out),
        /DATABASE_FUTURE_OBJECT:ai_provider_attempts/,
      );
      unchangedFailure(out, () => platform.createStore(out));
      const dest = disposable("disguised16-refused");
      unchangedFailure(out, () => snapshot(out, dest));
      assert.equal(fs.existsSync(dest), false);
    },
  );
  check(
    "Snapshot CLI uses Node24 shared contract without a development compiler or migrations",
    () => {
      const { spawnSync } = require("node:child_process"),
        result = spawnSync(
          process.execPath,
          ["scripts/database-snapshot.cjs", "inspect", "--source", backup],
          { cwd: root, encoding: "utf8" },
        );
      assert.equal(result.status, 0, result.stderr);
      assert.equal(JSON.parse(result.stdout).schemaVersion, 17);
    },
  );
  const report = {
    status: "PASS",
    checkedAt: new Date().toISOString(),
    passed: checks.length,
    checks,
    schemaVersion: 17,
    providerRequests: 0,
    scope:
      "Actual temporary SQLite and native Node24 CLI. Authored private synthetic grade/receipt/sync/ledger rows, real VACUUM snapshots and separate restore; no production DB, providers, off-host transfer or disaster recovery.",
    notTested: [
      "Actual Render host loss/recovery",
      "Off-host backup schedule and RPO/RTO",
      "Physical-device storage",
      "Provider invoice reconciliation",
    ],
  };
  fs.mkdirSync(path.join(root, "docs/v7/reports"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "docs/v7/reports/operations-integrity.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    "V7 operations integrity: " +
      checks.length +
      " checks passed; 0 provider requests.",
  );
} finally {
  db.close();
  store.close();
  fs.rmSync(folder, { recursive: true, force: true });
}
