const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");
const load = require("./v9-database-loader.cjs")();
const {
  normalizedTableSQL,
  normalizedGuardSQL,
  assertDatabaseIntegrity,
  DATABASE_GUARDS,
} = load("lib/server/database-integrity.ts");
const { createStore } = load("lib/server/store.ts");
let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log("PASS " + name);
}
check("SQLite not-equal aliases match only as complete operator tokens", () => {
  assert.equal(
    normalizedTableSQL("CREATE TABLE x(a,b,CHECK(a!=b))"),
    normalizedTableSQL("CREATE TABLE x(a,b,CHECK(a <> b))"),
  );
  for (const [a, b] of [
    ["CHECK(a!='!=')", "CHECK(a<>'<>')"],
    ['CHECK("!="!=a)', 'CHECK("<>"<>a)'],
    ["CHECK(a! =b)", "CHECK(a!=b)"],
    ["CHECK(a<b)", "CHECK(a<>b)"],
    ["CHECK(a=b)", "CHECK(a<>b)"],
  ])
    assert.notEqual(normalizedTableSQL(a), normalizedTableSQL(b));
});
check(
  "Actual SQLite retains equal non-equality and NULL semantics for both spellings",
  () => {
    const db = new DatabaseSync(":memory:");
    try {
      for (const [a, b] of [
        [1, 1],
        [1, 2],
        [null, 1],
        [null, null],
        ["a", "b"],
      ]) {
        const result = db
          .prepare("SELECT ? != ? AS first, ? <> ? AS second")
          .get(a, b, a, b);
        assert.equal(result.first, result.second);
      }
    } finally {
      db.close();
    }
  },
);
check(
  "Reformatted trigger tokens match while timing, WHEN, operation and literal changes remain distinct",
  () => {
    const guard = DATABASE_GUARDS[0].sql;
    assert.equal(
      normalizedGuardSQL(guard),
      normalizedGuardSQL(
        guard
          .replace("BEGIN SELECT", "BEGIN\nSELECT")
          .replace("RAISE(", "RAISE (")
          .replace(",'AUDIT_APPEND_ONLY'", ", 'AUDIT_APPEND_ONLY'")
          .replace("; END", ";\nEND"),
      ),
    );
    for (const altered of [
      guard.replace("BEFORE", "AFTER"),
      guard.replace("BEGIN", "WHEN 0 BEGIN"),
      guard.replace("DELETE", "UPDATE"),
      guard.replace("ABORT", "IGNORE"),
      guard.replace("AUDIT_APPEND_ONLY", "audit_append_only"),
      guard + "; SELECT 1",
    ])
      assert.notEqual(normalizedGuardSQL(guard), normalizedGuardSQL(altered));
  },
);
check(
  "Full schema integrity permits an equivalent rewritten CHECK and rejects a weakened CHECK",
  () => {
    const db = new DatabaseSync(":memory:");
    const store = createStore(":injected:", { database: db });
    function view(operator) {
      return {
        prepare(sql) {
          const statement = db.prepare(sql);
          return {
            all(...args) {
              return statement
                .all(...args)
                .map((row) =>
                  row.name === "teaching_assessment_windows"
                    ? {
                        ...row,
                        sql: row.sql.replace(
                          "root_assignment_id!=assignment_id",
                          "root_assignment_id" + operator + "assignment_id",
                        ),
                      }
                    : row,
                );
            },
            get: (...args) => statement.get(...args),
          };
        },
      };
    }
    try {
      assert.deepEqual(assertDatabaseIntegrity(view("<>")), {
        schemaVersion: 18,
        guardsChecked: 6,
      });
      assert.throws(
        () => assertDatabaseIntegrity(view("=")),
        /DATABASE_TABLE_INVALID:teaching_assessment_windows/,
      );
      assert.throws(
        () => assertDatabaseIntegrity(view("<")),
        /DATABASE_TABLE_INVALID:teaching_assessment_windows/,
      );
    } finally {
      store.close();
    }
  },
);
check(
  "Full integrity retains all six immutable guard checks after equivalent remote formatting",
  () => {
    const db = new DatabaseSync(":memory:");
    const store = createStore(":injected:", { database: db });
    function view(weaken) {
      return {
        prepare(sql) {
          const s = db.prepare(sql);
          return {
            all(...args) {
              return s
                .all(...args)
                .map((row) =>
                  row.type === "trigger"
                    ? {
                        ...row,
                        sql:
                          row.sql
                            .replace("BEGIN SELECT", "BEGIN\nSELECT")
                            .replace("RAISE(", "RAISE (") +
                          (weaken && row.name === "audit_no_delete"
                            ? " WHEN 0"
                            : ""),
                      }
                    : row,
                );
            },
            get: (...args) => s.get(...args),
          };
        },
      };
    }
    try {
      assert.deepEqual(assertDatabaseIntegrity(view(false)), {
        schemaVersion: 18,
        guardsChecked: 6,
      });
      assert.throws(
        () => assertDatabaseIntegrity(view(true)),
        /DATABASE_GUARD_INVALID:audit_no_delete/,
      );
    } finally {
      store.close();
    }
  },
);
console.log(
  JSON.stringify({
    status: "PASS",
    passed,
    scope:
      "Local token-boundary and SQLite schema-integrity regression; no remote credentials or service calls",
  }),
);
