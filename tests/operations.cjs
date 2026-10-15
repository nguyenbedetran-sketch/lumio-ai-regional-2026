const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  ts = require("typescript"),
  { DatabaseSync } = require("node:sqlite");
const root = path.resolve(__dirname, ".."),
  cache = new Map();
function load(relative) {
  const file = path.resolve(root, relative);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      resolveJsonModule: true,
      esModuleInterop: true,
    },
  }).outputText;
  new Function("require", "module", "exports", code)(
    (name) =>
      name.endsWith(".json")
        ? require(path.resolve(path.dirname(file), name))
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
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "lumio-ops-")),
  file = path.join(folder, "active.sqlite");
const platform = load("lib/server/store.ts"),
  store = platform.createStore(file),
  { snapshot, inspect } = require("../scripts/database-snapshot.cjs");
let passed = 0;
const check = (name, fn) => {
  fn();
  passed++;
  console.log("PASS " + name);
};
const user = store.ensureIdentity({
  provider: "google",
  providerAccountId: "backup-synthetic",
  name: "Synthetic fixture",
  emailVerified: false,
});
check(
  "Readiness queries current schema and required tables without provider calls",
  () => {
    assert.deepEqual(store.runtimeHealth(), { ready: true, schemaVersion: 11 });
  },
);
const backup = path.join(folder, "backup.sqlite"),
  restored = path.join(folder, "restored.sqlite");
check(
  "Read-only source backup includes committed WAL data and verifies checksum/integrity",
  () => {
    const result = snapshot(file, backup);
    assert.equal(result.schemaVersion, 11);
    assert.equal(result.integrity, "ok");
    assert.match(result.sha256, /^[a-f0-9]{64}$/);
    const copy = platform.createStore(backup);
    assert.equal(copy.getUser(user.id).storageKey, user.storageKey);
    copy.close();
  },
);
check(
  "Restore writes a separate verified database without changing the active database",
  () => {
    snapshot(backup, restored);
    assert.equal(inspect(restored).integrity, "ok");
    const copy = platform.createStore(restored);
    assert.equal(copy.getUser(user.id).name, "Synthetic fixture");
    copy.close();
    assert.equal(store.getUser(user.id).name, "Synthetic fixture");
  },
);
check(
  "Operator helper refuses overwriting source/backup and publicly served destinations",
  () => {
    assert.throws(() => snapshot(file, file), /DESTINATION_MUST_BE_NEW/);
    assert.throws(() => snapshot(file, backup), /DESTINATION_MUST_BE_NEW/);
    assert.throws(
      () => snapshot(file, path.join(root, "public", "unsafe-test.sqlite")),
      /PUBLIC_DESTINATION_FORBIDDEN/,
    );
  },
);
check("Corrupt, missing and unsupported-schema databases fail closed", () => {
  const corrupt = path.join(folder, "corrupt.sqlite");
  fs.writeFileSync(corrupt, "invalid sqlite");
  assert.throws(() => inspect(corrupt));
  assert.throws(() => inspect(path.join(folder, "missing.sqlite")));
  const newer = path.join(folder, "unsupported.sqlite"),
    db = new DatabaseSync(newer);
  db.exec(
    "CREATE TABLE schema_migrations(version INTEGER); INSERT INTO schema_migrations VALUES(999)",
  );
  db.close();
  assert.throws(() => inspect(newer), /SCHEMA_NOT_SUPPORTED/);
});
check(
  "Readiness detects missing required tables instead of reporting a healthy process",
  () => {
    const broken = platform.createStore(path.join(folder, "broken.sqlite")),
      db = new DatabaseSync(path.join(folder, "broken.sqlite"));
    db.exec("DROP TABLE summary_job_parts; DROP TABLE summary_jobs");
    db.close();
    assert.throws(() => broken.runtimeHealth());
    broken.close();
  },
);
check(
  "Readiness rejects a missing retrieval snapshot table even when migration 11 remains recorded",
  () => {
    const filename = path.join(folder, "missing-rag.sqlite"),
      broken = platform.createStore(filename),
      db = new DatabaseSync(filename);
    db.exec("DROP TABLE rag_snapshots");
    assert.equal(
      db.prepare("SELECT max(version) version FROM schema_migrations").get()
        .version,
      11,
    );
    db.close();
    assert.throws(() => broken.runtimeHealth(), /no such table: rag_snapshots/);
    assert.throws(() => inspect(filename), /no such table: rag_snapshots/);
    broken.close();
  },
);
const { normalizeSyncEnvelope, MAX_SYNC_BYTES } = load("lib/sync/contracts.ts");
const stamp = "2026-10-15T07:00:00.000Z";
function syncFixture(count, url, text = "Authored source.") {
  return {
    version: 1,
    library: {
      version: 1,
      spaces: [],
      items: Array.from({ length: count }, (_, index) => ({
        id: "synthetic-url-" + index,
        title: "Synthetic source",
        kind: "link",
        spaceId: "",
        createdAt: stamp,
        updatedAt: stamp,
        text,
        notes: "",
        cards: [],
        questions: [],
        attempts: [],
        favorite: false,
        url,
      })),
    },
    learning: { version: 1, tasks: [], reviews: [], events: [], focus: null },
    preferences: { version: 1, enabled: true, feedback: [] },
  };
}
check(
  "Sync rejects canonical Unicode URLs that would poison subsequent reads and keeps bounded URLs idempotent",
  () => {
    const prefix = "https://example.com/",
      vietnamese = "ắ";
    assert.throws(
      () =>
        normalizeSyncEnvelope(syncFixture(1, prefix + vietnamese.repeat(2000))),
      /INVALID_BACKUP/,
    );
    const normalized = normalizeSyncEnvelope(
      syncFixture(1, prefix + vietnamese.repeat(20)),
    );
    assert.deepEqual(normalizeSyncEnvelope(normalized), normalized);
  },
);
check(
  "Sync applies the two MiB cap to the canonical stored payload after Unicode expansion",
  () => {
    const input = syncFixture(
      100,
      "https://example.com/" + "ắ".repeat(300),
      "x".repeat(18500),
    );
    assert.ok(Buffer.byteLength(JSON.stringify(input)) < MAX_SYNC_BYTES);
    assert.throws(() => normalizeSyncEnvelope(input), /SYNC_TOO_LARGE/);
  },
);
store.close();
console.log(
  `Operations: ${passed} checks passed; actual isolated SQLite backup/restore, no provider calls.`,
);
